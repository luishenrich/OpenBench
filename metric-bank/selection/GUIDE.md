# Selecting metrics for a client

This is the guide for the model that reads a client's brief and picks rows from the metric bank. The bank is a library. A scorecard is a small subset. Running every row is a failed selection.

The machine-readable bank is `data/metric-bank.json`. A deterministic reference implementation of this guide is `src/metric_bank/selector.py`. The five worked clients below are the examples that function returns. `selection/examples.json` is that output.

## What you may put on a scorecard

Start from the brief, not from a leaderboard.

1. **Always measure** `error_rate`, `truncation_rate`, `throttle_rate`, `cost_per_case_usd`, `cost_per_success_usd`, and `tokens_out_per_case`. They come off logs the runner already stores. Rank cost on cost per successful case. Monthly cost is reported only when the client entered a volume, and it is not a second cost axis.
2. **One speed metric**, from the product kind. Chat and RAG: `ttft_ms`. Extraction, classification, summarization, generation: `e2e_ms`. Agents: `task_e2e_ms`. Batch, or any caller who is not waiting: none. If reasoning models are in a chat set, also report `ttfat_ms`. It does not replace time to first token as the ranking speed.
3. **One to five quality metrics.** A metric may enter the quality average only when `utility_axis` is `quality`. Those scores are already higher-better on 0–1. Do not min-max them across candidates. Do not transform a gate into a quality term by subtracting it from 1 unless the row's `quality_transform` says so. In this bank, lower-better risk rates are gates, so their transform is `not_a_quality_input`.
4. **Zero to three risk gates.** Use them for harmful compliance, over-refusal, privacy, insecure code, and injection on untrusted context. Do not turn a preference into a gate.
5. **Task gates** for requirements the client named as pass/fail: schema validity at or above 0.99, faithfulness at or above 0.9 when the source is binding, banned strings, a hard length window, a required language. `error_rate` is always a task gate. Chat and RAG default to at most 0.02, batch to at most 0.05, and other kinds to at most 0.01.
6. **At most one generic judge**, and only when no named metric fits. Prefer `rubric_score`. Use `g_eval` when the kind is summarization and there is no claim or coverage check. Add `pairwise_vs_baseline` only when a baseline completion is in the run, and then it is the one judge, not a second one.
7. **Agents also report `pass_hat_k`.** It is not part of the quality average. Task success already counts a success. pass^k asks whether that success is stable.

Caps live in `selection_policy.caps` in the bank: 5 quality, 3 risk, 2 business, 1 judging.

## How to read a row

Use these fields, in this order.

| Field | Decision |
|---|---|
| `selector_priority` | `core` first. `supporting` when the brief names that failure. `diagnostic` is a slice, not a headline. `avoid_as_primary` must not be the quality score. |
| `when_to_use.signals` | Select the row when the brief matches a signal. |
| `when_not_to_use` | A match here beats a vague category match. |
| `utility_axis` | `quality` can enter Q. `speed` and `cost` stay on their axes. `gate_only` is a gate. `none` is reported and not averaged. |
| `group_role` | `gate_form` is a threshold for a construct you are already measuring. It is not a second quality term. |
| `construct_group` | If the group is in `double_count_groups`, keep one row. Grounding, generic judges, classification, instruction prompts, tool-call match, lexical summary scores, translation quality, cost, and deflection are those groups. |
| `required_inputs.inputs` | If the client cannot supply the input, do not select the metric. Do not invent a judge to fill the gap. |
| `cost_effort.level` | Prefer a deterministic metric over a judge of the same construct. |
| `tags` | Retrieval only. Tags do not outrank the fields above. |

`catalog_match: true` means the id is already in `docs/metrics-catalog.md`. Keep those ids. Do not rename them.

## Signal to metric

