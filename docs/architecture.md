# Architecture

## Overview

```
React dashboard (Vite + TS)
        │  REST (JSON)
        ▼
FastAPI app ──────────────┬── /api/*   REST for the dashboard
  │                       └── /mcp     FastMCP (Streamable HTTP), same services
  │
  ├── services/            one service layer shared by REST and MCP
  │     use_cases, datasets, connections, catalog, runs, scoring, synth
  ├── providers/           OpenAI-compatible client + auth adapters
  ├── runner/              async worker: executes runs, streams results
  ├── metrics/             metric implementations (catalogue)
  └── Postgres             all state; secrets encrypted at rest
```

**Rule:** REST and MCP are thin layers over the same `services/` functions. **No feature exists in only one of them.** This is how we get "everything in the dashboard is also in MCP".

## Stack

| Layer | Choice | Why |
|---|---|---|
| API | FastAPI + Pydantic v2 | Async, typed, auto OpenAPI |
| MCP | FastMCP, mounted into FastAPI at `/mcp` | One deploy, same auth and services |
| DB | Postgres (Supabase or Neon) via SQLAlchemy 2 + Alembic | JSONB for flexible case and result payloads |
| Worker | `arq` (Redis) or an in-process asyncio task queue for the demo | Runs take minutes; stream progress |
| LLM calls | `openai` Python SDK with a per-connection `base_url` | Every provider is OpenAI-compatible |
| Frontend | React + Vite + TS, TanStack Query, shadcn/ui, Recharts | Fast to build, good charts |
| Auth | Workspace API key (bearer) for MCP and API; simple email login for the dashboard | OAuth for MCP is post-hackathon |
| Deploy | Fly.io / Railway (API + worker) + Vercel (frontend) | Quick |

**We are not using LiteLLM as a dependency.** Versions 1.82.7 and 1.82.8 shipped a credential stealer, and we hold customers' keys. We can reuse its price JSON as data. Pin every dependency with hashes (`uv lock`).

## Data model

```
workspace(id, name, default_profile jsonb, default_judge jsonb, api_key_hash)

connection(id, workspace_id, provider, role, base_url, auth_type, secret_enc,
           extra jsonb, status, last_checked_at)
  provider ∈ nebius | openrouter | hf_router | together | fireworks | groq |
             cerebras | deepinfra | azure | bedrock | vertex |
             openai | anthropic | openai_compatible
  role     ∈ candidates | baseline        -- baseline = closed provider for current model / judge

use_case(id, workspace_id, name, kind, description,
         source_refs jsonb,          -- [{repo, path, line, symbol}]
         current_model jsonb,        -- {provider, model, params}
         profile_override jsonb,     -- {weights:{q,s,c}, targets:{...}}
         gates jsonb,                -- [{metric_id, op, value}]
         metrics jsonb,              -- [{metric_id, weight, config}]
         judge jsonb,                -- null → workspace default
         io_spec jsonb,              -- system prompt, template, tools, response schema, params
         created_by)                 -- 'mcp' | 'dashboard'

case(id, use_case_id, input jsonb, reference jsonb, tags text[],
     source)                         -- repo | synthetic | upload | trace | public

candidate(id, model_id, connection_id, params jsonb, is_baseline bool)
  -- hackathon: one candidate per model (no cross-provider comparison yet)

run(id, use_case_id, status, candidate_ids, repeats, estimate_usd,
    actual_usd, started_at, finished_at, config_snapshot jsonb)

result(id, run_id, candidate_id, case_id, repeat_idx,
       output jsonb, usage jsonb,    -- tokens in/out/cached/reasoning
       timing jsonb,                 -- ttft_ms, e2e_ms, tps
       cost_usd, error, scores jsonb) -- {metric_id: value}

run_summary(run_id, candidate_id, aggregates jsonb, utility, rank,
            passed_gates bool, pareto bool)
```

`kind` ∈ `chat | batch | extraction | agent | classification | rag | summarization | generation | other`.

## Model catalogue

- **Primary source (hackathon): Nebius Token Factory** `GET https://api.tokenfactory.nebius.com/v1/models` with a Bearer key.
  - It returns IDs such as `deepseek-ai/DeepSeek-V3.2`, `Qwen/Qwen3.5-397B-A17B`, `moonshotai/Kimi-K2.5`, `zai-org/GLM-5`, `openai/gpt-oss-120b-fast`, `MiniMaxAI/MiniMax-M2.5`.
  - Many models have a **`-fast` variant**.
  - `?verbose=true` **returns pricing, context length, modality, quantization, supported features, region and rate limits** (checked 2026-10-24). No separate price file is needed.
  - The verified catalogue lives in [catalog/](../catalog/README.md). It is built by `scripts/probe_models.py` (real API calls per model) and `scripts/build_catalog.py`.
  - A US region exists at `api.tokenfactory.us-central1.nebius.com/v1`.
