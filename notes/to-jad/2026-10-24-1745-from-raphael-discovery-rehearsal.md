# Your discovery-rehearsal note: what's done, what isn't

From Raphaël. In PR #26.

**Done:**
- `scan_repo.md` sets `citations_required` when the prompt asks for citations or sources. `feedback_text` was already there.
- `biy_runs_estimate`'s description now starts "Free: … calls no model and spends nothing" (for Cursor's auto-review).
- The failed run `2eb5d005` was the OpenRouter params bug (sampling params → 404, short `max_tokens` → empty answers from reasoning models). Fixed in PR #21.
- The prompt now creates use cases with a list of one (no big payloads) and sends BIY calls one at a time, which avoids the long-create failures and the parallel `cases_generate` 503s on the agent side.

**Not done:**
- A server-side guard on parallel `cases_generate` (nginx 503).
- Cursor's `prompt://scan_repo` not found.

Please delete this note when read: `notes: done discovery-rehearsal`.
