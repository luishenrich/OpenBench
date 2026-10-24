"""Bridge to the metrics bank (biy.metrics, Jad's) with a small built-in fallback.

The runner only calls the functions below. When biy.metrics implements the interface in
contract/services.md (score, aggregate, percentiles, judge, METRICS), it is used; until then a
few deterministic metrics and a bootstrap aggregate keep runs working end to end.
"""

from __future__ import annotations

import json
import math
import random
import re
from dataclasses import dataclass
from typing import Any

from contract.schemas import IOSpec, Pct, Stat

try:  # Jad's bank, once it lands
    from . import metrics as _bank
    _HAS_BANK = callable(getattr(_bank, "score", None))
except ImportError:  # pragma: no cover
    _bank, _HAS_BANK = None, False

JUDGE_METRICS = {"rubric_score", "pairwise_vs_baseline"}


@dataclass
class CaseView:
    input: dict
    reference: Any | None
    io_spec: IOSpec


@dataclass
class OutputView:
    text: str | None
    json: Any | None
    tool_calls: list | None


def is_judge_metric(metric_id: str) -> bool:
    info = getattr(_bank, "METRICS", {}).get(metric_id) if _HAS_BANK else None
    return (getattr(info, "kind", None) == "judge") if info else metric_id in JUDGE_METRICS


def has_judge() -> bool:
    return _HAS_BANK and callable(getattr(_bank, "judge", None))


async def judge(metric_id: str, case: CaseView, output: OutputView, baseline: OutputView | None,
                config: dict, call_llm):
    return await _bank.judge(metric_id, case, output, baseline, config, call_llm)


def score(metric_id: str, case: CaseView, output: OutputView, config: dict) -> float | None:
    if _HAS_BANK:
        try:
            return _bank.score(metric_id, case, output, config)
        except KeyError:  # unknown to the bank: try the fallback
            pass
    fn = _FALLBACK.get(metric_id)
    return fn(case, output, config) if fn else None


def aggregate(values: list[float]) -> Stat:
    if _HAS_BANK and callable(getattr(_bank, "aggregate", None)):
        return _bank.aggregate(values)
    return _bootstrap(values)


def percentiles(values: list[float]) -> Pct:
    if _HAS_BANK and callable(getattr(_bank, "percentiles", None)):
        return _bank.percentiles(values)
    return Pct(p50=_pct(values, 50), p95=_pct(values, 95))


# --- fallback ----------------------------------------------------------------

def _pct(values: list[float], q: float) -> float:
    if not values:
        return 0.0
    s = sorted(values)
    k = (len(s) - 1) * q / 100
    lo, hi = math.floor(k), math.ceil(k)
    return float(s[lo] + (s[hi] - s[lo]) * (k - lo))


def _bootstrap(values: list[float], n_boot: int = 1000, seed: int = 0) -> Stat:
    n = len(values)
    if n == 0:
        return Stat(mean=0.0, std=0.0, ci_low=0.0, ci_high=0.0, n=0)
    mean = sum(values) / n
    std = math.sqrt(sum((v - mean) ** 2 for v in values) / (n - 1)) if n > 1 else 0.0
    rng = random.Random(seed)
    means = sorted(sum(rng.choices(values, k=n)) / n for _ in range(n_boot))
    return Stat(mean=round(mean, 6), std=round(std, 6), ci_low=round(_pct(means, 2.5), 6),
                ci_high=round(_pct(means, 97.5), 6), n=n)


def _norm(v: Any) -> str:
    return re.sub(r"\s+", " ", str(v)).strip().lower().strip(".")


def _ref_obj(ref: Any) -> Any:
    if isinstance(ref, str):
        try:
            return json.loads(ref)
        except json.JSONDecodeError:
            return ref
    return ref


def _json_valid(case: CaseView, out: OutputView, cfg: dict) -> float:
    return 1.0 if out.json is not None else 0.0


_TYPES = {"string": str, "number": (int, float), "integer": int, "boolean": bool, "object": dict, "array": list}


def _json_schema_valid(case: CaseView, out: OutputView, cfg: dict) -> float | None:
    """Shallow check (required keys + top-level types). The bank does full JSON Schema."""
    schema = case.io_spec.response_schema
    if not schema:
        return None
    schema = schema.get("json_schema", {}).get("schema", schema)
    obj = out.json
    if not isinstance(obj, dict):
        return 0.0
    if any(k not in obj for k in schema.get("required", [])):
        return 0.0
    for k, spec in (schema.get("properties") or {}).items():
        t = _TYPES.get(spec.get("type")) if isinstance(spec.get("type"), str) else None
        if k in obj and obj[k] is not None and t and not isinstance(obj[k], t):
            return 0.0
    return 1.0


def _exact_match(case: CaseView, out: OutputView, cfg: dict) -> float | None:
    if case.reference is None:
        return None
    ref = _ref_obj(case.reference)
    if isinstance(ref, (dict, list)):
        return 1.0 if out.json == ref else 0.0
    return 1.0 if _norm(out.text or "") == _norm(ref) else 0.0


def _label_accuracy(case: CaseView, out: OutputView, cfg: dict) -> float | None:
    if case.reference is None:
        return None
    ref = _ref_obj(case.reference)
    label = ref.get("label") if isinstance(ref, dict) else ref
    got = out.json.get("label") if isinstance(out.json, dict) and "label" in out.json else out.text
    return 1.0 if _norm(got or "") == _norm(label) else 0.0


def _flatten(obj: Any, prefix: str = "") -> dict[str, Any]:
    if isinstance(obj, dict):
        out = {}
        for k, v in obj.items():
            out.update(_flatten(v, f"{prefix}{k}."))
        return out
    if isinstance(obj, list):
        out = {}
        for i, v in enumerate(obj):
            out.update(_flatten(v, f"{prefix}{i}."))
        return out
    return {prefix.rstrip("."): obj}


def _field_f1(case: CaseView, out: OutputView, cfg: dict) -> float | None:
    ref = _ref_obj(case.reference)
    if not isinstance(ref, dict):
        return None
    if not isinstance(out.json, dict):
        return 0.0
    want, got = _flatten(ref), _flatten(out.json)
    if not want:
        return None
    hits = sum(1 for k, v in want.items() if k in got and _norm(got[k]) == _norm(v))
    p = hits / len(got) if got else 0.0
    r = hits / len(want)
    return 0.0 if p + r == 0 else 2 * p * r / (p + r)


_FALLBACK = {
    "json_valid": _json_valid,
    "json_schema_valid": _json_schema_valid,
    "exact_match": _exact_match,
    "label_accuracy": _label_accuracy,
    "field_f1": _field_f1,
}
