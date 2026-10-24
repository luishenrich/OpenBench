"""Leaderboard from result rows: aggregates → scores → gates → Pareto → utility → recommendation.

Scores per axis are in [0, 1]. With a target and a max in the profile, an axis scores 1 at the
target and 0 at the max, on a log scale (contract Profile). Without targets, it is relative to
the best candidate in the run. Utility = Q^wq · S^ws · C^wc with weights normalised to 1.
"""

from __future__ import annotations

import math
from collections import defaultdict
from typing import Any

from contract.schemas import CandidateResult, ParetoPoint, Recommendation, Scores, Stat

from . import scoring


def candidate_key(provider: str, model: str) -> str:
    return f"{provider}:{model}"


def short_name(model: str) -> str:
    return model.split("/")[-1]


def _axis(value: float | None, target: float | None, worst: float | None, best_seen: float | None) -> float:
    """Lower-is-better value → [0, 1]."""
    if value is None or value <= 0:
        return 1.0 if value == 0 else 0.0
    if target and worst and worst > target:
        if value <= target:
            return 1.0
        if value >= worst:
            return 0.0
        return 1 - math.log(value / target) / math.log(worst / target)
    return min(1.0, (best_seen or value) / value)


def _quality(scores: dict[str, float], metric_specs: list[dict]) -> float | None:
    """Weighted mean of the use case's quality-axis metrics present in this result."""
    total = weight = 0.0
    for m in metric_specs:
        if not scoring.in_quality(m["metric_id"]):
            continue
        v = scores.get(m["metric_id"])
        if v is not None:
            total += v * m.get("weight", 1.0)
            weight += m.get("weight", 1.0)
    return total / weight if weight else None


def _gate_value(c: dict, metric_id: str) -> float | None:
    """Value a gate compares. Latency gates without a suffix use p95."""
    if metric_id in c["metric_means"]:
        return c["metric_means"][metric_id]
    ttft = c["ttft"]
    return {
        "quality": c["quality"].mean,
        "error_rate": c["error_rate"],
        "truncation_rate": c["truncation_rate"],
        "throttle_rate": c["throttle_rate"],
        "ttft_ms": ttft.p95 if ttft else None, "ttft_ms_p95": ttft.p95 if ttft else None,
        "ttft_ms_p50": ttft.p50 if ttft else None,
        "e2e_ms": c["e2e"].p95, "e2e_ms_p95": c["e2e"].p95, "e2e_ms_p50": c["e2e"].p50,
        "cost_per_call_usd": c["cost_per_call"], "cost_per_case_usd": c["cost_per_call"],
        "cost_per_success_usd": c["cost_per_success"],
        "output_tps": c["tps"], "tokens_per_s": c["tps"],
    }.get(metric_id)


def _passes(value: float | None, op: str, threshold: float) -> bool:
    if value is None:
        return False
    return {">=": value >= threshold, "<=": value <= threshold, ">": value > threshold, "<": value < threshold}[op]


