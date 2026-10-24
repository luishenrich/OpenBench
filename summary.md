## Judge agreement

On 10 reviewed cases, the human matched the judge on 80% of rows.

- Agreement: 8/10 (80%)
- Inter-judge agreement: 0/3 (0%). Low agreement: flag this use case.
- Per-juror agreement (rows where this juror and another both voted):
  - nebius:deepseek-ai/DeepSeek-V4.1-Flash-1017@low: 0/3 (0%)
  - openrouter:openai/gpt-6-luna@low: 0/3 (0%)
- Pairwise Cohen's kappa: n/a (need pairwise human_winner values, or human_agree=yes)
- Rubric Spearman: 0.68 (n=10)

Agreement is human_agree=yes, or a blank agree cell whose pairwise label matches or whose rubric score is within 0.10 of the judge. Kappa uses candidate/baseline/tie. Spearman uses rubric scores. Inter-judge agreement counts rows where at least two jurors voted and agreed (rubric scores within 0.25, or the same pairwise winner). Below 70% the summary flags the use case. One abstention is left out.
