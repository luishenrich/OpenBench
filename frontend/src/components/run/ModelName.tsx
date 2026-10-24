import { ModelIcon } from '@/components/ModelIcon'
import { compact, effortOf, shortModel } from '@/lib/format'
import type { CandidateResult, JudgeConfig, UseCase } from '@/types'

/** Small quiet chip: reasoning effort is part of a model's identity. */
export function EffortChip({ effort, className = '' }: { effort: string | null | undefined; className?: string }) {
  if (!effort) return null
  return (
    <span className={`inline-flex shrink-0 items-center rounded-[5px] border border-line px-1.5 py-px text-[10.5px] leading-[16px] whitespace-nowrap text-faint ${className}`}>
      {effort === 'default' ? 'provider default' : `reasoning ${effort}`}
    </span>
  )
}

/** Icon, name and effort chip, in one line. */
export function ModelName({ model, effort, size = 16, className = '', nameClass = 'font-medium' }: {
  model: string; effort?: string | null; size?: number; className?: string; nameClass?: string
}) {
  return (
    <span className={`inline-flex min-w-0 items-center gap-2 ${className}`}>
      <ModelIcon model={model} size={size} />
      <span className={`truncate ${nameClass}`} title={model}>{prettyModel(model)}</span>
      <EffortChip effort={effort} />
    </span>
  )
}

// Closed references get their product names; everything else keeps its id.
const PRETTY: Record<string, string> = { 'gpt-6-luna': 'GPT-6 Luna', 'gpt-6.1-sol': 'GPT-6.1 Sol', 'DeepSeek-V4.1-Flash-1017': 'DeepSeek V4.1 Flash' }
export const prettyModel = (keyOrModel: string) => {
  const s = shortModel(keyOrModel)
  return PRETTY[s] ?? s
}

/** Closed references (incl. today's model, labelled "today"): measured, never ranked, drawn grey. */
export const isReference = (c: { is_reference?: boolean }) => !!c.is_reference
export const isToday = (c: { is_reference?: boolean; reference_label?: string | null }) => !!c.is_reference && c.reference_label === 'today'
/** All jurors abstained: no quality score, so not ranked. */
export const notScored = (c: Pick<CandidateResult, 'quality'>) => c.quality.n === 0
/** Effort of a leaderboard row: the pinned value, else from the key. */
export const rowEffort = (c: Pick<CandidateResult, 'reasoning_effort' | 'candidate_key'>) => c.reasoning_effort ?? effortOf(c.candidate_key)

export const reasoningNote = (c: Pick<CandidateResult, 'avg_reasoning_tokens'>) =>
  c.avg_reasoning_tokens != null && c.avg_reasoning_tokens > 0 ? `~${compact(c.avg_reasoning_tokens)} reasoning tokens / call` : null

// contract default: three families, so every output keeps at least two votes after one juror abstains
export const DEFAULT_JURY = ['openai/gpt-6-luna', 'deepseek-ai/DeepSeek-V4.1-Flash-1017', 'zai-org/GLM-5.3']
/** "GPT-6 Luna + DeepSeek V4.1 Flash": the use case's jury, else the workspace default, else the contract default. */
export function juryNames(uc?: Pick<UseCase, 'judge'> | null, fallback?: JudgeConfig | null): string {
  const judges = uc?.judge?.judges?.length ? uc.judge.judges : fallback?.judges?.length ? fallback.judges : DEFAULT_JURY.map((model) => ({ model }))
  return judges.map((j) => prettyModel(j.model)).join(' + ')
}
