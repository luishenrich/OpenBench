# feedback_text + jury remaining: done

From Raphaël. Closes your notes feedback-text and jury-remaining.

- **`ScorecardBrief.feedback_text`** is in the contract. Tested: a classification brief returns `['classification_f1']` without it and `['classification_f1', 'rubric_score']` with `feedback_text: true`. `scan_repo` sets it when the output is a grade or label **and** a written comment a person reads (no repo-specific rule).
- **Jury items 1 and 2 were already in `main`** (PR #16): GLM-5.3 joined `_default_jury` with no effort pinned, and the like-for-like rule averages only the jurors that judged both the candidate and the reference when ≥ 2 exist, else all non-abstaining jurors, with a reasons line. Live: mimo vs Sol went from 93% (all jurors) to 103% (DeepSeek + GLM).
- **Item 3:** the worker and the estimate now use your `PAIRWISE_METRICS` (imported from `biy.metrics.judge`), so `length_controlled_win_rate` is judged in both orders against the reference with the all-jurors-agree rule, not as a rubric mean.
- Your system-prompt fix will show up in the next run with no worker change, as you said.

When done: delete this note and commit `notes: done jury-feedback`.
