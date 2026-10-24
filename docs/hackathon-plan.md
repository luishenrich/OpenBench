# Hackathon plan (4h30, 3 people, each with Claude Code)

With Claude Code writing most of the code, the bottleneck is no longer typing. It is **people waiting on each other** and **integration**. So the plan is built around three rules:

1. **Freeze the contract in the first 20 minutes.** After that, everyone builds against shared schemas and fixture JSON, never against someone else's unfinished code.
2. **Each person owns folders, not features.** Two Claudes never edit the same file.
3. **Integrate at fixed checkpoints**, not continuously. Between checkpoints, merge your own small PRs into `main` whenever your part works.

## The demo we're building toward (3 minutes)

1. **Setup.** A sample fintech "support + document" app in `/demo-app` uses GPT for:
   - **support chat**: user-facing, streaming
   - **invoice extraction**: JSON schema
   - **nightly ticket summarisation**: batch
   - **intent classification**
2. **Discovery.** In Claude Code, run `/mcp__biy__scan_repo`. The agent finds the 4 use cases, sets weights (chat favours speed, batch favours cost), seeds cases from fixtures, generates synthetic ones, and shows the cost estimate. We say "yes".
3. **Dashboard.** The use cases appear and the runs fill in on **Nebius Token Factory**. We open the extraction use case and show the leaderboard and the Pareto chart, with the current GPT model as the baseline dot and the cheap `-Flash` models next to the big ones.
4. **Recommendations.** "Move 3 of 4 use cases to open models: −84% cost, quality within noise. Keep chat on X because of the TTFT gate…".
5. **MCP parity.** In Claude Code: "make cost more important for summarisation and re-run". The slider moves in the dashboard.

**Pre-recorded results as a backup.** Live runs depend on provider rate limits.

## Scope for 4h30

Already done: the verified model catalogue ([catalog/models.json](../catalog/README.md)) with prices, capabilities and rate limits. The backend reads it directly; there is no catalogue sync to build.

| In | Out (cut up front) |
|---|---|
| Nebius only for candidates; OpenAI only for the baseline | OpenRouter, other providers, provider comparison |
| SQLite (one file), no migrations | Postgres, Alembic |
| In-process `asyncio` runner | Redis / arq worker |
| No auth: one hard-coded demo workspace | Login, OAuth, MCP API keys |
| Dashboard polls every 2 s | SSE / websockets |
| Deterministic metrics + **one** rubric judge | Pairwise judge, bootstrap CIs (show mean ± std dev) |
| ~15–20 cases per use case, **1 repeat**, 5–6 candidates | Upload, trace import, public suites |
| Runs locally on a laptop | Deploy |

**Suggested candidates** (all on Nebius, all in [catalog/shortlist.json](../catalog/shortlist.json), all verified for tools + JSON schema): `DeepSeek-V4.1-Flash-1017`, `GLM-5.3`, `MiniMax-M3.1-Flash`, `GLM-5.3-Flash`, `DeepSeek-V4-Flash-0731`, `Qwen3.8-27B`. **Judge:** `Kimi-K3` (top of the shortlist that is not a candidate).

## Who owns what

| Person | Owns (folders) | In one line |
|---|---|---|
| **A: Frontend** | `/frontend` | The dashboard, built on fixture JSON first, then on the real API |
| **B: Backend + runner** | `/backend` (except `backend/app/mcp/`), `/contract` | API, SQLite, Nebius client, runner, metrics, scoring, recommendation |
| **C: MCP + discovery + data** | `/demo-app`, `backend/app/mcp/`, `/prompts` | Demo repo, MCP tools, `scan_repo` prompt, synthetic cases, pitch |

**Shared and frozen after 0:20:** `/contract` — owned by B. Anyone who needs a change asks B in the chat; B makes it and says so.

## Timeline

T = time since kickoff.

### 0:00–0:20 · Kickoff: freeze the contract (everyone)

All three in the same room, 20 minutes, no coding outside of this:

