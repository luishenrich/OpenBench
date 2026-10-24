# REST API

Base path `/api`. All bodies are JSON. Shapes are the Pydantic models in [schemas.py](schemas.py), and every response has an example in [fixtures/](fixtures/). OpenAPI is served at `/api/openapi.json`.

## Auth

Every request carries `Authorization: Bearer <token>`. The token is one of:
- **Dashboard:** the Supabase access token (`supabase.auth.getSession()`). The API verifies it against the project's JWKS (`$SUPABASE_URL/auth/v1/.well-known/jwks.json`, ES256, audience `authenticated`). The first request from a new user (normally `GET /api/me`) creates their workspace.
- **MCP / scripts:** the workspace key `biy_…`. Only its hash is stored.

- **MCP clients (OAuth):** `/mcp` answers `401` with `WWW-Authenticate: Bearer resource_metadata="https://biy.studypdf.net/.well-known/oauth-protected-resource"` before any JSON-RPC handling when the token is missing or bad. The metadata (RFC 9728, also at `…/oauth-protected-resource/mcp`) names Supabase Auth's OAuth 2.1 server, so clients sign the user in with the browser. The resulting access token is a Supabase JWT (ES256, same JWKS); accepted audiences: `authenticated` and `https://biy.studypdf.net/mcp`. Its `sub` maps to the user's workspace exactly like a dashboard session.

`401` means no or bad token. Every resource belongs to the caller's workspace; another workspace's ids return `404`.

## Errors

`{"detail": "message"}` with a 4xx/5xx status. Validation errors return `422` (FastAPI default).

## Endpoints

| Method | Path | Body | Returns | Fixture |
|---|---|---|---|---|
| GET | `/api/health` | — | `{"ok": true, "db": bool, "redis": bool}` | — |
| GET | `/api/me` | — | `Me` | `me.json` |
| PATCH | `/api/workspace` | `WorkspacePatch` (any subset; `null` resets a field to the built-in default) | `Workspace` | `me.json` |
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
| PATCH | `/api/use-cases/{id}/cases/{case_id}` | `CasePatch` (`input`, `reference` (null clears), `tags`) | `Case`. Past runs keep their results; `Case.updated_at` > a run's `finished_at` means "edited after that run" | — |
| DELETE | `/api/use-cases/{id}/cases/{case_id}` | — | `204` | — |
| POST | `/api/use-cases/{id}/cases/generate` | `GenerateCasesIn` | `Case[]` (source `synthetic`) | `cases.json` |
| POST | `/api/use-cases/{id}/upload-url?field=` | — | `{url, field, expires_in_s, curl}`: single-use, 15 min. `field`: `system_prompt`, `user_template`, `response_schema`, `tools`, `cases_jsonl`, `image` | — |
| POST | `/api/uploads/{token}` | raw bytes (`curl --data-binary @file`) | `{ok, field, …}`. **No bearer token**: the URL is the credential. Text → `io_spec.<field>`, JSON fields parsed, `cases_jsonl` → bulk add, `image` → bucket `cases`, returns its public URL | — |
| GET | `/api/use-cases/{id}/runs` | — | `RunBrief[]`, newest first | — |
| POST | `/api/runs/estimate` | `RunIn` (`confirm_cost_usd` ignored) | `Estimate` | `estimate.json` |
| POST | `/api/runs` | `RunIn` with `confirm_cost_usd ≥ estimate.total_usd` | `Run` (status `queued`), `202` | `run_running.json` |
| GET | `/api/runs/{id}` | — | `Run`. **The dashboard polls this every 2 s** until status is `done`, `failed` or `cancelled` | `run_running.json`, `run_done.json` |
| POST | `/api/runs/{id}/cancel` | — | `Run` | — |
| GET | `/api/runs/{id}/results?candidate_key=&case_id=&cursor=&limit=50` | — | `ResultsPage` | `results.json` |

### Rules worth knowing

