import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import Leaderboard from '@/components/Leaderboard'
import ParetoChart from '@/components/ParetoChart'
import RecommendationCard from '@/components/RecommendationCard'
import ResultsViewer from '@/components/ResultsViewer'
import { Button, ErrorNote, Loading, Panel, Section, StatusPill } from '@/components/ui'
import { api } from '@/lib/api'
import { ago, shortModel, usd } from '@/lib/format'
import type { Run } from '@/types'

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
  const cancel = useMutation({
    mutationFn: () => api.cancelRun(id),
    onSuccess: (r: Run) => qc.setQueryData(['run', id], r),
  })

  if (run.isLoading) return <Loading label="Loading run" />
  if (run.error) return <ErrorNote error={run.error} />
  const r = run.data!
  const live = !TERMINAL.has(r.status)
  const p = r.progress
  const frac = p.total ? p.done / p.total : 0
  const baseline = r.leaderboard.find((c) => c.is_baseline)

  return (
    <div className="space-y-10">
      <div>
        {uc.data && <Link to={`/use-cases/${uc.data.id}`} className="text-sm text-muted hover:text-ink">{uc.data.name}</Link>}
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-semibold tracking-tight">Benchmark run</h1>
          <StatusPill status={r.status} />
          <span className="text-sm text-muted">
            {r.candidates.length} models, {r.repeats} repeats, {live ? `est. ${usd(r.est_cost_usd)}` : `${usd(r.actual_cost_usd)} spent`}
            {r.finished_at && `, finished ${ago(r.finished_at)}`}
          </span>
          {live && <Button variant="danger" className="ml-auto" onClick={() => cancel.mutate()} disabled={cancel.isPending}>Cancel run</Button>}
        </div>

        {live && (
          <div className="mt-5">
            <div className="h-2 overflow-hidden rounded-full bg-rule">
              <div className="h-full rounded-full bg-accent transition-[width] duration-700" style={{ width: `${frac * 100}%` }} />
            </div>
            <div className="mt-2 flex flex-wrap gap-x-5 text-sm text-muted">
              <span><span className="font-medium text-ink">{p.done.toLocaleString()}</span> of {p.total.toLocaleString()} calls</span>
              {p.errors > 0 && <span className="text-bad">{p.errors} errors</span>}
              {p.judge_total > 0 && <span>{p.judged} of {p.judge_total} judged</span>}
              <span>The leaderboard fills in as results arrive. The recommendation comes when every call is scored.</span>
            </div>
          </div>
        )}
        {r.error && <div className="mt-4"><ErrorNote error={r.error} /></div>}
      </div>

      {r.recommendation && <RecommendationCard rec={r.recommendation} baselineName={baseline ? shortModel(baseline.model) : null} />}

      {r.pareto_points.length > 0 && (
        <Section title="Quality against cost" aside={<span className="text-sm text-muted">Green points are on the Pareto front: nothing else is both better and cheaper.</span>}>
          <Panel className="p-4">
            <ParetoChart points={r.pareto_points} recommended={r.recommendation?.candidate_key ?? null} />
          </Panel>
        </Section>
      )}

      <Section title="Leaderboard" aside={<span className="text-sm text-muted">Ranked by gates, then the Pareto front, then your weights.</span>}>
        {r.leaderboard.length === 0 ? (
          <p className="rounded-lg border border-dashed border-rule px-5 py-8 text-sm text-muted">Waiting for the first results.</p>
        ) : (
          <Leaderboard rows={r.leaderboard} metrics={metrics.data ?? []} recommended={r.recommendation?.candidate_key ?? null} running={live} />
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
