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

## Still open

### Product
1. **Monthly volume.** Should the agent infer it, the user enter it, or should we skip savings in $?
2. **Who reviews synthetic cases?** Is draft → approve in the dashboard required before a run, or optional?
3. **One repo or many per workspace?** (`source_refs` already carries the repo.)
4. **Domain / handle for BIY.** Rename the GitHub repo from `OpenBench` to `BIY`?

### Technical
5. **Nebius details to check on day 1** (needs a key):
   - Does `/v1/models?verbose=true` return prices and context length? If not, we need a price YAML.
   - What are the rate limits and the credit amount?
   - Which models support tools and JSON schema?
6. **Worker.** In-process asyncio for the demo, or Redis + arq from the start?
7. **Hosting.** Run the API on Nebius AI Cloud compute (if the credits cover it), or on Fly.io / Railway with Vercel for the frontend?
8. **Repeats.** Use 3 repeats by default, or 1 for the demo to save time and credits?
9. **Agent use cases.** Benchmarking multi-step agents means replaying tool results. For the hackathon, single-step tool-call correctness only?

### Business / pitch
10. **Pricing model.** Per run, per seat, or % of savings?
11. **Defensibility.** Data from many customers' benchmarks could become a "which open model for which task" prior. Is that ok privacy-wise if aggregated?
12. **BYOC runner** as the enterprise upsell. Mention it in the pitch?
