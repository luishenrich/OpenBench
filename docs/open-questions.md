# Open questions

## Decided (2026-10-21)

| Question | Decision |
|---|---|
| Scope | 48h, polished end-to-end demo |
| Stack | Python backend (FastAPI + FastMCP) + React frontend |
| Where runs execute / who pays | Our server, the **customer's own API keys** |
| Dataset sources | Repo extraction, synthetic generation, upload / trace import, public suites (all four, in that priority) |
| Judge | **The user chooses per benchmark** (closed or open model); workspace default configurable |
| Team | 3 people: frontend / backend + runner / MCP + discovery + data |
| Main output | **Recommendation per use case**, plus a Pareto chart and leaderboard |
| Audience | Both cost cutters (lead) and regulated / sovereignty buyers |
| Name | **BIY: Benchmark It Yourself** |
| Baseline | **Yes.** The current closed model (OpenAI/Anthropic) is benchmarked through an optional baseline connection, and every result is compared against it |
| Hackathon provider | **Nebius Token Factory** (OpenAI-compatible; hackathon credits). OpenRouter is the fallback. Azure is out of scope for the demo |
| Default judge | **The strongest open model on the connected providers**, skipping any model or family that is a candidate in the run |
| Candidates | **One per model.** No cross-provider comparison yet. Nebius `-fast` variants count as separate candidates |
| Timeline (2026-10-24) | **4 hours left, 2 roles**: Luis = frontend + all connections; Claude = backend, runner, scoring, MCP, demo repo. See [hackathon plan](hackathon-plan.md) |
| Infra | Supabase (Postgres + Auth), Upstash Redis, **Coolify on our VPS** (`studypdf`). No Vercel. Dashboard polls every 2 s |
| Worker (was Q6) | `arq` worker container on Upstash Redis |
| Hosting (was Q7) | Coolify on our VPS: one image, `api` (FastAPI + static frontend) and `worker` services |
| Repeats (was Q8) | 3 repeats, 50 cases per use case by default |
| Statistics | Show mean ± std **and** 95% bootstrap CI. Pairwise judge stays (both orders) |
| Default judge | DeepSeek-V4.1-Flash-1017 on Nebius (AA 45, ~1/5 of GLM-5.3's price); GLM-5.3-Flash if DeepSeek is a candidate |
| Model set | `catalog/models.json` with `shortlist: true` (29 models) as the default candidate pool |
| Repo name (was Q4) | Renamed to `BIY` |
| Nebius details (was Q5) | `?verbose=true` returns prices, context, modality, features, rate limits. Tools/JSON support verified per model in the catalogue |

## Still open

### Product
1. **Monthly volume.** Should the agent infer it, the user enter it, or should we skip savings in $?
2. **Who reviews synthetic cases?** Is draft → approve in the dashboard required before a run, or optional?
3. **One repo or many per workspace?** (`source_refs` already carries the repo.)

### Technical
9. **Agent use cases.** Benchmarking multi-step agents means replaying tool results. For the hackathon, single-step tool-call correctness only?

### Business / pitch
10. **Pricing model.** Per run, per seat, or % of savings?
11. **Defensibility.** Data from many customers' benchmarks could become a "which open model for which task" prior. Is that ok privacy-wise if aggregated?
12. **BYOC runner** as the enterprise upsell. Mention it in the pitch?
