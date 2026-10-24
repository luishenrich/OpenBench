"""Shared API shapes. Frozen at T+0:30; owner: Raphaël. Ask before changing.

The REST API, the MCP tools and the frontend all use these shapes. JSON field names are
exactly the attribute names below. Every example in contract/fixtures/ validates against them.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, Field

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


class JudgeConfig(BaseModel):
    provider: Provider = "nebius"
    model: str = "deepseek-ai/DeepSeek-V4.1-Flash-1017"
    mode: Literal["rubric", "pairwise"] = "rubric"
    rubric: str | None = None


class Workspace(BaseModel):
    id: UUID
    name: str
    default_profile: Profile
    default_judge: JudgeConfig


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

class RunIn(BaseModel):
    use_case_id: UUID
    candidates: list[ModelRef]
    repeats: int = 3
    include_baseline: bool = True  # also run use_case.current_model, if set
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
    est_cost_usd: float  # candidates + baseline
    judge_cost_usd: float
    total_usd: float
    per_candidate: list[EstimateLine]


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
    candidate_key: str  # "nebius:zai-org/GLM-5.3"
    provider: Provider
    model: str
    is_baseline: bool
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
    rank: int | None  # null if disqualified


class ParetoPoint(BaseModel):
    candidate_key: str
    label: str
    quality: float
    cost_per_success_usd: float | None
    latency_ms: float
    is_baseline: bool
    pareto: bool


class Recommendation(BaseModel):
    candidate_key: str
    provider: Provider
    model: str
    headline: str  # "Switch to GLM-5.3-Flash: 97% of GPT-4.1's quality at 1/9 of the cost"
    reasons: list[str]
    quality_vs_baseline_pct: float | None
    cost_multiple_vs_baseline: float | None  # 0.11 = 9× cheaper
    latency_delta_ms: float | None
    statistical_tie_with: list[str] = Field(default_factory=list)
    est_monthly_savings_usd: float | None = None


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
    repeats: int
    est_cost_usd: float
    actual_cost_usd: float
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
    judge: dict[str, Any] | None  # {"mode", "score", "reasoning", "winner"}


class ResultsPage(BaseModel):
    items: list[ResultOut]
    next_cursor: str | None
