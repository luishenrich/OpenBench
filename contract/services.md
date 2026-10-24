# Service functions

REST routes and MCP tools are thin wrappers over these. **No feature exists in only one of them.** Types are from [schemas.py](schemas.py). All functions are `async` and take the caller's `workspace_id` first; it is omitted below.

Owners: **Raphaël** implements everything except `biy.metrics`, which is **Jad's**. The metric interface at the bottom is what Raphaël's runner calls, so the two can be built in parallel.

## `biy.services` (Raphaël)

```python
# workspace
async def get_me(user_id: UUID) -> Me
async def rotate_mcp_key() -> str                      # returns the new key once

# metric bank (reads metric-bank/data/metric-bank.json, no DB); implemented in contract/metric_bank_mapping.py
def list_metrics(kind: str | None = None, category: str | None = None) -> list[MetricInfo]
def scorecard(brief: ScorecardBrief) -> Scorecard

# catalogue (reads catalog/models.json, no DB)
def list_models(shortlist: bool | None = None, type: str | None = None,
                provider: str | None = None) -> list[CatalogModel]

# use cases + cases
async def list_use_cases() -> list[UseCase]
async def create_use_cases(items: list[UseCaseIn], created_by: str = "dashboard") -> list[UseCase]
async def get_use_case(use_case_id: UUID) -> UseCase
async def update_use_case(use_case_id: UUID, patch: UseCasePatch) -> UseCase
async def delete_use_case(use_case_id: UUID) -> None
async def list_cases(use_case_id: UUID) -> list[Case]
async def add_cases(use_case_id: UUID, items: list[CaseIn]) -> list[Case]
async def generate_cases(use_case_id: UUID, req: GenerateCasesIn) -> list[Case]

# runs
async def estimate_run(req: RunIn) -> Estimate
async def start_run(req: RunIn) -> Run                 # raises CostNotConfirmed(estimate) → 409
async def get_run(run_id: UUID) -> Run                 # leaderboard computed from results so far
async def cancel_run(run_id: UUID) -> Run
async def list_results(run_id: UUID, candidate_key: str | None, case_id: UUID | None,
                       cursor: str | None, limit: int = 50) -> ResultsPage
```

## `biy.worker` (Raphaël, arq)

```python
async def execute_run(ctx, run_id: str) -> None
# 1. load run + cases; build jobs = candidates × cases × repeats
# 2. per-connection semaphore (Nebius / OpenRouter limits); stream each call → timing, usage, cost
# 3. score each result with biy.metrics.score(); write result rows; bump Redis progress
# 4. judge pass (biy.metrics.judge) for judge metrics; then status "done"
```

## `biy.metrics` (Jad): the metric interface

**Metric ids, directions and selection rules come from `metric-bank/`** (`data/metric-bank.json`, `selector.py`). `biy.metrics` is the runtime on top of it: it computes the scores the bank describes.

```python
@dataclass
class CaseView:
    input: dict            # case.input (vars / messages / images)
    reference: Any | None  # case.reference
    io_spec: IOSpec        # incl. response_schema

@dataclass
class OutputView:
    text: str | None
    json: Any | None       # parsed JSON if the output was JSON, else None
    tool_calls: list | None

METRICS: dict[str, MetricInfo]   # built from the bank: id → MetricInfo (direction, range, utility_axis, …)
                                 # look-ups accept aliases (contract.metric_bank_mapping.resolve_id)

def score(metric_id: str, case: CaseView, output: OutputView, config: dict) -> float | None
# deterministic metrics. Returns the value in the bank's own unit and direction
# (None = not applicable, e.g. no reference). No "1 - value" flipping:
#   cer, wer            → reported, lower is better, can exceed 1, never in Q
#   character_accuracy, word_accuracy → 0–1 higher is better, these enter Q
# first set for the demo: json_schema_valid, field_accuracy, field_f1 (its own metric, see below),
# exact_match, classification_accuracy, character_accuracy, word_accuracy, cer, wer, bbox_iou, bbox_f1

async def judge(metric_id: str, case: CaseView, output: OutputView,
                baseline: OutputView | None, config: dict, call_llm) -> JudgeResult
# metric_id in {"rubric_score", "pairwise_vs_baseline"}; call_llm(messages) -> str is passed in by the runner
# pairwise runs both orders; a winner counts only if both orders agree, otherwise tie (0.5)
# JudgeResult(score: float in [0, 1], reasoning: str, winner: "candidate"|"baseline"|"tie" | None)

def aggregate(values: list[float], n_boot: int = 1000, seed: int = 0) -> Stat
# mean, std, 95% bootstrap CI (percentile), n — over cases × repeats

def percentiles(values: list[float]) -> Pct    # p50, p95 for latency
```

**Quality score Q** (Raphaël's ranking): weighted mean over the use case's metrics whose `utility_axis == "quality"` only. Speed and cost stay on their own axes; gate-only metrics are only gates.

**Open on the bank side (Jad):** `field_f1` is still an alias of `field_accuracy`, but it measures something else (F1 punishes extra or hallucinated fields), so it becomes its own row. `select()` should not require `id`/`title`/`narrative` (the adapter fills them for now).

`docs/metrics-catalog.md` lists the metric ids; Jad keeps it in sync with the bank, at least for every id `score()` and `judge()` accept.
