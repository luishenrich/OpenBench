# Hackathon plan (final 4 hours)

> Replaces the 48h / 3-person plan. Written 2026-10-24 with ~4h left.
> Done so far: concept docs, research, and a **verified model catalogue** ([catalog/](../catalog/README.md)). It has 134 models probed for text, vision, tools and JSON, and a 29-model default shortlist ranked by the Artificial Analysis index.

## The demo (3 minutes)

We run BIY on a **real product: StudyPDF** (Luis's company, private repo `luishenrich/studypdf`), not on a sample app we wrote ourselves.

**Nobody picks the use cases in advance.** Finding and classifying them is BIY's job, so whatever our `scan_repo` prompt discovers live is what gets benchmarked. We don't hand-pick call sites, metrics or cases, and we don't tune the prompt to StudyPDF's file names. Hand-picking would be cheating: the demo exists to prove discovery works on an unfamiliar repo.

1. **Discovery.** In Claude Code, inside the StudyPDF repo, run `/mcp__biy__scan_repo`.
   - The agent finds the LLM call sites, classifies each one and creates the use cases.
   - It proposes weights, gates and metrics from the metrics bank, and takes the current model from the code.
   - It seeds cases from test data it finds in the repo, adds synthetic ones, and shows the cost estimate. We say "yes".
2. **Dashboard.** Log in (Supabase). The discovered use cases are there, and the runs fill in as the dashboard **polls every 2 s**.
   - Open one and show the leaderboard (**mean ± std, 95% bootstrap CI**) and the Pareto chart, with today's model as the baseline dot.
   - Use cases with image input only get candidates with **verified vision** from the catalogue.
3. **Recommendation** per use case: which open model to switch to, at what quality, cost and latency compared with today's model.
4. **MCP parity.** In Claude Code: "make cost more important for <use case> and re-run". The dashboard shows the new weights and the new ranking.

**Rules that keep it honest:**
- `scan_repo` and the metrics bank stay **generic**. We rehearse on StudyPDF **and** on at least one public open-source repo, to show discovery isn't tailored.
- Multi-step agents: the prompt's generic rule applies (benchmark single steps only). We don't skip or pick anything by hand.
- **Data:** only templates, schemas and test data from the repo go to providers, **never user uploads**.
- **Baseline:** the current model that discovery reports, run **through OpenRouter** (it serves closed models too), so no separate OpenAI or Google key.

**Backup.** Record one finished discovery + run before the demo. A seed script loads it if a provider rate-limits us live.

## Who does what

Three people, each with their own Claude Code. **Each person owns folders, not features**, so two Claudes never edit the same file.

| Person | Owns (folders) | In one line |
|---|---|---|
| **Luis** | `/frontend`, `Dockerfile`, `docker-compose.yml` + **every connection** | Dashboard (React + Vite + shadcn + Recharts); Supabase (Postgres + Auth), Upstash Redis, the Coolify app on the `studypdf` VPS, env vars, domain |
| **Raphaël** | `/backend` (except `backend/biy/metrics/`), `/contract`, `/prompts/scan_repo.md` | Backend + MCP: FastAPI app, `schema.sql`, providers (streaming, TTFT, cost), arq worker, ranking (gates → Pareto → utility), recommendation, FastMCP tools + `scan_repo`, seed/backup script |
| **Jad** | `backend/biy/metrics/`, `/prompts/judge/`, `docs/metrics-catalog.md` | Metrics bank + research: a **broad, generic** bank covering text, JSON/extraction, classification, vision (OCR text accuracy, bounding boxes) and judges (rubric + pairwise prompts and scoring); statistics (mean, std, p50/p95, 95% bootstrap CI); metric defaults per use-case kind that `scan_repo` can choose from |

**The contract (`/contract`) is shared and frozen at T+0:30.** Luis's Claude drafts it at kickoff so nobody waits; Raphaël owns it from then on. Anyone who needs a change asks Raphaël, who makes it and says so. The metric interface (`score(metric_id, case, output, config)` and `aggregate(values)`) is in `contract/services.md`, so Jad and Raphaël never wait on each other. Everyone builds against the contract and its fixture JSON, never against someone else's unfinished code.

**Model policy (decided 2026-10-24, 14:30):** candidates are open-weight only (the catalogue). Closed frontier models (`openai/gpt-6-luna`, `openai/gpt-6.1-sol` via OpenRouter BYOK) run only as grey reference lines, never ranked or recommended; they replace `gpt-4.1-mini` as the comparison. The judge is a jury of two from different families, GPT-6 Luna + DeepSeek-V4.1-Flash; each abstains on its own model family. Every reasoning-capable model runs with a pinned, displayed `reasoning_effort` (references `medium`). BYOK cost = `usage.cost_details.upstream_inference_cost`.

## Stack (final)

| Piece | Choice | Notes |
|---|---|---|
| Hosting | **Coolify on Luis's VPS** (`ssh studypdf`), live at **https://biy.studypdf.net** | Coolify project "BIY", compose app `biy` built from `main` of the public GitHub repo; `api` has the domain, `worker` none. Traefik + Cloudflare handle TLS. Deploys are triggered by Luis (no push webhook yet). The VPS has 12 vCPUs and ~13 GB of free RAM, and it also runs other production apps, so **set memory limits** (api 1 GB, worker 1 GB) |
| Containers | **One image, two services** | `api`: uvicorn running FastAPI. It serves REST at `/api/*`, MCP at `/mcp` and the **built Vite frontend** as static files (one domain, no CORS). `worker`: the same image running the arq worker. Multi-stage `Dockerfile` (node builds the frontend, python runs both) |
| DB | **Supabase Postgres** | Plain SQL migration (`contract/schema.sql`) run in the Supabase SQL editor; no Alembic. Use the **session pooler** URL: the direct connection is IPv6-only, and long-running containers don't need the transaction pooler |
| Auth | **Supabase Auth** | The dashboard logs in with Supabase, and the API verifies the Supabase JWT. **MCP uses a workspace API key** (bearer), stored hashed |
| Queue + worker | **Upstash Redis + arq** | A normal long-running worker: no function time limits, no self-chaining. `POST /api/runs` enqueues one job per run; the worker fans out candidates × cases × repeats with a **per-connection concurrency limit** and writes progress counters to Redis. Connects with the Upstash `rediss://` URL (TCP), not the REST API |
| Progress | **Polling every 2 s** | `GET /api/runs/{id}` returns done/total, partial leaderboard and errors. No SSE or WebSocket |
| Inference | **Nebius + OpenRouter**, keys from Coolify env | Candidate list comes from `catalog/models.json` (`shortlist: true` by default). OpenRouter calls pin the provider (`provider.only`, `allow_fallbacks: false`). Baseline: the use case's current model via OpenRouter |
| MCP | **FastMCP, Streamable HTTP**, mounted at `/mcp` | Same service functions as REST |

## Scope

**In:**
- Discovery over MCP, creating use cases + cases.
- Synthetic case generation (`cases_generate`).
- Cost estimate with confirmation before every run.
- **More cases and repeats:** default **50 cases per use case and 3 repeats**.
- Streaming calls with real TTFT.
- Deterministic metrics: `json_schema_valid`, `field_f1`, `exact_match`, `label_accuracy`.
- **Rubric judge and pairwise judge**, with pairwise running both orders against the baseline.
- Aggregation: **mean, std, p50/p95, 95% bootstrap CI** over cases × repeats.
- Gates → Pareto → utility, and a recommendation text with a "statistical tie" check.
- Supabase login.
- Deploy on Coolify.

**Out:**
- BYO keys stored per workspace (the demo uses our env keys; the data model keeps `connection`).
- Trace import and CSV upload.
- Cross-provider comparison.
- Scheduled re-runs.
- `apply_recommendation` PRs.

**Default judge:** DeepSeek-V4.1-Flash-1017 on Nebius. It has AA 45, the same score as GLM-5.3, at about 1/5 of the price: about $5 instead of ~$23 for the pairwise pass of the demo run. If DeepSeek is a candidate, the judge falls back to GLM-5.3-Flash.

## API contract (frozen at T+0:30 in `contract/api.md`; OpenAPI at `/api/openapi.json`)

| Method | Path | For |
|---|---|---|
| GET | `/api/me` | Workspace of the logged-in user, plus the MCP key's last 4 characters |
| GET | `/api/models?shortlist=true&type=vision` | Catalogue (from `catalog/models.json`) |
| GET / POST / PATCH | `/api/use-cases`, `/api/use-cases/{id}` | Use cases incl. profile weights, gates, metrics, judge |
| GET / POST | `/api/use-cases/{id}/cases` | Dataset |
| POST | `/api/use-cases/{id}/cases/generate` | Synthetic cases |
| POST | `/api/runs/estimate` | Cost and call count before a run |
| POST | `/api/runs` | Start a run; requires `confirm_cost_usd` |
| GET | `/api/runs/{id}` | Status, progress, leaderboard (mean, std, CI), Pareto points, recommendation. **Polled every 2 s** |
| GET | `/api/runs/{id}/results?candidate=&case=` | Per-case outputs + judge reasoning |
| — | `/mcp` | MCP: `scan_repo` prompt; tools for use cases, cases, cases_generate, estimate, run, run_status, set_profile |

## Timeline (T = now)

| Time | Luis | Raphaël (backend + MCP) | Jad (metrics bank + research) | Checkpoint |
|---|---|---|---|---|
| **T+0:00–0:30** | Give Jad read-only access to `luishenrich/studypdf` (for rehearsals); Supabase project + Auth + a public Storage bucket `cases` (case images), Upstash Redis, Coolify app from the GitHub repo + subdomain, env vars ([list below](#env-vars)); scaffold Vite + shadcn. Luis's Claude drafts `/contract` (`api.md`, `schemas.py`, `services.md`, `schema.sql`, fixtures) + `Dockerfile` / `docker-compose.yml` + backend skeleton | Streaming client for Nebius + OpenRouter with TTFT / E2E / tokens / cost (reuse `scripts/probe_models.py`, prices from `catalog/models.json`) | Research: which metrics per use-case kind, including vision tasks (start from [metrics-catalog.md](metrics-catalog.md) and [research/metrics.md](research/metrics.md)); extend the catalogue with IDs, inputs and defaults per kind | **T+0:30: contract frozen**; Luis runs `schema.sql`; first Coolify deploy is green |
| **T+0:30–1:30** | Pages against the contract fixtures: login, overview, use case (sliders, gates, dataset table), run view with 2 s polling | Use case + case CRUD on Supabase, catalogue endpoint, estimate, arq worker with per-connection concurrency, results into Supabase | Deterministic metrics (`json_schema_valid`, `field_f1`, `exact_match`, `label_accuracy`, `cer`, `wer`, `bbox_iou`, `bbox_f1`) + stats (mean, std, p50/p95, bootstrap CI) behind the `services.md` interface, with unit tests on made-up examples | **T+1:30: one real run end-to-end on Coolify** (1 use case, 3 candidates, deterministic metrics, results in Supabase) |
| **T+1:30–2:30** | Leaderboard (mean ± std, CI bars), Pareto chart, recommendation card, per-case output viewer; switch fixtures → real API | Ranking (gates → Pareto → utility) + recommendation text; FastMCP tools + a generic `scan_repo` (rehearse on StudyPDF and on a public repo, without naming either in the prompt); cost confirmation in the run tool; baseline via OpenRouter | Rubric + pairwise judge (both orders): prompts in `/prompts/judge/`, parsing, judge reasoning stored; metric defaults per kind; `cases_generate` (synthetic cases) | **T+2:30: feature freeze.** Discovery in Claude Code (inside StudyPDF) creates its use cases and starts a run |
| **T+2:30–3:15** | Integration fixes, empty/error states | Full rehearsal: discovery on StudyPDF, then the runs (~8 candidates × 50 cases × 3 repeats per use case); seed script for the backup run | Sanity-check the scores of the demo run (does the judge agree with a human on 10 cases?) | Demo flow works **twice in a row** |
| **T+3:15–3:45** | Polish, pitch slides | Fix demo blockers; README "how to run" | Metric/research slide for the pitch: why these metrics, judge mitigations | Video recorded |
| **T+3:45–4:00** | Buffer, submit | Buffer | Buffer | Submitted |

**Working rules:**
- **Team notes:** check `scripts/notes.sh` after every pull (open notes for you are in `notes/to-<you>/`). Delete a note when it's handled. See [notes/README.md](../notes/README.md).
- Small PRs, merged by their author. Say "merged X" in the team chat.
- `git pull` before starting anything new, and at every checkpoint.
- Point your Claude at the contract, not at someone else's code. For example: "build the run page from `contract/api.md` and `contract/fixtures/run_done.json`".
- Keys live only in `.env` / Coolify, never in prompts or other files.

## Cut list (in this order if we fall behind)

1. Per-case side-by-side diff (keep a plain output list)
2. `cases_generate` (only cases the agent extracts from the repo)
3. MCP parity step in the demo (show it in the dashboard instead)
4. Rubric judge for chat (keep pairwise only)
5. Baseline run (compare against the best candidate instead)
6. Supabase login (single demo workspace, no auth)

Pairwise judge and bootstrap CIs are **not** on the cut list. They are what makes the recommendation trustworthy.

## Budget

- **Demo run:** per discovered use case, 8 candidates × 50 cases × 3 repeats = 1,200 calls. If discovery finds ~4 use cases, that's 4,800 calls.
  - About **$3** with the 8 cheapest shortlist models, **$8** with mid-priced ones, and **$46** with the 8 most expensive (Kimi-K3 alone ~$17).
  - Pick a mix: 2–3 frontier models plus cheap ones.
- **Judge:** about $5 per demo run with DeepSeek-V4.1-Flash-1017.
- **Funding:**
  - Nebius models run on the hackathon credits.
  - OpenRouter is real money; the key is capped at $50 and $0.04 is used so far.
  - The baseline (today's closed model) runs on OpenRouter too, so it is real money as well.
- These figures assume ~2K input and 1.5K output tokens per call. Reasoning models can write more, so trust the runner's estimate before each run.

## Env vars

All set in Coolify (both services), except the MCP key.

| Var | Used by | Set by |
|---|---|---|
| `DATABASE_URL` | api, worker | Luis: Supabase **session pooler** URL (`aws-0-eu-west-1.pooler.supabase.com:5432`); the direct host is IPv6-only |
| `REDIS_URL` | api, worker | Luis: Upstash `rediss://default:<token>@<host>:6379` |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY` | api (JWKS) + frontend build (`VITE_` prefix, as build args) | Public values, in [.env.example](../.env.example). Tokens are ES256: the API verifies them against `$SUPABASE_URL/auth/v1/.well-known/jwks.json`, no JWT secret |
| `NEBIUS_API_KEY`, `OPENROUTER_API_KEY` | api, worker + local `.env` | Luis (already in local `.env`) |
| `BIY_MCP_KEY` | Claude Code config | Created by the API (`/api/me`); only its hash is stored |
