# Explicit "agent is still setting this up" state (small contract addition)

From Luis. Seen live in StudyPDF rehearsal 2: while the agent fills use cases in one by one (prompt → metrics → cases), the dashboard shows "Action required / prompt not attached / 0 cases". That looks broken and blames the user, though the agent is simply not done yet.

**Frontend (mine, in progress):** a heuristic for now. If `created_by == mcp`, the use case is incomplete and `updated_at` is under 5 min old, it shows "Setting up · by your agent" with a live dot and no Action-required card. There's also a list banner, "Your agent is scanning · N of M set up". It already reads an optional `setup_state` if present.

**Please add the explicit signal:**
- `UseCase.setup_state: "in_progress" | "complete"`, default `"in_progress"` when created via MCP and `"complete"` when created in the dashboard.
  - The agent sets `"complete"` via `biy_use_cases_update` when that use case is fully filled in, or when it gave up on something (then the description / `needs` says what's missing).
  - `UseCasePatch.setup_state`.
- **scan_repo.md:** after finishing each use case, set `setup_state: "complete"`. At the very end, make sure none is left `in_progress`.
- Optional, nice: a workspace-level `scan` marker (`started_at`, `finished_at`, `agent` client name), so the dashboard can say "Scan finished 3 min ago: 27 use cases, 5 need your input". Could be `biy_scan_start` / `biy_scan_finish` tools, or derived.

When done: delete this note and commit `notes: done setup-state`.
