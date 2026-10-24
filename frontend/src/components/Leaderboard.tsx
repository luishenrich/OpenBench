import { ms, num, pct, shortModel, usd } from '@/lib/format'
import type { CandidateResult, MetricInfo } from '@/types'
import { Tag } from './ui'

// Mean with a 95% CI bar on a shared scale, so overlapping intervals are visible at a glance.
function CiBar({ lo, hi, mean, min, max, tone }: { lo: number; hi: number; mean: number; min: number; max: number; tone: string }) {
  const x = (v: number) => ((v - min) / (max - min || 1)) * 100
  return (
    <svg viewBox="0 0 100 10" preserveAspectRatio="none" className="h-2.5 w-28" aria-hidden>
      <rect x={0} y={4.5} width={100} height={1} fill="#e6eaf0" />
      <rect x={x(lo)} y={2} width={Math.max(1, x(hi) - x(lo))} height={6} rx={1} fill={tone} opacity={0.3} />
      <rect x={x(mean) - 0.8} y={0} width={1.6} height={10} fill={tone} />
    </svg>
  )
}

export default function Leaderboard({ rows, metrics, recommended, running }: {
  rows: CandidateResult[]
  metrics: MetricInfo[]
  recommended: string | null
  running: boolean
}) {
  const sorted = [...rows].sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999) || b.scores.utility - a.scores.utility)
  const metricIds = Object.keys(sorted[0]?.metrics ?? {})
  const name = (id: string) => metrics.find((m) => m.id === id)?.name ?? id
  const lo = Math.min(...sorted.map((r) => r.quality.ci_low))
  const hi = Math.max(...sorted.map((r) => r.quality.ci_high))
  const scaleMin = Math.max(0, lo - 0.01)
  const scaleMax = Math.min(1, hi + 0.01)

  return (
    <div className="overflow-x-auto rounded-lg border border-rule bg-surface">
      <table className="w-full min-w-[920px] text-left text-sm">
        <thead className="border-b border-rule text-muted">
          <tr>
            <th className="w-10 px-4 py-2.5 font-medium">#</th>
            <th className="px-4 py-2.5 font-medium">Model</th>
            <th className="px-4 py-2.5 font-medium">Quality, mean ± std</th>
            <th className="px-4 py-2.5 font-medium">95% CI</th>
            {metricIds.map((m) => <th key={m} className="px-4 py-2.5 font-medium">{name(m)}</th>)}
            <th className="px-4 py-2.5 font-medium">p95 latency</th>
            <th className="px-4 py-2.5 font-medium">Cost / call</th>
            <th className="px-4 py-2.5 font-medium">Errors</th>
            <th className="px-4 py-2.5 font-medium">Score</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-rule">
          {sorted.map((r) => {
            const isRec = r.candidate_key === recommended
            const tone = isRec ? '#0f8a5f' : r.is_baseline ? '#141b2d' : '#2b4acb'
            const dq = !r.passed_gates
            return (
              <tr key={r.candidate_key} className={isRec ? 'bg-win-soft/60' : dq ? 'text-muted' : ''}>
                <td className="px-4 py-3 font-medium">{r.rank ?? '–'}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="font-medium text-ink">{shortModel(r.model)}</span>
                    {r.is_baseline && <Tag>today</Tag>}
                    {isRec && <Tag tone="win">recommended</Tag>}
                    {r.pareto && !isRec && !r.is_baseline && <Tag tone="accent">Pareto</Tag>}
                  </div>
                  <div className="text-xs text-muted">
                    {r.provider}, n = {r.n}
                    {dq && <span className="text-bad">, failed {r.failed_gates.join(', ')}</span>}
                  </div>
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <span className="font-medium text-ink">{pct(r.quality.mean)}</span>
                  <span className="text-muted"> ± {pct(r.quality.std)}</span>
                </td>
                <td className="px-4 py-3">
                  <CiBar lo={r.quality.ci_low} hi={r.quality.ci_high} mean={r.quality.mean} min={scaleMin} max={scaleMax} tone={tone} />
                  <div className="text-[11px] text-muted">{num(r.quality.ci_low, 3)}–{num(r.quality.ci_high, 3)}</div>
                </td>
                {metricIds.map((m) => (
                  <td key={m} className="px-4 py-3">{r.metrics[m] ? pct(r.metrics[m].mean) : '–'}</td>
                ))}
                <td className="px-4 py-3 whitespace-nowrap">{ms(r.e2e_ms.p95)}{r.ttft_ms && <div className="text-xs text-muted">first token {ms(r.ttft_ms.p95)}</div>}</td>
                <td className="px-4 py-3">{usd(r.cost_per_call_usd)}</td>
                <td className={`px-4 py-3 ${r.error_rate > 0 ? 'text-bad' : ''}`}>{pct(r.error_rate)}</td>
                <td className="px-4 py-3 font-medium text-ink">{running ? '…' : num(r.scores.utility, 2)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
