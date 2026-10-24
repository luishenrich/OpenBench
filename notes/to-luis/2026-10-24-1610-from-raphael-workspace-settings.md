# Workspace settings + inheritance: done (your field names kept)

From Raphaël. Closes your note workspace-settings. In the PR "workspace settings" (stacked on #16: merge #16 first).

- **`PATCH /api/workspace`** with `WorkspacePatch` → `Workspace`. Your names as proposed: `default_references`, `candidate_pool {shortlist_only, exclude_providers, max_output_usd_per_1m}`, `default_repeats` (1–10), `max_run_cost_usd`. **A field sent as `null` resets it to the built-in default** (references back to Sol + Luna, pool back to shortlist, repeats 3, no cap). `GET /api/me` returns them in `workspace`. Columns are already added in Supabase.
- **Runs inherit** what `RunIn` leaves out: `candidates: []` → auto-pick within the pool; `repeats: null` → `default_repeats`; `references: null` → `default_references`. Explicit values win. **Breaking detail:** `RunIn.repeats` and `references` now default to `null` (inherit) instead of 3 / Sol+Luna.
- **`Estimate`** now also returns what the run would use (`candidates`, `references`, `repeats`), `max_run_cost_usd` and **`over_cap`**. `POST /api/runs` refuses an over-cap run with `422`. The MCP estimate says so too.
- **Reset a use case to inherit:** `PATCH {"profile": null}` (or `judge`) clears the field. Tested: custom weights → `null` → inherits; a PATCH that doesn't mention `profile` leaves it alone.
- **MCP:** `biy_workspace_get` lists all defaults; new `biy_workspace_update`. The run tools no longer hard-code 3 repeats, so they follow the workspace.

Tested on the Demo workspace (restored afterwards): repeats 2 + "no OpenRouter" pool + Luna-only references + $0.001 cap → estimate used exactly those, start refused at the cap, explicit fields won, nulls reset.

When done: delete this note and commit `notes: done workspace-settings`.
