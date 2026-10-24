"""Shared API shapes. Frozen at T+0:30; owner: Raphaël. Ask before changing.

The REST API, the MCP tools and the frontend all use these shapes. JSON field names are
exactly the attribute names below. Every example in contract/fixtures/ validates against them.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, Field, model_validator

UseCaseKind = Literal[
    "chat", "batch", "extraction", "agent", "classification", "rag", "summarization", "generation", "other"
]
Provider = Literal["nebius", "openrouter", "openai"]
RunStatus = Literal["queued", "running", "scoring", "done", "failed", "cancelled"]
CaseSource = Literal["repo", "synthetic", "upload", "trace", "public"]


# --- workspace -------------------------------------------------------------

class Profile(BaseModel):
    """Trade-off weights (sum to 100) and targets. score = 1 at target, 0 at max (log scale)."""
    weights: dict[Literal["quality", "speed", "cost"], int] = {"quality": 60, "speed": 20, "cost": 20}
    targets: dict[str, float] = Field(default_factory=dict, examples=[{
        "ttft_ms_p95": 500, "ttft_ms_p95_max": 2000, "cost_per_call_usd": 0.001, "cost_per_call_usd_max": 0.01,
    }])


class JudgeModel(BaseModel):
    """One juror. params.reasoning_effort is pinned (stored with every judgement)."""
    provider: Provider
    model: str
    params: dict[str, Any] = Field(default_factory=dict)


def _default_jury() -> list[JudgeModel]:
    """Three families, so every output keeps ≥ 2 votes after a juror abstains on its own family.
    GLM stays at the provider's default effort: on Nebius, setting any effort nearly turns its reasoning off."""
    return [JudgeModel(provider="openrouter", model="openai/gpt-6-luna", params={"reasoning_effort": "low"}),
            JudgeModel(provider="nebius", model="deepseek-ai/DeepSeek-V4.1-Flash-1017",
                       params={"reasoning_effort": "low"}),
            JudgeModel(provider="nebius", model="zai-org/GLM-5.3")]


class JudgeConfig(BaseModel):
    """A jury of judges from three model families (Verga et al. 2024): Luna, DeepSeek, GLM.

    Rubric: mean of the judges' scores. Pairwise: both orders × every judge; a win counts only if
    all non-abstaining judges agree in both orders, else a tie (0.5). A judge abstains on outputs
    from its own model family. Configs saved before juries ({provider, model}, e.g. workspace defaults
    in the database) get the default jury, keeping their mode and rubric.
    """
    judges: list[JudgeModel] = Field(default_factory=_default_jury)
    mode: Literal["rubric", "pairwise"] = "rubric"
    rubric: str | None = None

    @model_validator(mode="before")
    @classmethod
    def _legacy_single_judge(cls, data: Any) -> Any:
        if isinstance(data, dict) and "judges" not in data:
            data = {k: v for k, v in data.items() if k not in ("provider", "model", "params")}
        return data


class CandidatePool(BaseModel):
    """Where automatic candidates come from (runs with no candidates given)."""
    shortlist_only: bool = True
    exclude_providers: list[Provider] = Field(default_factory=list)
    max_output_usd_per_1m: float | None = None  # skip models whose output price is above this


class Workspace(BaseModel):
    """Company defaults. Use cases and runs inherit them: use case field → workspace → built-in default.
    A use case's profile / judge = null means "inherit"; runs inherit references, repeats and the pool."""
    id: UUID
    name: str
    default_profile: Profile
    default_judge: JudgeConfig
    default_references: list[ModelRef] = Field(default_factory=lambda: _default_references())
    candidate_pool: CandidatePool = Field(default_factory=CandidatePool)
    default_repeats: int = 3
    max_run_cost_usd: float | None = None  # a run whose estimate is above this is refused (null = no cap)


class WorkspacePatch(BaseModel):
    """PATCH /api/workspace: any subset. default_references: null resets to the built-in references."""
    name: str | None = None
    default_profile: Profile | None = None
    default_judge: JudgeConfig | None = None
    default_references: list[ModelRef] | None = None
    candidate_pool: CandidatePool | None = None
    default_repeats: int | None = Field(default=None, ge=1, le=10)
    max_run_cost_usd: float | None = Field(default=None, ge=0)


class Me(BaseModel):
    user_id: UUID
    email: str
    workspace: Workspace
    mcp_key_last4: str | None


# --- use cases and cases -----------------------------------------------------

class SourceRef(BaseModel):
    repo: str | None = None
    path: str
    line: int | None = None
    symbol: str | None = None


