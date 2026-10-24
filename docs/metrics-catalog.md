# Metrics catalogue

The discovery agent (via MCP) and the dashboard choose from this list. Each metric has a stable `id`.

**Every run records timing, tokens, cost, and reliability rates from result rows.** `classification_f1` is runner-measured too: the ranking computes macro F1 over a candidate's cases, not one score per case. Quality metrics are chosen per use case, and only from rows the runtime can compute.

Background and sources: [research/metrics.md](research/metrics.md). The machine-readable source of ids is [metric-bank/data/metric-bank.json](../metric-bank/data/metric-bank.json). Each bank row has `runtime_status`: `implemented` (`score()`), `judge` (`judge()`), `runner_measured` (timing, usage, cost, reliability rates, and set-level `classification_f1`), or `planned`. The selector proposes only the first three unless the brief sets `include_planned`. `score()` raises on any other id. `None` still means the case does not apply.

## Runnable today

`select()` proposes only these ids unless the brief sets `include_planned`. Planned rows stay in the bank.

| runtime_status | ids |
|---|---|
| implemented | `bbox_f1`, `bbox_iou`, `bleu`, `brier_score`, `cer`, `character_accuracy`, `classification_accuracy`, `classification_precision`, `classification_recall`, `codebleu`, `compression_ratio`, `constraint_satisfaction_rate`, `contains_all`, `contains_none`, `context_entity_recall`, `copyright_regurgitation`, `cross_lingual_consistency`, `empty_output_rate`, `enum_adherence`, `exact_match`, `extraneous_field_rate`, `field_accuracy`, `field_f1`, `format_valid`, `hallucinated_tool_rate`, `insecure_code_rate`, `instruction_following`, `instruction_following_loose`, `irrelevance_abstention`, `json_schema_valid`, `json_valid`, `length_within`, `locale_format_adherence`, `math_equivalence`, `negation_robustness`, `negative_constraint_adherence`, `numeric_tolerance_accuracy`, `overconfidence_rate`, `pii_leakage_rate`, `readability_band_match`, `refusal_calibration`, `regex_match`, `required_field_recall`, `rouge_l`, `secret_leakage_rate`, `set_f1`, `step_efficiency`, `summary_conciseness`, `syntax_valid_rate`, `token_f1`, `tool_argument_schema_valid`, `tool_call_correct`, `tool_call_f1`, `tool_choice_correct`, `translation_chrf`, `unknown_abstention`, `unnecessary_pii_echo_rate`, `wer`, `word_accuracy` |
| judge | `answer_relevancy`, `bertscore_f1`, `citation_precision`, `citation_recall`, `context_precision`, `context_recall`, `context_relevancy`, `contradiction_rate`, `conversation_completeness`, `factscore`, `factual_correctness`, `faithfulness`, `freshness_accuracy`, `g_eval`, `goal_accuracy`, `groundedness_nli`, `hallucination`, `jailbreak_robustness`, `knowledge_retention`, `language_is`, `length_controlled_win_rate`, `misuse_refusal`, `multi_turn_coherence`, `noise_sensitivity`, `non_advice_compliance`, `over_refusal`, `pairwise_vs_baseline`, `plan_adherence`, `policy_violation_rate`, `prompt_injection_resistance`, `reasoning_trace_faithfulness`, `role_adherence`, `rubric_score`, `safety_violation`, `semantic_similarity`, `short_form_factuality`, `step_correctness`, `stereotype_rate`, `summary_coherence`, `summary_coverage`, `summary_fluency`, `summary_relevance`, `sycophancy_rate`, `tone_brand_fit`, `topic_adherence`, `toxicity_rate`, `translation_comet`, `turn_relevancy` |
| runner_measured | `classification_f1`, `cost_per_case_usd`, `cost_per_success_usd`, `e2e_ms`, `error_rate`, `output_tps`, `throttle_rate`, `tokens_in_per_case`, `tokens_out_per_case`, `truncation_rate`, `ttft_ms` |

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

## Reliability

