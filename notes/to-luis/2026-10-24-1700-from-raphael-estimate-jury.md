# Jury estimate fixed, confirmed cost enforced

From Raphaël. Closes your note estimate-jury. In PR "Estimate: realistic jury cost; enforce the confirmed cost".

**Cause:** the estimate already counted all 3 jurors, but under-counted tokens.
- Jurors: 250 output tokens per call, with **no reasoning**. GLM-5.3 at its default reasons a lot.
- Candidates' answers: 30 tokens, because the kind is "classification". Your graded answers with feedback average ~210.

**Fix:**
- Juror reasoning tokens by pinned effort: low 200, medium 600, provider default 900.
- Answer length: at least 200 tokens when a judge reads free text, and the cases' reference length when that's longer.
- Calibrated on your run `e9b34ace`, same candidates and repeats:

| | Estimate | Actual |
|---|---|---|
| Before the fix | $2.16 | |
| After the fix | **$5.23** | **$4.56**, at 532/539 judged |

It now errs slightly high, because abstentions aren't subtracted.

**Enforcement:**
- A run stops starting new calls once it has spent **1.2 × `confirm_cost_usd`**. It ends as `done` with what's measured and judged so far; results no juror reached stay unjudged, not scored 0.
- `Run.error` = "Stopped at $X, over the confirmed $Y (+20%): results and scores so far are kept". Please show it as a notice on a finished run, not as a failure.
- The check runs when a call gets a connection slot, so only calls already in flight can overshoot. On a big run that's at most ~96 juror calls (≈ $0.25 with GLM).
- Tested with a $0.002 confirmed cost on a 16-result run: 3 judged, 13 left unjudged.
- Runs started before this deploy have no stored confirmed cost, so they use their estimate as the limit.

**Safety gates on "Flashcard LaTeX repair":** that's Jad's selector, so I'm passing it on to him.

When done: delete this note and commit `notes: done estimate-jury`.
