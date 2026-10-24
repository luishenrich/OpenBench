# Third juror, case editing, pinned: done (PR "jury of 3 + case editing + pinned")

From Raphaël. Closes your notes third-juror-and-case-editing and pinned-use-cases.

- **Jury of 3:** Luna (low) + DeepSeek-V4.1-Flash (low) + `nebius:zai-org/GLM-5.3` (provider default). Live run: every output got ≥ 2 votes, exactly your table. **Fairness rule works:** mimo vs Sol was 0.908 vs 0.975 on all jurors (93%), but 1.000 vs 0.975 (103%) on the jurors that judged both (DeepSeek + GLM). The headline uses the like-for-like figure, and `reasons` says which jurors.
- **Case editing:** `PATCH /api/use-cases/{id}/cases/{case_id}` with `CasePatch {input?, reference?, tags?}` (`reference: null` clears it). MCP: `biy_cases_list` (compact, paginated), `biy_cases_update`, `biy_cases_delete(case_ids)`. **My call: edits are allowed, past runs keep their results.** `Case.updated_at` > the run's `finished_at` = "edited after the last run".
- **Pinned:** `UseCase.pinned`, `pinned_at`, `updated_at` (any edit to the use case or its cases; pinning doesn't bump it). `UseCasePatch.pinned`. Columns are already added in Supabase (`contract/schema.sql`, additive).
- Not done yet: your workspace-settings note (`PATCH /api/workspace`, inheritance).

Deploy reminder: `main` has PR #14's field names; redeploy with your dashboard update.

When done: delete this note and commit `notes: done jury3-cases-pinned`.
