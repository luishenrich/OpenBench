# MCP server

BIY exposes a remote MCP server at `https://<host>/mcp` (Streamable HTTP, built with FastMCP inside the FastAPI app).

**Every dashboard action has an MCP tool.** Both call the same service layer.

## Connect

Get a workspace API key from **Settings → MCP** in the dashboard.

```bash
claude mcp add --transport http biy https://<host>/mcp --header "Authorization: Bearer $BIY_KEY"
```

To share the server with the team, add `--scope project`. That writes `.mcp.json`, which you can commit; the key comes from `${BIY_KEY}`.

**Cursor** (`.cursor/mcp.json`):
```json
{ "mcpServers": { "biy": { "url": "https://<host>/mcp",
  "headers": { "Authorization": "Bearer ${env:BIY_KEY}" } } } }
```

**VS Code** (`.vscode/mcp.json`):
```json
{ "servers": { "biy": { "type": "http", "url": "https://<host>/mcp",
  "headers": { "Authorization": "Bearer ${input:biy_key}" } } } }
```

**Auth.** For the hackathon, a static bearer key. OAuth 2.1 (via WorkOS or Clerk) comes later.

## Design rules

These follow Anthropic's guidance on writing tools for agents:
- **Few tools, shaped around workflows.** Batch operations where agents naturally batch (create many use cases or cases at once).
- **Names.** Prefixed `biy_`; parameters are explicit (`use_case_id`, not `id`).
- **Return shape.** Every tool returns `structuredContent` **and** a short text summary in `content`, with names next to IDs.
- **`response_format: "concise" | "detailed"`** on read tools. Lists are paginated.
- **Errors explain how to fix the call**, e.g. "unknown metric_id 'json_valid_schema'. Did you mean 'json_schema_valid'? See biy_metrics_list."
- **Annotations.** Reads get `readOnlyHint`. Deletes get `destructiveHint`.
- **Cost confirmation.** `biy_runs_start` refuses to run without `confirm_cost_usd ≥ estimate`, so an agent can never spend money silently.

## Tools

### Workspace and settings
| Tool | Purpose |
|---|---|
| `biy_workspace_get` | Default profile, default judge, connections summary, counts |
| `biy_workspace_update` | Set the default trade-off profile (`weights {quality,speed,cost}`, `targets`), default judge (unset = strongest open model), monthly-volume defaults |

### Connections and catalogue
| Tool | Purpose |
|---|---|
| `biy_connections_list` | Providers connected, status, reachable model count (secrets never returned) |
| `biy_connections_test` | Ping a connection and return the models it can reach |
| `biy_models_search` | Search the open-weight models reachable on your connections. Filters: `supports_tools`, `supports_json_schema`, `min_context`, `max_price_out`, `license_tier`, `provider`, `family`. Returns price, context and quantization per endpoint |

Adding connections (entering secrets) is **dashboard-only on purpose**. Keys should not pass through an agent's context.

### Metrics
| Tool | Purpose |
|---|---|
| `biy_metrics_list` | The [catalogue](metrics-catalog.md), filterable by `kind`, with config schemas and default sets |

### Use cases
| Tool | Purpose |
|---|---|
| `biy_use_cases_create` | **Batch.** Create one or more use cases. Each takes: `name, kind, description, source_refs[], current_model, io_spec {system_prompt, template, variables, tools, response_schema, params}, profile_override?, gates?, metrics?, judge?, monthly_volume?`. If `metrics` is omitted, the default set for the kind is used. Returns IDs and dashboard URLs |
| `biy_use_cases_list` | List with status (cases count, last run, recommendation) |
| `biy_use_cases_get` | Full definition plus the latest recommendation |
| `biy_use_cases_update` | Patch any field (weights, gates, metrics, judge, io_spec) |
| `biy_use_cases_delete` | Destructive |

### Datasets
| Tool | Purpose |
|---|---|
| `biy_cases_add` | **Batch.** Add cases `{input, reference?, tags?, source}` to a use case |
| `biy_cases_generate` | Synthesise N cases from the io_spec plus seed cases. Options: `strategy: expand\|evolve\|persona_grid\|schema_first`, `n`, `languages`, `edge_cases`. Returns cases for review (`status: draft`) |
| `biy_cases_list` | Paginated |
| `biy_cases_update` / `biy_cases_delete` | Edit or remove; approve drafts |

### Runs and results
| Tool | Purpose |
|---|---|
| `biy_runs_estimate` | Candidates × cases × repeats → token and USD estimate, time estimate, warnings (context too small, no tool support, rate limits) |
| `biy_runs_start` | Start a run. Takes `use_case_id`, `candidates[] {model, connection_id?, params}` (or `auto: n` to let BIY pick n candidates), `include_baseline` (default true), `repeats`, `confirm_cost_usd`. Returns `run_id` |
| `biy_runs_get` | Status and progress. When finished: leaderboard, Pareto set, recommendation |
| `biy_runs_cancel` | Stop a run |
| `biy_results_list` | Per-case outputs and scores for one candidate (for spot checks) |
| `biy_recommendations_get` | Across all use cases: current vs recommended model, quality delta, cost and latency multiples, monthly savings |

## Prompts

| Prompt | What it does |
|---|---|
| `scan_repo` | The [discovery prompt](discovery-prompt.md). In Claude Code it shows up as a slash command (`/mcp__biy__scan_repo`), so nobody has to copy-paste anything |
| `apply_recommendation` (stretch) | Edits the call site to use the recommended model and provider, and opens a PR |

## Example agent session

```
> /mcp__biy__scan_repo
  ● grep for LLM SDK usage … 6 call sites found
  ● biy_metrics_list(kind=chat|extraction|batch)
  ● biy_use_cases_create([... 4 use cases ...])
  ● biy_cases_add(use_case=support-chat, 12 cases from tests/fixtures)
  ● biy_cases_generate(use_case=invoice-extract, strategy=schema_first, n=40)
  ● biy_runs_estimate(...)  → $3.10 for 6 candidates × 52 cases × 3 repeats
  Should I start the runs for $3.10?
> yes
  ● biy_runs_start(..., confirm_cost_usd=3.10)
```
