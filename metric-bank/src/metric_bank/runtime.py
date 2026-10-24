"""Which bank rows the product can compute today.

The selector proposes only these rows unless a brief sets include_planned.
Planned rows stay in the bank as the roadmap.

implemented
    score() computes the id (aliases included).
judge
    judge() computes the id. score() does not.
runner_measured
    The runner records it from stream timing, usage, or cost
    (contract/services.md: "stream each call → timing, usage, cost").
    score() does not recompute it.
planned
    Everything else. In the bank, off the default scorecard.
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
        "character_accuracy",
        "word_accuracy",
        "cer",
        "wer",
        "bbox_iou",
        "bbox_f1",
    }
)

# Must match the ids judge() accepts.
JUDGE = frozenset({"rubric_score", "pairwise_vs_baseline"})

# timing: ttft_ms, e2e_ms, tokens_per_s (output_tps).
# usage: prompt tokens (tokens_in_per_case), completion tokens (tokens_out_per_case).
# cost: cost_per_case_usd and cost_per_success_usd.
# task_e2e_ms, ttfat_ms, monthly_cost_usd, and the reliability rates are planned:
# the runner comment does not record them.
RUNNER_MEASURED = frozenset(
    {
        "ttft_ms",
        "e2e_ms",
        "output_tps",
        "tokens_in_per_case",
        "tokens_out_per_case",
        "cost_per_case_usd",
        "cost_per_success_usd",
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
