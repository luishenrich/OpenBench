"""Runtime for the metric bank. Ids, directions and selection rules stay in metric-bank/.

Interface: contract/services.md. score() returns the bank's own direction. cer and wer
are lower-better and can exceed 1. character_accuracy and word_accuracy are the 0–1
quality terms. Quality Q uses only metrics whose utility_axis is "quality".
"""

from __future__ import annotations

from contract.metric_bank_mapping import metric_info, resolve_id
from contract.schemas import MetricInfo
from metric_bank.build import load_bank

from .judge import judge
from .score import SCORERS
from .stats import aggregate, percentiles
from .types import CaseView, JudgeResult, OutputView

METRICS: dict[str, MetricInfo] = {row["id"]: metric_info(row) for row in load_bank()["metrics"]}


def score(metric_id: str, case: CaseView, output: OutputView, config: dict | None = None) -> float | None:
    """Score one deterministic metric. Unknown ids raise KeyError. Unimplemented bank ids return None."""
    canonical = resolve_id(metric_id)
    scorer = SCORERS.get(canonical)
    if scorer is None:
        return None
    return scorer(case, output, config or {})


__all__ = [
    "METRICS",
    "CaseView",
    "JudgeResult",
    "OutputView",
    "aggregate",
    "judge",
    "percentiles",
    "score",
]
