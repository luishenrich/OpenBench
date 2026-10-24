"""Metric bank (metric-bank/, Jad's): list, select a scorecard, resolve ids. No DB.

contract/metric_bank_mapping.py does the bank → contract conversion; this module adds the
look-ups the backend needs (canonical ids, utility axis, judge or not) and validation.
"""

from __future__ import annotations

from functools import lru_cache

from contract.schemas import Gate, MetricInfo, MetricSpec, Scorecard, ScorecardBrief

from .errors import Invalid

# Run-level values the ranking computes itself, accepted as gate ids next to bank ids.
OPERATIONAL = {"error_rate", "truncation_rate", "throttle_rate", "ttft_ms", "e2e_ms", "output_tps",
               "cost_per_case_usd", "cost_per_success_usd", "quality"}


def _mapping():
    from contract import metric_bank_mapping  # imports metric-bank/src; keep lazy
    return metric_bank_mapping


@lru_cache(maxsize=1)
def _by_id() -> dict[str, MetricInfo]:
    try:
        infos = _mapping().list_metrics()
    except Exception:  # bank missing (e.g. a bare checkout): fall back to permissive behaviour
        return {}
    out = {}
    for m in infos:
        out[m.id] = m
        for a in m.aliases:
            out.setdefault(a, m)
    return out


def list_metrics(kind: str | None = None, category: str | None = None) -> list[MetricInfo]:
    return _mapping().list_metrics(kind=kind, category=category)


def scorecard(brief: ScorecardBrief) -> Scorecard:
    return _mapping().scorecard(brief)


def info(metric_id: str) -> MetricInfo | None:
    return _by_id().get(metric_id)


def canonical(metric_id: str) -> str:
    """Bank id for an id or alias; unknown ids stay as they are."""
    m = info(metric_id)
    return m.id if m else metric_id


def utility_axis(metric_id: str) -> str:
    """quality | speed | cost | gate_only | none. Unknown ids count as quality when the bank is
    unavailable, so a run without the bank still ranks."""
    m = info(metric_id)
    if m:
        return m.utility_axis
    return "none" if _by_id() else "quality"


def is_judge(metric_id: str) -> bool:
    m = info(metric_id)
    return bool(m and m.method == "llm_judge") or metric_id in ("rubric_score", "pairwise_vs_baseline")


def normalize_metrics(specs: list[MetricSpec] | None) -> list[MetricSpec] | None:
    """Canonical ids; 422 for ids the bank doesn't know."""
    if specs is None or not _by_id():
        return specs
    out = []
    for s in specs:
        if not info(s.metric_id):
            raise Invalid(f"unknown metric_id {s.metric_id!r}; see GET /api/metrics")
        out.append(s.model_copy(update={"metric_id": canonical(s.metric_id)}))
    return out


def normalize_gates(gates: list[Gate] | None) -> list[Gate] | None:
    if gates is None or not _by_id():
        return gates
    out = []
    for g in gates:
        mid = g.metric_id
        if mid not in OPERATIONAL and not mid.removesuffix("_p95").removesuffix("_p50") in OPERATIONAL:
            if not info(mid):
                raise Invalid(f"unknown gate metric_id {mid!r}; see GET /api/metrics")
            mid = canonical(mid)
        out.append(g.model_copy(update={"metric_id": mid}))
    return out