class ModelRef(BaseModel):
    """A model at given settings. params.reasoning_effort (none | minimal | low | medium | high | xhigh)
    is part of its identity: candidate_key = "<provider>:<model>@<effort>" when set."""
    provider: Provider
    model: str
    params: dict[str, Any] = Field(default_factory=dict)  # temperature, reasoning_effort, max_tokens, …


class Gate(BaseModel):
    metric_id: str  # e.g. "json_schema_valid", "error_rate", "ttft_ms_p95"
    op: Literal[">=", "<=", ">", "<"]
    value: float


class MetricSpec(BaseModel):
    metric_id: str  # see docs/metrics-catalog.md
    weight: float = 1.0
    config: dict[str, Any] = Field(default_factory=dict)


class IOSpec(BaseModel):
    """How a case becomes a request. Variables in user_template are filled from case.input.vars."""
    system_prompt: str | None = None
    user_template: str | None = None
    response_schema: dict[str, Any] | None = None  # JSON schema → response_format json_schema
    tools: list[dict[str, Any]] | None = None
    params: dict[str, Any] = Field(default_factory=dict)


class UseCaseIn(BaseModel):
    name: str
    kind: UseCaseKind
    description: str = ""
    source_refs: list[SourceRef] = Field(default_factory=list)
    current_model: ModelRef | None = None
    profile: Profile | None = None  # null → workspace default
    gates: list[Gate] = Field(default_factory=list)
    metrics: list[MetricSpec] = Field(default_factory=list)
    judge: JudgeConfig | None = None  # null → workspace default
    io_spec: IOSpec = Field(default_factory=IOSpec)


class UseCasePatch(BaseModel):
    """PATCH body: any subset of UseCaseIn fields."""
    name: str | None = None
    description: str | None = None
    current_model: ModelRef | None = None
    profile: Profile | None = None
    gates: list[Gate] | None = None
    metrics: list[MetricSpec] | None = None
    judge: JudgeConfig | None = None
    io_spec: IOSpec | None = None
    pinned: bool | None = None  # pinning sets pinned_at; unpinning clears it


class RunBrief(BaseModel):
    id: UUID
    status: RunStatus
    finished_at: datetime | None = None
    recommendation_headline: str | None = None
    est_monthly_savings_usd: float | None = None


class UseCase(UseCaseIn):
    id: UUID
    workspace_id: UUID
    case_count: int = 0
    latest_run: RunBrief | None = None
    created_by: Literal["mcp", "dashboard"] = "dashboard"
    created_at: datetime
    updated_at: datetime | None = None  # last change to the use case or any of its cases
    pinned: bool = False
    pinned_at: datetime | None = None


class CaseIn(BaseModel):
    # {"vars": {...}} fills io_spec.user_template, or {"messages": [...]} in OpenAI chat format.
    # Image input: add "images": ["https://<supabase>/storage/v1/object/public/cases/<file>.png"];
    # they are sent as image_url content parts. Store files in the Supabase bucket "cases", not as base64.
    input: dict[str, Any]
    reference: Any | None = None  # expected JSON / label / text; null if none
    tags: list[str] = Field(default_factory=list)
    source: CaseSource = "repo"


class Case(CaseIn):
    id: UUID
    use_case_id: UUID
    # Edits don't touch past runs: their results keep what was run. updated_at later than a run's
    # finished_at means "edited after that run" (the dashboard shows it).
    updated_at: datetime | None = None


class CasePatch(BaseModel):
    """PATCH /api/use-cases/{id}/cases/{case_id}: any subset. "reference": null clears it."""
    input: dict[str, Any] | None = None
    reference: Any | None = None
    tags: list[str] | None = None


class GenerateCasesIn(BaseModel):
    n: int = 20
    strategy: Literal["auto", "schema_first", "persona_grid"] = "auto"


# --- catalogue ---------------------------------------------------------------

class CatalogModel(BaseModel):
    """A row of catalog/models.json, trimmed for the API."""
    id: str
    provider: Provider
    name: str
    type: Literal["text", "vision", "embedding"]
    input_modalities: list[str]
    verified: dict[str, bool]  # text, vision, tools, json_schema, reasoning
    context_length: int | None
    pricing_usd_per_1m: dict[str, float | None]  # input, output, cached_input
    shortlist: bool
    role: str | None  # frontier | value | small | specialist | baseline
    aa_index: int | None
    license: str | None = None
    legacy: bool = False


# --- metric bank (metric-bank/, owner: Jad) --------------------------------------

