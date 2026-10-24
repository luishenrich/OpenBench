// The latest run as a short verdict card (Overview tab) and the list of past runs (Runs tab).
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Line, LoadingRegion, Skeleton } from '@/components/Skeleton'
import { Badge, Panel, StatusPill } from '@/components/ui'
import VerdictCard from '@/components/VerdictCard'
import { focusRing } from '@/components/usecases/kit'
import { api } from '@/lib/api'
import { ago, ms, usd } from '@/lib/format'
import { briefVerdict, runVerdict } from '@/lib/verdict'
import type { Run, RunBrief } from '@/types'

const TERMINAL = new Set(['done', 'failed', 'cancelled'])
const verdictTone = { switch: 'win', use: 'front', keep: 'muted' } as const
const verdictWord = { switch: 'Switch', use: 'Use', keep: 'Keep' } as const
const linkCls = `inline-flex items-center gap-1 rounded-sm text-sm text-muted underline-offset-4 hover:text-fg hover:underline ${focusRing}`

function Fig({ value, label, tone }: { value: string; label: string; tone?: 'good' | 'bad' }) {
  return (
    <div className="min-w-0 border-l border-line pl-3">
      <div className={`title text-xl whitespace-nowrap tabular-nums ${tone === 'good' ? 'text-win' : tone === 'bad' ? 'text-bad' : 'text-fg'}`}>{value}</div>
      <div className="mt-0.5 truncate text-xs text-muted">{label}</div>
    </div>
  )
}

function figuresOf(run: Run, keep: boolean): { value: string; label: string; tone?: 'good' | 'bad' }[] {
  const rec = run.recommendation
  if (!rec) return []
  const out: { value: string; label: string; tone?: 'good' | 'bad' }[] = []
  const q = rec.quality_vs_reference_pct
  if (q != null) out.push({ value: `${q.toFixed(q > 99.5 && q < 100.5 ? 1 : 0)}%`, label: 'quality vs reference', tone: keep ? undefined : q >= 99 ? 'good' : q < 95 ? 'bad' : undefined })
  const cx = rec.cost_multiple_vs_reference
  if (cx != null && cx > 0) out.push({ value: cx < 1 ? `${(1 / cx).toFixed(1)}× cheaper` : `${cx.toFixed(1)}× the cost`, label: 'per call', tone: keep ? undefined : cx < 1 ? 'good' : 'bad' })
  const lat = rec.latency_delta_ms
  if (lat != null) out.push({ value: `${lat <= 0 ? '−' : '+'}${ms(Math.abs(lat))}`, label: 'p95 latency', tone: keep ? undefined : lat <= 0 ? 'good' : 'bad' })
  if (!keep && rec.est_monthly_savings_usd != null) out.push({ value: usd(rec.est_monthly_savings_usd), label: 'saved per month', tone: 'good' })
  return out
}

