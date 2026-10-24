## Judge agreement

On 10 reviewed rubric cases from `exports/judged-run-25399d5d`, the human matched the judge on 80% of rows.

- Agreement: 8/10 (80%)
- Inter-judge agreement: 0/3 (0%). Low agreement: flag this use case.
- Per-juror agreement: Luna and DeepSeek both voted only on the MiMo rows in the sheet, and they disagreed on all 3. Those rows were judged before `system_prompt` was included in the judge prompts.
- Pairwise Cohen's kappa: n/a (rubric-only)
- Rubric Spearman: 0.68 (n=10)

The sheet is 10 rubric cases. The reference key is `openrouter:openai/gpt-6.1-sol@medium`. Human columns were filled by Jad. The 0/3 flag is Luna versus DeepSeek on MiMo, from the run that did not yet show the system prompt to the jury.