class MetricInfo(BaseModel):
    """A row of metric-bank/data/metric-bank.json, trimmed for the API. Metric ids everywhere
    (MetricSpec, Gate, scores) are bank ids; aliases (e.g. label_accuracy) are accepted on input."""
    id: str
    name: str
    category: str
    description: str
    measures: str
    method: str            # deterministic | llm_judge | log_derived | …
    direction: str | None  # higher_better | lower_better
    unit: str | None
    score_min: float | None
    score_max: float | None
    utility_axis: str      # quality (may enter Q) | speed | cost | gate_only | none (reported only)
    gate_suitable: bool
    suggested_gate: str | None
    default_for_kinds: list[str]
    required_inputs: list[str]
    selector_priority: str | None
    aliases: list[str]


class ScorecardBrief(BaseModel):
    """Input to the bank's selector (metric_bank.selector.select). Only kind is required;
    every flag defaults to "not mentioned". Discovery fills it from what it saw in the code."""
    kind: UseCaseKind
    industry: str = "general"
    narrative: str = ""
    user_facing: bool | None = None
    waiting: bool | None = None          # caller waits for the answer (default: kind != batch)
    has_schema: bool | None = None
    has_reference: bool | None = None
    numeric_fields: bool | None = None
    tools: bool | None = None
    multi_step_agent: bool | None = None
    ocr: bool | None = None
    word_errors: bool | None = None
    layout_boxes: bool | None = None
    knowledge_base: bool | None = None
    hard_grounding: bool | None = None
    citations_required: bool | None = None
    baseline_present: bool | None = None
    open_ended_without_spec: bool | None = None
    reasoning_models: bool | None = None
    phi_or_customer_data: bool | None = None
    secrets_possible: bool | None = None
    regulated_advice: bool | None = None
    untrusted_context: bool | None = None
    banned_strings: Any | None = None
    length_bounded: bool | None = None
    has_constraints: bool | None = None
    brand_voice: bool | None = None
    feedback_text: bool | None = None  # scored label/grade plus written feedback a person reads: rubric_score joins quality
    has_key_points: bool | None = None
    retrieval_evaluated: bool | None = None
    recall_matters: bool | None = None
    must_abstain_when_unknown: bool | None = None
    executable_tests: bool | None = None
    code_can_merge: bool | None = None
    locale: str | None = None
    monthly_volume: int | None = None


class Scorecard(BaseModel):
    """Selector output. metrics + gates drop straight into UseCaseIn."""
    kind: UseCaseKind
    always_on: list[str]
    speed_ranking: str | None           # ttft_ms | e2e_ms | task_e2e_ms | None (batch)
    speed_also_report: list[str]
    quality: list[str]                  # 1–5 ids, all with utility_axis == "quality"
    quality_alternates: list[str]
    judging: list[str]                  # at most one judge id, also listed in quality
    also_report: list[str]              # e.g. cer, wer: reported, never in Q
    reliability_extra: list[str]
    notes: list[str]
    metrics: list[MetricSpec]           # = quality, weight 1 each
    gates: list[Gate]                   # risk gates + task gates, parsed from "<= 0.01"


# --- runs --------------------------------------------------------------------

def _default_references() -> list[ModelRef]:
    return [ModelRef(provider="openrouter", model="openai/gpt-6.1-sol", params={"reasoning_effort": "medium"}),
            ModelRef(provider="openrouter", model="openai/gpt-6-luna", params={"reasoning_effort": "medium"})]


class RunIn(BaseModel):
    """candidates: open-weight models from GET /api/models (others → 422).

    references: closed frontier models, run on the same cases × repeats for comparison only, never
    ranked or recommended. use_case.current_model is added as one more reference ("today") when it
    is a closed model. The first reference is the pairwise opponent (pairwise_vs_baseline).

    Omitted fields inherit the workspace: candidates [] → auto-pick within workspace.candidate_pool,
    repeats null → default_repeats, references null → default_references.
    """
    use_case_id: UUID
    candidates: list[ModelRef] = Field(default_factory=list)
    repeats: int | None = Field(default=None, ge=1, le=10)
    references: list[ModelRef] | None = None
    include_references: bool = True
    confirm_cost_usd: float | None = None  # required by POST /api/runs; must be ≥ estimate


class EstimateLine(BaseModel):
    provider: Provider
    model: str
    calls: int
    est_cost_usd: float


class Estimate(BaseModel):
    calls: int
    est_input_tokens: int
    est_output_tokens: int
    est_cost_usd: float  # candidates + references
    judge_cost_usd: float  # every juror
    total_usd: float
    per_candidate: list[EstimateLine]
    # what the run would use after inheritance (so the caller sees and can confirm the same run)
    candidates: list[ModelRef] = Field(default_factory=list)
    references: list[ModelRef] = Field(default_factory=list)
    repeats: int = 3
    max_run_cost_usd: float | None = None  # the workspace cap
    over_cap: bool = False  # total_usd > max_run_cost_usd: POST /api/runs will refuse it (422)