def build(results: list[dict], snapshot: dict, done: bool) -> dict[str, Any]:
    """{"leaderboard", "pareto_points", "recommendation"} for Run. `results` are result rows."""
    uc = snapshot["use_case"]
    profile = uc.get("profile") or snapshot.get("default_profile") or {}
    weights = profile.get("weights") or {"quality": 60, "speed": 20, "cost": 20}
    targets = profile.get("targets") or {}
    metric_specs = uc.get("metrics") or []
    speed_by_ttft = uc.get("kind") in ("chat", "agent")

    candidates = {candidate_key(m["provider"], m["model"]): m for m in snapshot["candidates"]}
    baseline = snapshot.get("baseline")
    if baseline:
        candidates[candidate_key(baseline["provider"], baseline["model"])] = baseline

    by_cand: dict[str, list[dict]] = defaultdict(list)
    for r in results:
        by_cand[r["candidate_key"]].append(r)

    rows = []
    for key, ref in candidates.items():
        rs = by_cand.get(key) or []
        if not rs:
            continue
        ok = [r for r in rs if not r.get("error")]
        qualities = [q for r in ok if (q := _quality(r.get("scores") or {}, metric_specs)) is not None]
        per_metric: dict[str, list[float]] = defaultdict(list)
        for r in ok:
            for mid, v in (r.get("scores") or {}).items():
                if v is not None:
                    per_metric[mid].append(v)
        ttfts = [r["timing"]["ttft_ms"] for r in ok if (r.get("timing") or {}).get("ttft_ms") is not None]
        e2es = [r["timing"]["e2e_ms"] for r in ok if (r.get("timing") or {}).get("e2e_ms") is not None]
        tpss = [r["timing"]["tokens_per_s"] for r in ok if (r.get("timing") or {}).get("tokens_per_s")]
        costs = [r["cost_usd"] for r in ok if r.get("cost_usd") is not None]
        cost_per_call = sum(costs) / len(costs) if costs else 0.0
        quality = scoring.aggregate(qualities) if qualities else Stat(mean=0, std=0, ci_low=0, ci_high=0, n=0)
        success = quality.mean * (1 - (len(rs) - len(ok)) / len(rs))
        rows.append({
            "key": key, "ref": ref, "is_baseline": key == (baseline and candidate_key(baseline["provider"], baseline["model"])),
            "n": len(rs), "quality": quality,
            "metrics": {mid: scoring.aggregate(v) for mid, v in per_metric.items()},
            "metric_means": {mid: sum(v) / len(v) for mid, v in per_metric.items()},
            "ttft": scoring.percentiles(ttfts) if ttfts else None,
            "e2e": scoring.percentiles(e2es) if e2es else scoring.percentiles([0.0]),
            "tps": round(sum(tpss) / len(tpss), 1) if tpss else None,
            "cost_per_call": cost_per_call,
            "cost_per_success": cost_per_call / success if success > 0 else None,
            "error_rate": (len(rs) - len(ok)) / len(rs),
            "truncation_rate": sum(1 for r in rs if (r.get("output") or {}).get("finish_reason") == "length") / len(rs),
            "throttle_rate": sum(1 for r in rs if "HTTP 429" in (r.get("error") or "")) / len(rs),
        })
    if not rows:
        return {"leaderboard": [], "pareto_points": [], "recommendation": None}

    latency = lambda c: (c["ttft"].p95 if speed_by_ttft and c["ttft"] else c["e2e"].p95)  # noqa: E731
    best_lat = min((latency(c) for c in rows if latency(c)), default=None)
    best_cost = min((c["cost_per_call"] for c in rows if c["cost_per_call"] > 0), default=None)
    lat_key = "ttft_ms_p95" if speed_by_ttft else "e2e_ms_p95"
    wsum = sum(weights.values()) or 1
    wq, ws, wc = (weights.get(k, 0) / wsum for k in ("quality", "speed", "cost"))

    for c in rows:
        q = max(c["quality"].mean, 0.0)
        s = _axis(latency(c), targets.get(lat_key), targets.get(f"{lat_key}_max"), best_lat)
        k = _axis(c["cost_per_call"], targets.get("cost_per_call_usd"), targets.get("cost_per_call_usd_max"), best_cost)
        utility = (q ** wq) * (max(s, 1e-6) ** ws) * (max(k, 1e-6) ** wc) if q > 0 else 0.0
        c["scores"] = Scores(quality=round(q, 4), speed=round(s, 4), cost=round(k, 4), utility=round(utility, 4))
        c["failed_gates"] = [f'{g["metric_id"]} {g["op"]} {g["value"]}' for g in uc.get("gates") or []
                             if not _passes(_gate_value(c, g["metric_id"]), g["op"], g["value"])]
        if c["error_rate"] > 0.5 and not any(g["metric_id"] == "error_rate" for g in uc.get("gates") or []):
            c["failed_gates"].append("error_rate <= 0.5")  # implicit floor when the use case sets none

    # Pareto over quality ↑, cost per success ↓, latency ↓
    def dominated(a: dict) -> bool:
        ca = a["cost_per_success"] if a["cost_per_success"] is not None else math.inf
        for b in rows:
            if b is a:
                continue
            cb = b["cost_per_success"] if b["cost_per_success"] is not None else math.inf
            if (b["quality"].mean >= a["quality"].mean and cb <= ca and latency(b) <= latency(a)
                    and (b["quality"].mean > a["quality"].mean or cb < ca or latency(b) < latency(a))):
                return True
        return False

    for c in rows:  # a candidate with no successful call has nothing to trade off
        c["pareto"] = c["error_rate"] < 1 and not dominated(c)
    ranked = sorted((c for c in rows if not c["failed_gates"]), key=lambda c: -c["scores"].utility)
    for i, c in enumerate(ranked, start=1):
        c["rank"] = i

    leaderboard = [CandidateResult(
        candidate_key=c["key"], provider=c["ref"]["provider"], model=c["ref"]["model"], is_baseline=c["is_baseline"],
        n=c["n"], quality=c["quality"], metrics=c["metrics"], ttft_ms=c["ttft"], e2e_ms=c["e2e"],
        tokens_per_s=c["tps"], cost_per_call_usd=round(c["cost_per_call"], 8),
        cost_per_success_usd=round(c["cost_per_success"], 8) if c["cost_per_success"] is not None else None,
        error_rate=round(c["error_rate"], 4), scores=c["scores"], passed_gates=not c["failed_gates"],
        failed_gates=c["failed_gates"], pareto=c["pareto"], rank=c.get("rank"),
    ) for c in sorted(rows, key=lambda c: (c.get("rank") or 10_000, -c["scores"].utility))]

    pareto_points = [ParetoPoint(
        candidate_key=c["key"], label=short_name(c["ref"]["model"]), quality=round(c["quality"].mean, 4),
        cost_per_success_usd=c["cost_per_success"], latency_ms=latency(c), is_baseline=c["is_baseline"],
        pareto=c["pareto"],
    ) for c in rows]

    rec = _recommend(ranked, next((c for c in rows if c["is_baseline"]), None), latency) if done else None
    return {"leaderboard": leaderboard, "pareto_points": pareto_points, "recommendation": rec}


