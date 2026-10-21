# BIY — Benchmark It Yourself

**Benchmarks for your own use cases, so you can pick the right open-weight model for each job.**

Open-weight models (Qwen, DeepSeek, GLM, Kimi, gpt-oss, Gemma, Llama, Mistral, …) are now good enough for most production work. Which one is *right*, and on which provider, depends on your use case. Public leaderboards won't tell you whether Qwen3.5-397B beats DeepSeek V3.2 or the cheaper gpt-oss-120b for *your* support chat, *your* invoice extraction, or *your* nightly ad-copy batch.

BIY lets any team, in health, finance, ad tech or anywhere else, build those benchmarks in minutes:

1. **Point your coding agent at your repo.** It runs in Claude Code, Cursor or VS Code over MCP. It finds every LLM call site and agent, classifies each use case, and creates a benchmark for each one.
2. **Set what matters.** Choose a company-wide trade-off between **quality, speed and cost**, then override it per use case. A user-facing chat cares about time-to-first-token; a background batch job cares about cost.
3. **Connect your providers.** Add your own keys for Nebius Token Factory (our hackathon provider), OpenRouter, Hugging Face, Together, Groq, … Add your current closed provider (OpenAI or Anthropic) too, so it can serve as the **baseline**.
4. **Run.** BIY runs every candidate model, plus your current model as the baseline, on your test cases. It measures quality, latency and cost on the same run.
5. **Get a recommendation per use case.** For example: *"Support chat → Qwen3.5-397B-fast on Nebius: 96% of your current model's quality, 7× cheaper, TTFT 180 ms."* You also get the Pareto chart behind it.

Everything you can do in the dashboard, you can also do over MCP.

## Status

Hackathon project (48h). Nothing is built yet. This repo holds the concept, the research and the plan.

## Docs

| Doc | What's in it |
|---|---|
| [Product concept](docs/product.md) | Users, core flow, concepts, what the dashboard shows |
| [Architecture](docs/architecture.md) | Stack, data model, benchmark runner, scoring |
| [Metrics catalogue](docs/metrics-catalog.md) | Every metric an agent can pick for a use case, with IDs |
| [MCP server](docs/mcp-server.md) | Tool surface, how to connect from Claude Code, Cursor and VS Code |
| [Discovery prompt](docs/discovery-prompt.md) | The copy-paste prompt that scans a repo and creates benchmarks |
| [Hackathon plan](docs/hackathon-plan.md) | 48h plan for 3 people, demo script |
| [Open questions](docs/open-questions.md) | Decisions still to make |
| Research: [metrics](docs/research/metrics.md) · [providers & models](docs/research/providers-and-models.md) · [MCP, discovery & competitors](docs/research/mcp-discovery-and-competitors.md) | Background research, Oct 2026 |

## Stack (planned)

- **Backend:** Python, FastAPI, FastMCP (mounted in the same app), Postgres, background worker for runs
- **Frontend:** React (Vite) + TypeScript
- **Inference:** Nebius Token Factory for the hackathon (OpenAI-compatible); other providers through the same client with per-provider auth adapters

## License

TBD
