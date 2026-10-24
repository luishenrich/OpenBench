import { ms, num, pct, shortModel, usd } from '@/lib/format'
import type { CandidateResult, MetricInfo } from '@/types'
import { Tag } from './ui'

// A forest plot: one lane per model on a shared quality axis. The band is the 95% CI, the tick is the mean,
// the dashed line is today's model. Overlapping bands mean the difference is not significant.

const COLS = 'grid-cols-[28px_minmax(180px,240px)_minmax(260px,1fr)_84px_84px_60px]'

function axis(rows: CandidateResult[]) {
  const lo = Math.min(...rows.map((r) => r.quality.ci_low))
  const hi = Math.max(...rows.map((r) => r.quality.ci_high))
  const min = Math.max(0, Math.floor((lo - 0.01) * 50) / 50)
  const max = Math.min(1, Math.ceil((hi + 0.01) * 50) / 50)
  const span = max - min || 1
  const step = span > 0.3 ? 0.1 : span > 0.12 ? 0.05 : 0.02
  const ticks: number[] = []
  for (let t = Math.ceil(min / step) * step; t <= max + 1e-9; t += step) ticks.push(+t.toFixed(3))
  return { min, max, x: (v: number) => ((v - min) / span) * 100, ticks }
}

function Lane({ r, x, baseX, recommended, running }: {
  r: CandidateResult; x: (v: number) => number; baseX: number | null; recommended: boolean; running: boolean
}) {
  const color = recommended ? 'var(--color-front)' : r.is_baseline ? 'var(--color-fg)' : r.passed_gates ? 'var(--color-muted)' : 'var(--color-bad)'
  return (
    <div className="relative h-9">
      {baseX != null && <div className="absolute top-0 bottom-0 border-l border-dashed border-faint" style={{ left: `${baseX}%` }} />}
      <div className="absolute top-1/2 h-px w-full -translate-y-1/2 bg-line" />
      <div
        className="absolute top-1/2 h-3 -translate-y-1/2 rounded-[2px]"
        style={{ left: `${x(r.quality.ci_low)}%`, width: `${Math.max(0.8, x(r.quality.ci_high) - x(r.quality.ci_low))}%`, background: color, opacity: running ? 0.25 : 0.35 }}
      />
      <div className="absolute top-1/2 h-5 w-[3px] -translate-x-1/2 -translate-y-1/2 rounded-[1px]" style={{ left: `${x(r.quality.mean)}%`, background: color }} />
    </div>
  )
}

export default function Leaderboard({ rows, metrics, recommended, running }: {
  rows: CandidateResult[]
  metrics: MetricInfo[]
  recommended: string | null
  running: boolean
}) {
  const sorted = [...rows].sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999) || b.scores.utility - a.scores.utility)
  const passed = sorted.filter((r) => r.passed_gates)
  const failed = sorted.filter((r) => !r.passed_gates)
  const { x, ticks } = axis(sorted)
  const base = sorted.find((r) => r.is_baseline)
  const baseX = base ? x(base.quality.mean) : null
  const name = (id: string) => metrics.find((m) => m.id === id)?.name ?? id.replaceAll('_', ' ')

  const row = (r: CandidateResult) => {
    const isRec = r.candidate_key === recommended
    return (
      <div key={r.candidate_key} className={`grid ${COLS} items-center gap-4 border-t border-line px-4 py-3 ${isRec ? 'bg-front/[0.06]' : ''}`}>
        <span className={`title text-lg ${isRec ? 'text-front' : r.rank ? 'text-fg' : 'text-faint'}`}>{r.rank ?? '–'}</span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="truncate font-medium">{shortModel(r.model)}</span>
            {r.is_baseline && <Tag>today</Tag>}
            {isRec && <Tag tone="front">pick</Tag>}
            {r.pareto && !isRec && !r.is_baseline && <Tag tone="signal">Pareto</Tag>}
          </div>
          <div className="mt-0.5 truncate text-xs text-faint">
            {r.provider}, n = {r.n}
            {Object.entries(r.metrics).map(([k, v]) => `, ${name(k)} ${pct(v.mean, 0)}`).join('')}
          </div>
          {!r.passed_gates && <div className="mt-0.5 text-xs text-bad">failed {r.failed_gates.join(', ')}</div>}
        </div>
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1"><Lane r={r} x={x} baseX={baseX} recommended={isRec} running={running} /></div>
          <div className="w-[88px] shrink-0 text-right">
            <div className="text-sm font-medium">{pct(r.quality.mean)}</div>
            <div className="text-[11px] text-faint">± {pct(r.quality.std)}</div>
          </div>
        </div>
        <div className="text-right text-sm">
          {ms(r.e2e_ms.p95)}
          {r.ttft_ms && <div className="text-[11px] text-faint">first token {ms(r.ttft_ms.p95)}</div>}
        </div>
        <div className="text-right text-sm">{usd(r.cost_per_call_usd)}</div>
        <div className={`text-right text-sm ${r.error_rate > 0 ? 'text-bad' : 'text-faint'}`}>{pct(r.error_rate, r.error_rate ? 1 : 0)}</div>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-line bg-panel">
      <div className="min-w-[860px]">
        <div className={`grid ${COLS} items-end gap-4 px-4 pt-3 pb-2 text-xs text-faint`}>
          <span>#</span>
          <span>Model</span>
          <div className="flex items-end gap-3">
            <div className="relative h-8 min-w-0 flex-1">
              <span className="absolute top-0 left-0">Quality, 95% CI</span>
              {ticks.map((t) => (
                <span key={t} className="absolute bottom-0 -translate-x-1/2 text-[10.5px]" style={{ left: `${x(t)}%` }}>{num(t * 100, 0)}</span>
              ))}
            </div>
            <span className="w-[88px] shrink-0 text-right">mean ± std</span>
          </div>
          <span className="text-right">p95 latency</span>
          <span className="text-right">cost / call</span>
          <span className="text-right">errors</span>
        </div>
        {passed.map(row)}
        {failed.length > 0 && (
          <>
            <div className="border-t border-line bg-bg/40 px-4 py-2 text-xs text-bad">Failed a gate, not ranked</div>
            {failed.map(row)}
          </>
        )}
        {base && (
          <div className="flex items-center gap-2 border-t border-line px-4 py-2.5 text-xs text-faint">
            <span className="h-3 border-l border-dashed border-faint" /> {shortModel(base.model)} today, {pct(base.quality.mean)} quality
          </div>
        )}
      </div>
    </div>
  )
}