`error_rate`, `truncation_rate`, and `throttle_rate` are runner-measured and on the default scorecard. `flip_rate` and `pass_hat_k` stay planned.

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
| `field_accuracy` | extraction | per-field matchers (exact / numeric tolerance / fuzzy). Extra keys are ignored. |
| `field_f1` | extraction | F1 over the union of fields. An extra or hallucinated field lowers the score. Not an alias of `field_accuracy`. |
| `character_accuracy` | vision, OCR | `max(0, 1 − CER)`. This is the quality-average term. |
| `word_accuracy` | vision, OCR | `max(0, 1 − WER)`, when the client named words. |
| `cer` | vision, OCR | Character error rate. Reported only. Lower is better and can exceed 1. |
| `wer` | vision, OCR | Word error rate. Reported only. Lower is better and can exceed 1. |
| `bbox_f1` | vision | Detection F1 at IoU 0.5. This is the quality-average term for regions. |
| `bbox_iou` | vision | Mean IoU of matched boxes. Reported beside `bbox_f1`. |
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

The discovery agent starts from these. They are the runnable defaults (`runtime_status` of implemented, judge, or runner_measured). Judge metrics use the jury when the run configures both judges, and one judge when only one is configured. `error_rate` is a task gate on every default card. Streamed text (chat, RAG, generation, and a user-facing summary) ranks on `ttft_ms`. A schema on batch or generation puts `json_schema_valid` in quality, not only on the gate. OCR without a schema uses `character_accuracy` or `word_accuracy`, with `cer` and `wer` reported, and does not use `field_accuracy`. `feedback_text` adds `rubric_score` beside the label for the written comment. An agent with `tools` uses `tool_call_correct` and `tool_choice_correct`. An agent without a tool trace falls back to `rubric_score`, and the selector notes say so. `code_tests_pass`, `agent_task_success`, and `task_e2e_ms` stay planned.

| Kind | Quality metrics | Gates (defaults) | Speed metric |
|---|---|---|---|
| chat | `answer_relevancy` (plus `faithfulness` and `tone_brand_fit` when the brief sets those flags) | `error_rate ≤ 0.02`; refusal gates when the brief is user-facing | `ttft_ms` p95 |
| batch | `rubric_score`, or `json_schema_valid` when `has_schema` is set | `error_rate ≤ 0.05`; `json_schema_valid ≥ 0.99` when there is a schema | — |
| generation | `rubric_score`, or `json_schema_valid` when `has_schema` is set | `error_rate ≤ 0.01`; schema gate when there is a schema | `ttft_ms` p95 |
| extraction | `field_accuracy`, plus `json_schema_valid` when there is a schema | `error_rate`, `truncation_rate` when there is a schema, `json_schema_valid ≥ 0.99` | `e2e_ms` p95 |
| classification | `classification_f1` (`rubric_score` as well when `feedback_text` is set) | `error_rate ≤ 0.01` | `e2e_ms` p95 |
| agent | `tool_call_correct`, `tool_choice_correct` when `tools` is set; otherwise `rubric_score`, and the card notes say so | `error_rate`, `truncation_rate` and `tool_argument_schema_valid` when the agent has tools | `e2e_ms` p95 |
| rag | `faithfulness`, `answer_relevancy` | `error_rate ≤ 0.02`, `faithfulness ≥ 0.9` | `ttft_ms` p95 |
| summarization | `faithfulness`, `summary_coverage`, `summary_relevance` | `error_rate ≤ 0.01` | `e2e_ms` p95, or `ttft_ms` when `user_facing` or `streaming` |

## Public suites (baseline / priors, stretch)

These are optional reference points shown next to custom results. They never replace custom results.
- **IFBench:** instruction following.
- **BFCL subset:** tool calling.
- **RULER subset:** long context.
- **JSONSchemaBench subset:** structured output.
- **Artificial Analysis index:** pulled from its API, not run.

## Full bank index

Generated from the metric bank. `utility_axis` is what may enter the quality average. `runtime` is `runtime_status` on the bank row. `score()` implements only the `implemented` rows.

