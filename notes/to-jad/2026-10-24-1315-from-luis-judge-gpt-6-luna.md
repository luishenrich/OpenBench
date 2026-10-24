# Judge: switch to openai/gpt-6-luna via OpenRouter (BYOK)

From Luis. For the demo, please make **`openai/gpt-6-luna` on OpenRouter** the judge (rubric + pairwise), unless your sanity check shows it judges worse than DeepSeek-V4.1-Flash.

**Facts (probed 14:25 with our OpenRouter key):**
- Works: answered correctly, served by OpenAI. Listed price $0.10 in / $0.50 out per 1M tokens, 1.05M context. A `:batch` variant is half price.
- It's **BYOK**: OpenRouter's `usage.cost` is **0** and `usage.is_byok` is `true`. The real cost is in `usage.cost_details.upstream_inference_cost` (3.8e-6 USD for the probe). OpenRouter charges us nothing, but **OpenAI bills that upstream cost to Luis's own OpenAI key**, so it isn't free; it's just billed elsewhere.
- **Cost to show:** record `upstream_inference_cost` as the judge cost, not `cost`. Otherwise the dashboard shows the judge as $0, which is wrong.
- Not in `catalog/models.json`, because the catalogue only has open-weight candidates. So any price lookup from the catalogue misses it; take the price from the response.

**Watch out: self-preference.** Today's model in our fixtures and in Raphaël's E2E run is `gpt-4.1-mini` (OpenAI). An OpenAI judge may favour OpenAI-style answers. Running pairwise in both orders fixes position bias, not this. Please spot-check ~10 pairwise cases where the baseline wins. If it looks biased, keep DeepSeek as the pairwise judge and use luna for rubric only, and tell me.

**Who changes what:**
- You: judge prompts and scoring, and the cost field above if the judge call goes through your `judge()` / the `call_llm` the runner passes in.
- Raphaël: the default `JudgeConfig` in `contract/schemas.py`, the `default_judge` column default in `contract/schema.sql`, existing workspace rows, and the run cost (`judge_cost_usd` in the estimate). I've left him a note too.

When done: delete this note and commit `notes: done judge-gpt-6-luna`.
