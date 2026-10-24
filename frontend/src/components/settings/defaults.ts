// Workspace defaults, and the fallbacks for fields the backend doesn't send yet
// (default_references, candidate_pool, default_repeats, max_run_cost_usd are requested from Raphaël).
import type { CandidatePool, ModelRef, Provider, Workspace } from '@/types'
import { shortModel } from '@/lib/format'

export const EFFORTS = ['minimal', 'low', 'medium', 'high', 'xhigh'] as const

/** The closed models a run can compare against. Same as RunIn's server default. */
export const REFERENCE_CHOICES: ModelRef[] = [
  { provider: 'openrouter', model: 'openai/gpt-6.1-sol', params: { reasoning_effort: 'medium' } },
  { provider: 'openrouter', model: 'openai/gpt-6-luna', params: { reasoning_effort: 'medium' } },
]
export const DEFAULT_REFERENCES: ModelRef[] = REFERENCE_CHOICES
export const DEFAULT_POOL: CandidatePool = { shortlist_only: true, exclude_providers: [], max_output_usd_per_1m: null }
export const DEFAULT_REPEATS = 3
export const POOL_PROVIDERS: { key: Provider; name: string }[] = [
  { key: 'nebius', name: 'Nebius' },
  { key: 'openrouter', name: 'OpenRouter' },
]

const LABELS: Record<string, string> = {
  'openai/gpt-6.1-sol': 'GPT-6.1 Sol',
  'openai/gpt-6-luna': 'GPT-6 Luna',
  'deepseek-ai/DeepSeek-V4.1-Flash-1017': 'DeepSeek-V4.1-Flash',
  'zai-org/GLM-5.3': 'GLM-5.3',
  'MiniMaxAI/MiniMax-M3.1-Flash': 'MiniMax-M3.1-Flash',
}
export const modelLabel = (model: string) => LABELS[model] ?? shortModel(model)
export const sameModel = (a: ModelRef, b: ModelRef) => a.provider === b.provider && a.model === b.model

/** The workspace with every optional field filled in, so the settings form always has a value. */
export type FullWorkspace = Workspace & Required<Pick<Workspace, 'default_references' | 'candidate_pool' | 'default_repeats' | 'max_run_cost_usd'>>

export function withDefaults(w: Workspace): FullWorkspace {
  return {
    ...w,
    default_references: w.default_references ?? DEFAULT_REFERENCES,
    candidate_pool: { ...DEFAULT_POOL, ...w.candidate_pool },
    default_repeats: w.default_repeats ?? DEFAULT_REPEATS,
    max_run_cost_usd: w.max_run_cost_usd ?? null,
  }
}
