# REST API

Base path `/api`. All bodies are JSON. Shapes are the Pydantic models in [schemas.py](schemas.py), and every response has an example in [fixtures/](fixtures/). OpenAPI is served at `/api/openapi.json`.

## Auth

Every request carries `Authorization: Bearer <token>`. The token is one of:
- **Dashboard:** the Supabase access token (`supabase.auth.getSession()`). The API verifies it against the project's JWKS (`$SUPABASE_URL/auth/v1/.well-known/jwks.json`, ES256, audience `authenticated`). The first request from a new user (normally `GET /api/me`) creates their workspace.
- **MCP / scripts:** the workspace key `biy_…`. Only its hash is stored.

`401` means no or bad token. Every resource belongs to the caller's workspace; another workspace's ids return `404`.

## Errors

`{"detail": "message"}` with a 4xx/5xx status. Validation errors return `422` (FastAPI default).

## Endpoints

| Method | Path | Body | Returns | Fixture |
|---|---|---|---|---|
| GET | `/api/health` | — | `{"ok": true, "db": bool, "redis": bool}` | — |
| GET | `/api/me` | — | `Me` | `me.json` |
| POST | `/api/me/mcp-key` | — | `{"key": "biy_…"}`, shown **once**; replaces the old key | — |
| GET | `/api/models?shortlist=true&type=vision&provider=nebius` | — | `CatalogModel[]` (all filters optional) | `models.json` |
| GET | `/api/metrics?kind=extraction&category=vision` | — | `MetricInfo[]` from the metric bank (filters optional) | `metrics.json` |
| POST | `/api/metrics/select` | `ScorecardBrief` | `Scorecard`: the bank's selector picks metrics + gates for a use case | `scorecard.json` |
| GET | `/api/use-cases` | — | `UseCase[]` | `use_cases.json` |
| POST | `/api/use-cases` | `UseCaseIn` or `UseCaseIn[]` (bulk, used by discovery) | `UseCase` or `UseCase[]` | `use_case.json` |
| GET | `/api/use-cases/{id}` | — | `UseCase` | `use_case.json` |
| PATCH | `/api/use-cases/{id}` | `UseCasePatch` | `UseCase` | `use_case.json` |
| DELETE | `/api/use-cases/{id}` | — | `204` | — |
| GET | `/api/use-cases/{id}/cases` | — | `Case[]` | `cases.json` |
| POST | `/api/use-cases/{id}/cases` | `CaseIn[]` | `Case[]` | `cases.json` |
| DELETE | `/api/use-cases/{id}/cases/{case_id}` | — | `204` | — |
| POST | `/api/use-cases/{id}/cases/generate` | `GenerateCasesIn` | `Case[]` (source `synthetic`) | `cases.json` |
| GET | `/api/use-cases/{id}/runs` | — | `RunBrief[]`, newest first | — |
| POST | `/api/runs/estimate` | `RunIn` (`confirm_cost_usd` ignored) | `Estimate` | `estimate.json` |
| POST | `/api/runs` | `RunIn` with `confirm_cost_usd ≥ estimate.total_usd` | `Run` (status `queued`), `202` | `run_running.json` |
| GET | `/api/runs/{id}` | — | `Run`. **The dashboard polls this every 2 s** until status is `done`, `failed` or `cancelled` | `run_running.json`, `run_done.json` |
| POST | `/api/runs/{id}/cancel` | — | `Run` | — |
| GET | `/api/runs/{id}/results?candidate_key=&case_id=&cursor=&limit=50` | — | `ResultsPage` | `results.json` |

### Rules worth knowing

- **Cost confirmation:** `POST /api/runs` returns `409 {"detail": "...", "estimate": Estimate}` if `confirm_cost_usd` is missing or below the estimate. The MCP run tool shows that estimate to the user and asks before retrying.
- **Candidates:** `ModelRef.provider` + `model` must match a row of `GET /api/models` (`id` + `provider`). Image-input use cases accept only models with `verified.vision == true`; others return `422`.
- **Candidates are open-weight only** (rows of `GET /api/models`); anything else is `422`.
- **References:** closed frontier models, by default `openrouter:openai/gpt-6.1-sol@medium` and `openrouter:openai/gpt-6-luna@medium` (`RunIn.references`, `include_references`). The use case's `current_model` is added as one more reference labelled `"today"` when it is a closed model. References run on the same cases × repeats and show in the leaderboard and Pareto points with `is_reference: true` and a `reference_label`. They are **never ranked, never on the Pareto front, never recommended**; their `failed_gates` is informative only. The recommendation is measured against the best reference by quality (`reference_key`, `quality_vs_reference_pct`, `cost_multiple_vs_reference`). `pairwise_vs_baseline` compares candidates with the first reference.
- **Reasoning effort** is part of a model's identity: `params.reasoning_effort` (`none` … `xhigh`), and the candidate key becomes `"<provider>:<model>@<effort>"`. Automatic candidates get `medium` on OpenRouter where the endpoint supports it. Nebius models keep the provider default and show `reasoning_effort: "default"`, because the parameter is accepted but models react inconsistently (GLM-5.3-Flash nearly stops reasoning at any value). `CandidateResult.avg_reasoning_tokens` is the mean per call.
- **Judges = a jury** (`JudgeConfig.judges`, default GPT-6 Luna + DeepSeek-V4.1-Flash, both `reasoning_effort: "low"`). Rubric: mean of the jurors. Pairwise: both orders × every juror; a win only if all non-abstaining jurors agree, else a tie. A juror abstains on its own model family (and, pairwise, on the reference's). Each judged result stores `judge.jurors`, `judge.abstained` and `judge.agreement`; `Run.judge_agreement` is the share of results where the jurors agreed.
- **Leaderboard while running:** `Run.leaderboard` fills in as results arrive (partial `n`). `recommendation` is `null` until `status == "done"`.
- **Metric ids are metric-bank ids** (`metric-bank/data/metric-bank.json`). Aliases are accepted on input and stored as the canonical id (`label_accuracy` → `classification_accuracy`). Unknown ids return `422`.
- **What enters the quality score:** only metrics whose bank `utility_axis` is `quality`. `cer` / `wer` are reported values (lower is better, can exceed 1); `character_accuracy` / `word_accuracy` are what gets scored. Gate-only metrics (e.g. `error_rate`) are gates, never averaged.
- **Candidate key:** `"<provider>:<model>"`, e.g. `"nebius:zai-org/GLM-5.3-Flash"`. It is used in `leaderboard`, `pareto_points`, `results` and `recommendation`.

## MCP (`/mcp`)

Streamable HTTP, same auth (workspace key). The tools wrap the same service functions as the REST routes ([services.md](services.md)):

| Tool | Wraps |
|---|---|
| `biy_workspace_get` | `GET /api/me` |
| `biy_models_list` | `GET /api/models` |
| `biy_metrics_list` | `GET /api/metrics` |
| `biy_metrics_select` | `POST /api/metrics/select`. Discovery calls this per use case and puts `metrics` + `gates` into `biy_use_cases_create` |
| `biy_use_cases_list` / `_create` / `_update` | use-case routes (`_create` takes a list) |
| `biy_cases_add` / `biy_cases_generate` | case routes |
| `biy_runs_estimate` / `biy_runs_start` / `biy_runs_status` | run routes (`_start` needs `confirm_cost_usd`) |
| prompt `scan_repo` | discovery prompt; shows up as `/mcp__biy__scan_repo` |
