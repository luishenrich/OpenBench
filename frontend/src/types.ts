// Mirrors contract/schemas.py. Change there first, then here.

export type UseCaseKind =
  | 'chat' | 'batch' | 'extraction' | 'agent' | 'classification' | 'rag' | 'summarization' | 'generation' | 'other'
export type Provider = 'nebius' | 'openrouter' | 'openai'
export type RunStatus = 'queued' | 'running' | 'scoring' | 'done' | 'failed' | 'cancelled'
export type CaseSource = 'repo' | 'synthetic' | 'upload' | 'trace' | 'public'
export type Axis = 'quality' | 'speed' | 'cost'

export interface Profile { weights: Record<Axis, number>; targets: Record<string, number> }
/** One juror. params.reasoning_effort is pinned. */
export interface JudgeModel { provider: Provider; model: string; params?: Record<string, unknown> }
/** A jury (default GPT-6 Luna + DeepSeek-V4.1-Flash, effort low). Each juror abstains on its own model family. */
export interface JudgeConfig { judges: JudgeModel[]; mode: 'rubric' | 'pairwise'; rubric: string | null }
export interface Workspace {
  id: string
  name: string
  default_profile: Profile
  default_judge: JudgeConfig
  /** closed comparison models runs inherit (default GPT-6.1 Sol + GPT-6 Luna at medium) */
  default_references: ModelRef[]
  /** where automatic candidates come from (runs with candidates: []) */
  candidate_pool: CandidatePool
  default_repeats: number
  /** a run whose estimate is above this is refused; null = no cap */
  max_run_cost_usd: number | null
}
/** Which open-weight models get picked automatically as candidates. */
export interface CandidatePool { shortlist_only: boolean; exclude_providers: Provider[]; max_output_usd_per_1m: number | null }
export type WorkspacePatch = Partial<Pick<Workspace,
  'name' | 'default_profile' | 'default_judge' | 'default_references' | 'candidate_pool' | 'default_repeats' | 'max_run_cost_usd'>>
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
  /** last change to the use case or any of its cases */
  updated_at?: string | null
  /** Not in the contract yet: the backend will add it. in_progress = the coding agent is still attaching
   *  prompt, metrics and cases. Until then the dashboard infers it (components/usecases/group.ts, isAgentSettingUp). */
  setup_state?: 'in_progress' | 'complete'
  /** pinning sets pinned_at; unpinning clears it. Older APIs omit it: pins then live in localStorage. */
  pinned: boolean
  pinned_at?: string | null
}
export type UseCasePatch = Partial<Pick<UseCase, 'name' | 'description' | 'current_model' | 'profile' | 'gates' | 'metrics' | 'judge' | 'io_spec' | 'pinned'>>
/** PATCH /api/use-cases/{id}/cases/{case_id}: any subset. reference: null clears it. */
export interface CasePatch { input?: Case['input']; reference?: unknown; tags?: string[] }

export interface Case {
  id: string
  use_case_id: string
  input: { vars?: Record<string, unknown>; messages?: unknown[]; images?: string[] }
  reference: unknown
  tags: string[]
  source: CaseSource
  /** later than a run's finished_at = edited after that run (past runs keep their results) */
  updated_at?: string | null
}

export interface CaseIn {
  input: { vars?: Record<string, unknown>; messages?: unknown[]; images?: string[] }
  reference?: unknown
  tags?: string[]
  source?: CaseSource
}
export interface GenerateCasesIn { n?: number; strategy?: 'auto' | 'schema_first' | 'persona_grid' }

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

/** Omitted fields inherit the workspace: candidates [] → auto-pick within candidate_pool,
 *  repeats null → default_repeats, references null → default_references. */
export interface RunIn {
  use_case_id: string
  candidates?: ModelRef[]
  repeats?: number | null
  /** closed frontier models, same cases × repeats, comparison only */
  references?: ModelRef[] | null
  include_references?: boolean
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
  /** what the run would use after inheritance */
  candidates: ModelRef[]
  references: ModelRef[]
  repeats: number
  max_run_cost_usd: number | null
  /** total_usd > max_run_cost_usd: POST /api/runs refuses it (422) */
  over_cap: boolean
}

export interface Stat { mean: number; std: number; ci_low: number; ci_high: number; n: number }
export interface Pct { p50: number; p95: number }
export interface Scores { quality: number; speed: number; cost: number; utility: number }
export interface CandidateResult {
  candidate_key: string // "openrouter:openai/gpt-6.1-sol@medium"
  provider: Provider
  model: string
  /** closed reference (incl. "today"): measured, never ranked, never recommended; failed_gates informative only */
  is_reference: boolean
  reference_label?: string | null // "GPT-6.1 Sol", "GPT-6 Luna", "today"
  reasoning_effort?: string | null // pinned effort; "default" = the provider's own default
  avg_reasoning_tokens?: number | null
  /** params this model's endpoint doesn't support, dropped before the call (e.g. ["temperature"]) */
  dropped_params?: string[]
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
  /** grey reference point, never on the front; label = reference label */
  is_reference: boolean
  pareto: boolean
}
export interface Recommendation {
  candidate_key: string
  provider: Provider
  model: string
  headline: string
  reasons: string[]
  /** the best reference by quality (usually GPT-6.1 Sol) */
  reference_key?: string | null
  quality_vs_reference_pct: number | null
  cost_multiple_vs_reference: number | null // 0.05 = 20× cheaper
  latency_delta_ms: number | null // candidate − reference, p95
  statistical_tie_with: string[]
  est_monthly_savings_usd?: number | null // vs the "today" reference
}
export interface Progress { done: number; total: number; errors: number; judged: number; judge_total: number }
export interface Run {
  id: string
  use_case_id: string
  status: RunStatus
  progress: Progress
  candidates: ModelRef[]
  references?: ModelRef[] // as run, incl. "today"
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
  /** share of judged results where the voting jurors agree; null if fewer than 2 judged */
  judge_agreement?: number | null
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
  judge: ResultJudge | null
}
export interface Juror { key: string; reasoning_effort?: string | null; score?: number | null; reasoning?: string | null; winner?: string | null }
export interface ResultJudge {
  mode?: string
  score?: number | null
  winner?: string | null
  /** all non-abstaining jurors agree; null when fewer than two voted */
  agreement?: boolean | null
  abstained?: string[]
  reasoning?: string | null // all jurors in one string
  jurors?: Juror[]
}
export interface ResultsPage { items: ResultOut[]; next_cursor: string | null }
