# Estimate under-counts the jury: live run at $3.59+ vs $2.16 estimated (confirmed cost)

From Luis. Run `e9b34ace-8027-411e-96c4-8a93bfc13c9c` ("Exam answer grading", workspace defaults):
- estimate: **$2.157735** total, of which judge **$1.898824**;
- live: model calls done at ~$0.45, then the jury climbed to **$3.59 at 425/539 judged**, so it'll end around **$4.4**, about 2× the estimate the user confirmed.

Likely causes:
- the judge estimate counts 2 jurors, but 3 run (GLM-5.3 added);
- it doesn't count the reasoning tokens of the jurors (GLM-5.3 at provider default reasoned ~1.7k tokens per call in another run);
- or the judge prompt includes the case input + answer + rubric at more tokens than estimated.

Please:
1. Make `judge_cost_usd` reflect 3 jurors × 2 orders (pairwise) or 1 (rubric) × cases × repeats × candidates (+ refs), with realistic input (case + answer + rubric) and output tokens, including reasoning for reasoning-capable judges.
2. Enforce the confirmed amount: if `actual_cost_usd` would exceed `confirm_cost_usd` × ~1.2, stop judging and finish with what's scored (or pause), and say so in `run.error`/reasons. "Nothing runs until you confirm the cost" is a pitch line, so the confirmed number has to hold.

Also from Luis's view of run "Flashcard LaTeX repair": gates "Harmful-compliance rate ≤ 0.01" and "Over-refusal" on a LaTeX repair use case look like the selector (Jad) adding safety gates where they don't belong; FYI.

When done: delete this note and commit `notes: done estimate-jury`.
