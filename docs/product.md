# Product concept

## Problem

- **Open-weight models now cover most production LLM work** at a fraction of closed-model prices. They can also be self-hosted, which matters for health and finance.
- **Choosing one is hard:**
  - There are 15+ strong families, and each is served by 5–25 providers.
  - The same weights behave differently per provider. Kimi K2 tool-call accuracy ranged from 72% to 100% across vendors.
  - Public leaderboards measure generic skills, not *your* task.
- **Most teams never build their own evals.** It feels like a project of its own, so they stay on whatever model they picked first.

## Who it's for

The pitch covers both groups:
- **Cost cutters.** Startups and dev teams on GPT or Claude who want to move suitable workloads to cheaper open models without losing quality. *Lead the demo with this.*
- **Sovereignty seekers.** Regulated companies (health, finance, public sector) that need open weights they can host in their own cloud or region.

## Core flow

```
 ┌──────────────┐   MCP / prompt    ┌──────────────┐
 │ Coding agent │ ────────────────▶ │  BIY   │
 │ in your repo │  use cases,       │  API + MCP   │
 └──────────────┘  datasets, prefs  └──────┬───────┘
        ▲                                  │ runs candidates
        │ recommendation (+ later: PR)     ▼ (your keys)
        │                         ┌─────────────────────┐
        └──────────────────────── │ Nebius, OpenRouter, │
                                  │ HF, … + baseline    │
                                  └─────────────────────┘
```

1. **Onboard.** Create a workspace and set the company **trade-off profile** (see below).
2. **Connect providers.**
   - Add API keys for **Nebius Token Factory** (the hackathon default), OpenRouter, the HF router and others. BIY then lists every open-weight model those keys can reach.
   - Optionally add a **baseline connection** (OpenAI or Anthropic) so your current closed model is benchmarked alongside.
3. **Discover use cases.**
   - Run `/mcp__biy__scan_repo` in Claude Code, or paste the [discovery prompt](discovery-prompt.md).
   - The agent finds call sites and classifies each one: chat, batch, extraction, agent, classification, RAG, summarisation.
   - For each, it proposes weights, gates and metrics, extracts example inputs, and creates the use case in BIY.
4. **Review in the dashboard.**
   - Every discovered use case appears with its source location, current model, suggested metrics and seed cases.
   - The user adjusts as needed, and can add synthetic cases, upload CSV/JSONL, or import from Langfuse/LangSmith.
5. **Run.**
   - Pick candidates. Defaults are suggested from the use case: tool support, context length, budget.
   - See the **cost estimate**, then run.
6. **Decide.** Each use case gets a recommendation card, a Pareto chart and a leaderboard, with drill-down to individual outputs.

## Key concepts

| Concept | Meaning |
|---|---|
| **Workspace** | A company or team. Holds connections, a default trade-off profile and an API key for MCP. |
| **Trade-off profile** | Weights for **quality / speed / cost** that sum to 100, plus targets such as "TTFT ≤ 500 ms" or "≤ $0.002 per call". Set per workspace and overridable per use case. |
| **Use case** | One job an LLM does in your product, e.g. "support chat reply" or "extract invoice fields". Has a kind, source location(s), current model, profile override, gates and metrics. |
| **Dataset** | The test cases for a use case. Each case has an input (messages, variables, tools) and an optional reference answer or label. Sources: repo, synthetic, upload, trace import, public suite. |
| **Metric** | Something measured per case or per run, picked from the [catalogue](metrics-catalog.md). Quality metrics depend on the kind of task; speed, cost and reliability are always measured. |
| **Gate** | A hard requirement. Candidates that fail it are disqualified, e.g. "JSON schema valid ≥ 99%" or "p95 latency ≤ 2 s". |
| **Connection** | Credentials for one provider: Nebius, OpenRouter, HF, Together, Groq, … A connection can also be a **baseline connection** (OpenAI or Anthropic) used only for the current model and, if chosen, the judge. |
| **Candidate** | What actually gets benchmarked: **one model** plus settings (reasoning effort, temperature), served through one connection. Nebius `-fast` variants (e.g. `Qwen3.5-397B-A17B-fast`) count as separate candidates, because they trade cost for speed. Comparing the same model across providers is a later feature; the data model already allows it. |
| **Baseline** | The model the use case runs on today (often GPT or Claude). It is benchmarked like a candidate, but it is never recommended. Every result is compared against it. |
| **Run** | Candidates × cases × repeats. Produces results, aggregates and a recommendation. |
| **Judge** | The model that scores open-ended outputs. **The user chooses per benchmark.** If nobody picks one, the default is **the strongest open model on the connected providers**. Where possible, it comes from a different family than the candidates. A closed model can be chosen if a baseline connection exists. |

## Trade-off profile: how the sliders work

- **Weights: three sliders** (quality, speed, cost) that sum to 100.
  - Default workspace profile: 60 / 20 / 20.
  - The discovery agent proposes overrides per use case:

| Use case kind | Quality | Speed | Cost | Speed is measured as |
|---|---|---|---|---|
| User-facing chat | 50 | 35 | 15 | TTFT p95 + tokens/s |
| Background batch | 50 | 0 | 50 | — (throughput only) |
| Extraction (sync, in a request) | 60 | 25 | 15 | E2E p95 |
| Agent / tool use | 70 | 10 | 20 | E2E per task |
| Classification / routing | 50 | 30 | 20 | E2E p95 |

- **Targets** set what "good enough" means on each axis. For example, a TTFT target of 300 ms with 1500 ms as the maximum acceptable. Each axis is scored 0–1 against its targets (see [architecture: scoring](architecture.md#scoring)).
- **Gates** are hard filters that apply before any weighting.

## What the dashboard shows

- **Overview.** All use cases, each with its current model, recommended candidate and estimated monthly savings.
- **Use case page.**
  - Profile sliders and gates.
  - Metrics, which you can add or remove from the catalogue.
  - Dataset table.
  - Candidate picker.
  - Run history.
- **Run results:**
  - Recommendation card
  - Pareto scatter (quality vs cost per successful task, with latency as the dot size)
  - Leaderboard with confidence intervals
  - Per-case output viewer with side-by-side diffs and judge reasoning
- **Connections.** Add or test keys, and see which models and providers are reachable.
- **Settings.** Default profile, default judge, MCP API key.

## Out of scope for the hackathon

- Self-hosted / BYOC runner
- Fine-tuning
- Automatic PRs that swap the model in code (this is the stretch goal)
- Scheduled re-runs and drift alerts
- Closed-model candidates. Closed models appear only as the *baseline* (the current model) and as an optional judge.
- Comparing one model across several providers (one candidate per model for now).