- **Cost confirmation:** `POST /api/runs` returns `409 {"detail": "...", "estimate": Estimate}` if `confirm_cost_usd` is missing or below the estimate. The MCP run tool shows that estimate to the user and asks before retrying.
- **Gates on unmeasured metrics.** A gate whose metric has no value for any candidate in the run (never computed, e.g. a planned metric) is *not evaluated*: it goes to `CandidateResult.unmeasured_gates`, never to `failed_gates`, and the recommendation's first reason lists it. A metric measured for some candidates but missing for another still fails that candidate.
- **The confirmed cost holds.** A run stops starting calls once it has spent 1.2 × `confirm_cost_usd`. It then finishes as `done` with what's measured and judged so far; results no juror reached stay unjudged, not scored 0. `Run.error` says `Stopped at $X, over the confirmed $Y (+20%)…`. Calls already in flight finish. The jury estimate counts every juror × every output (× 2 orders for pairwise). Abstentions aren't subtracted, so it's an upper bound. Each juror call is counted with its reasoning tokens, by pinned effort.
- **Candidates:** `ModelRef.provider` + `model` must match a row of `GET /api/models` (`id` + `provider`). Image-input use cases accept only models with `verified.vision == true`; others return `422`.
- **Candidates are open-weight only** (rows of `GET /api/models`); anything else is `422`.
- **References:** closed frontier models, by default `openrouter:openai/gpt-6.1-sol@medium` and `openrouter:openai/gpt-6-luna@medium` (`RunIn.references`, `include_references`). The use case's `current_model` is added as one more reference labelled `"today"` when it is a closed model. References run on the same cases × repeats and show in the leaderboard and Pareto points with `is_reference: true` and a `reference_label`. They are **never ranked, never on the Pareto front, never recommended**; their `failed_gates` is informative only. The recommendation is measured against the best reference by quality (`reference_key`, `quality_vs_reference_pct`, `cost_multiple_vs_reference`). `pairwise_vs_baseline` compares candidates with the first reference.
- **Reasoning effort** is part of a model's identity: `params.reasoning_effort` (`none` … `xhigh`), and the candidate key becomes `"<provider>:<model>@<effort>"`. Automatic candidates get `medium` on OpenRouter where the endpoint supports it. Nebius models keep the provider default and show `reasoning_effort: "default"`, because the parameter is accepted but models react inconsistently (GLM-5.3-Flash nearly stops reasoning at any value). `CandidateResult.avg_reasoning_tokens` is the mean per call.
- **Params per endpoint.** The use case's `io_spec.params` go to every model, adapted to what its endpoint accepts. Params the pinned OpenRouter upstream doesn't list are dropped, as are sampling params on closed OpenAI reasoning models (`temperature`, `top_p`, penalties, `logit_bias`, `logprobs`). Those models then run at the provider's default, and `CandidateResult.dropped_params` lists the params dropped (e.g. `["temperature"]`). Reasoning models get 2,048 extra `max_tokens` on top of the use case's own limit, and never less than 4,096, so a short limit isn't spent on thinking with no answer left.
- **Judges = a jury** (`JudgeConfig.judges`, default GPT-6 Luna (`low`) + DeepSeek-V4.1-Flash (`low`) + MiniMax-M3.1-Flash (`low`), three families so every output keeps ≥ 2 votes). Rubric: mean of the jurors. Pairwise: both orders × every juror; a win only if all non-abstaining jurors agree, else a tie. A juror abstains on its own model family (and, pairwise, on the reference's). Each judged result stores `judge.jurors`, `judge.abstained` and `judge.agreement`; `Run.judge_agreement` is the share of results where the jurors agreed. **Fairness:** the recommendation's "X% of <reference>'s quality" uses only the jurors that judged both the candidate and the reference when there are ≥ 2 (stated in `reasons`).
- **Inheritance:** use case field → workspace → built-in default. A use case's `profile` / `judge` = `null` inherits (`PATCH {"profile": null}` resets it). A run inherits what `RunIn` leaves out: `candidates: []` → auto-pick within `workspace.candidate_pool`, `repeats: null` → `default_repeats`, `references: null` → `default_references`. `Estimate` returns what the run would use (`candidates`, `references`, `repeats`) and `over_cap` when `total_usd` > `workspace.max_run_cost_usd`; `POST /api/runs` refuses such a run (`422`).
- **Use case list fields:** `pinned`, `pinned_at` (set by `PATCH {"pinned": true}`, cleared on unpin; pinning doesn't change `updated_at`) and `updated_at` (any edit to the use case or its cases).
- **Runs refuse a use case with no prompt** (`io_spec.system_prompt` and `user_template` both empty, unless the cases carry `messages`): `422`.
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
| `biy_use_cases_list` / `_create` / `_update` | use-case routes, **compact replies** (`id, name, kind, url, metrics, case_count, prompt_attached, needs, latest_run`); `_create` takes a list. `prompt_attached` = `system_prompt` **or** `user_template` is set (one is enough; a chat use case may have only a system prompt). `needs`: `prompt not attached`, `no cases` (or `needs page images` when the description says so), `no metrics`. Templates fill `{{name}}` / `{name}` only for variables the case has; anything else (`{{cite:…}}`, `{{1}}`) is left as is, so no escaping |
| `biy_use_cases_fill` | one call for scan_repo step 3: `patch` (io_spec, profile, metrics/gates) + optional `brief` (BIY selects metrics + gates when the patch has none) + optional `cases`; sets `setup_state: complete` unless `complete: false` |
| `biy_use_cases_get` | `GET /api/use-cases/{id}` (the full object) |
| `biy_cases_list` / `_add` / `_update` / `_delete` / `_generate` | case routes; `_list` is paginated and compact (previews), `_delete` takes a list of ids |
| `biy_workspace_update` | `PATCH /api/workspace` |
| `biy_upload_url` | `POST /api/use-cases/{id}/upload-url` |
| `biy_runs_estimate` / `biy_runs_start` / `biy_runs_status` | run routes (`_start` needs `confirm_cost_usd`) |
| prompt `scan_repo` | discovery prompt; shows up as `/mcp__biy__scan_repo` |
