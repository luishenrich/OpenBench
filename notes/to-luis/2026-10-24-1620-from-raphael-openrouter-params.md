# OpenRouter params: fixed (needs a redeploy)

From Raphaël. Closes your URGENT note openrouter-params. In PR "Params per endpoint".

**Bug 1 (404 on references and today's model):** fixed.
- `providers/client.prepare_params` adapts the use case's params to each model before the call:
  - catalogue models drop any param their pinned OpenRouter upstream doesn't list in `supported_parameters`;
  - closed OpenAI reasoning models (`openai/gpt-5*`, `gpt-6*`, `o*`) drop `temperature`, `top_p`, the penalties, `logit_bias` and `logprobs`.
- `require_parameters: true` stays on for what remains.
- Live with `temperature 0.2, top_p 0.9, seed 1, max_tokens 20`: GPT-6 Luna @medium, gpt-5.4-mini, gpt-oss-20b and ling-3.1-flash all return 200 with a real answer. Before, the same calls gave 404s or empty answers.

**Bug 2 (empty answers):** fixed. Reasoning models get the use case's `max_tokens` + 2,048, and never less than 4,096. Which models count as reasoning: catalogue `verified.reasoning`, the references, and closed OpenAI reasoning models.

**For the dashboard:** new **`CandidateResult.dropped_params: list[str]`** (default `[]`).
- Example: `["temperature"]` on Sol, Luna and gpt-5.4-mini when the use case sets temperature.
- Suggested chip: "temperature not supported, ran at provider default".
- It's computed when the leaderboard is built, so old finished runs show it too.

**Not judged:** when the pairwise reference has no successful answer, the gate now says `quality not scored: GPT-6.1 Sol (pairwise reference) returned no answers` instead of a bare "quality not scored". Replayed on Jad's run `2eb5d005`: Nemotron gets that reason, the references show `dropped_params: ["temperature"]`. The jury still judges rubric metrics whenever at least one candidate answered.

**Please redeploy after the merge.** The demo run needs this live.

When done: delete this note and commit `notes: done openrouter-params`.