class Stat(BaseModel):
    """Aggregate of one metric for one candidate, over cases × repeats."""
    mean: float
    std: float
    ci_low: float  # 95% bootstrap CI
    ci_high: float
    n: int


class Pct(BaseModel):
    p50: float
    p95: float


class Scores(BaseModel):
    quality: float  # 0–1, weighted mean of quality metrics
    speed: float    # 0–1 vs profile targets
    cost: float     # 0–1 vs profile targets
    utility: float  # Q^wq · S^ws · C^wc


class CandidateResult(BaseModel):
    """A leaderboard row. References (is_reference) are measured the same way but never ranked,
    never on the Pareto front and never recommended; failed_gates is informative for them."""
    candidate_key: str  # "nebius:zai-org/GLM-5.3", "openrouter:openai/gpt-6.1-sol@medium"
    provider: Provider
    model: str
    is_reference: bool
    reference_label: str | None = None  # "GPT-6.1 Sol", "today" (the use case's current model)
    reasoning_effort: str | None = None  # pinned effort; "default" = the provider's own default
    avg_reasoning_tokens: float | None = None  # per call (usage.completion_tokens_details.reasoning_tokens)
    dropped_params: list[str] = []  # use-case params this endpoint rejects, e.g. ["temperature"]: ran at its default
    n: int
    quality: Stat
    metrics: dict[str, Stat]
    ttft_ms: Pct | None
    e2e_ms: Pct
    tokens_per_s: float | None
    cost_per_call_usd: float
    cost_per_success_usd: float | None
    error_rate: float
    scores: Scores
    passed_gates: bool
    failed_gates: list[str]
    pareto: bool
    rank: int | None  # null if disqualified, and always null for references


class ParetoPoint(BaseModel):
    candidate_key: str
    label: str
    quality: float
    cost_per_success_usd: float | None
    latency_ms: float
    is_reference: bool  # draw as a grey reference line/point, never on the front
    pareto: bool


class Recommendation(BaseModel):
    """Compared with reference_key: the best reference by quality (usually GPT-6.1 Sol)."""
    candidate_key: str
    provider: Provider
    model: str
    headline: str  # "Switch to GLM-5.3-Flash: 97% of GPT-6.1 Sol's quality at 1/20 of the cost"
    reasons: list[str]
    reference_key: str | None = None
    quality_vs_reference_pct: float | None
    cost_multiple_vs_reference: float | None  # 0.05 = 20× cheaper
    latency_delta_ms: float | None  # candidate − reference, p95
    statistical_tie_with: list[str] = Field(default_factory=list)
    est_monthly_savings_usd: float | None = None  # vs the "today" reference, when there is one


class Progress(BaseModel):
    done: int
    total: int
    errors: int
    judged: int = 0
    judge_total: int = 0


class Run(BaseModel):
    id: UUID
    use_case_id: UUID
    status: RunStatus
    progress: Progress
    candidates: list[ModelRef]
    references: list[ModelRef] = Field(default_factory=list)  # as run, incl. "today" when added
    repeats: int
    est_cost_usd: float
    actual_cost_usd: float
    judge_agreement: float | None = None  # share of judged results where both jurors agree; null if < 2 judged
    created_at: datetime
    started_at: datetime | None
    finished_at: datetime | None
    error: str | None = None
    leaderboard: list[CandidateResult] = Field(default_factory=list)  # partial while running
    pareto_points: list[ParetoPoint] = Field(default_factory=list)
    recommendation: Recommendation | None = None  # only when status == "done"


class ResultOut(BaseModel):
    id: UUID
    candidate_key: str
    case_id: UUID
    repeat_idx: int
    output: dict[str, Any]  # {"text": …, "json": …, "tool_calls": …}
    timing: dict[str, float | None]  # ttft_ms, e2e_ms, tokens_per_s
    usage: dict[str, Any]
    cost_usd: float | None
    error: str | None
    scores: dict[str, float]
    # {"mode", "score", "winner", "agreement": bool | None, "abstained": ["openrouter:openai/gpt-6-luna@low"],
    #  "reasoning": "<juror>: …  |  <juror>: …" (all jurors, one string),
    #  "jurors": [{"key", "reasoning_effort", "score", "reasoning", "winner"}]}
    judge: dict[str, Any] | None


class ResultsPage(BaseModel):
    items: list[ResultOut]
    next_cursor: str | None


Workspace.model_rebuild()  # ModelRef / _default_references are defined after Workspace
Me.model_rebuild()
