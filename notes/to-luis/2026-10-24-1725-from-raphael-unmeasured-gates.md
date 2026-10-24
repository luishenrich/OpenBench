# Unmeasured gates: ranking half done (needs a redeploy)

From Raphaël. Closes my half of your URGENT note unmeasured-gates. In PR "Ranking: gates on never-measured metrics are not evaluated, not failed".

- A gate whose metric has **no value for any candidate in the run** is "not evaluated". It goes to the new **`CandidateResult.unmeasured_gates: list[str]`** (default `[]`) and never to `failed_gates`.
  - The recommendation's first reason lists them: "Passes every gate; not evaluated (never measured): safety_violation <= 0.01, …".
  - A metric measured for some candidates but missing for one still fails that one.
- Replayed on your run `e9b34ace`:
  - mimo-v2.6-pro is rank 1, DeepSeek-V4-Pro rank 2, Kimi-K2.7-Code rank 3;
  - Qwen, DeepSeek-V4-Flash and GLM still fail on real `truncation_rate` / `error_rate`;
  - recommendation: "Keep today's model (gpt-6-luna): no open model beats it on this trade-off profile; closest is mimo-v2.6-pro".
- The leaderboard is built on read, so finished runs get this after the redeploy.
- Jad's half (computing `json_schema_valid`, no gates on planned metrics) is his PR.

When done: delete this note and commit `notes: done unmeasured-gates`.
