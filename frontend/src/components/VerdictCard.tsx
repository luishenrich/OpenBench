import { ms, shortModel, usd } from '@/lib/format'
import type { Verdict } from '@/lib/verdict'
import type { Recommendation } from '@/types'
import Backdrop from './Backdrop'
import { Badge } from './ui'

type Tone = 'good' | 'bad' | 'plain'

function Figure({ value, label, tone = 'plain' }: { value: string; label: string; tone?: Tone }) {
  const c = { good: 'text-win', bad: 'text-bad', plain: 'text-fg' }[tone]
  return (
    <div className="border-l border-line pl-4">
      <div className={`title text-3xl sm:text-4xl ${c}`}>{value}</div>
      <div className="mt-1 text-sm text-muted">{label}</div>
    </div>
  )
}

// "Switch" is the hero: grid backdrop, green figures. "Keep" stays quiet: today's model holds, and the figures
// describe how far the closest challenger is from it.
export default function VerdictCard({ rec, verdict, baselineName }: { rec: Recommendation; verdict: Verdict; baselineName: string | null }) {
  const keep = verdict === 'keep'
  const challenger = shortModel(rec.model)
  const cx = rec.cost_multiple_vs_baseline
  const q = rec.quality_vs_baseline_pct
  const lat = rec.latency_delta_ms

  const figures: { value: string; label: string; tone: Tone }[] = []
  if (q != null) figures.push({ value: `${q.toFixed(0)}%`, label: keep ? `${challenger}'s quality vs today` : `of ${baselineName ?? "today's"} quality`, tone: q >= 99 ? 'good' : q < 95 ? 'bad' : 'plain' })
  if (cx != null && cx > 0) {
    figures.push(cx < 1
      ? { value: `${(1 / cx).toFixed(1)}× cheaper`, label: 'per call', tone: 'good' }
      : { value: `${cx.toFixed(1)}× the cost`, label: 'per call', tone: 'bad' })
  }
  if (lat != null) figures.push({ value: `${lat <= 0 ? '−' : '+'}${ms(Math.abs(lat))}`, label: 'p95 latency vs today', tone: lat <= 0 ? 'good' : 'bad' })
  if (!keep && rec.est_monthly_savings_usd != null) figures.push({ value: usd(rec.est_monthly_savings_usd), label: 'saved per month at today\'s volume', tone: 'good' })

  return (
    <section className={`relative overflow-hidden rounded-2xl border ${keep ? 'border-line bg-panel' : 'border-line-strong bg-bg'}`}>
      {!keep && <Backdrop className="opacity-70" />}
      <div className="relative p-6 sm:p-10">
        {keep
          ? <Badge tone="muted">Verdict: keep today's model</Badge>
          : <Badge tone="win">Verdict: {verdict === 'switch' ? 'switch' : 'best trade-off'}</Badge>}
        <h2 className={`display mt-6 max-w-4xl ${keep ? 'text-3xl sm:text-5xl' : 'text-4xl sm:text-6xl'}`}>{rec.headline}</h2>
        {keep && <p className="mt-4 text-muted">Closest challenger: <span className="text-fg">{challenger}</span>. Here is how far it is from {baselineName ?? "today's model"}.</p>}

        {figures.length > 0 && (
          <div className="mt-10 grid grid-cols-2 gap-6 lg:grid-cols-4">
            {figures.map((f) => <Figure key={f.label} {...f} />)}
          </div>
        )}

        <ul className="mt-10 space-y-1.5 border-t border-line pt-5 text-sm text-muted">
          {rec.reasons.map((r) => <li key={r}>{r}</li>)}
          {rec.statistical_tie_with.length > 0 && !rec.reasons.some((r) => r.startsWith('Statistical tie')) && (
            <li>Statistically tied with {rec.statistical_tie_with.map(shortModel).join(', ')}: the confidence intervals overlap.</li>
          )}
        </ul>
      </div>
    </section>
  )
}