def _recommend(ranked: list[dict], base: dict | None, latency) -> Recommendation | None:
    pick = next((c for c in ranked if not c["is_baseline"]), None)
    if not pick:
        return None
    name = short_name(pick["ref"]["model"])
    q_pct = cost_x = lat_delta = None
    reasons = ["Passes every gate" + (f" (error rate {pick['error_rate']:.0%})" if pick["error_rate"] else "")]
    if base and base["quality"].mean > 0:
        q_pct = round(100 * pick["quality"].mean / base["quality"].mean, 1)
        if base["cost_per_call"] > 0:
            cost_x = round(pick["cost_per_call"] / base["cost_per_call"], 3)
        lat_delta = round(latency(pick) - latency(base), 1)
        reasons.append(f"Quality {pick['quality'].mean:.3f} vs {base['quality'].mean:.3f} for "
                       f"{short_name(base['ref']['model'])}")
        reasons.append(f"p95 latency {latency(pick) / 1000:.1f} s vs {latency(base) / 1000:.1f} s today")
    ties = [c["key"] for c in ranked if c is not pick and not c["is_baseline"]
            and c["quality"].ci_low <= pick["quality"].ci_high and pick["quality"].ci_low <= c["quality"].ci_high]
    if ties:
        reasons.append(f"Statistical tie on quality with {', '.join(short_name(k.split(':', 1)[1]) for k in ties)}; "
                       "ranked by the trade-off profile")
    base_rank = base.get("rank") if base else None
    if base_rank is not None and base_rank < pick["rank"]:
        # today's model wins the trade-off: say so, and name the best open alternative
        base_name = short_name(base["ref"]["model"])
        headline = f"Keep {base_name}: no candidate beats it on this trade-off profile; closest is {name}"
        reasons.insert(0, f"{base_name} ranks #{base_rank}, {name} #{pick['rank']} by utility")
    elif q_pct is not None and cost_x:
        cost = f"1/{round(1 / cost_x)} of the cost" if cost_x < 1 else f"{cost_x:.1f}× the cost"
        headline = f"Switch to {name}: {q_pct:.0f}% of today's quality at {cost}"
    else:
        headline = f"Use {name}: best trade-off of quality, speed and cost in this run"
    return Recommendation(
        candidate_key=pick["key"], provider=pick["ref"]["provider"], model=pick["ref"]["model"],
        headline=headline, reasons=reasons, quality_vs_baseline_pct=q_pct, cost_multiple_vs_baseline=cost_x,
        latency_delta_ms=lat_delta, statistical_tie_with=ties,
    )
