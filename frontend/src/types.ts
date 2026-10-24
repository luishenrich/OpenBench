// Mirrors contract/schemas.py. Change there first, then here.

export type UseCaseKind =
  | 'chat' | 'batch' | 'extraction' | 'agent' | 'classification' | 'rag' | 'summarization' | 'generation' | 'other'
export type Provider = 'nebius' | 'openrouter' | 'openai'
export type RunStatus = 'queued' | 'running' | 'scoring' | 'done' | 'failed' | 'cancelled'
export type CaseSource = 'repo' | 'synthetic' | 'upload' | 'trace' | 'public'
export type Axis = 'quality' | 'speed' | 'cost'

export interface Profile { weights: Record<Axis, number>; targets: Record<string, number> }
export interface JudgeConfig { provider: Provider; model: string; mode: 'rubric' | 'pairwise'; rubric: string | null }
export interface Workspace { id: string; name: string; default_profile: Profile; default_judge: JudgeConfig }
export interface Me { user_id: string; email: string; workspace: Workspace; mcp_key_last4: string | null }

export interface SourceRef { repo: string | null; path: string; line: number | null; symbol: string | null }
export interface ModelRef { provider: Provider; model: string; params?: Record<string, unknown> }
export interface Gate { metric_id: string; op: '>=' | '<=' | '>' | '<'; value: number }
export interface MetricSpec { metric_id: string; weight: number; config: Record<string, unknown> }
export interface IOSpec {
  system_prompt: string | null
  user_template: string | null
  response_schema: Record<string, unknown> | null
  tools: Record<string, unknown>[] | null
  params: Record<string, unknown>
}
export interface RunBrief {
  id: string
  status: RunStatus
  finished_at: string | null
  recommendation_headline: string | null
  est_monthly_savings_usd: number | null
}
export interface UseCase {
  id: string
  workspace_id: string
  name: string
  kind: UseCaseKind
  description: string
  source_refs: SourceRef[]
  current_model: ModelRef | null
  profile: Profile | null
  gates: Gate[]
  metrics: MetricSpec[]
  judge: JudgeConfig | null
  io_spec: IOSpec
  case_count: number
  latest_run: RunBrief | null
  created_by: 'mcp' | 'dashboard'
  created_at: string
}
export type UseCasePatch = Partial<Pick<UseCase, 'name' | 'description' | 'current_model' | 'profile' | 'gates' | 'metrics' | 'judge' | 'io_spec'>>

export interface Case {
  id: string
  use_case_id: string
  input: { vars?: Record<string, unknown>; messages?: unknown[]; images?: string[] }
  reference: unknown
  tags: string[]
  source: CaseSource
}

export interface CatalogModel {
  id: string
  provider: Provider
  name: string
  type: 'text' | 'vision' | 'embedding'
  input_modalities: string[]
  verified: Record<string, boolean>
  context_length: number | null
  pricing_usd_per_1m: { input: number | null; output: number | null; cached_input: number | null }
  shortlist: boolean
  role: string | null
  aa_index: number | null
  license: string | null
  legacy: boolean
}

export interface MetricInfo {
  id: string
  name: string
  category: string
  description: string
  measures: string
  method: string
  direction: string | null
  unit: string | null
  score_min: number | null
  score_max: number | null
  utility_axis: string
  gate_suitable: boolean
  suggested_gate: string | null
  default_for_kinds: string[]
  required_inputs: string[]
  selector_priority: string | null
  aliases: string[]
}

export interface RunIn {
  use_case_id: string
  candidates: ModelRef[]
  repeats: number
  include_baseline: boolean
  confirm_cost_usd?: number | null
}
export interface EstimateLine { provider: Provider; model: string; calls: number; est_cost_usd: number }
export interface Estimate {
  calls: number
  est_input_tokens: number
  est_output_tokens: number
  est_cost_usd: number
  judge_cost_usd: number
  total_usd: number
  per_candidate: EstimateLine[]
}

export interface Stat { mean: number; std: number; ci_low: number; ci_high: number; n: number }
export interface Pct { p50: number; p95: number }
export interface Scores { quality: number; speed: number; cost: number; utility: number }
export interface CandidateResult {
  candidate_key: string
  provider: Provider
  model: string
  is_baseline: boolean
  n: number
  quality: Stat
  metrics: Record<string, Stat>
  ttft_ms: Pct | null
  e2e_ms: Pct
  tokens_per_s: number | null
  cost_per_call_usd: number
  cost_per_success_usd: number | null
  error_rate: number
  scores: Scores
  passed_gates: boolean
  failed_gates: string[]
  pareto: boolean
  rank: number | null
}
export interface ParetoPoint {
  candidate_key: string
  label: string
  quality: number
  cost_per_success_usd: number | null
  latency_ms: number
  is_baseline: boolean
  pareto: boolean
}
export interface Recommendation {
  candidate_key: string
  provider: Provider
  model: string
  headline: string
  reasons: string[]
  quality_vs_baseline_pct: number | null
  cost_multiple_vs_baseline: number | null
  latency_delta_ms: number | null
  statistical_tie_with: string[]
  est_monthly_savings_usd: number | null
}
export interface Progress { done: number; total: number; errors: number; judged: number; judge_total: number }
export interface Run {
  id: string
  use_case_id: string
  status: RunStatus
  progress: Progress
  candidates: ModelRef[]
  repeats: number
  est_cost_usd: number
  actual_cost_usd: number
  created_at: string
  started_at: string | null
  finished_at: string | null
  error: string | null
  leaderboard: CandidateResult[]
  pareto_points: ParetoPoint[]
  recommendation: Recommendation | null
}
export interface ResultOut {
  id: string
  candidate_key: string
  case_id: string
  repeat_idx: number
  output: { text?: string | null; json?: unknown; tool_calls?: unknown[] | null }
  timing: { ttft_ms?: number | null; e2e_ms?: number | null; tokens_per_s?: number | null }
  usage: Record<string, unknown>
  cost_usd: number | null
  error: string | null
  scores: Record<string, number>
  judge: { mode?: string; score?: number; reasoning?: string; winner?: string } | null
}
export interface ResultsPage { items: ResultOut[]; next_cursor: string | null }
