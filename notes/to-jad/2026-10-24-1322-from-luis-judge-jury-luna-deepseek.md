# Judge = jury of two: GPT-6 Luna + DeepSeek-V4.1-Flash

From Luis. Decision, replaces "judge stays open-weight".

**Jury**
- Two judges from different families: `openrouter:openai/gpt-6-luna` (BYOK) and `nebius:deepseek-ai/DeepSeek-V4.1-Flash-1017`.
- Background: Verga et al. 2024, "Replacing Judges with Juries". A small panel from different families agrees with humans better than one big judge, and it reduces self-preference (Panickssery et al. 2024).

**Rules**
1. **Rubric:** the score is the mean of both judges. Store both scores and both reasonings.
2. **Pairwise:** run both orders × both judges. A win counts only if all non-abstaining judges agree in both orders; anything else is a tie (0.5).
3. **Abstain on your own family.**
   - Luna (OpenAI) doesn't judge outputs from OpenAI models: the references GPT-6 Luna / GPT-6.1 Sol and the open `openai/gpt-oss-*` candidates.
   - DeepSeek doesn't judge `deepseek-*` outputs.
   - When a judge abstains, the other one decides alone. Mark that in the result (`judge.abstained: ["luna"]`) so it's visible per case.
4. **Pin the reasoning effort of each judge** (`reasoning_effort` in the judge's params, e.g. `low` for both) and store it with every judgement. Luna without the parameter does no reasoning at all; with it, it thinks. See the probe below.
5. **Report agreement:** % of cases where the two judges agree. That's our answer to "why trust the judge". Low agreement on a use case = flag it in the result.
6. **BYOK cost:** Luna's real cost is `usage.cost_details.upstream_inference_cost` (OpenRouter's `usage.cost` is 0).

**Probe at 14:40, reasoning effort with the bat-and-ball question:**
- Luna accepts `none`, `minimal`, `low`, `medium`, `high` and `xhigh`. Without the parameter it uses 0 reasoning tokens.
- Sol requires reasoning (`none` gives an error) and accepts `minimal` to `xhigh`.

**Sanity check:** still ~10 cases against your own judgement, now including judge agreement.

Raphaël changes the contract (list of judges, judge results with both scores). Align field names with him.

When done: delete this note and commit `notes: done judge-jury`.
