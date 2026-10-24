import type { Run, RunBrief } from '@/types'

export type Verdict = 'switch' | 'keep' | 'use'

// ranking.py writes "Keep …" when today's model out-ranks every candidate, "Switch to …" / "Use …" otherwise.
export function verdictOf(headline: string | null | undefined): Verdict | null {
  if (!headline) return null
  if (headline.startsWith('Keep')) return 'keep'
  if (headline.startsWith('Switch')) return 'switch'
  return 'use'
}

export function runVerdict(run: Run): Verdict | null {
  if (!run.recommendation) return null
  // References (incl. today's model) are never ranked, so the headline alone carries keep / switch / use.
  return verdictOf(run.recommendation.headline)
}

export const briefVerdict = (r: RunBrief) => verdictOf(r.recommendation_headline)
