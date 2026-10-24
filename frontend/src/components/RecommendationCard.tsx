import { ms, shortModel, usd } from '@/lib/format'
import type { Recommendation } from '@/types'

function Figure({ value, label, good }: { value: string; label: string; good?: boolean }) {
  return (
    <div>
      <div className={`text-2xl font-semibold tracking-tight ${good ? 'text-[#5ad49c]' : ''}`}>{value}</div>
      <div className="text-sm text-muted">{label}</div>
    </div>
  )
}

export default function RecommendationCard({ rec, baselineName }: { rec: Recommendation; baselineName: string | null }) {
  const cheaper = rec.cost_multiple_vs_baseline
  return (
    <section className="rounded-xl bg-ink p-6 text-white sm:p-8">
      <p className="text-sm text-white/60">Recommendation</p>
      <h2 className="mt-2 max-w-4xl text-3xl leading-tight font-semibold tracking-tight [font-stretch:90%] sm:text-[2.6rem]">
        {rec.headline}
      </h2>
      <div className="mt-8 grid grid-cols-2 gap-6 sm:grid-cols-4 [&_.text-muted]:text-white/55">
        {rec.quality_vs_baseline_pct != null && (
          <Figure value={`${rec.quality_vs_baseline_pct.toFixed(0)}%`} label={`of ${baselineName ?? "today's"} quality`} />
        )}
        {cheaper != null && cheaper > 0 && (
          <Figure value={cheaper < 1 ? `${(1 / cheaper).toFixed(1)}× cheaper` : `${cheaper.toFixed(1)}× the cost`} label="per call" good={cheaper < 1} />
        )}
        {rec.latency_delta_ms != null && (
          <Figure value={`${rec.latency_delta_ms <= 0 ? '−' : '+'}${ms(Math.abs(rec.latency_delta_ms))}`} label="p95 latency vs today" good={rec.latency_delta_ms <= 0} />
        )}
        {rec.est_monthly_savings_usd != null && (
          <Figure value={usd(rec.est_monthly_savings_usd)} label="saved per month at today's volume" good />
        )}
      </div>
      <ul className="mt-8 space-y-1.5 border-t border-white/15 pt-5 text-sm text-white/80">
        {rec.reasons.map((r) => <li key={r}>{r}</li>)}
        {rec.statistical_tie_with.length > 0 && (
          <li className="text-white/60">
            Statistically tied with {rec.statistical_tie_with.map(shortModel).join(', ')}: the confidence intervals overlap, so the cheaper model wins.
          </li>
        )}
      </ul>
    </section>
  )
}
