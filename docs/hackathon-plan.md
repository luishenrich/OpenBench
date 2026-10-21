# Hackathon plan (48h, 3 people)

## The demo we're building toward (3 minutes)

1. **Setup.** We have a sample app: a fintech or health "support + document" app in a demo repo. It uses GPT for:
   - **support chat**: user-facing, streaming
   - **invoice/claim extraction**: JSON schema
   - **nightly ticket summarisation**: batch
   - **intent classification**
2. **Discovery.** In Claude Code, run `/mcp__biy__scan_repo`. The agent finds the 4 use cases, sets weights (chat favours speed, batch favours cost), seeds cases from fixtures, generates synthetic ones, and shows the cost estimate. We say "yes".
3. **Dashboard.** The use cases appear live and the runs stream in on **Nebius Token Factory**. We open the extraction use case and show the leaderboard and the Pareto chart, with the current GPT model as the baseline dot and base vs `-fast` variants side by side.
4. **Recommendations.** "Move 3 of 4 use cases to open models: −84% cost, quality within CI. Keep chat on X because TTFT gate…".
5. **MCP parity.** In Claude Code: "make cost more important for summarisation and re-run". The slider moves in the dashboard.

**Pre-run results as a backup.** Live runs depend on provider rate limits.

## Team split

| Person | Owns | Day 1 | Day 2 |
|---|---|---|---|
| **A: Frontend** | React dashboard | Scaffold Vite + shadcn; pages: Overview, Use case (profile sliders, gates, metrics, dataset table), Connections, Settings; mock API | Run view with live progress (SSE), leaderboard, Pareto chart (Recharts), recommendation card, per-case output viewer; polish |
| **B: Backend + runner** | FastAPI, DB, providers, runner, scoring | Schema + migrations; connections (**Nebius** first, then the OpenAI baseline; OpenRouter as fallback); catalogue sync; streaming client with timing; runner with concurrency; deterministic metrics | Judge metrics (rubric, pairwise); aggregation, CIs, gates/Pareto/utility; cost estimate; recommendation text; deploy |
| **C: MCP + discovery + data** | FastMCP tools, discovery prompt, synthetic data, demo repo | Demo repo with 4 realistic call sites + fixtures; FastMCP mounted; tools for workspace/use cases/cases/metrics; `scan_repo` prompt; test end-to-end in Claude Code | `cases_generate` (schema_first, persona_grid); runs tools; iterate on the prompt until discovery is reliable on the demo repo; pitch deck and demo script |

## Milestones

| Time | Milestone |
|---|---|
| H+2 | Repo scaffolded (`/backend`, `/frontend`, `/demo-app`), DB up, API contract agreed (OpenAPI = source of truth) |
| H+8 | One benchmark runs end-to-end from a script: 1 use case, 3 candidates via OpenRouter, deterministic metric, results in DB |
| H+16 | MCP: Claude Code creates use cases + cases in the DB from the demo repo |
| H+24 | Dashboard shows use cases and a finished run with a leaderboard. **Feature freeze for new concepts.** |
| H+32 | Judge metrics, Pareto, recommendation card, live progress |
| H+40 | Full demo flow works twice in a row; backup results recorded |
| H+44 | Polish, pitch, video recording |
| H+48 | Submit |

## Cut list (in this order if we fall behind)

1. Public suites / priors
2. Trace import (Langfuse/LangSmith), CSV upload (keep JSONL)
3. Every provider except Nebius + the OpenAI baseline
4. Bootstrap CIs (show simple std dev)
5. Pairwise judge (keep rubric)
6. Dashboard login (single demo workspace)

## Stretch

- `apply_recommendation`: the agent opens a PR that swaps the model at the call site
- Throughput / concurrency test for batch use cases
- Scheduled canary re-runs per provider with drift alerts
- Self-hosted cost comparison (GPU $/hr → $/1M tokens)

## Budget

- One full demo run: 4 use cases × 6 candidates × ~50 cases × 3 repeats, plus judging. Estimated at **$5–30**, depending on which models we pick.
- Inference runs on the **Nebius hackathon credits**. Check the credit amount and the rate limits on day 1, because they determine the number of repeats and the concurrency.
- A small OpenAI or Anthropic budget is needed for baseline runs (and for a closed judge, if someone picks one). **Cap the spend on each key.**
