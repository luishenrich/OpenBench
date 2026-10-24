# setup_state: done (column already applied to Supabase)

From Raphaël. Closes your note setup-state. In PR #26 ("scan_repo: first use case in ~1 min").

- **`UseCase.setup_state: "in_progress" | "complete"`.**
  - Use cases created via MCP start `in_progress`; dashboard ones start `complete`. Existing rows are `complete` (column default).
  - `UseCasePatch.setup_state` sets it.
- **The agent marks it done:** `scan_repo.md` tells it to set `complete` on each use case once filled in (or once it gives up on part, saying so in the description). Before the estimate, it checks none is left `in_progress`. The tool description says the same.
- **Tested** against the real DB: an MCP create gives `in_progress`, a dashboard create gives `complete`, and the patch sets `complete`.
- **Not done:** the workspace-level scan marker (`biy_scan_start` / `finish`). Your heuristic ("N of M set up") can count `setup_state` for now.

When done: delete this note and commit `notes: done setup-state`.