| If the brief says | Quality, in this order | Gate, not a quality term |
|---|---|---|
| Extraction with a schema | `field_accuracy`, `json_schema_valid`, and `numeric_tolerance_accuracy` when amounts have a tolerance | `json_schema_valid` ≥ 0.99. Do not also gate on `json_valid`. |
| Dollar, dose, or rate fields | `numeric_tolerance_accuracy` for those fields only | Leave them out of the exact `field_accuracy` denominator. |
| Classification labels | `classification_f1` | Add precision or recall only if the client named that error. Do not average F1 and accuracy. |
| Chat, a question, no gold answer | `answer_relevancy` | — |
| Brand guide | `tone_brand_fit` | — |
| Optional knowledge base | `faithfulness` | Not a gate, unless the client said unsupported claims are unacceptable. |
| Binding source, RAG, or a summary that feeds a decision | `faithfulness` | `faithfulness` ≥ 0.9. Do not also add `hallucination`. |
| Citations required | `citation_precision`, `citation_recall` | — |
| Retrieval is in scope | `context_recall`, then `context_precision` if the cap allows | Omit both if the client froze the context. |
| The product must abstain when the source is silent | `unknown_abstention` | — |
| Verifiable prompt constraints | `instruction_following` | Write checks. A judge is the last resort. |
| Banned strings or competitors | `contains_none` | ≥ 0.99 when the ban is explicit. |
| Character or token window | `length_within` | ≥ 0.99 when the window is a product constraint. |
| Summary with key points | `summary_coverage`, plus `faithfulness` | Do not select `rouge_l`, `bertscore_f1`, or `summary_fluency` as the quality score. |
| Summary without key points | `faithfulness` and `summary_relevance` | `g_eval` only if those two cannot be run. |
| Tools, one step or many | `tool_call_correct`, `tool_choice_correct` | `tool_argument_schema_valid` ≥ 0.99. |
| Tests exist | `code_tests_pass` | `insecure_code_rate` ≤ 0.01 when code can be merged. |
| Multi-step agent with a goal | `agent_task_success` | Report `pass_hat_k`. Speed is `task_e2e_ms`. |
| User-facing assistant | — | `safety_violation` ≤ 0.01 and `over_refusal` ≤ 0.05, together. |
| Regulated advice boundary | — | `non_advice_compliance` ≥ 0.98. |
| PHI, account numbers, customer data | — | `pii_leakage_rate` ≤ 0 on a confirmed set. |
| Secrets or canaries | — | `secret_leakage_rate` ≤ 0. |
| Untrusted documents or tool output | — | `prompt_injection_resistance` ≥ 0.95 for agents and RAG. |
| Required locale | — | `language_is` must pass. Rank translation with `translation_comet`, not `bleu`. |
| Open-ended, and nothing above applies | `rubric_score` | One judge only. Pairwise only against a baseline. |

Public exams are not in this table. MMLU, BIG-bench, GSM8K, HELM scenarios, and Arena Elo are priors in the bank's `priors` array. Use them to form a suspicion about a model family. Score the client's cases.

## Refusals you should make

- **BLEU, ROUGE-L, BERTScore, summary fluency, embedding cosine.** These rows exist so you can explain the refusal. They are `avoid_as_primary` and they are not on the quality axis. Overlap with a reference is not support by a source, and it is not a business outcome.
- **Perplexity and MAUVE.** They are not in the bank. Perplexity is not comparable across tokenizers. MAUVE needs a reference distribution of generations and does not answer a client task.
- **A jailbreak you invent for the occasion.** `jailbreak_robustness` and `prompt_injection_resistance` are scores on a reviewed, versioned set. Do not synthesize attacks in order to produce a number. The bank does not contain attack payloads.
- **Elo from a public arena.** Preference against a shifting field of opponents is not this client's quality. Pairwise against their current model is the related metric, and only when that baseline is in the run.
- **CSAT invented by a judge.** `csat_proxy` is diagnostic and only when a survey already exists.

## Worked clients

Always-on metrics are the same six on every card: `error_rate`, `truncation_rate`, `throttle_rate`, `cost_per_case_usd`, `cost_per_success_usd`, `tokens_out_per_case`.

### 1. Health insurer claim extraction (`health_claim_extraction`)

A claims platform extracts a fixed JSON object from an explanation-of-benefits packet: member id, service date, billed amount, allowed amount, and denial code. The caller waits. Amounts may be off by one cent. The packet contains PHI. Kind `extraction`, industry `insurance`.

| Role | Metrics |
|---|---|
| Quality | `field_accuracy`, `numeric_tolerance_accuracy`, `json_schema_valid` |
| Speed | `e2e_ms` |
| Risk gate | `pii_leakage_rate` ≤ 0 |
| Task gates | `error_rate` ≤ 0.01, `truncation_rate` ≤ 0.01, `json_schema_valid` ≥ 0.99 |

Dollar fields are scored only by numeric tolerance. Schema validity is one measurement used two ways: the rate enters quality, and 0.99 disqualifies. Time to first token is the wrong speed metric because a partial object is not a result.

