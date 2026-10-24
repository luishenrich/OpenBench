# Metrics catalogue

The discovery agent (via MCP) and the dashboard choose from this list. Each metric has a stable `id`.

**Every run measures the operational metrics** (speed, cost, reliability). Quality metrics are chosen per use case.

Background and sources: [research/metrics.md](research/metrics.md). The machine-readable source of ids is [metric-bank/data/metric-bank.json](../metric-bank/data/metric-bank.json). `backend/biy/metrics.score` implements `json_schema_valid`, `field_accuracy`, `field_f1`, `exact_match`, `classification_accuracy` (alias `label_accuracy`), `character_accuracy`, `word_accuracy`, `cer`, `wer`, `bbox_iou`, and `bbox_f1`. `judge` implements `rubric_score` and `pairwise_vs_baseline`. Every other bank id is listed below and is not computed by `score()` yet.

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

## Full bank index

Generated from the metric bank. `utility_axis` is what may enter the quality average. `score()` does not implement every row.

| id | name | category | axis | priority |
|---|---|---|---|---|
| `classification_accuracy` | Classification accuracy | accuracy | quality | supporting |
| `classification_f1` | Classification F1 | accuracy | quality | core |
| `classification_precision` | Classification precision | accuracy | quality | supporting |
| `classification_recall` | Classification recall | accuracy | quality | supporting |
| `contains_all` | Contains all | accuracy | quality | supporting |
| `contains_none` | Contains none | accuracy | quality | supporting |
| `exact_match` | Exact match | accuracy | quality | core |
| `matthews_correlation` | Matthews correlation coefficient | accuracy | none | diagnostic |
| `regex_match` | Regex match | accuracy | quality | supporting |
| `semantic_similarity` | Semantic similarity | accuracy | none | avoid_as_primary |
| `set_f1` | Set F1 | accuracy | quality | core |
| `token_f1` | Token F1 | accuracy | quality | core |
| `agent_task_success` | Agent task success | agents_tools | quality | core |
| `goal_accuracy` | Goal accuracy | agents_tools | quality | supporting |
| `hallucinated_tool_rate` | Hallucinated-tool rate | agents_tools | gate_only | supporting |
| `irrelevance_abstention` | Irrelevance abstention | agents_tools | quality | supporting |
| `plan_adherence` | Plan adherence | agents_tools | quality | supporting |
| `step_efficiency` | Step efficiency | agents_tools | quality | supporting |
| `tool_argument_schema_valid` | Tool-argument schema validity | agents_tools | quality | supporting |
| `tool_call_correct` | Tool-call match | agents_tools | quality | core |
| `tool_call_f1` | Tool-call F1 | agents_tools | quality | supporting |
| `tool_choice_correct` | Tool choice | agents_tools | quality | core |
| `tool_error_recovery` | Tool-error recovery | agents_tools | quality | supporting |
| `ambiguous_context_bias` | Ambiguous-context bias | bias_fairness | none | supporting |
| `counterfactual_invariance` | Counterfactual invariance | bias_fairness | gate_only | core |
| `equalized_odds_gap` | Equalized-odds gap | bias_fairness | none | supporting |
| `representation_skew` | Representation skew | bias_fairness | none | diagnostic |
| `stereotype_rate` | Stereotype rate | bias_fairness | none | supporting |
| `subgroup_performance_gap` | Subgroup performance gap | bias_fairness | gate_only | core |
| `containment_rate` | Containment rate | business_ux | none | supporting |
| `csat_proxy` | CSAT | business_ux | none | diagnostic |
| `escalation_rate` | Escalation rate | business_ux | gate_only | supporting |
| `human_acceptance_rate` | Human acceptance rate | business_ux | quality | supporting |
| `normalized_edit_distance` | Normalized edit distance | business_ux | none | supporting |
| `readability_band_match` | Readability band match | business_ux | quality | supporting |
| `regeneration_rate` | Regeneration rate | business_ux | none | diagnostic |
| `thumbs_up_rate` | Thumbs-up rate | business_ux | none | diagnostic |
| `tone_brand_fit` | Brand-voice fit | business_ux | quality | core |
| `brier_score` | Brier score | calibration_hallucination | none | supporting |
| `expected_calibration_error` | Expected calibration error | calibration_hallucination | none | supporting |
| `hallucination` | Hallucination rate | calibration_hallucination | gate_only | core |
| `overconfidence_rate` | Overconfidence rate | calibration_hallucination | gate_only | supporting |
| `selective_accuracy` | Selective accuracy | calibration_hallucination | quality | supporting |
| `semantic_entropy` | Semantic entropy | calibration_hallucination | none | diagnostic |
| `code_tests_pass` | Unit-test pass rate | code | quality | core |
| `codebleu` | CodeBLEU | code | quality | supporting |
| `insecure_code_rate` | Insecure-code rate | code | gate_only | supporting |
| `pass_at_k` | pass@k | code | quality | supporting |
| `patch_resolve_rate` | Patch resolve rate | code | quality | supporting |
| `syntax_valid_rate` | Syntax-valid rate | code | quality | supporting |
| `conversation_completeness` | Conversation completeness | conversation | quality | core |
| `knowledge_retention` | Knowledge retention | conversation | quality | core |
| `multi_turn_coherence` | Multi-turn coherence | conversation | quality | supporting |
| `role_adherence` | Role adherence | conversation | quality | supporting |
| `topic_adherence` | Topic adherence | conversation | quality | supporting |
| `turn_relevancy` | Turn relevancy | conversation | quality | supporting |
| `cache_hit_rate` | Cache hit rate | cost | none | supporting |
| `cost_per_case_usd` | Cost per case | cost | cost | core |
| `cost_per_success_usd` | Cost per successful case | cost | cost | core |
| `monthly_cost_usd` | Projected monthly cost | cost | cost | supporting |
| `reasoning_token_ratio` | Reasoning-token ratio | cost | none | diagnostic |
| `self_host_cost_per_mtok` | Self-hosted cost per million tokens | cost | cost | diagnostic |
| `tokens_in_per_case` | Input tokens per case | cost | none | diagnostic |
| `tokens_out_per_case` | Output tokens per case | cost | none | core |
| `cold_start_ms` | Cold-start latency | efficiency | none | diagnostic |
| `e2e_ms` | End-to-end latency | efficiency | speed | core |
| `goodput_rps` | Goodput | efficiency | none | diagnostic |
| `itl_ms` | Inter-token latency | efficiency | speed | supporting |
| `output_tps` | Output tokens per second | efficiency | speed | core |
| `task_e2e_ms` | Task end-to-end time | efficiency | speed | core |
| `throughput_rps` | Throughput | efficiency | none | diagnostic |
| `ttfat_ms` | Time to first answer token | efficiency | speed | supporting |
| `ttft_ms` | Time to first token | efficiency | speed | core |
| `constraint_satisfaction_rate` | Constraint satisfaction rate | instruction_following | quality | supporting |
| `instruction_following` | Instruction following (strict) | instruction_following | quality | core |
| `instruction_following_loose` | Instruction following (loose) | instruction_following | none | diagnostic |
| `length_within` | Length within bounds | instruction_following | quality | supporting |
| `negative_constraint_adherence` | Negative-constraint adherence | instruction_following | quality | supporting |
| `g_eval` | G-Eval | judging | quality | core |
| `length_controlled_win_rate` | Length-controlled win rate | judging | none | diagnostic |
| `pairwise_vs_baseline` | Pairwise win rate versus baseline | judging | quality | core |
| `rubric_score` | Rubric score | judging | quality | core |
| `factscore` | FActScore | knowledge | quality | supporting |
| `factual_correctness` | Factual correctness | knowledge | quality | core |
| `freshness_accuracy` | Freshness accuracy | knowledge | quality | supporting |
| `short_form_factuality` | Short-form factuality | knowledge | quality | supporting |
| `unknown_abstention` | Unknown abstention | knowledge | quality | core |
| `bleu` | BLEU | multilingual | none | avoid_as_primary |
| `cross_lingual_consistency` | Cross-lingual consistency | multilingual | quality | supporting |
| `language_is` | Language match | multilingual | quality | core |
| `locale_format_adherence` | Locale-format adherence | multilingual | quality | supporting |
| `translation_chrf` | chrF | multilingual | none | diagnostic |
| `translation_comet` | Translation COMET | multilingual | quality | core |
| `copyright_regurgitation` | Copyright regurgitation | privacy | gate_only | diagnostic |
| `pii_leakage_rate` | PII leakage rate | privacy | gate_only | core |
| `secret_leakage_rate` | Secret leakage rate | privacy | gate_only | supporting |
| `unnecessary_pii_echo_rate` | Unnecessary PII echo rate | privacy | gate_only | supporting |
| `answer_relevancy` | Answer relevancy | rag_grounding | quality | core |
| `citation_precision` | Citation precision | rag_grounding | quality | supporting |
| `citation_recall` | Citation recall | rag_grounding | quality | supporting |
| `context_entity_recall` | Context entity recall | rag_grounding | none | diagnostic |
| `context_precision` | Context precision | rag_grounding | quality | core |
| `context_recall` | Context recall | rag_grounding | quality | core |
| `context_relevancy` | Context relevancy | rag_grounding | quality | core |
| `contradiction_rate` | Contradiction rate | rag_grounding | gate_only | supporting |
| `faithfulness` | Faithfulness | rag_grounding | quality | core |
| `groundedness_nli` | NLI groundedness | rag_grounding | quality | supporting |
| `noise_sensitivity` | Noise sensitivity | rag_grounding | gate_only | supporting |
| `math_equivalence` | Math equivalence | reasoning | quality | core |
| `reasoning_trace_faithfulness` | Reasoning-trace faithfulness | reasoning | quality | supporting |
| `self_consistency_rate` | Self-consistency rate | reasoning | none | diagnostic |
| `step_correctness` | Step correctness | reasoning | quality | core |
| `empty_output_rate` | Empty-output rate | reliability | none | diagnostic |
| `error_rate` | Error rate | reliability | gate_only | core |
| `flip_rate` | Flip rate | reliability | none | supporting |
| `pass_hat_k` | pass^k | reliability | none | core |
| `throttle_rate` | Throttle rate | reliability | gate_only | supporting |
| `timeout_rate` | Timeout rate | reliability | none | diagnostic |
| `truncation_rate` | Truncation rate | reliability | gate_only | core |
| `long_context_accuracy` | Long-context accuracy | robustness | quality | core |
| `lost_in_the_middle_drop` | Lost-in-the-middle drop | robustness | none | diagnostic |
| `negation_robustness` | Negation robustness | robustness | quality | supporting |
| `option_order_sensitivity` | Option-order sensitivity | robustness | gate_only | supporting |
| `paraphrase_invariance` | Paraphrase invariance | robustness | quality | supporting |
| `sycophancy_rate` | Sycophancy rate | robustness | gate_only | supporting |
| `typo_robustness` | Typo robustness | robustness | quality | supporting |
| `jailbreak_robustness` | Jailbreak robustness | safety | gate_only | supporting |
| `misuse_refusal` | Misuse refusal | safety | gate_only | supporting |
| `non_advice_compliance` | Non-advice compliance | safety | gate_only | supporting |
| `over_refusal` | Over-refusal rate | safety | gate_only | core |
| `policy_violation_rate` | Policy-violation rate | safety | gate_only | supporting |
| `prompt_injection_resistance` | Prompt-injection resistance | safety | gate_only | core |
| `refusal_calibration` | Refusal calibration | safety | none | supporting |
| `safety_violation` | Harmful-compliance rate | safety | gate_only | core |
| `toxicity_rate` | Toxicity rate | safety | gate_only | supporting |
| `enum_adherence` | Enum adherence | structured_output | quality | supporting |
| `extraneous_field_rate` | Extraneous-field rate | structured_output | gate_only | diagnostic |
| `field_accuracy` | Field accuracy | structured_output | quality | core |
| `field_f1` | Field F1 | structured_output | quality | supporting |
| `format_valid` | Format validity | structured_output | quality | supporting |
| `json_schema_valid` | JSON Schema validity | structured_output | quality | core |
| `json_valid` | JSON parse rate | structured_output | quality | supporting |
| `numeric_tolerance_accuracy` | Numeric tolerance accuracy | structured_output | quality | supporting |
| `required_field_recall` | Required-field recall | structured_output | none | diagnostic |
| `sql_execution_accuracy` | SQL execution accuracy | structured_output | quality | core |
| `bertscore_f1` | BERTScore F1 | summarization | none | avoid_as_primary |
| `compression_ratio` | Compression ratio | summarization | none | diagnostic |
| `rouge_l` | ROUGE-L | summarization | none | avoid_as_primary |
| `summary_coherence` | Summary coherence | summarization | quality | core |
| `summary_conciseness` | Summary conciseness | summarization | quality | supporting |
| `summary_coverage` | Summary coverage | summarization | quality | core |
| `summary_fluency` | Summary fluency | summarization | none | avoid_as_primary |
| `summary_relevance` | Summary relevance | summarization | quality | supporting |
| `bbox_f1` | Box F1 | vision | quality | core |
| `bbox_iou` | Box IoU | vision | quality | core |
| `cer` | Character error rate | vision | none | core |
| `character_accuracy` | Character accuracy | vision | quality | core |
| `wer` | Word error rate | vision | none | supporting |
| `word_accuracy` | Word accuracy | vision | quality | supporting |
