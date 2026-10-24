"""Which bank rows the product can compute today.

The selector proposes only these rows unless a brief sets include_planned.
Planned rows stay in the bank as the roadmap.

implemented
    score() computes the id (aliases included).
judge
    judge() computes the id. score() does not.
runner_measured
    Computed from result rows outside score(): stream timing, usage, cost,
    reliability rates, or a set-level score such as classification_f1.
    score() does not recompute it per case.
planned
    Needs a human, a sandbox, repeat calls, or logs score() is not given.
    The reason for each id is PLANNED_REASONS. A test fails if that map drifts.
"""

from __future__ import annotations

# Must match backend/biy/metrics/score.py SCORERS. A test fails if they drift.
IMPLEMENTED = frozenset(
    {
        "json_schema_valid",
        "field_accuracy",
        "field_f1",
        "exact_match",
        "classification_accuracy",
        "classification_precision",
        "classification_recall",
        "character_accuracy",
        "word_accuracy",
        "cer",
        "wer",
        "bbox_iou",
        "bbox_f1",
        "contains_all",
        "contains_none",
        "regex_match",
        "set_f1",
        "token_f1",
        "hallucinated_tool_rate",
        "irrelevance_abstention",
        "step_efficiency",
        "tool_argument_schema_valid",
        "tool_call_correct",
        "tool_call_f1",
        "tool_choice_correct",
        "constraint_satisfaction_rate",
        "instruction_following",
        "instruction_following_loose",
        "length_within",
        "negative_constraint_adherence",
        "json_valid",
        "enum_adherence",
        "extraneous_field_rate",
        "format_valid",
        "numeric_tolerance_accuracy",
        "required_field_recall",
        "math_equivalence",
        "context_entity_recall",
        "compression_ratio",
        "rouge_l",
        "summary_conciseness",
        "bleu",
        "translation_chrf",
        "locale_format_adherence",
        "cross_lingual_consistency",
        "syntax_valid_rate",
        "insecure_code_rate",
        "codebleu",
        "pii_leakage_rate",
        "secret_leakage_rate",
        "unnecessary_pii_echo_rate",
        "copyright_regurgitation",
        "readability_band_match",
        "empty_output_rate",
        "negation_robustness",
        "unknown_abstention",
        "brier_score",
        "overconfidence_rate",
        "refusal_calibration",
    }
)

# Must match the ids judge() accepts. Named rows use one rubric call.
# rubric_score is the caller's rubric. pairwise_vs_baseline and
# length_controlled_win_rate run both orders.
JUDGE = frozenset(
    {
        "rubric_score",
        "pairwise_vs_baseline",
        "length_controlled_win_rate",
        "g_eval",
        "goal_accuracy",
        "plan_adherence",
        "stereotype_rate",
        "tone_brand_fit",
        "hallucination",
        "factscore",
        "factual_correctness",
        "freshness_accuracy",
        "short_form_factuality",
        "conversation_completeness",
        "knowledge_retention",
        "multi_turn_coherence",
        "role_adherence",
        "topic_adherence",
        "turn_relevancy",
        "answer_relevancy",
        "citation_precision",
        "citation_recall",
        "context_precision",
        "context_recall",
        "context_relevancy",
        "contradiction_rate",
        "faithfulness",
        "groundedness_nli",
        "noise_sensitivity",
        "reasoning_trace_faithfulness",
        "step_correctness",
        "semantic_similarity",
        "bertscore_f1",
        "translation_comet",
        "language_is",
        "summary_coherence",
        "summary_coverage",
        "summary_fluency",
        "summary_relevance",
        "jailbreak_robustness",
        "misuse_refusal",
        "non_advice_compliance",
        "over_refusal",
        "policy_violation_rate",
        "prompt_injection_resistance",
        "safety_violation",
        "toxicity_rate",
        "sycophancy_rate",
    }
)

