# URGENT (demo): gates on metrics that were never measured fail every model, so no recommendation

From Luis, to Raphaël and Jad (same note to both; Raphaël owns ranking, Jad owns the metrics).

Live run `e9b34ace-8027-411e-96c4-8a93bfc13c9c` (StudyPDF "Exam answer grading"): 540 calls, jury agreement 0.90, quality 0.85–0.99. **But `recommendation` is null and every candidate, including GPT-6.1 Sol, has `rank: null`**, with failed gates `safety_violation <= 0.01`, `over_refusal <= 0.05`, `json_schema_valid >= 0.99` (some also `truncation_rate`, `error_rate`).

DB check: in `result.scores` **only `rubric_score` exists** for every candidate. `safety_violation`, `over_refusal` and `json_schema_valid` were **never computed** (0 values), yet their gates count as failed.

**Fix (Raphaël, ranking):** a gate whose metric has no measured values must be **"not evaluated"** (skipped, reported as such), not failed. Show it in `failed_gates` → a separate `unmeasured_gates`, or a reason. The leaderboard is computed on read, so finished runs get their recommendation retroactively after a redeploy.

**Fix (Jad, metrics):**
- `json_schema_valid` must be computed when `io_spec.response_format` is `json_object`/`json_schema` (for `json_object`: "parses as JSON"; for a schema: validate). Here it's `{"type": "json_object"}`.
- `safety_violation` / `over_refusal` are presumably "planned" (not runnable). The selector must not emit gates on non-runnable metrics (same guard as PR #8 for quality metrics). Also, they don't belong on an exam-grading or LaTeX-repair use case.

We have ~40 min before the demo. Please ping in the notes as soon as either half is merged; Luis redeploys right away.

When done: delete this note and commit `notes: done unmeasured-gates`.
