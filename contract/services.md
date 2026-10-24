# Service functions

REST routes and MCP tools are thin wrappers over these. **No feature exists in only one of them.** Types are from [schemas.py](schemas.py). All functions are `async` and take the caller's `workspace_id` first; it is omitted below.

Owners: **Raphaël** implements everything except `biy.metrics`, which is **Jad's**. The metric interface at the bottom is what Raphaël's runner calls, so the two can be built in parallel.

## `biy.services` (Raphaël)

```python
# workspace
async def get_me(user_id: UUID) -> Me
async def rotate_mcp_key() -> str                      # returns the new key once

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

METRICS: dict[str, MetricInfo]  # registry: id → MetricInfo(kind="deterministic"|"judge",
                                #   higher_is_better: bool, range=(0, 1), needs_reference: bool, description: str)

def score(metric_id: str, case: CaseView, output: OutputView, config: dict) -> float | None
# deterministic metrics: return a value in [0, 1] (None = not applicable, e.g. no reference)
# e.g. json_schema_valid, field_f1, exact_match, label_accuracy, cer, wer, bbox_iou, bbox_f1
# metrics where lower is better (cer, wer) are returned as 1 - value, so every score is "higher = better"

async def judge(metric_id: str, case: CaseView, output: OutputView,
                baseline: OutputView | None, config: dict, call_llm) -> JudgeResult
# metric_id in {"rubric_score", "pairwise_vs_baseline"}; call_llm(messages) -> str is passed in by the runner
# pairwise runs both orders; a winner counts only if both orders agree, otherwise tie (0.5)
# JudgeResult(score: float in [0, 1], reasoning: str, winner: "candidate"|"baseline"|"tie" | None)

def aggregate(values: list[float], n_boot: int = 1000, seed: int = 0) -> Stat
# mean, std, 95% bootstrap CI (percentile), n — over cases × repeats

def percentiles(values: list[float]) -> Pct    # p50, p95 for latency
```

`docs/metrics-catalog.md` lists the metric ids; Jad keeps it in sync with `METRICS`.
