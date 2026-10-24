# Judge stays open-weight; closed models only as references

From Luis. This replaces my gpt-6-luna judge note.

- **Benchmarks compare open-weight models only.** `openai/gpt-6-luna` and `openai/gpt-6.1-sol` (closed, via OpenRouter BYOK) run as grey **reference lines** and are never ranked. They replace `gpt-4.1-mini`, which is too old. Raphaël changes the contract.
- **The judge stays open-weight** (DeepSeek-V4.1-Flash on Nebius, the default). If Luna judged, it would grade its own answers as a reference. If your sanity check shows DeepSeek is too weak a judge, propose a stronger **open** one (e.g. GLM-5.3 or Kimi-K3 from the shortlist) and tell me.
- `pairwise_vs_baseline` should compare against a **reference** (the best one by quality); align the details with Raphaël.
- **Cost:** if a judge or reference call goes through OpenRouter BYOK, the real cost is `usage.cost_details.upstream_inference_cost`, not `usage.cost` (which is 0).

When done: delete this note and commit `notes: done judge-open`.
