# Default judge → openrouter:openai/gpt-6-luna (BYOK): config + cost accounting

From Luis. Jad has the judge-side note; here is what's in your folders.

1. **Default judge.** Change it to `{"provider": "openrouter", "model": "openai/gpt-6-luna", "mode": "rubric"}`:
   - in `JudgeConfig` (`contract/schemas.py`) and the `default_judge` default in `contract/schema.sql`;
   - plus an `update workspace set default_judge = …` for existing rows (Luis's and the demo workspace). Ask me if you want me to run it via the Supabase MCP.
   - Jad may keep DeepSeek for pairwise if luna shows self-preference towards gpt-4.1-mini; check with him.
2. **BYOK cost.** OpenRouter returns `usage.cost = 0`, `usage.is_byok = true` and the real cost in `usage.cost_details.upstream_inference_cost`. Wherever you record `cost_usd` from OpenRouter (candidates and judge), use `upstream_inference_cost` when `is_byok` is true. Otherwise OpenAI models (BYOK) look free on the leaderboard and in the judge cost.
3. **Estimate.** The model isn't in `catalog/models.json` (open-weight only). For `judge_cost_usd`, take its price from OpenRouter (`/api/v1/models`: $0.10 / $0.50 per 1M) or keep a small judge price table.

Probe from 14:25: works, served by OpenAI, 18 tokens, upstream cost 3.8e-6 USD.

When done: delete this note and commit `notes: done judge-byok`.
