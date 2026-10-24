"""Turn metric-bank rows and selector output into contract shapes. Shared by the API and fixtures.

metric-bank/ (Jad) is the source of truth for metric ids, directions and selection rules.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

from contract.schemas import Gate, MetricInfo, MetricSpec, Scorecard, ScorecardBrief

# metric-bank/src next to contract/ (repo root locally, /app in the Docker image)
_SRC = Path(__file__).resolve().parents[1] / "metric-bank" / "src"
if _SRC.exists() and str(_SRC) not in sys.path:
    sys.path.insert(0, str(_SRC))

from metric_bank.build import load_bank  # noqa: E402
from metric_bank.selector import select  # noqa: E402

_GATE = re.compile(r"^\s*(>=|<=|>|<)\s*(-?\d+(?:\.\d+)?)")


def metric_info(row: dict) -> MetricInfo:
    score = row.get("score") or {}
    return MetricInfo(
        id=row["id"], name=row["name"], category=row["category"], description=row["description"],
        measures=row["measures"], method=(row.get("computation") or {}).get("method", "unknown"),
        direction=score.get("direction"), unit=score.get("unit"),
        score_min=score.get("min"), score_max=score.get("max"),
        utility_axis=row.get("utility_axis") or "none", gate_suitable=bool(row.get("gate_suitable")),
        suggested_gate=score.get("suggested_gate"), default_for_kinds=list(row.get("default_for_kinds") or []),
        required_inputs=list((row.get("required_inputs") or {}).get("inputs") or []),
        selector_priority=row.get("selector_priority"), aliases=list(row.get("aliases") or []),
    )


def list_metrics(kind: str | None = None, category: str | None = None) -> list[MetricInfo]:
    rows = load_bank()["metrics"]
    return [metric_info(r) for r in rows
            if (kind is None or kind in (r.get("default_for_kinds") or []))
            and (category is None or r["category"] == category)]


def resolve_id(metric_id: str, bank: dict | None = None) -> str:
    """Canonical id for an id or alias (label_accuracy → classification_accuracy)."""
    for r in (bank or load_bank())["metrics"]:
        if metric_id == r["id"] or metric_id in (r.get("aliases") or []):
            return r["id"]
    raise KeyError(f"unknown metric id {metric_id!r}")


def parse_gate(metric_id: str, threshold: str) -> Gate:
    # "== 1" / "== 0" on a 0–1 rate (e.g. language_is): the same as ">= 1" / "<= 0", which Gate can express
    eq = re.fullmatch(r"\s*==\s*([01](?:\.0+)?)\s*", threshold)
    if eq:
        v = float(eq.group(1))
        return Gate(metric_id=metric_id, op=">=" if v == 1 else "<=", value=v)
    m = _GATE.match(threshold)
    if not m:
        raise ValueError(f"can't parse gate threshold {threshold!r} for {metric_id}")
    return Gate(metric_id=metric_id, op=m.group(1), value=float(m.group(2)))


def scorecard(brief: ScorecardBrief) -> Scorecard:
    data = brief.model_dump(exclude_none=True)
    # select() still requires these three (to be made optional in the bank)
    data.setdefault("id", "brief")
    data.setdefault("title", brief.kind)
    data.setdefault("narrative", brief.narrative)
    out = select(data, load_bank())
    gates = [parse_gate(g["id"], g["threshold"]) for g in out["risk_gates"] + out["task_gates"]]
    return Scorecard(
        kind=brief.kind, always_on=out["always_on"],
        speed_ranking=out["speed"]["ranking"], speed_also_report=out["speed"]["also_report"],
        quality=out["quality"], quality_alternates=out["quality_alternates"], judging=out["judging"],
        also_report=out["also_report"], reliability_extra=out["reliability_extra"], notes=out["notes"],
        metrics=[MetricSpec(metric_id=i) for i in out["quality"]], gates=gates,
    )
