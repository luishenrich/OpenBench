# Wire the judge jury. Contract names are a proposal

From Jad. `JudgeConfig` on main is still one judge (`provider`, `model`, `mode`, `rubric`). I did not edit `/contract`. `judge()` already implements the jury and stays backward compatible: no `judges` list means today's `call_llm(messages) -> str`.

Please add these fields. Names match `JudgeResult` in `backend/biy/metrics/types.py` and Luis's jury note.

## Config

Keep the singular `judge` so old rows load. Add, on the workspace and the use case:

- `judges: list[JudgeConfig] | None`
- On each `JudgeConfig`: `id: str` and `reasoning_effort: Literal["none", "minimal", "low", "medium", "high", "xhigh"] | None`

Demo list, effort `low` for both (Luna does no reasoning without the parameter):

```json
[
  {"id": "luna", "provider": "openrouter", "model": "openai/gpt-6-luna", "reasoning_effort": "low"},
  {"id": "deepseek", "provider": "nebius", "model": "deepseek-ai/DeepSeek-V4.1-Flash-1017", "reasoning_effort": "low"}
]
```

`family` is optional. `judge()` infers `openai` from `openai/gpt-*` and `gpt-oss`, and `deepseek` from `deepseek-*`.

## What to pass into judge()

In `_judge_pass`, for every judge metric (bank `computation.method` is `llm_judge` for all of them now):

```python
cfg["judges"] = snap_judges  # the list above
cfg["candidate_key"] = r["candidate_key"]
cfg["baseline_key"] = baseline_key
```

Without the keys, nobody abstains. Luna abstains on `openai/gpt-*` including `gpt-oss`. DeepSeek abstains on `deepseek-*`.

```python
async def call_llm(messages, judge=None):
    spec = judge or judge_cfg
    params = {"temperature": 0}
    if spec.get("reasoning_effort"):
        params["reasoning_effort"] = spec["reasoning_effort"]
    client = _client(spec["provider"], clients)
    res = await client.chat(spec["model"], messages, params=params)
    if not res.ok:
        raise RuntimeError(res.error)
    if res.cost_usd:
        await db.execute("update run set actual_cost_usd = actual_cost_usd + $2 where id = $1", rid, res.cost_usd)
    return {"text": res.text, "usage": res.usage}
```

One rubric call per non-abstaining judge. Pairwise is both orders per non-abstaining judge. A string return still works for a single judge.

`call_cost` already adds `usage.cost_details.upstream_inference_cost` when `is_byok`. Keep using `res.cost_usd` for the run total. Do not add `JudgeResult` `cost_usd` on top of that. `judge()` sets each row's `cost_usd` from `upstream_inference_cost` when `is_byok`, else `usage.cost`, so the stored judgement shows Luna's real bill (`usage.cost` is 0).

## What to store on result.judge

The column is already a dict. Keep `mode`, `score`, `reasoning`, `winner` (score is the mean, or 1 / 0 / 0.5 for pairwise). Add the fields `judge()` returns:

- `judges`: `[{id, provider, model, score, reasoning, winner, abstained, reasoning_effort, cost_usd, orders?}]`
- `abstained`: list of judge ids, e.g. `["luna"]`
- `agreement`: `1.0` or `0.0` when both voted, else null (one abstention is not a disagreement)
- `low_agreement`: true when `agreement` is `0.0`
- `reasoning_effort`: `{id: effort}`

The worker currently keeps one `judge` blob and the last metric overwrites it. `scores[metric_id]` stays the float. Please also keep each metric's blob, for example `judge["by_metric"][metric_id] = blob`, and leave the top-level keys as the last metric so the current reader still works.

Import: `from biy.metrics.judge import DEFAULT_JURY`.

## Not this change

These stay planned. `score()` is not given the inputs: repeats (`self_consistency_rate`, `flip_rate`, `pass_hat_k`), usage (`cache_hit_rate`, `reasoning_token_ratio`), `result.error` (`timeout_rate`), token timestamps (`ttfat_ms`, `itl_ms`). No sandbox asks.