- **Metadata enrichment:** OpenRouter `/api/v1/models` and the HF router `/v1/models` (both public) supply license, HF repo, context length and tool support, matched by HF repo ID. Refresh on startup and then hourly.
- **Normalised form:** `catalog_entry(model_id, family, hf_repo, license, license_tier, provider, context, max_out, price_in, price_out, price_cached, supports_tools, supports_json_schema, quantization)`.
- **Open-weight filter:** the model has an `hugging_face_id` / HF repo, plus a manual override list (see [research §5](research/providers-and-models.md#5-defining-open-weight-in-code)).
- **Other direct connections** (OpenRouter, Together, Groq, Azure, …) map onto the same catalogue by HF repo. They come after the hackathon, except OpenRouter, which is a fallback if Nebius rate limits bite.
- **Baseline connections** (OpenAI, Anthropic) are not in the open-weight catalogue. The user picks the current model by name, or the discovery agent fills it in from the code.

## Provider layer

```python
class ProviderAdapter(Protocol):
    def client(self, conn: Connection) -> AsyncOpenAI: ...        # base_url + auth
    def build_request(self, cand: Candidate, req: ChatRequest) -> dict: ...
        # OpenRouter: provider={only:[p], allow_fallbacks:false}, require_parameters
        # reasoning flags: reasoning_effort | reasoning.effort | chat_template_kwargs
    def parse_usage(self, resp) -> Usage: ...                     # incl. cached + reasoning tokens
```

- **Always stream**, so TTFT is real. Timestamps:
  - `t0` when the request is sent
  - `t_first` at the first non-empty content or reasoning delta
  - `t_last` at the final chunk
- Request `stream_options: {include_usage: true}`.
- **Per-connection concurrency limiter.** Retries back off on `x-ratelimit-*` headers.
- **Throttling is recorded separately** from latency, so throttling never counts as "slow".

## Runner

1. **Estimate.** Tokens are estimated from the case inputs × expected output length × endpoint price. Show the total, and **block the run until the user confirms** (in MCP, the agent has to pass `confirm_cost_usd`).
2. **Warm-up.** One discarded request per candidate.
3. **Execute** candidates × cases × repeats (default 3) with bounded concurrency. Write each `result` as soon as it arrives, and push progress over SSE to the dashboard.
4. **Score.**
   - Deterministic metrics run inline.
   - LLM-judge metrics run as a second pass, in batches, through the judge connection.
5. **Aggregate.** Per candidate: means, p50/p95, error rates, cost per successful task, and bootstrap 95% CIs.
6. **Rank.** Gates → Pareto → utility, then write `run_summary`.

## Scoring

Details and rationale are in [research/metrics.md §6](research/metrics.md#6-aggregation-recommendation).

1. **Gates.** A candidate is disqualified if any gate fails, e.g. `json_schema_valid ≥ 0.99`, `error_rate ≤ 0.01`, `ttft_p95 ≤ 1000`.
2. **Quality** `Q ∈ [0,1]` is the weighted mean of the use case's quality metrics, each already on an absolute 0–1 scale. It is **not** min-max normalised against the other candidates.
3. **Speed** `S` and **cost** `C ∈ [0,1]` are scored against the profile's targets on a log scale:

   ```
   score(x) = 1                                  if x ≤ target
            = 1 - log(x/target) / log(max/target) if target < x < max
            = 0                                  if x ≥ max
   ```

   - Speed uses the metric that fits the kind: TTFT p95 for chat, E2E p95 for sync extraction, ignored for batch.
   - Cost uses **cost per successful case**.
4. **Utility** `U = Q^wq · S^ws · C^wc`, a weighted geometric mean with the weights normalised to sum to 1. A zero on any weighted axis sinks the candidate.
5. **Pareto flag.** Mark candidates that no other candidate beats on Q, cost and latency at once.
6. **Recommendation.** The highest-U candidate that passes the gates. If its CI overlaps with the next candidate's, say "statistical tie" and prefer the cheaper one.
7. **Card text** compares against the baseline (the current model, if benchmarked) and shows:
   - quality % of the baseline (or of the best candidate if there is no baseline)
   - cost multiple
   - latency
   - estimated monthly savings at the user-entered call volume

## Judge

- Configured per use case, falling back to the workspace default.
- `judge = {connection_id, model, mode: rubric|pairwise|g_eval, rubric, reference_required}`.
- **Default when unset:** the strongest open model reachable on the workspace's connections.
  - Rank by a static list we maintain, e.g. on Nebius: Kimi-K2.5 → Qwen3.5-397B → DeepSeek-V3.2 → GLM-5. Artificial Analysis index can serve as a tiebreaker.
  - Skip any model that is itself a candidate in the run, or from the same family, and fall back to the next one.
- **The user may pick a closed judge** (Anthropic or OpenAI) through a baseline connection. That is the only place closed models are used, apart from the baseline.
- **Mitigations:**
  - Pairwise judging runs both orders.
  - The judge's family differs from the candidates' family where possible.
  - The judge version is pinned.
  - Judge reasoning is stored for every score.
  - Optional: human labels on ~20 cases to report judge–human agreement.

## Security and privacy

- Connection secrets are encrypted with a KMS or Fernet key from the environment, and are never returned by the API or MCP. Only the last 4 characters are shown.
- The workspace MCP API key is stored hashed and can be rotated.
- The discovery prompt tells the agent to send **templates, schemas and redacted samples only**. It must not send secrets or real customer data.
- We prefer ZDR provider settings (`zdr=true` on OpenRouter) and expose them as a connection option.