### 2. Fintech support chat (`fintech_support_chat`)

A streaming assistant answers account questions in the company's voice. A help-center article is retrieved when useful. The article is not a system of record. Candidates include reasoning models. The assistant must refuse scams, must answer ordinary balance questions, and must not give personalized advice. Kind `chat`, industry `finance`.

| Role | Metrics |
|---|---|
| Quality | `faithfulness`, `tone_brand_fit`, `answer_relevancy` |
| Speed | `ttft_ms`, and report `ttfat_ms` |
| Risk gates | `safety_violation` ≤ 0.01, `over_refusal` ≤ 0.05, `non_advice_compliance` ≥ 0.98 |
| Task gate | `error_rate` ≤ 0.02 |

No rubric. The three quality metrics name the constructs the catalogue would otherwise have collapsed into `rubric_score`. Faithfulness is not a gate: grounding is not a hard requirement of this product. Three risk gates fill the cap, which is the point of pairing under-refusal with over-refusal.

### 3. Nightly ad-copy batch (`nightly_ad_copy`)

A job writes product blurbs overnight. Copy must sound like the brand, must not name competitors, and must stay inside a character window. Monthly volume is known. Kind `batch`, industry `advertising`.

| Role | Metrics |
|---|---|
| Quality | `tone_brand_fit`, `contains_none`, `length_within` |
| Speed | none |
| Risk gates | none |
| Task gates | `error_rate` ≤ 0.05, `contains_none` ≥ 0.99, `length_within` ≥ 0.99 |
| Also report | `monthly_cost_usd` |

The product profile for batch puts no weight on speed. Brand fit is the only judged quality metric. Rank on cost per success, and show the monthly figure because the client supplied a volume.

### 4. Coding agent (`coding_agent`)

An agent edits a repository through tools, runs tests, and may open a pull request. Several tool sequences can be legal. Arguments must validate before execution. Generated code can be merged. Kind `agent`, industry `software`.

| Role | Metrics |
|---|---|
| Quality | `tool_call_correct`, `tool_choice_correct`, `code_tests_pass`, `agent_task_success` |
| Speed | `task_e2e_ms` |
| Risk gate | `insecure_code_rate` ≤ 0.01 |
| Task gates | `error_rate` ≤ 0.01, `truncation_rate` ≤ 0.01, `tool_argument_schema_valid` ≥ 0.99 |
| Reliability, not quality | `pass_hat_k` |

`tool_argument_schema_valid` is the catalogue's "JSON valid on tool arguments" gate, under the id that says what is actually checked. It does not also enter the quality average. pass^k does not enter the average either, or a flaky agent would be penalized twice for one fact.

### 5. Legal contract RAG (`legal_contract_rag`)

An internal tool answers questions about a contract the firm uploaded. Answers must be supported by retrieved clauses, must cite them, and must say when the contract is silent. Retrieval is being judged. The tool is not a public chatbot. Kind `rag`, industry `legal`.

| Role | Metrics |
|---|---|
| Quality | `faithfulness`, `citation_precision`, `citation_recall`, `unknown_abstention`, `context_recall` |
| First alternate, over the cap | `answer_relevancy`, then `context_precision` |
| Speed | `ttft_ms` |
| Risk gates | none |
| Task gates | `error_rate` ≤ 0.02, `faithfulness` ≥ 0.9 |

Five quality metrics fill the cap. Answer relevancy is the right next metric if the client later drops citations. Hallucination rate is the gate form of the same grounding construct and is not added beside faithfulness.

## Prompt

Paste this ahead of the bank, then the brief.

```
You are choosing a benchmark scorecard from the BIY metric bank. Return only ids that exist in the bank.

Include the always-on operational metrics. Pick one speed metric from the kind, or none for batch. Pick one to five quality metrics whose utility_axis is quality. Pick at most three risk gates. Pick task gates only for requirements the client stated as pass or fail, plus error_rate.

Do not select a metric marked avoid_as_primary as the quality score. Do not select a gate_form as a quality metric when the primary of that construct is already selected. Do not select two metrics from a double_count group. Do not select more than one of rubric_score and g_eval. Do not select pairwise_vs_baseline without a baseline. Do not select a metric whose required inputs the client cannot provide. Do not treat a public exam as a metric.

Prefer a deterministic or claim-level metric over a generic judge. Say which metric you considered and rejected, and why, using when_not_to_use.
```