| id | name | category | axis | priority | runtime |
|---|---|---|---|---|---|
| `classification_accuracy` | Classification accuracy | accuracy | quality | supporting | implemented |
| `classification_f1` | Classification F1 | accuracy | quality | core | runner_measured |
| `classification_precision` | Classification precision | accuracy | quality | supporting | implemented |
| `classification_recall` | Classification recall | accuracy | quality | supporting | implemented |
| `contains_all` | Contains all | accuracy | quality | supporting | implemented |
| `contains_none` | Contains none | accuracy | quality | supporting | implemented |
| `exact_match` | Exact match | accuracy | quality | core | implemented |
| `matthews_correlation` | Matthews correlation coefficient | accuracy | none | diagnostic | planned |
| `regex_match` | Regex match | accuracy | quality | supporting | implemented |
| `semantic_similarity` | Semantic similarity | accuracy | none | avoid_as_primary | judge |
| `set_f1` | Set F1 | accuracy | quality | core | implemented |
| `token_f1` | Token F1 | accuracy | quality | core | implemented |
| `agent_task_success` | Agent task success | agents_tools | quality | core | planned |
| `goal_accuracy` | Goal accuracy | agents_tools | quality | supporting | judge |
| `hallucinated_tool_rate` | Hallucinated-tool rate | agents_tools | gate_only | supporting | implemented |
| `irrelevance_abstention` | Irrelevance abstention | agents_tools | quality | supporting | implemented |
| `plan_adherence` | Plan adherence | agents_tools | quality | supporting | judge |
| `step_efficiency` | Step efficiency | agents_tools | quality | supporting | implemented |
| `tool_argument_schema_valid` | Tool-argument schema validity | agents_tools | quality | supporting | implemented |
| `tool_call_correct` | Tool-call match | agents_tools | quality | core | implemented |
| `tool_call_f1` | Tool-call F1 | agents_tools | quality | supporting | implemented |
| `tool_choice_correct` | Tool choice | agents_tools | quality | core | implemented |
| `tool_error_recovery` | Tool-error recovery | agents_tools | quality | supporting | planned |
| `ambiguous_context_bias` | Ambiguous-context bias | bias_fairness | none | supporting | planned |
| `counterfactual_invariance` | Counterfactual invariance | bias_fairness | gate_only | core | planned |
| `equalized_odds_gap` | Equalized-odds gap | bias_fairness | none | supporting | planned |
| `representation_skew` | Representation skew | bias_fairness | none | diagnostic | planned |
| `stereotype_rate` | Stereotype rate | bias_fairness | none | supporting | judge |
| `subgroup_performance_gap` | Subgroup performance gap | bias_fairness | gate_only | core | planned |
| `containment_rate` | Containment rate | business_ux | none | supporting | planned |
| `csat_proxy` | CSAT | business_ux | none | diagnostic | planned |
| `escalation_rate` | Escalation rate | business_ux | gate_only | supporting | planned |
| `human_acceptance_rate` | Human acceptance rate | business_ux | quality | supporting | planned |
| `normalized_edit_distance` | Normalized edit distance | business_ux | none | supporting | planned |
| `readability_band_match` | Readability band match | business_ux | quality | supporting | implemented |
| `regeneration_rate` | Regeneration rate | business_ux | none | diagnostic | planned |
| `thumbs_up_rate` | Thumbs-up rate | business_ux | none | diagnostic | planned |
| `tone_brand_fit` | Brand-voice fit | business_ux | quality | core | judge |
| `brier_score` | Brier score | calibration_hallucination | none | supporting | implemented |
| `expected_calibration_error` | Expected calibration error | calibration_hallucination | none | supporting | planned |
| `hallucination` | Hallucination rate | calibration_hallucination | gate_only | core | judge |
| `overconfidence_rate` | Overconfidence rate | calibration_hallucination | gate_only | supporting | implemented |
| `selective_accuracy` | Selective accuracy | calibration_hallucination | quality | supporting | planned |
| `semantic_entropy` | Semantic entropy | calibration_hallucination | none | diagnostic | planned |
| `code_tests_pass` | Unit-test pass rate | code | quality | core | planned |
| `codebleu` | CodeBLEU | code | quality | supporting | implemented |
| `insecure_code_rate` | Insecure-code rate | code | gate_only | supporting | implemented |
| `pass_at_k` | pass@k | code | quality | supporting | planned |
| `patch_resolve_rate` | Patch resolve rate | code | quality | supporting | planned |
| `syntax_valid_rate` | Syntax-valid rate | code | quality | supporting | implemented |
| `conversation_completeness` | Conversation completeness | conversation | quality | core | judge |
| `knowledge_retention` | Knowledge retention | conversation | quality | core | judge |
| `multi_turn_coherence` | Multi-turn coherence | conversation | quality | supporting | judge |
| `role_adherence` | Role adherence | conversation | quality | supporting | judge |
| `topic_adherence` | Topic adherence | conversation | quality | supporting | judge |
| `turn_relevancy` | Turn relevancy | conversation | quality | supporting | judge |
| `cache_hit_rate` | Cache hit rate | cost | none | supporting | planned |
| `cost_per_case_usd` | Cost per case | cost | cost | core | runner_measured |
| `cost_per_success_usd` | Cost per successful case | cost | cost | core | runner_measured |
| `monthly_cost_usd` | Projected monthly cost | cost | cost | supporting | planned |
| `reasoning_token_ratio` | Reasoning-token ratio | cost | none | diagnostic | planned |
| `self_host_cost_per_mtok` | Self-hosted cost per million tokens | cost | cost | diagnostic | planned |
| `tokens_in_per_case` | Input tokens per case | cost | none | diagnostic | runner_measured |
| `tokens_out_per_case` | Output tokens per case | cost | none | core | runner_measured |
| `cold_start_ms` | Cold-start latency | efficiency | none | diagnostic | planned |
| `e2e_ms` | End-to-end latency | efficiency | speed | core | runner_measured |
| `goodput_rps` | Goodput | efficiency | none | diagnostic | planned |
| `itl_ms` | Inter-token latency | efficiency | speed | supporting | planned |
| `output_tps` | Output tokens per second | efficiency | speed | core | runner_measured |
| `task_e2e_ms` | Task end-to-end time | efficiency | speed | core | planned |
| `throughput_rps` | Throughput | efficiency | none | diagnostic | planned |
| `ttfat_ms` | Time to first answer token | efficiency | speed | supporting | planned |
| `ttft_ms` | Time to first token | efficiency | speed | core | runner_measured |
| `constraint_satisfaction_rate` | Constraint satisfaction rate | instruction_following | quality | supporting | implemented |
| `instruction_following` | Instruction following (strict) | instruction_following | quality | core | implemented |
| `instruction_following_loose` | Instruction following (loose) | instruction_following | none | diagnostic | implemented |
| `length_within` | Length within bounds | instruction_following | quality | supporting | implemented |
| `negative_constraint_adherence` | Negative-constraint adherence | instruction_following | quality | supporting | implemented |
| `g_eval` | G-Eval | judging | quality | core | judge |
| `length_controlled_win_rate` | Length-controlled win rate | judging | none | diagnostic | judge |
| `pairwise_vs_baseline` | Pairwise win rate versus baseline | judging | quality | core | judge |
| `rubric_score` | Rubric score | judging | quality | core | judge |
| `factscore` | FActScore | knowledge | quality | supporting | judge |
| `factual_correctness` | Factual correctness | knowledge | quality | core | judge |
| `freshness_accuracy` | Freshness accuracy | knowledge | quality | supporting | judge |
| `short_form_factuality` | Short-form factuality | knowledge | quality | supporting | judge |
| `unknown_abstention` | Unknown abstention | knowledge | quality | core | implemented |
| `bleu` | BLEU | multilingual | none | avoid_as_primary | implemented |
| `cross_lingual_consistency` | Cross-lingual consistency | multilingual | quality | supporting | implemented |
| `language_is` | Language match | multilingual | quality | core | judge |
| `locale_format_adherence` | Locale-format adherence | multilingual | quality | supporting | implemented |
| `translation_chrf` | chrF | multilingual | none | diagnostic | implemented |
| `translation_comet` | Translation COMET | multilingual | quality | core | judge |
| `copyright_regurgitation` | Copyright regurgitation | privacy | gate_only | diagnostic | implemented |
| `pii_leakage_rate` | PII leakage rate | privacy | gate_only | core | implemented |
| `secret_leakage_rate` | Secret leakage rate | privacy | gate_only | supporting | implemented |
| `unnecessary_pii_echo_rate` | Unnecessary PII echo rate | privacy | gate_only | supporting | implemented |
| `answer_relevancy` | Answer relevancy | rag_grounding | quality | core | judge |
| `citation_precision` | Citation precision | rag_grounding | quality | supporting | judge |
| `citation_recall` | Citation recall | rag_grounding | quality | supporting | judge |
| `context_entity_recall` | Context entity recall | rag_grounding | none | diagnostic | implemented |
| `context_precision` | Context precision | rag_grounding | quality | core | judge |
| `context_recall` | Context recall | rag_grounding | quality | core | judge |
| `context_relevancy` | Context relevancy | rag_grounding | quality | core | judge |
| `contradiction_rate` | Contradiction rate | rag_grounding | gate_only | supporting | judge |
| `faithfulness` | Faithfulness | rag_grounding | quality | core | judge |
| `groundedness_nli` | NLI groundedness | rag_grounding | quality | supporting | judge |
| `noise_sensitivity` | Noise sensitivity | rag_grounding | gate_only | supporting | judge |
| `math_equivalence` | Math equivalence | reasoning | quality | core | implemented |
| `reasoning_trace_faithfulness` | Reasoning-trace faithfulness | reasoning | quality | supporting | judge |
| `self_consistency_rate` | Self-consistency rate | reasoning | none | diagnostic | planned |
| `step_correctness` | Step correctness | reasoning | quality | core | judge |
| `empty_output_rate` | Empty-output rate | reliability | none | diagnostic | implemented |
| `error_rate` | Error rate | reliability | gate_only | core | runner_measured |
| `flip_rate` | Flip rate | reliability | none | supporting | planned |
| `pass_hat_k` | pass^k | reliability | none | core | planned |
| `throttle_rate` | Throttle rate | reliability | gate_only | supporting | runner_measured |
| `timeout_rate` | Timeout rate | reliability | none | diagnostic | planned |
| `truncation_rate` | Truncation rate | reliability | gate_only | core | runner_measured |
| `long_context_accuracy` | Long-context accuracy | robustness | quality | core | planned |
| `lost_in_the_middle_drop` | Lost-in-the-middle drop | robustness | none | diagnostic | planned |
| `negation_robustness` | Negation robustness | robustness | quality | supporting | implemented |
| `option_order_sensitivity` | Option-order sensitivity | robustness | gate_only | supporting | planned |
| `paraphrase_invariance` | Paraphrase invariance | robustness | quality | supporting | planned |
| `sycophancy_rate` | Sycophancy rate | robustness | gate_only | supporting | judge |
| `typo_robustness` | Typo robustness | robustness | quality | supporting | planned |
| `jailbreak_robustness` | Jailbreak robustness | safety | gate_only | supporting | judge |
| `misuse_refusal` | Misuse refusal | safety | gate_only | supporting | judge |
| `non_advice_compliance` | Non-advice compliance | safety | gate_only | supporting | judge |
| `over_refusal` | Over-refusal rate | safety | gate_only | core | judge |
| `policy_violation_rate` | Policy-violation rate | safety | gate_only | supporting | judge |
| `prompt_injection_resistance` | Prompt-injection resistance | safety | gate_only | core | judge |
| `refusal_calibration` | Refusal calibration | safety | none | supporting | implemented |
| `safety_violation` | Harmful-compliance rate | safety | gate_only | core | judge |
| `toxicity_rate` | Toxicity rate | safety | gate_only | supporting | judge |
| `enum_adherence` | Enum adherence | structured_output | quality | supporting | implemented |
| `extraneous_field_rate` | Extraneous-field rate | structured_output | gate_only | diagnostic | implemented |
| `field_accuracy` | Field accuracy | structured_output | quality | core | implemented |
| `field_f1` | Field F1 | structured_output | quality | supporting | implemented |
| `format_valid` | Format validity | structured_output | quality | supporting | implemented |
| `json_schema_valid` | JSON Schema validity | structured_output | quality | core | implemented |
| `json_valid` | JSON parse rate | structured_output | quality | supporting | implemented |
| `numeric_tolerance_accuracy` | Numeric tolerance accuracy | structured_output | quality | supporting | implemented |
| `required_field_recall` | Required-field recall | structured_output | none | diagnostic | implemented |
| `sql_execution_accuracy` | SQL execution accuracy | structured_output | quality | core | planned |
| `bertscore_f1` | BERTScore F1 | summarization | none | avoid_as_primary | judge |
| `compression_ratio` | Compression ratio | summarization | none | diagnostic | implemented |
| `rouge_l` | ROUGE-L | summarization | none | avoid_as_primary | implemented |
| `summary_coherence` | Summary coherence | summarization | quality | core | judge |
| `summary_conciseness` | Summary conciseness | summarization | quality | supporting | implemented |
| `summary_coverage` | Summary coverage | summarization | quality | core | judge |
| `summary_fluency` | Summary fluency | summarization | none | avoid_as_primary | judge |
| `summary_relevance` | Summary relevance | summarization | quality | supporting | judge |
| `bbox_f1` | Box F1 | vision | quality | core | implemented |
| `bbox_iou` | Box IoU | vision | quality | core | implemented |
| `cer` | Character error rate | vision | none | core | implemented |
| `character_accuracy` | Character accuracy | vision | quality | core | implemented |
| `wer` | Word error rate | vision | none | supporting | implemented |
| `word_accuracy` | Word accuracy | vision | quality | supporting | implemented |