/** Overview: what the last benchmark said, in a few lines, with a link to the full run. */
export function LatestRun({ brief }: { brief: RunBrief | null }) {
  const run = useQuery({
    queryKey: ['run', brief?.id],
    queryFn: () => api.run(brief!.id),
    enabled: !!brief,
    // same polling as the run page while it is still going
    refetchInterval: (q) => (q.state.data && TERMINAL.has(q.state.data.status) ? false : 2000),
  })

  if (!brief) {
    return (
      <Panel className="p-5">
        <Badge>Latest run</Badge>
        <p className="title mt-4 text-lg">No benchmark yet</p>
        <p className="mt-1 max-w-xl text-sm text-muted">Estimate the cost in Benchmark models, then start a run. The verdict lands here.</p>
      </Panel>
    )
  }

  const r = run.data
  const live = !TERMINAL.has(brief.status)
  const v = briefVerdict(brief) ?? (r ? runVerdict(r) : null)
  const figs = r && brief.status === 'done' ? figuresOf(r, v === 'keep') : []
  const frac = r && r.progress.total ? r.progress.done / r.progress.total : null

  // a finished run with a recommendation gets the same verdict card as the run page
  const full = r && r.status === 'done' && r.recommendation ? runVerdict(r) : null
  if (r && full && r.recommendation) {
    return (
      <div>
        <VerdictCard
          rec={r.recommendation} verdict={full}
          reference={r.leaderboard.find((c) => c.candidate_key === r.recommendation?.reference_key)}
          pick={r.leaderboard.find((c) => c.candidate_key === r.recommendation!.candidate_key)}
        />
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 px-1">
          <span className="text-xs text-faint">
            {r.candidates.length} open-weight {r.candidates.length === 1 ? 'candidate' : 'candidates'}, {r.repeats} repeats, {usd(r.actual_cost_usd)} spent{brief.finished_at ? `, finished ${ago(brief.finished_at)}` : ''}
          </span>
          <Link to={`/runs/${brief.id}`} className={linkCls}>Open the run <span aria-hidden>→</span></Link>
        </div>
      </div>
    )
  }

  return (
    <Panel className="p-5">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={v ? verdictTone[v] : live ? 'signal' : brief.status === 'done' ? 'win' : 'bad'}>{v ? `Latest run · ${verdictWord[v]}` : 'Latest run'}</Badge>
        <StatusPill status={brief.status} />
        <span className="ml-auto text-xs text-faint">{brief.finished_at ? `finished ${ago(brief.finished_at)}` : live ? 'in progress' : ''}</span>
      </div>

      {brief.recommendation_headline ? (
        <p className={`title mt-4 text-xl leading-snug text-balance ${v === 'keep' ? 'text-muted' : 'text-fg'}`}>{brief.recommendation_headline}</p>
      ) : live ? (
        <p className="title mt-4 text-lg">Benchmark running{frac != null && <span className="text-muted"> · {Math.round(frac * 100)}%</span>}</p>
      ) : (
        <p className="title mt-4 text-lg">{brief.status === 'failed' ? 'The run failed' : 'The run was cancelled'}</p>
      )}
      {r?.error && <p className="mt-1 text-sm text-bad">{r.error}</p>}

      {brief.status === 'done' && run.isLoading && (
        <LoadingRegion label="Loading run figures" className="mt-5 grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="border-l border-line pl-3"><Line lh="h-7" bar="h-4" className="w-16" /><Line lh="mt-0.5 h-4" bar="h-2" className="w-24" /></div>
          ))}
        </LoadingRegion>
      )}
      {figs.length > 0 && (
        <div className="mt-5 grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-4">
          {figs.map((f) => <Fig key={f.label} {...f} />)}
        </div>
      )}

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
        <span className="text-xs text-faint">
          {r ? `${r.candidates.length} open-weight ${r.candidates.length === 1 ? 'candidate' : 'candidates'}, ${r.repeats} repeats, ${live ? `estimated ${usd(r.est_cost_usd)}` : `${usd(r.actual_cost_usd)} spent`}` : ' '}
        </span>
        <Link to={`/runs/${brief.id}`} className={linkCls}>{live ? 'Watch the run' : 'Open the run'} <span aria-hidden>→</span></Link>
      </div>
    </Panel>
  )
}

/** Runs tab: every run of this use case, newest first. */
export function RunsList({ runs, loading, onStart }: { runs: RunBrief[] | undefined; loading: boolean; onStart: () => void }) {
  if (loading) return <RunsSkeleton />
  if (!runs?.length) {
    return (
      <div className="rounded-xl border border-dashed border-line-strong px-5 py-8">
        <p className="title">No runs yet</p>
        <p className="mt-1 text-sm text-muted">
          Start one from <button type="button" onClick={onStart} className={`text-fg underline underline-offset-4 ${focusRing}`}>Overview</button>: you see the cost before anything runs.
        </p>
      </div>
    )
  }
  return (
    <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line">
      {runs.map((r) => {
        const v = briefVerdict(r)
        return (
          <li key={r.id}>
            <Link to={`/runs/${r.id}`} className={`grid grid-cols-[88px_minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 bg-panel px-4 py-3.5 transition-colors hover:bg-raised sm:grid-cols-[88px_minmax(0,1fr)_120px_96px_16px] ${focusRing}`}>
              <span><StatusPill status={r.status} /></span>
              <span className={`min-w-0 truncate text-sm ${v === 'keep' ? 'text-muted' : 'text-fg'}`} title={r.recommendation_headline ?? undefined}>
                {r.recommendation_headline ?? <span className="text-muted">{r.status === 'done' ? 'No recommendation' : 'Benchmark in progress'}</span>}
              </span>
              <span className="hidden text-right text-sm text-win sm:block">{r.est_monthly_savings_usd ? `~${usd(r.est_monthly_savings_usd)}/mo` : ''}</span>
              <span className="text-right text-xs text-faint">{r.finished_at ? ago(r.finished_at) : '–'}</span>
              <span className="hidden text-faint sm:block" aria-hidden>→</span>
            </Link>
          </li>
        )
      })}
    </ul>
  )
}

export function RunsSkeleton({ n = 2 }: { n?: number }) {
  return (
    <LoadingRegion label="Loading runs">
      <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line" aria-hidden>
        {Array.from({ length: n }, (_, i) => (
          <li key={i} className="grid grid-cols-[88px_minmax(0,1fr)_auto] items-center gap-x-4 bg-panel px-4 py-3.5 sm:grid-cols-[88px_minmax(0,1fr)_120px_96px_16px]">
            <Skeleton className="h-[22px] w-14 rounded-md" />
            <Line lh="h-5" bar="h-2.5" className={i ? 'w-[45%]' : 'w-[70%]'} />
            <Skeleton className="ml-auto hidden h-2.5 w-16 sm:block" />
            <Skeleton className="ml-auto h-2 w-10" />
            <span className="hidden sm:block" />
          </li>
        ))}
      </ul>
    </LoadingRegion>
  )
}
