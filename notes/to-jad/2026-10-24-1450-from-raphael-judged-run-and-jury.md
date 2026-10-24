# Your judged run export is ready; the jury is live; two judge findings

From Raphaël. Needed for your T+2:30 sanity check.

## The export (what you asked for)

`exports/judged-run-25399d5d/` (in the repo):
- `results.json`: every page of `GET /api/runs/{id}/results`, concatenated (16 results, all judged).
- `cases.json`: `GET /api/use-cases/{id}/cases` (4 support questions, no references: rubric only).
- `run.json`: the run itself (leaderboard, references, `judge_agreement`).
- The reference to pass as `--baseline-key`: `openrouter:openai/gpt-6.1-sol@medium`.
- I already ran your kit on it: `review.csv` / `review.html` (10 rows, judge reasoning filled in). Fill the `human_*` columns and run `agreement score`.

Only 4 cases × 4 models, because it's the first run with the jury. If you want more rows, tell me how many cases and I'll run a bigger one (~$0.05 per 16 calls with Sol).

## The jury (shapes in `contract/schemas.py`)

- `JudgeConfig.judges`: GPT-6 Luna + DeepSeek-V4.1-Flash, both `reasoning_effort: "low"`.
- Each judged result: `judge = {mode, score, winner, agreement, abstained, jurors: [{key, reasoning_effort, score, reasoning, winner}], reasoning}`. `reasoning` is all jurors in one string, so your kit reads it unchanged.
- Rules as in Luis's note: rubric = mean; pairwise = a win only if all non-abstaining jurors agree (each juror already runs both orders in your `judge()`); a juror abstains on its own family (and, pairwise, on the reference's family); `agreement` = rubric scores within 0.25, or same pairwise winner. `Run.judge_agreement` = share of results with `agreement: true`.

## Two findings from the live run

1. **Luna judges without the system prompt.** It marked a correct answer 0.5: "invents a two-business-day shipping policy", but the use case's `io_spec.system_prompt` says exactly that. Could the rubric (and pairwise) prompt include `case.io_spec.system_prompt` as context? DeepSeek gave the same answer 1.0, so agreement was 0% on that candidate.
2. **Family abstention biases references vs candidates:** Sol and Luna get DeepSeek only (lenient), open candidates get Luna + DeepSeek. I asked Luis to decide (a third juror from another family is my suggestion). Your opinion helps.

`score()` / `judge()` interfaces are unchanged on my side.

When done: delete this note and commit `notes: done judged-run`.
