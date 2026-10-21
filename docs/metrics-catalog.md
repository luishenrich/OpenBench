# Metrics catalogue

The discovery agent (via MCP) and the dashboard choose from this list. Each metric has a stable `id`.

**Every run measures the operational metrics** (speed, cost, reliability). Quality metrics are chosen per use case.

Background and sources: [research/metrics.md](research/metrics.md).

## Speed (always measured, streamed)

| id | Definition | Good for |
|---|---|---|
| `ttft_ms` (p50/p95) | Request sent → first token | User-facing chat, voice |
| `ttfat_ms` (p50/p95) | Time to first *answer* token (skips reasoning) | Reasoning models in chat |
| `output_tps` | Output tokens/s after the first token | Long answers, streaming UX |
| `e2e_ms` (p50/p95/p99) | Full request time | Sync extraction, classification, agent steps |
| `task_e2e_ms` | Wall time for a multi-step agent task | Agents |
| `throughput_rps` | Sustained requests/s at N concurrency | Batch, capacity planning (stretch) |

## Cost (always measured)

| id | Definition |
|---|---|
| `cost_per_case_usd` | Σ in·p_in + cached·p_cache + out·p_out, from provider-reported usage |
| `cost_per_success_usd` | Total cost / cases that passed quality and gates. **Used for ranking.** |
| `tokens_out_per_case` | Output tokens, split into reasoning and answer |
| `monthly_cost_usd` | `cost_per_case × user-entered monthly volume` (for the recommendation card) |

## Reliability (always measured)

| id | Definition |
|---|---|
| `error_rate` | HTTP errors, timeouts, empty completions |
| `truncation_rate` | `finish_reason = length` |
| `throttle_rate` | 429s at the configured concurrency |
| `flip_rate` | Share of cases whose pass/fail differs across repeats |
| `pass_hat_k` | Share of cases passed in **all** k repeats |

## Quality: deterministic

| id | Kind | Config |
|---|---|---|
| `exact_match` | extraction, QA | `normalize: true` |
| `token_f1` | extraction, QA | — |
| `regex_match` | any | `pattern` |
| `contains_all` / `contains_none` | any | `strings[]` |
| `classification_accuracy` | classification | label field |
| `classification_f1` | classification | `average: macro\|micro` |
| `json_valid` | extraction | — |
| `json_schema_valid` | extraction | JSON Schema (taken from the code: pydantic/zod) |
| `field_accuracy` | extraction | per-field matchers (exact / numeric tolerance / fuzzy) |
| `tool_call_correct` | agent | expected tool name and arguments (AST match, BFCL-style) |
| `tool_choice_correct` | agent | whether the right tool was picked, or correctly none |
| `length_within` | generation, summarisation | `min_chars`, `max_chars` |
| `language_is` | multilingual | ISO code |
| `code_tests_pass` | code | test command (sandbox, stretch) |

## Quality: model-graded (uses the judge)

| id | Kind | Notes |
|---|---|---|
| `rubric_score` | any open-ended | Rubric written per use case (the agent drafts it from the prompt); score 0–1 |
| `pairwise_vs_baseline` | chat, generation | Win rate against the current model's output; both orders |
| `g_eval` | summarisation, chat | Criteria → CoT → probability-weighted score |
| `faithfulness` | RAG, summarisation | Supported claims / total claims, given the context (Ragas-style); cheap option: HHEM-2.1-open |
| `answer_relevancy` | chat, RAG | Does the answer address the question |
| `instruction_following` | any | Constraints from the system prompt checked one by one |
| `tone_brand_fit` | chat, generation | Rubric from the brand guidelines |
| `safety_violation` | user-facing | Harmful compliance |
| `over_refusal` | user-facing | Refusing benign requests (health and finance often hit this) |
| `hallucination` | any with a source | Unsupported facts |

## Default metric sets by kind

The discovery agent starts from these and edits them.

| Kind | Quality metrics | Gates (defaults) | Speed metric |
|---|---|---|---|
| chat | `rubric_score`, `pairwise_vs_baseline`, `over_refusal` | `error_rate ≤ 0.02` | `ttft_ms` p95 |
| batch | `rubric_score` or task-specific | `error_rate ≤ 0.05` | — |
| extraction | `field_accuracy`, `json_schema_valid` | `json_schema_valid ≥ 0.99` | `e2e_ms` p95 |
| classification | `classification_f1` | — | `e2e_ms` p95 |
| agent | `tool_call_correct`, `tool_choice_correct`, task success via `rubric_score` | `json_valid ≥ 0.99` on tool args | `task_e2e_ms` |
| rag | `faithfulness`, `answer_relevancy` | `faithfulness ≥ 0.9` | `ttft_ms` p95 |
| summarization | `g_eval`, `faithfulness`, `length_within` | — | `e2e_ms` p95 |

## Public suites (baseline / priors, stretch)

These are optional reference points shown next to custom results. They never replace custom results.
- **IFBench:** instruction following.
- **BFCL subset:** tool calling.
- **RULER subset:** long context.
- **JSONSchemaBench subset:** structured output.
- **Artificial Analysis index:** pulled from its API, not run.