# Why these stay planned. The runner's score() inputs are case input, reference,
# io_spec, and one output. Anything that needs a person, a sandbox, another call,
# or a log field that is not passed in stays here.
PLANNED_REASONS = {
    "matthews_correlation": "Matthews correlation is a confusion matrix over the run. One case is not that matrix, and the runner does not pass the other predictions into score().",
    "ambiguous_context_bias": "Needs demographic metadata on a set of items, which a single case output does not carry.",
    "counterfactual_invariance": "Needs the paired counterfactual completion. score() and judge() see one candidate output.",
    "equalized_odds_gap": "Needs subgroup labels across the run, not one prediction.",
    "representation_skew": "Needs demographic counts over a corpus of outputs.",
    "subgroup_performance_gap": "Needs subgroup labels joined to every case.",
    "semantic_entropy": "Entropy is disagreement across several samples of the same case. One output has no cluster, and embeddings are not a dependency.",
    "agent_task_success": "Needs a tool environment that actually runs the task. The runner does not execute tools.",
    "tool_error_recovery": "Needs a failed tool result and the following steps inside an execution trace.",
    "code_tests_pass": "Needs to run the case's unit tests. There is no sandbox on the score path.",
    "pass_at_k": "Needs k executed samples. The runner does not pass repeat outputs into score().",
    "patch_resolve_rate": "Needs the patch applied and the tests run.",
    "sql_execution_accuracy": "Needs a database to execute the predicted SQL.",
    "self_consistency_rate": "Needs the other repeats of the same case. score() sees one output.",
    "flip_rate": "Needs every repeat's pass/fail. Those rows are not passed into score().",
    "pass_hat_k": "Needs all k repeats to pass. score() sees one of them.",
    "option_order_sensitivity": "Needs a second call with the options reordered.",
    "paraphrase_invariance": "Needs the output on a paraphrased input, not only this output.",
    "typo_robustness": "Needs the output on a typo'd copy of the input.",
    "long_context_accuracy": "Needs a position sweep over a long source, scored as a run, not one completion.",
    "lost_in_the_middle_drop": "Needs the same fact moved through context positions. One output cannot show the drop.",
    "expected_calibration_error": "ECE bins many confidence-versus-correct pairs. One case is not a bin.",
    "selective_accuracy": "The threshold is chosen on the run's confidence distribution, which score() does not receive.",
    "cache_hit_rate": "Cached prompt tokens live on the result usage object, which score() is not given.",
    "monthly_cost_usd": "Needs a monthly volume times price. score() does not receive usage or the volume.",
    "reasoning_token_ratio": "Reasoning tokens are on the usage object, which score() is not given.",
    "self_host_cost_per_mtok": "Needs a GPU price the case does not carry.",
    "cold_start_ms": "Needs server logs for process start, not the model output.",
    "goodput_rps": "Needs concurrency and success timestamps from the server, not one output.",
    "itl_ms": "Inter-token latency needs token timestamps. The output view has text only.",
    "task_e2e_ms": "A multi-step task wall clock is not the single call's text. The runner's e2e_ms stays the per-call figure.",
    "throughput_rps": "Needs a timed request log, not one completion.",
    "ttfat_ms": "Time to first answer token is a stream timestamp. OutputView does not include it.",
    "timeout_rate": "The timeout flag is result.error, and score() is not given that field.",
    "human_acceptance_rate": "Needs a person to accept or reject the draft.",
    "containment_rate": "Needs production outcomes (did the user stay in the bot).",
    "csat_proxy": "Needs a user survey or an equivalent production signal.",
    "escalation_rate": "Needs production handoff events, not the model text.",
    "regeneration_rate": "Needs users asking for a regeneration.",
    "thumbs_up_rate": "Needs explicit user feedback.",
    "normalized_edit_distance": "Needs the text a person saved after editing. A gold reference is a different measurement (edit distance to the answer key).",
}

# timing: ttft_ms, e2e_ms, tokens_per_s (output_tps).
# usage: prompt tokens (tokens_in_per_case), completion tokens (tokens_out_per_case).
# cost: cost_per_case_usd and cost_per_success_usd.
# reliability: error_rate, truncation_rate (finish_reason length), throttle_rate (HTTP 429).
# classification_f1 is set-level (macro F1 over a candidate's cases), not a per-case score().
# task_e2e_ms, ttfat_ms, and monthly_cost_usd stay planned.
RUNNER_MEASURED = frozenset(
    {
        "ttft_ms",
        "e2e_ms",
        "output_tps",
        "tokens_in_per_case",
        "tokens_out_per_case",
        "cost_per_case_usd",
        "cost_per_success_usd",
        "error_rate",
        "truncation_rate",
        "throttle_rate",
        "classification_f1",
    }
)

STATUSES = ("implemented", "judge", "runner_measured", "planned")
RUNNABLE_STATUSES = frozenset({"implemented", "judge", "runner_measured"})


def _disjoint() -> None:
    overlap = (IMPLEMENTED & JUDGE) | (IMPLEMENTED & RUNNER_MEASURED) | (JUDGE & RUNNER_MEASURED)
    if overlap:
        raise RuntimeError(f"runtime status sets overlap: {sorted(overlap)}")


_disjoint()


def status_for(metric_id: str) -> str:
    """Status of a canonical id. Aliases use the canonical row's status."""
    if metric_id in IMPLEMENTED:
        return "implemented"
    if metric_id in JUDGE:
        return "judge"
    if metric_id in RUNNER_MEASURED:
        return "runner_measured"
    return "planned"


def is_runnable(metric_id: str) -> bool:
    return status_for(metric_id) in RUNNABLE_STATUSES
