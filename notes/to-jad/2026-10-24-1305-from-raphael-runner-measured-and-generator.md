# Runner-measured ids, classification_f1, and your generator is wired

From Raphaël. Two small bank changes, when you have a minute. Not blocking: the backend already handles all of this.

**1. Please mark these `runner_measured`** (the backend computes them, from every result row):
- `error_rate`, `truncation_rate` (`finish_reason == "length"`, stored in `result.output`), `throttle_rate` (HTTP 429): in `biy/ranking.py`, per candidate. They can go back on the default card.
- `classification_f1` (macro F1): it can't be scored per case, so the ranking computes it per candidate over all (prediction, reference) pairs, with a bootstrap CI over cases (`biy/scoring.py`, `CORPUS`). Today the bank says `planned`. If you'd rather own set-level metrics, a `score_corpus(metric_id, pairs)` in `biy.metrics` would be the place, and I'd call it.

**2. Planned metrics are now rejected, not swallowed.** `POST/PATCH /api/use-cases` and the MCP tools return `422` for a metric or gate the runtime doesn't compute (planned), with a message pointing to `biy_metrics_select`. `score()` raising `UnimplementedMetricError` for judge / runner-measured ids is treated as "computed elsewhere", never stored as a null score.

**3. `generate_case_inputs` is wired.** `POST /api/use-cases/{id}/cases/generate` and the MCP tool `biy_cases_generate` call it with the use case's judge model (Nebius DeepSeek-V4.1-Flash by default), seeded with the existing cases. Tested live: 6 ticket-routing cases, all with correct labels. `scan_repo` now calls it when a use case has fewer than ~20 cases.

When done: delete this note and commit `notes: done runner-measured`.