- **B** writes, with Claude, `/contract`:
  - `schemas.py`: Pydantic models for `UseCase`, `Case`, `Candidate`, `Run`, `Result`, `RunSummary`, `Recommendation`, `Profile` (from [architecture.md](architecture.md#data-model)).
  - `api.md`: the list of REST endpoints with one example request and response each.
  - `services.md`: the Python signatures of the service functions MCP will call (e.g. `create_use_cases(items) -> list[UseCase]`, `start_run(use_case_id, candidate_ids, confirm_cost_usd) -> Run`).
  - `fixtures/`: one JSON file per endpoint response, including **one finished run** with realistic numbers.
- **A** scaffolds `/frontend` (Vite + React + TS + shadcn + Recharts + TanStack Query) while B writes.
- **C** scaffolds `/demo-app`: the 4 call sites and their fixtures.
- **0:15** everyone reads the contract together, fixes names, B merges it to `main`. **Contract frozen.**

### 0:20–1:45 · Build alone, against the contract

| A: Frontend | B: Backend + runner | C: MCP + discovery + data |
|---|---|---|
| Overview page (use cases, current model, recommendation, savings) | FastAPI app + SQLite tables from `schemas.py` | Finish `/demo-app`: realistic prompts, schemas and test fixtures per call site |
| Use case page: profile sliders, gates, metrics, dataset table | Services for use cases, cases, candidates, runs (CRUD) | `backend/app/mcp/`: FastMCP tools (`biy_*`) calling the service functions from `services.md` (stubbed until B's land) |
| Run page: leaderboard, Pareto chart, recommendation card | Nebius client: streaming, TTFT / E2E / tokens, cost from `catalog/models.json` prices | `scan_repo` prompt in `/prompts` (from [discovery-prompt.md](discovery-prompt.md)) |
| All on `fixtures/` through one `api.ts` client | Async runner: candidates × cases, concurrency within Nebius rate limits | Synthetic case generation (`schema_first` for extraction, persona grid for chat) |
| | Deterministic metrics: `json_schema_valid`, field accuracy, label accuracy | Test the MCP server from Claude Code against B's stub app |

**Goal at 1:45:** each part works on its own. One script runs 1 use case × 3 candidates on Nebius and stores results.

### 1:45–2:00 · Checkpoint 1: first integration (everyone)

- Everyone merges their PR into `main`, pulls, and runs the app.
- A switches `api.ts` from fixtures to the real API.
- C mounts the MCP server into B's FastAPI app at `/mcp`.
- **Done when:** Claude Code, through MCP, creates 1 use case with cases, starts a run, and the run appears in the dashboard.

### 2:00–3:15 · Build the rest

| A: Frontend | B: Backend + runner | C: MCP + discovery + data |
|---|---|---|
| Live progress (poll the run every 2 s) | Rubric judge metric (`Kimi-K3`) for chat and summarisation | Make `scan_repo` reliable on `/demo-app`: 4 use cases found, every time |
| Per-case output viewer: candidate vs baseline, judge reasoning | Scoring: per-axis 0–1 vs targets, weighted utility, gates, Pareto flag | `biy_runs_start` with the cost confirmation; `biy_use_cases_update` for the profile |
| Sliders and gates save to the API; re-run button | Cost estimate before a run; recommendation text per use case | OpenAI baseline: make sure the current GPT model runs as the baseline candidate |
| Models page from the catalogue (verified capabilities, prices) | Monthly savings estimate on the overview | **Run all 4 use cases for real** and save the results as the backup |

### 3:15–3:30 · Checkpoint 2: full demo, first run (everyone)

- Merge, pull, run the whole 3-minute demo once, end to end.
- Write down every bug. **Feature freeze: from here, fixes only.**

### 3:30–4:10 · Fix and polish

- **A:** UI bugs, empty and loading states, make the Pareto chart and recommendation card look great.
- **B:** backend bugs, speed up the runner if the demo is slow, make sure the backup results load from the DB.
- **C:** pitch deck (problem → demo → differentiation → business) and the demo script. **Record a backup video** of the full flow.

### 4:10–4:30 · Rehearse and submit

- Run the demo twice in a row from a clean state.
- Submit, with the video and the repo link.

## Working with Claude Code in parallel

- **Each person runs Claude in their own folders only.** The [CLAUDE.md](../CLAUDE.md) ownership table tells your Claude what it may touch.
- **Small PRs, merged by their author.** No waiting for review between checkpoints; just say "merged X" in the team chat.
- **`git pull` before you start anything new**, and always at checkpoints.
- **Point Claude at the contract**, not at someone else's code: "build the run page from `contract/api.md` and `contract/fixtures/run.json`".
- **Never paste keys into prompts or files other than `.env`.**

## If we fall behind (cut in this order)

1. Models page in the dashboard
2. Monthly savings estimate (show cost per call instead)
3. Synthetic generation for chat (keep schema-first extraction + repo fixtures)
4. Rubric judge (keep deterministic metrics only: extraction + classification still make the demo)
5. Live discovery in the demo (show the result of a pre-recorded `scan_repo` run)

## Stretch (only if everything works at 3:15)

- `apply_recommendation`: the agent opens a PR that swaps the model at the call site
- OpenRouter candidates, with a pinned upstream provider

## Budget

- Full demo run: 4 use cases × 6 candidates × ~20 cases × 1 repeat, plus judging. Roughly **$1–5** on Nebius.
- Check the Nebius credit and rate limits at 0:20 (the catalogue already records rate limits per model).
- A small OpenAI budget for the baseline. **Cap the spend on the key.**
