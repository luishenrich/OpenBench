# URGENT (blocks every demo run): OpenAI references 404, reasoning models return empty answers

From Luis. Diagnosed from Jad's run `2eb5d005-f7c5-4c3e-b8c6-73a5711e8a44` (gpt-researcher) and reproduced live just now. The OpenRouter key is fine ($49.95 left; plain calls to Luna/DeepSeek return 200).

## Bug 1: `HTTP 404: No endpoints found that can handle the requested parameters`
Hits `openai/gpt-6-luna@medium`, `openai/gpt-6.1-sol@medium` and `openai/gpt-5.4-mini` (today's model), i.e. **every reference and every closed "today" model**.

**Cause** (`providers/client.py`): the body carries the use case's `io_spec.params` (`**params`), and the routing sends `{"allow_fallbacks": false, "require_parameters": true}`. OpenAI's reasoning models on OpenRouter don't support sampling params, so with `require_parameters` no endpoint qualifies. Reproduced on GPT-6 Luna + `reasoning: {effort: medium}` + `require_parameters: true`:

| extra param | result |
|---|---|
| none | 200 |
| `temperature: 0.2` | **404** |
| `top_p: 0.9` | **404** |
| `frequency_penalty: 0.1` | **404** |
| `seed: 1` | 200 |
| `response_format` json_schema strict | 200 |

Almost every discovered use case has `temperature` in its params, so practically every run loses all references and today's model.

**Fix suggestion:**
- Per model, drop the params its endpoint doesn't support **before** sending. Use the catalogue's `supported_parameters` for the pinned endpoint. For references/closed models not in the catalogue, keep a small table in `references.py`: OpenAI reasoning models drop `temperature`, `top_p`, `presence_penalty`, `frequency_penalty`, `logit_bias`, `logprobs`, `top_logprobs`.
- Record the dropped params per candidate in `config_snapshot`, and surface them (e.g. `CandidateResult.dropped_params`), so the dashboard can say "temperature not supported, ran at provider default". That's fair, and we're honest about it.
- Keep `require_parameters: true` for what remains (tools / response_format must really be honoured).

## Bug 2: `empty answer (finish_reason=length)`
Hits `openai/gpt-oss-20b` and `inclusionai/ling-3.1-flash`.

**Cause:** the use case's `max_tokens` (small, e.g. a title or filename) overrides `DEFAULT_MAX_TOKENS = 4096`. Reasoning models spend that budget on thinking and emit no content. A live check gave gpt-oss-20b with `max_tokens: 20` → `content: None`.

**Fix suggestion:** for reasoning-capable models (`verified.reasoning`, or every reference), send `max_tokens = io max_tokens + reasoning headroom` (e.g. +2048, or at least 4096). If the answer is still longer than the use case's own limit, measure that separately as truncation / length overrun rather than as an empty answer.

## Also from Jad's run
The judge/pairwise pass never ran, because every OpenRouter candidate errored. Please make sure a run with one successful candidate still gets judged (or clearly says "not judged: <reason>").

Please fix before the final; StudyPDF rehearsal 2 is about to do its cheap run and will hit both. When done: delete this note and commit `notes: done openrouter-params`.
