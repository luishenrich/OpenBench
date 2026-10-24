import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import Leaderboard from '@/components/Leaderboard'
import ParetoChart from '@/components/ParetoChart'
import ResultsViewer from '@/components/ResultsViewer'
import { Badge, Button, ErrorNote, Panel, Section, StatusPill } from '@/components/ui'
import RunSkeleton from '@/components/run/RunSkeleton'
import { Line, Skeleton } from '@/components/Skeleton'
import VerdictCard from '@/components/VerdictCard'
import { api } from '@/lib/api'
import { ago, effortOf, pct, usd } from '@/lib/format'
import { runVerdict } from '@/lib/verdict'
import type { Run } from '@/types'
import { EffortChip, isReference, juryNames, prettyModel, rowEffort } from '@/components/run/ModelName'
import { hasJudgeMetric } from '@/components/usecase/readiness'

const TERMINAL = new Set(['done', 'failed', 'cancelled'])

// 40 ticks, filled as calls complete: the progress bar reads like a ruler.
function ProgressRuler({ frac }: { frac: number }) {
  const n = 40
  const filled = Math.round(frac * n)
  return (
    <div className="flex h-6 items-end gap-[3px]" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(frac * 100)}>
      {Array.from({ length: n }, (_, i) => (
        <span key={i} className={`flex-1 rounded-[1px] transition-colors duration-500 ${i < filled ? 'bg-front' : 'bg-line'} ${i % 10 === 0 ? 'h-6' : 'h-4'}`} />
      ))}
    </div>
  )
}

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
  const p = r.progress
  const frac = p.total ? p.done / p.total : 0
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

  return (
    <div className="space-y-14">
      <div>
        {uc.data && <Link to={`/use-cases/${uc.data.id}`} className="rounded-md border border-line bg-panel px-2.5 py-1 text-xs text-muted hover:text-fg">{uc.data.name}</Link>}
        {uc.isLoading && <Skeleton className="h-[26px] w-[136px] rounded-md" />}
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Badge tone={live ? 'signal' : r.status === 'done' ? 'win' : 'bad'}>Benchmark run</Badge>
          <StatusPill status={r.status} />
          {live && <Button variant="danger" className="ml-auto" onClick={() => cancel.mutate()} disabled={cancel.isPending}>Cancel run</Button>}
        </div>
        {uc.data && <h1 className="display mt-3 text-3xl text-balance sm:text-4xl">{uc.data.name}</h1>}
        {uc.isLoading && <Line lh="mt-3 h-[30px] sm:h-10" bar="h-[60%]" className="w-[340px] max-w-full" />}
        <p className="mt-3 text-muted">
          {r.candidates.length} open-weight {r.candidates.length === 1 ? 'candidate' : 'candidates'}, {r.repeats} repeats per case, {live ? `estimated ${usd(r.est_cost_usd)}` : `${usd(r.actual_cost_usd)} spent`}
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
                  {r.judge_agreement != null && <span className="ml-2 text-faint">· jurors agree on {pct(r.judge_agreement, 0)}</span>}
                </dd>
              </div>
            )}
          </dl>
        )}

        {live && (
          <div className="mt-8">
            <div className="flex items-baseline justify-between gap-4">
              <span className="display text-5xl">{Math.round(frac * 100)}%</span>
              <span className="text-sm text-muted">{p.done.toLocaleString()} of {p.total.toLocaleString()} calls{p.errors > 0 && <span className="text-bad">, {p.errors} {p.errors === 1 ? 'error' : 'errors'}</span>}</span>
            </div>
            <div className="mt-3"><ProgressRuler frac={frac} /></div>
            <p className="mt-3 text-sm text-faint">
              {p.judge_total > 0 && `${p.judged} of ${p.judge_total} judged. `}The leaderboard fills in as results arrive. The verdict comes when every call is scored.
            </p>
          </div>
        )}
        {r.error && <div className="mt-4"><ErrorNote error={r.error} /></div>}
      </div>

      {r.recommendation && verdict && (
        <VerdictCard
          rec={r.recommendation} verdict={verdict} reference={reference} judgedBy={jury}
          pick={r.leaderboard.find((c) => c.candidate_key === r.recommendation!.candidate_key)}
        />
      )}

      {r.pareto_points.length > 0 && (
        <Section title="Quality against cost" aside="Coral staircase: the Pareto front of open-weight candidates. Grey dashed rings: closed references.">
          <Panel className="p-4">
            <ParetoChart points={r.pareto_points} recommended={pickKey} efforts={efforts} />
          </Panel>
        </Section>
      )}

      <Section title="Leaderboard" aside="Open-weight candidates only. Gates first, then the Pareto front, then your weights.">
        {r.leaderboard.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line-strong px-5 py-8 text-sm text-muted">Waiting for the first results.</p>
        ) : (
          <Leaderboard rows={r.leaderboard} metrics={metrics.data ?? []} recommended={pickKey} closest={closestKey} running={live} />
        )}
      </Section>

      {r.leaderboard.length > 0 && (
        <Section title="Outputs per case">
          <ResultsViewer runId={r.id} candidates={r.leaderboard} />
        </Section>
      )}
    </div>
  )
}
