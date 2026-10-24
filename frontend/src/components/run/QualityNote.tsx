import type { MetricInfo, Run, UseCase } from '@/types'
import { isReference, notScored } from './ModelName'

// Deterministic format checks: they say "the output parses", not "the answer is right".
const FORMAT = /schema|json_valid|valid_json|format|parses|regex/

const joinNames = (xs: string[]) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`)

/** The note's text, or null when quality does separate the candidates. */
export function qualityNote(run: Run, uc: UseCase | undefined, catalog: MetricInfo[]): string | null {
  const ranked = run.leaderboard.filter((c) => !isReference(c) && !notScored(c) && c.passed_gates)
  if (ranked.length < 2) return null
  const qs = ranked.map((c) => c.quality.mean)
  const allPerfect = qs.every((q) => q >= 0.999)
  const spread = Math.max(...qs) - Math.min(...qs)
  if (!allPerfect && spread >= 0.01) return null

  // quality metrics: what the leaderboard measured, else what the use case declares
  const ids = [...new Set(ranked.flatMap((c) => Object.keys(c.metrics)))]
  const qualityIds = (ids.length ? ids : uc?.metrics.map((m) => m.metric_id) ?? [])
    .filter((id) => (catalog.find((m) => m.id === id)?.utility_axis ?? 'quality') === 'quality')
  if (!qualityIds.length) return null
  const onlyFormat = qualityIds.every((id) => FORMAT.test(id) || catalog.find((m) => m.id === id)?.category === 'structured_output' && id !== 'field_accuracy')
  if (!onlyFormat && qualityIds.length > 1) return null

  const names = qualityIds.map((id) => catalog.find((m) => m.id === id)?.name ?? id.replaceAll('_', ' '))
  const only = qualityIds.length === 1 ? 'the only quality metric' : 'the only quality metrics'
  const scored = allPerfect
    ? `every model scored 100% on ${joinNames(names)}, ${only}`
    : `every passing model scored within ${(spread * 100).toFixed(1)} points on ${joinNames(names)}, ${only}`
  return `Quality doesn't separate the models here: ${scored}. The pick is decided by cost and speed. Add a reference-based or judge metric to compare answer quality.`
}

export default function QualityNote({ text }: { text: string }) {
  return (
    <div role="note" className="flex gap-3 rounded-xl border border-[#e8b04b]/30 bg-[#e8b04b]/[0.06] px-5 py-4 text-sm">
      <svg viewBox="0 0 16 16" className="mt-0.5 size-4 shrink-0 text-[#e8b04b]" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden>
        <circle cx="8" cy="8" r="6.5" /><path d="M8 4.8v3.8M8 11.2v.01" />
      </svg>
      <p className="text-pretty text-[#ecd9b0]">{text}</p>
    </div>
  )
}
