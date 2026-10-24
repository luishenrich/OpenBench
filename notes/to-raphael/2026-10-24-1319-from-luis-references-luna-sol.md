# Closed models only as references (GPT-6 Luna + GPT-6.1 Sol), never as candidates

From Luis. Product decision (replaces my judge-byok note):

**Rules**
- **Candidates: open-weight only.** These are the catalogue models, as today. Reject any candidate that isn't in `catalog/models.json` (`422`).
- **References: closed frontier models, for comparison only.** By default: `openrouter:openai/gpt-6-luna` and `openrouter:openai/gpt-6.1-sol`.
  - They run on the same cases × repeats.
  - In the leaderboard and Pareto chart they show as grey reference lines. They are **never ranked or recommended**, and they can't fail a gate out of the ranking, because they aren't in it.
  - This replaces `gpt-4.1-mini` as "today's model": too old to be a fair comparison.
- **Judge: open-weight** (DeepSeek-V4.1-Flash on Nebius, the current default). This way the judge never grades its own answers as a reference. Jad knows.

**Contract changes (yours)**
- `RunIn`: replace `include_baseline` with `references: list[ModelRef]`, defaulting to the two above, and `include_references: bool = True`. A use case's `current_model` from discovery can be added as a third reference when it's closed. It's the "today" line for savings, so keep that option.
- `CandidateResult` / `ParetoPoint`: `is_baseline` → `is_reference` (or keep `is_baseline` and add `reference_label`). Tell me which, so I can change the dashboard in the same go.
- `Recommendation`: `quality_vs_baseline_pct` / `cost_multiple_vs_baseline` should be measured against the **best reference by quality** (Sol, most likely). Name it in the headline: "97% of GPT-6.1 Sol's quality at 1/20 of the cost". Add `reference_key`.
- Fixtures: swap `gpt-4.1-mini` for the two references.

**Cost: they're BYOK on our OpenRouter key.** Both were probed at 14:31 and both return valid JSON. OpenRouter returns `usage.cost = 0` and `usage.is_byok = true`. The real cost, which OpenAI bills to Luis's key, is in `usage.cost_details.upstream_inference_cost`:
- Sol: $0.000282 for 16 → 25 tokens, 11 of them reasoning.
- Luna: $7.6e-6.
- Record `upstream_inference_cost` as `cost_usd` whenever `is_byok`, otherwise they'd show as free.
- Estimate prices: Luna $0.10 / $0.50, Sol $2 / $10 per 1M tokens. They're not in the catalogue (open-weight only), so keep a small reference price table next to it.
- Rough cost: Sol for 50 cases × 3 repeats is about $3 per use case, Luna about $0.15.

When done: delete this note and commit `notes: done references`.
