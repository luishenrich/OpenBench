import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import Leaderboard from '@/components/Leaderboard'
import ParetoChart from '@/components/ParetoChart'
import ResultsViewer from '@/components/ResultsViewer'
import { Badge, Button, ErrorNote, Panel, Section, StatusPill } from '@/components/ui'
import RunSkeleton from '@/components/run/RunSkeleton'
import { Line } from '@/components/Skeleton'
import VerdictCard from '@/components/VerdictCard'
import { api } from '@/lib/api'
import { ago, effortOf } from '@/lib/format'
import { runVerdict } from '@/lib/verdict'
import type { Run } from '@/types'
import { EffortChip, isReference, juryNames, prettyModel, rowEffort } from '@/components/run/ModelName'
import { hasJudgeMetric } from '@/components/usecase/readiness'
import RunFacts, { runPhase } from '@/components/run/RunFacts'
import { LiveDot } from '@/components/usecases/live'
import QualityNote, { qualityNote } from '@/components/run/QualityNote'

const TERMINAL = new Set(['done', 'failed', 'cancelled'])

export default function RunPage() {
  const { id = '' } = useParams()
  const qc = useQueryClient()
  // The dashboard polls the run every 2 s until it reaches a terminal status (contract/api.md).
  const run = useQuery({
    queryKey: ['run', id],
    queryFn: () => api.run(id),
    refetchInterval: (q) => (q.state.data && TERMINAL.has(q.state.data.status) ? false : 2000),
  })
  const uc = useQuery({ queryKey: ['use-case', run.data?.use_case_id], queryFn: () => api.useCase(run.data!.use_case_id), enabled: !!run.data })
  const metrics = useQuery({ queryKey: ['metrics'], queryFn: api.metrics })
  const me = useQuery({ queryKey: ['me'], queryFn: api.me })
  const cancel = useMutation({
    mutationFn: () => api.cancelRun(id),
    onSuccess: (r: Run) => qc.setQueryData(['run', id], r),
  })

  if (run.isLoading) return <RunSkeleton />
  if (run.error) return <ErrorNote error={run.error} />
  const r = run.data!
  const live = !TERMINAL.has(r.status)
  const verdict = runVerdict(r)
  const reference = r.leaderboard.find((c) => c.candidate_key === r.recommendation?.reference_key)
  const refRows = r.leaderboard.filter(isReference)
  // references as run (incl. "today"); while the leaderboard is empty, fall back to the request
  const refs = refRows.length
    ? refRows.map((c) => ({ key: c.candidate_key, name: c.reference_label === 'today' ? `${prettyModel(c.model)} (today)` : c.reference_label ?? prettyModel(c.model), effort: rowEffort(c) }))
    : (r.references ?? []).map((m) => ({ key: `${m.provider}:${m.model}`, name: prettyModel(m.model), effort: effortOf(m.model, m.params) }))
  const judged = uc.data ? hasJudgeMetric(uc.data) : false
  const jury = judged ? juryNames(uc.data, me.data?.workspace.default_judge) : null
  const efforts = Object.fromEntries(r.leaderboard.map((c) => [c.candidate_key, rowEffort(c)]))
  // On "keep", the recommendation names the closest challenger, not a pick: nothing is highlighted as the choice.
  const pickKey = verdict === 'keep' ? null : r.recommendation?.candidate_key ?? null
  const closestKey = verdict === 'keep' ? r.recommendation?.candidate_key ?? null : null
  const note = !live ? qualityNote(r, uc.data, metrics.data ?? []) : null
  // Points the chart can draw: a cost per success, and (while live) a quality the jury has actually scored.
  const scored = new Set(r.leaderboard.filter((c) => c.quality.n > 0).map((c) => c.candidate_key))
  const points = r.pareto_points.filter((pt) => pt.cost_per_success_usd != null && pt.cost_per_success_usd > 0 && (!live || scored.has(pt.candidate_key)))

  return (
    <div className="space-y-14">
      <div>
        {/* the app header carries the breadcrumb (project / use case / run); the row keeps the Cancel button's height so it doesn't jump when the run ends */}
        <div className="flex min-h-[38px] flex-wrap items-center gap-3">
          <Badge tone={live ? 'signal' : r.status === 'done' ? 'win' : 'bad'}>Benchmark run</Badge>
          <StatusPill status={r.status} />
          {live && <Button variant="danger" className="ml-auto" onClick={() => cancel.mutate()} disabled={cancel.isPending}>Cancel run</Button>}
        </div>
        {uc.data && <h1 className="display mt-3 text-3xl text-balance sm:text-4xl">{uc.data.name}</h1>}
        {uc.isLoading && <Line lh="mt-3 h-[30px] sm:h-10" bar="h-[60%]" className="w-[340px] max-w-full" />}
        <p className="mt-3 text-muted">
          {r.candidates.length} open-weight {r.candidates.length === 1 ? 'candidate' : 'candidates'}, {r.repeats} repeats per case
          {r.finished_at && `, finished ${ago(r.finished_at)}`}
        </p>
        {(refs.length > 0 || jury) && (
          <dl className="mt-4 flex flex-wrap gap-x-8 gap-y-3 text-sm">
            {refs.length > 0 && (
              <div>
                <dt className="text-xs text-faint">Closed references, never ranked</dt>
                <dd className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-muted">
                  {refs.map((x) => <span key={x.key} className="inline-flex items-center gap-1.5">{x.name}<EffortChip effort={x.effort} /></span>)}
                </dd>
              </div>
            )}
            {jury && (
              <div>
                <dt className="text-xs text-faint">Judged by</dt>
                <dd className="mt-1 text-muted">
                  {jury}
                </dd>
              </div>
            )}
          </dl>
        )}

        <RunFacts run={r} />
        {live && <p className="mt-3 text-sm text-faint">The leaderboard fills in as results arrive. The verdict comes when every call is scored.</p>}
        {/* a finished run can carry a notice (e.g. stopped at the confirmed cost): results are kept, so not an error */}
        {r.error && (r.status === 'done'
          ? <p className="mt-4 rounded-lg border border-line bg-panel px-4 py-3 text-sm text-muted">{r.error}</p>
          : <div className="mt-4"><ErrorNote error={r.error} /></div>)}
      </div>

      {(note || (r.recommendation && verdict)) && (
        <div className="space-y-4">
          {note && <QualityNote text={note} />}
          {r.recommendation && verdict && (
        <VerdictCard
          rec={r.recommendation} verdict={verdict} reference={reference} judgedBy={jury}
          pick={r.leaderboard.find((c) => c.candidate_key === r.recommendation!.candidate_key)}
        />
          )}
        </div>
      )}

      {(points.length > 0 || live) && (
        <Section title="Quality against cost" aside="Coral staircase: the Pareto front of open-weight candidates. Grey dashed rings: closed references.">
          <Panel className="p-4">
            {points.length > 0
              ? <ParetoChart points={points} recommended={pickKey} efforts={efforts} />
              : (
                <div className="flex h-[360px] flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-line text-center">
                  <p className="flex items-center gap-2 text-sm text-muted"><LiveDot small />Points appear once answers are scored · {runPhase(r).text.charAt(0).toLowerCase() + runPhase(r).text.slice(1)}</p>
                  <p className="text-xs text-faint">Quality comes from the metrics and the jury, so a model has no point until its answers are scored.</p>
                </div>
              )}
          </Panel>
        </Section>
      )}

      <Section title="Leaderboard" aside="Open-weight candidates only. Gates first, then the Pareto front, then your weights.">
        {r.leaderboard.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line-strong px-5 py-8 text-sm text-muted">Waiting for the first results.</p>
        ) : (
          <Leaderboard rows={r.leaderboard} metrics={metrics.data ?? []} recommended={pickKey} closest={closestKey} running={live}
            order={r.candidates.map((m) => `${m.provider}:${m.model}`)} />
        )}
      </Section>

      {r.leaderboard.length > 0 && (
        <Section title="Outputs per case" aside="One case at a time: every model and repeat. Click a tile for the full answer.">
          <ResultsViewer runId={r.id} useCaseId={r.use_case_id} candidates={r.leaderboard} pickKey={pickKey} repeats={r.repeats} metricSpecs={uc.data?.metrics} />
        </Section>
      )}
    </div>
  )
}
