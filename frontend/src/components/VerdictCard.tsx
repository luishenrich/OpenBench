import { ms, pct, shortModel, usd } from '@/lib/format'
import type { Verdict } from '@/lib/verdict'
import type { CandidateResult, Recommendation } from '@/types'
import Backdrop from './Backdrop'
import { Badge } from './ui'
import { ModelIcon } from '@/components/ModelIcon'
import { EffortChip, ModelName, prettyModel, rowEffort } from './run/ModelName'

type Tone = 'good' | 'bad' | 'plain'
type Fig = { value: string; label: string; detail?: string; tone: Tone }

function Figure({ value, label, detail, tone = 'plain', size = 'lg' }: Fig & { size?: 'lg' | 'md' }) {
  const c = { good: 'text-win', bad: 'text-bad', plain: 'text-fg' }[tone]
  return (
    <div className="border-l border-line pl-4">
      <div className={`title ${size === 'lg' ? 'text-3xl sm:text-4xl' : 'text-2xl sm:text-3xl'} ${c}`}>{value}</div>
      <div className="mt-1 text-sm text-muted">{label}</div>
      {detail && <div className="mt-0.5 text-xs text-faint">{detail}</div>}
    </div>
  )
}

// "Switch" is the hero: grid backdrop, green figures. "Keep" stays quiet: today's model holds, so nothing is
// coloured as a win or a loss. Figures compare the open-weight pick with the best closed reference
// (rec.reference_key, usually GPT-6.1 Sol); savings are against today's model.
export default function VerdictCard({ rec, verdict, pick, reference, judgedBy }: {
  rec: Recommendation
  verdict: Verdict
  /** leaderboard rows of the recommended candidate and the reference it is compared with */
  pick?: CandidateResult
  reference?: CandidateResult
  /** "GPT-6 Luna + DeepSeek V4.1 Flash" when a judge metric applies */
  judgedBy?: string | null
}) {
  const keep = verdict === 'keep'
  const challenger = shortModel(rec.model)
  const refName = reference ? reference.reference_label ?? prettyModel(reference.model) : rec.reference_key ? prettyModel(rec.reference_key) : 'the reference'
  const base = reference
  const cx = rec.cost_multiple_vs_reference
  const q = rec.quality_vs_reference_pct
  const lat = rec.latency_delta_ms
  const vs = (a: string, b: string) => (pick && base ? `${a} vs ${b}` : undefined)

  const figures: Fig[] = []
  if (q != null) {
    figures.push({
      value: `${q.toFixed(q > 99.5 && q < 100.5 ? 1 : 0)}%`,
      label: `of ${refName}'s quality`,
      detail: pick && base ? vs(pct(pick.quality.mean), pct(base.quality.mean)) : undefined,
      tone: keep ? 'plain' : q >= 99 ? 'good' : q < 95 ? 'bad' : 'plain',
    })
  }
  if (cx != null && cx > 0) {
    const cheaper = cx < 1
    figures.push({
      value: cheaper ? `${(1 / cx).toFixed(1)}× cheaper` : `${cx.toFixed(1)}× the cost`,
      label: `per call than ${refName}`,
      detail: pick && base ? vs(usd(pick.cost_per_call_usd), usd(base.cost_per_call_usd)) : undefined,
      tone: keep ? 'plain' : cheaper ? 'good' : 'bad',
    })
  }
  if (lat != null) {
    figures.push({
      value: `${lat <= 0 ? '−' : '+'}${ms(Math.abs(lat))}`,
      label: `p95 latency vs ${refName}`,
      detail: pick && base ? vs(ms(pick.e2e_ms.p95), ms(base.e2e_ms.p95)) : undefined,
      tone: keep ? 'plain' : lat <= 0 ? 'good' : 'bad',
    })
  }
  if (!keep && rec.est_monthly_savings_usd != null) figures.push({ value: usd(rec.est_monthly_savings_usd), label: "saved per month vs today's model", tone: 'good' })

  // ranking.py writes "Keep X: why…; closest is Y". The verdict is the part before the colon.
  const colon = rec.headline.indexOf(': ')
  const keepTitle = keep && colon > 0 ? rec.headline.slice(0, colon) : rec.headline
  const keepWhy = keep && colon > 0 ? rec.headline.slice(colon + 2) : null

  return (
    <section className={`relative overflow-hidden rounded-2xl border ${keep ? 'border-line bg-panel' : 'border-line-strong bg-bg'}`}>
      {!keep && <Backdrop className="opacity-40 sm:opacity-70" />}
      <div className="relative p-6 sm:p-10">
        {keep
          ? <Badge tone="muted">Verdict: keep today's model</Badge>
          : <Badge tone="win">Verdict: {verdict === 'switch' ? 'switch' : 'best trade-off'}</Badge>}

        {pick && !keep && (
          <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
            <ModelName model={pick.candidate_key} effort={rowEffort(pick)} nameClass="font-medium text-fg" />
            <span>open-weight</span>
          </div>
        )}
        {keep ? (
          <>
            <h2 className="display mt-6 max-w-4xl text-4xl text-balance break-words sm:text-6xl">{keepTitle}</h2>
            {keepWhy && <p className="mt-4 max-w-3xl text-lg text-pretty text-muted">{keepWhy.charAt(0).toUpperCase() + keepWhy.slice(1)}.</p>}
          </>
        ) : (
          <h2 className="display mt-4 max-w-4xl text-4xl text-balance break-words sm:text-5xl">{rec.headline}</h2>
        )}

        {keep && figures.length > 0 && (
          <div className="mt-8 rounded-xl border border-line bg-bg/40 p-4 sm:mt-10 sm:p-6">
            <p className="text-sm text-muted">
              Closest challenger <ModelIcon model={rec.candidate_key} size={14} className="mx-1 inline-flex align-[-4px]" /><span className="font-medium text-fg">{challenger}</span>
              {pick && <EffortChip effort={rowEffort(pick)} className="ml-1.5 align-[1px]" />}
              {pick?.rank != null && <span className="text-faint"> (#{pick.rank})</span>}, measured against {refName}
            </p>
            <div className="mt-5 grid gap-5 sm:grid-cols-3 sm:gap-6">
              {figures.map((f) => <Figure key={f.label} {...f} size="md" />)}
            </div>
          </div>
        )}
        {!keep && figures.length > 0 && (
          <div className="mt-10 grid grid-cols-2 gap-6 lg:grid-cols-4">
            {figures.map((f) => <Figure key={f.label} {...f} />)}
          </div>
        )}

        {(reference || judgedBy) && (
          <p className="mt-8 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-faint">
            {reference && <>Compared with <span className="text-muted">{refName}</span><EffortChip effort={rowEffort(reference)} />, a closed reference that is never recommended.</>}
            {judgedBy && <span>Judged by {judgedBy}.</span>}
          </p>
        )}
        <ul className="mt-4 space-y-1.5 border-t border-line pt-5 text-sm text-muted">
          {rec.reasons.map((r) => <li key={r}>{r}</li>)}
          {rec.statistical_tie_with.length > 0 && !rec.reasons.some((r) => r.startsWith('Statistical tie')) && (
            <li>Statistically tied with {rec.statistical_tie_with.map(shortModel).join(', ')}: the confidence intervals overlap.</li>
          )}
        </ul>
      </div>
    </section>
  )
}
