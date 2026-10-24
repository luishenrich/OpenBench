# Remaining jury wiring after the field names landed

From Jad. `judge()` now speaks the names in `contract/schemas.py`. The proposal in the old jury note is obsolete; I deleted it. I did not edit `/contract` or `backend/biy/worker.py`.

What already matches a direct `judge()` call and the agreement kit:

- Jurors are Luna (`openrouter:openai/gpt-6-luna@low`), DeepSeek-V4.1-Flash (`nebius:deepseek-ai/DeepSeek-V4.1-Flash-1017@low`), and `nebius:zai-org/GLM-5.3` with `reasoning_effort` left unset (provider default). Kimi-K3 stays the fallback and is not in the panel.
- Each abstains on its own family, using `providers.references.family`. Pairwise also abstains on the reference's family. A pairwise win counts only when every non-abstaining juror agrees in both orders; otherwise the result is a tie at 0.5.
- Stored shape: `jurors: [{key, reasoning_effort, score, reasoning, winner}]`, `abstained` as those keys, `agreement` true/false when at least two voted else null, `reasoning` joined with `  |  `. Rubric agreement is the worker's 0.25 band.
- Rubric, pairwise, and named prompts now include `case.io_spec.system_prompt`. The worker already passes `io_spec` into `CaseView`, so the next run picks this up with no worker change. That is the "invents a two-business-day shipping policy" miss.

The live worker still aggregates the jury itself and calls `judge()` once per juror with `call_llm(messages) -> str`. That path is unchanged. The three-juror list above is what `config['jury'] is True` uses. The run's jury is still `JudgeConfig.judges`.

## Please

1. Add GLM-5.3 to `JudgeConfig._default_jury` with no `reasoning_effort`. It is still Luna + DeepSeek, both `reasoning_effort: "low"`. Do not pin an effort on GLM. Add Kimi-K3 only if a later run shows GLM disagreeing wildly; this export cannot say that, because GLM was not a juror.
2. "X% of reference quality" should average the jurors who scored both the candidate and the reference when at least two such jurors exist, otherwise every non-abstaining juror, and add a reasons line. `ranking._quality` means the scores already stored on each result, so Sol and Luna (DeepSeek only) are still compared with open candidates (Luna + DeepSeek). That comparison is in `ranking.py`, not in `score()`.
3. `_judge_pass` treats only `pairwise_vs_baseline` as pairwise. `length_controlled_win_rate` is the same kind of judge metric (both orders, win only if every non-abstaining juror agrees). As written, the worker scores it as a rubric mean.

`score()` / `judge()` signatures are unchanged. `notes/to-raphael/2026-10-24-1343-from-jad-feedback-text.md` is still open: `ScorecardBrief` has no `feedback_text`.
