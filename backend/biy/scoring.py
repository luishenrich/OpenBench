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
try:  # judge metrics that compare against the reference in both orders (Jad's list)
    from .metrics.judge import PAIRWISE_METRICS
except ImportError:  # pragma: no cover
    PAIRWISE_METRICS = {"pairwise_vs_baseline", "length_controlled_win_rate"}


def is_pairwise(metric_id: str) -> bool:
    return metric_id in PAIRWISE_METRICS


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
    from .services import metrics as bank_info  # lazy: services imports this module
    return bank_info.is_judge(metric_id) or metric_id in JUDGE_METRICS


def in_quality(metric_id: str) -> bool:
    """Only metrics on the bank's quality axis enter Q (cer/wer are reported, gates stay gates)."""
    from .services import metrics as bank_info
    return bank_info.utility_axis(metric_id) == "quality"


def has_judge() -> bool:
    return _HAS_BANK and callable(getattr(_bank, "judge", None))


async def judge(metric_id: str, case: CaseView, output: OutputView, baseline: OutputView | None,
                config: dict, call_llm):
    return await _bank.judge(metric_id, case, output, baseline, config, call_llm)


def score(metric_id: str, case: CaseView, output: OutputView, config: dict) -> float | None:
    """Per-case value, or None when there is none to store for this case.

    Ids the runtime doesn't compute per case (judge metrics, runner-measured ones, set-level ones
    in CORPUS) are computed elsewhere, so None here. Use cases can't hold planned metrics: the
    service layer rejects them on create/update.
    """
    if metric_id in CORPUS:
        return None
    if _HAS_BANK:
        try:
            return _bank.score(metric_id, case, output, config)
        except getattr(_bank, "UnimplementedMetricError", ()):
            return None
        except KeyError:  # unknown to the bank: try the fallback
            pass
    fn = _FALLBACK.get(metric_id)
    return fn(case, output, config) if fn else None


def aggregate(values: list[float]) -> Stat:
    if _HAS_BANK and callable(getattr(_bank, "aggregate", None)):
        return _bank.aggregate(values)
    return _bootstrap(values)


# Metrics defined over the whole set of a candidate's outputs, not per case. The ranking computes
# them from (prediction, reference) pairs; score() returns None for them.
def _label_of(output: dict | None, reference: Any) -> tuple[str, str] | None:
    ref = _ref_obj(reference)
    gold = ref.get("label") if isinstance(ref, dict) else ref
    if gold is None:
        return None
    out = output or {}
    js = out.get("json")
    pred = js.get("label") if isinstance(js, dict) and "label" in js else out.get("text")
    return _norm(pred or ""), _norm(gold)


def _macro_f1(pairs: list[tuple[str, str]]) -> float:
    labels = {g for _, g in pairs}
    f1s = []
    for lab in labels:
        tp = sum(1 for p, g in pairs if p == lab and g == lab)
        fp = sum(1 for p, g in pairs if p == lab and g != lab)
        fn = sum(1 for p, g in pairs if p != lab and g == lab)
        f1s.append(0.0 if tp == 0 else 2 * tp / (2 * tp + fp + fn))
    return sum(f1s) / len(f1s) if f1s else 0.0


CORPUS = {"classification_f1": _macro_f1}


def corpus_stat(metric_id: str, rows: list[dict], n_boot: int = 500, seed: int = 0) -> Stat | None:
    """Set-level metric with a bootstrap CI over cases. rows: result rows with output + reference."""
    fn = CORPUS.get(metric_id)
    if not fn:
        return None
    pairs = [p for r in rows if not r.get("error") and (p := _label_of(r.get("output"), r.get("reference")))]
    if not pairs:
        return None
    rng = random.Random(seed)
    boots = sorted(fn(rng.choices(pairs, k=len(pairs))) for _ in range(n_boot))
    mean = sum(boots) / n_boot
    std = math.sqrt(sum((b - mean) ** 2 for b in boots) / (n_boot - 1))
    return Stat(mean=round(fn(pairs), 6), std=round(std, 6), ci_low=round(_pct(boots, 2.5), 6),
                ci_high=round(_pct(boots, 97.5), 6), n=len(pairs))


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


_FALLBACK = {  # bank ids (aliases are resolved before scoring)
    "json_valid": _json_valid,
    "json_schema_valid": _json_schema_valid,
    "exact_match": _exact_match,
    "classification_accuracy": _label_accuracy,
    "label_accuracy": _label_accuracy,
    "field_accuracy": _field_f1,
    "field_f1": _field_f1,
}
