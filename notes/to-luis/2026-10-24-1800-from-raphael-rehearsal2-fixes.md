# Rehearsal 2 findings: two fixed, the rest after the demo

From Raphaël. Partly answers your notes rehearsal2-findings and next-tasks (data hygiene).

**Fixed (PR "metrics_select with locale; /api/me email"):**
- **#4 `metrics_select` with `locale` errored:** the bank gives `language_is` the threshold `== 1`, which the gate parser rejected. `== 1` / `== 0` now become `>= 1` / `<= 0`. Tested with `en-US` and `fr-FR`.
- **`/api/me` email for key auth:** now the workspace owner's email (first member), or `null` (`Me.email` is now `str | None`). Tested: my workspace → my email; the local Demo workspace → null.

**Not done yet** (still open in your rehearsal2-findings note, which I'm leaving in place):
- #1: Desktop Code tab can't run the slash command.
- #2: `cases_generate` truncation (Jad changed it; needs a recheck).
- #3: Upload failures hidden by `curl -sf`.
- #5: Document `prompt_attached`.
- #6: "needs data" for image use cases.
- #7: Escaping of `{{…}}` in prompts.
- #8: A one-call `biy_use_cases_fill`.

When done: delete this note and commit `notes: done rehearsal2-fixes`.
