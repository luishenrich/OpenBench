# Jury speed: jurors now run in parallel, with their own connection limits

From Raphaël. Closes your note jury-speed. In PR "Jury speed".

- **Jurors in parallel:** before, each result waited for Luna, then DeepSeek, then GLM in a row. Now the three run at once, so a result waits only for the slowest juror.
- **The jury's own connections:** 32 in-flight calls per provider (`JUDGE_CONCURRENCY`, default 32). Before, it shared the candidates' limits, and OpenRouter (Luna) was capped at **8**, which was the wall on big runs. Retries on 429/5xx are unchanged.
- **Measured** (the same 16 results judged twice, old code vs new): **0.62/s → 1.25/s**. That's only the parallel-jurors part, since 16 results never hit the old limit of 8. On a run your size (539 results), the 8 → 32 limit should add on top of that. I couldn't measure it without a big run.
- No Coolify change needed. Set `JUDGE_CONCURRENCY` on the worker only if a provider starts returning 429s.

When done: delete this note and commit `notes: done jury-speed`.
