"""Selection policy. The guide and the reference selector both follow this.

Quality metrics that enter Q must already be higher-better on 0–1.
Lower-better risk metrics are gates. Operational metrics stay on their own axes.
"""

# Imports are local to avoid a cycle while metrics modules load.
ALWAYS_ON = [
    "error_rate",
    "truncation_rate",
    "throttle_rate",
    "cost_per_case_usd",
    "cost_per_success_usd",
    "tokens_out_per_case",
]

SPEED_BY_KIND = {
    "chat": "ttft_ms",
    "rag": "ttft_ms",
    "extraction": "e2e_ms",
    "classification": "e2e_ms",
    "summarization": "e2e_ms",
    "agent": "task_e2e_ms",
    "generation": "e2e_ms",
    "batch": None,
    "other": "e2e_ms",
}

# When the caller is not waiting, drop the speed metric even if the kind has one.
BATCH_LIKE_SPEED = None

CAPS = {
    "quality_metrics": 5,
    "risk_metrics": 3,
    "business_metrics": 2,
    "judging_metrics": 1,
}

# Metrics in a group compete. The selector keeps the primary unless the client
# asked for the alternate. Gate forms are added only as gates, not as Q terms.
# Methods: at most one generic judge.


def selection_policy() -> dict:
    return {
        "caps": CAPS,
        "always_on": ALWAYS_ON,
        "speed_by_kind": SPEED_BY_KIND,
        "quality_rule": (
            "A metric may enter the quality average Q only when utility_axis is quality "
            "and the stored score is higher-better on 0–1. Apply quality_transform before "
            "averaging. Do not min-max Q across candidates."
        ),
        "gate_rule": (
            "Gates are hard failures. Use them for schema validity, error rate, harmful "
            "compliance, confirmed privacy leaks, and latency ceilings the client named. "
            "Do not turn every metric into a gate."
        ),
        "judge_rule": (
            "Prefer a named deterministic or claim-level metric over a generic judge. "
            "Select at most one of rubric_score and g_eval. Add pairwise_vs_baseline only "
            "when a baseline completion exists."
        ),
        "double_count_groups": [
            "grounding",
            "generic_judge",
            "classification",
            "instruction_prompt",
            "tool_call",
            "lexical_summary",
            "translation_quality",
            "cost",
            "deflection",
        ],
    }
