"""Leaderboard from result rows: aggregates → scores → gates → Pareto → utility → recommendation.

Scores per axis are in [0, 1]. With a target and a max in the profile, an axis scores 1 at the
target and 0 at the max, on a log scale (contract Profile). Without targets, it is relative to
the best candidate in the run. Utility = Q^wq · S^ws · C^wc with weights normalised to 1.

References (closed frontier models, and "today" = the use case's current model) are measured the
same way but never ranked, never on the Pareto front and never recommended. The recommendation is
compared with the best reference by quality.
"""

from __future__ import annotations

import math
from collections import defaultdict
from typing import Any

from contract.schemas import CandidateResult, ParetoPoint, Recommendation, Scores, Stat

from . import scoring
from .providers import catalog
from .providers.client import prepare_params
from .providers.request import response_format
from .providers import references as refs_info


def candidate_key(provider: str, model: str, params: dict | None = None) -> str:
    """"<provider>:<model>", plus "@<effort>" when a reasoning effort is pinned."""
    effort = (params or {}).get("reasoning_effort")
    return f"{provider}:{model}" + (f"@{effort}" if effort and effort != "default" else "")


def key_of(ref: dict) -> str:
    return candidate_key(ref["provider"], ref["model"], ref.get("params"))


def effort_of(ref: dict) -> str | None:
    """Pinned effort, or "default" for a reasoning model left at the provider's default."""
    effort = (ref.get("params") or {}).get("reasoning_effort")
    if effort:
        return effort
    m = catalog.get_model(ref["provider"], ref["model"]) or {}
    return "default" if (m.get("verified") or {}).get("reasoning") else None


def references_of(snapshot: dict) -> list[dict]:
    """The run's references, each with a label. Older runs stored one "baseline" (= today)."""
    if snapshot.get("references") is not None:
        return snapshot["references"]
    b = snapshot.get("baseline")
    return [{**b, "label": "today"}] if b else []


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


def build(results: list[dict], snapshot: dict, done: bool, judge_agreement: float | None = None) -> dict[str, Any]:
    """{"leaderboard", "pareto_points", "recommendation"} for Run. `results` are result rows."""
    uc = snapshot["use_case"]
    profile = uc.get("profile") or snapshot.get("default_profile") or {}
    weights = profile.get("weights") or {"quality": 60, "speed": 20, "cost": 20}
    targets = profile.get("targets") or {}
    metric_specs = uc.get("metrics") or []
    speed_by_ttft = uc.get("kind") in ("chat", "agent")
    io = uc.get("io_spec") or {}

    def dropped(ref: dict) -> list[str]:
        """Use-case params this model's endpoint doesn't take (it ran at the provider's default)."""
        return prepare_params(ref["provider"], ref["model"], {**(io.get("params") or {}), **(ref.get("params") or {})},
                              tools=io.get("tools"), response_format=response_format(io.get("response_schema")))[1]

    candidates = {key_of(m): m for m in snapshot["candidates"]}
    reference_keys = set()
    for r in references_of(snapshot):
        candidates.setdefault(key_of(r), r)
        reference_keys.add(key_of(r))

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
        reasoning = [rt for r in ok if (rt := ((r.get("usage") or {}).get("completion_tokens_details") or {})
                                        .get("reasoning_tokens")) is not None]
        cost_per_call = sum(costs) / len(costs) if costs else 0.0
        quality = scoring.aggregate(qualities) if qualities else None
        # set-level quality metrics (e.g. classification_f1): one value per candidate, bootstrap CI over cases
        corpus = {m["metric_id"]: (st, m.get("weight", 1.0)) for m in metric_specs
                  if scoring.in_quality(m["metric_id"]) and (st := scoring.corpus_stat(m["metric_id"], ok))}
        for mid, (st, _) in corpus.items():
            per_metric[mid] = [st.mean]
        if corpus:
            parts = [(st, w) for st, w in corpus.values()]
            if quality:
                w_case = sum(m.get("weight", 1.0) for m in metric_specs
                             if m["metric_id"] in per_metric and m["metric_id"] not in corpus
                             and scoring.in_quality(m["metric_id"]))
                parts.append((quality, w_case))
            wt = sum(w for _, w in parts) or 1.0
            quality = Stat(**{f: round(sum(getattr(st, f) * w for st, w in parts) / wt, 6)
                              for f in ("mean", "std", "ci_low", "ci_high")}, n=len(ok))
        quality = quality or Stat(mean=0, std=0, ci_low=0, ci_high=0, n=0)
        success = quality.mean * (1 - (len(rs) - len(ok)) / len(rs))
        rows.append({
            "key": key, "ref": ref, "is_reference": key in reference_keys, "ok": ok,
            "label": (ref.get("label") or refs_info.label(ref["model"])) if key in reference_keys else None,
            "avg_reasoning_tokens": round(sum(reasoning) / len(reasoning), 1) if reasoning else None,
            "dropped_params": dropped(ref),
            "n": len(rs), "quality": quality,
            "metrics": {mid: corpus[mid][0] if mid in corpus else scoring.aggregate(v) for mid, v in per_metric.items()},
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
    # speed / cost scores are relative to the best *candidate*: references don't move the scale
    pool = [c for c in rows if not c["is_reference"]] or rows
    best_lat = min((latency(c) for c in pool if latency(c)), default=None)
    best_cost = min((c["cost_per_call"] for c in pool if c["cost_per_call"] > 0), default=None)
    lat_key = "ttft_ms_p95" if speed_by_ttft else "e2e_ms_p95"
    wsum = sum(weights.values()) or 1
    wq, ws, wc = (weights.get(k, 0) / wsum for k in ("quality", "speed", "cost"))

    # pairwise metrics compare with one reference: without its answers nothing can be judged
    pair_key = snapshot.get("pairwise_reference") or next((key_of(r) for r in references_of(snapshot)), None)
    pair_row = next((c for c in rows if c["key"] == pair_key), None)
    not_scored = "quality not scored"
    if any(scoring.is_pairwise(m["metric_id"]) for m in metric_specs) and pair_key and not (pair_row and pair_row["ok"]):
        name = (pair_row or {}).get("label") or refs_info.label(pair_key.split(":", 1)[-1].split("@")[0])
        not_scored = f"quality not scored: {name} (pairwise reference) returned no answers"

    # A gate on a metric no candidate has a value for (never computed, e.g. a planned metric) is
    # "not evaluated": reported apart, never failed. Measured for some but not others still fails.
    gates = uc.get("gates") or []
    measured = {g["metric_id"] for g in gates if any(_gate_value(c, g["metric_id"]) is not None for c in rows)}
    unmeasured = [f'{g["metric_id"]} {g["op"]} {g["value"]}' for g in gates if g["metric_id"] not in measured]

    for c in rows:
        q = max(c["quality"].mean, 0.0)
        s = _axis(latency(c), targets.get(lat_key), targets.get(f"{lat_key}_max"), best_lat)
        k = _axis(c["cost_per_call"], targets.get("cost_per_call_usd"), targets.get("cost_per_call_usd_max"), best_cost)
        utility = (q ** wq) * (max(s, 1e-6) ** ws) * (max(k, 1e-6) ** wc) if q > 0 else 0.0
        c["scores"] = Scores(quality=round(q, 4), speed=round(s, 4), cost=round(k, 4), utility=round(utility, 4))
        c["failed_gates"] = [f'{g["metric_id"]} {g["op"]} {g["value"]}' for g in gates
                             if g["metric_id"] in measured and not _passes(_gate_value(c, g["metric_id"]), g["op"], g["value"])]
        if c["error_rate"] > 0.5 and not any(g["metric_id"] == "error_rate" for g in uc.get("gates") or []):
            c["failed_gates"].append("error_rate <= 0.5")  # implicit floor when the use case sets none
        if c["quality"].n == 0 and c["error_rate"] < 1 and any(scoring.in_quality(m["metric_id"]) for m in metric_specs):
            c["failed_gates"].append(not_scored)  # e.g. every juror abstained: unknown, not 0

    # Pareto over quality ↑, cost per success ↓, latency ↓, among candidates only
    def dominated(a: dict) -> bool:
        ca = a["cost_per_success"] if a["cost_per_success"] is not None else math.inf
        for b in pool:
            if b is a:
                continue
            cb = b["cost_per_success"] if b["cost_per_success"] is not None else math.inf
            if (b["quality"].mean >= a["quality"].mean and cb <= ca and latency(b) <= latency(a)
                    and (b["quality"].mean > a["quality"].mean or cb < ca or latency(b) < latency(a))):
                return True
        return False

    for c in rows:  # a candidate with no successful call has nothing to trade off
        c["pareto"] = not c["is_reference"] and c["error_rate"] < 1 and not dominated(c)
    ranked = sorted((c for c in rows if not c["failed_gates"] and not c["is_reference"]),
                    key=lambda c: -c["scores"].utility)
    for i, c in enumerate(ranked, start=1):
        c["rank"] = i

    leaderboard = [CandidateResult(
        candidate_key=c["key"], provider=c["ref"]["provider"], model=c["ref"]["model"],
        is_reference=c["is_reference"], reference_label=c["label"], reasoning_effort=effort_of(c["ref"]),
        avg_reasoning_tokens=c["avg_reasoning_tokens"], dropped_params=c["dropped_params"], n=c["n"], quality=c["quality"], metrics=c["metrics"], ttft_ms=c["ttft"], e2e_ms=c["e2e"],
        tokens_per_s=c["tps"], cost_per_call_usd=round(c["cost_per_call"], 8),
        cost_per_success_usd=round(c["cost_per_success"], 8) if c["cost_per_success"] is not None else None,
        error_rate=round(c["error_rate"], 4), scores=c["scores"], passed_gates=not c["failed_gates"],
        failed_gates=c["failed_gates"], unmeasured_gates=unmeasured, pareto=c["pareto"], rank=c.get("rank"),
    ) for c in sorted(rows, key=lambda c: (c["is_reference"], c.get("rank") or 10_000, -c["scores"].utility))]

    pareto_points = [ParetoPoint(
        candidate_key=c["key"], label=c["label"] or short_name(c["ref"]["model"]), quality=round(c["quality"].mean, 4),
        cost_per_success_usd=c["cost_per_success"], latency_ms=latency(c), is_reference=c["is_reference"],
        pareto=c["pareto"],
    ) for c in rows]

    rec = _recommend(ranked, [c for c in rows if c["is_reference"]], latency, judge_agreement,
                     metric_specs, unmeasured) if done else None
    return {"leaderboard": leaderboard, "pareto_points": pareto_points, "recommendation": rec}


def _jurors(c: dict, judge_ids: set[str]) -> set[str]:
    """Jurors who voted on this candidate's outputs for the judge metrics."""
    return {v["key"] for r in c["ok"] if isinstance(j := r.get("judge"), dict) and j.get("mode") in judge_ids
            for v in j.get("jurors") or []}


def _quality_with(c: dict, metric_specs: list[dict], judge_ids: set[str], jurors: set[str]) -> float | None:
    """Mean quality of c with judge-metric scores re-averaged over `jurors` only (like-for-like)."""
    qs = []
    for r in c["ok"]:
        scores = dict(r.get("scores") or {})
        j = r.get("judge") if isinstance(r.get("judge"), dict) else {}
        if j.get("mode") in judge_ids:
            votes = [v["score"] for v in j.get("jurors") or [] if v["key"] in jurors and v.get("score") is not None]
            if votes:
                scores[j["mode"]] = sum(votes) / len(votes)
            else:
                scores.pop(j["mode"], None)
        if (q := _quality(scores, metric_specs)) is not None:
            qs.append(q)
    return sum(qs) / len(qs) if qs else None


def _juror_name(key: str) -> str:
    return short_name(key.split(":", 1)[-1]).split("@")[0]


def _recommend(ranked: list[dict], references: list[dict], latency,
               judge_agreement: float | None = None, metric_specs: list[dict] | None = None,
               unmeasured: list[str] | None = None) -> Recommendation | None:
    pick = ranked[0] if ranked else None
    if not pick:
        return None
    name = short_name(pick["ref"]["model"])
    usable = [r for r in references if r["error_rate"] < 1 and r["quality"].mean > 0]
    best = max(usable, key=lambda r: r["quality"].mean, default=None)  # the bar to compare with
    today = next((r for r in usable if r["label"] == "today"), None)
    q_pct = cost_x = lat_delta = None
    reasons = ["Passes every gate" + (f" (error rate {pick['error_rate']:.0%})" if pick["error_rate"] else "")
               + (f"; not evaluated (never measured): {', '.join(unmeasured)}" if unmeasured else "")]
    if best:
        q_pct = round(100 * pick["quality"].mean / best["quality"].mean, 1)
        quality_line = f"Quality {pick['quality'].mean:.3f} vs {best['quality'].mean:.3f} for {best['label']}"
        # Fairness: jurors abstain on their own family, so a reference and a candidate can be judged by
        # different jurors. Compare like with like: only the jurors that judged both, when there are ≥ 2.
        judge_ids = {m["metric_id"] for m in metric_specs or [] if scoring.is_judge_metric(m["metric_id"])}
        if judge_ids:
            common = _jurors(pick, judge_ids) & _jurors(best, judge_ids)
            if len(common) >= 2:
                qp, qb = (_quality_with(c, metric_specs, judge_ids, common) for c in (pick, best))
                if qp is not None and qb:
                    q_pct = round(100 * qp / qb, 1)
                    quality_line = (f"Quality {qp:.3f} vs {qb:.3f} for {best['label']}, on the jurors that judged "
                                    f"both ({', '.join(sorted(_juror_name(k) for k in common))}); "
                                    f"{pick['quality'].mean:.3f} vs {best['quality'].mean:.3f} on all jurors")
            else:
                quality_line += (f"; fewer than 2 jurors judged both {name} and {best['label']}, so each side "
                                 "uses its own non-abstaining jurors")
        if best["cost_per_call"] > 0:
            cost_x = round(pick["cost_per_call"] / best["cost_per_call"], 4)
        lat_delta = round(latency(pick) - latency(best), 1)
        reasons.append(quality_line)
        reasons.append(f"p95 latency {latency(pick) / 1000:.1f} s vs {latency(best) / 1000:.1f} s for {best['label']}")
    if today and today is not best and today["cost_per_call"] > 0:
        reasons.append(f"{pick['cost_per_call'] / today['cost_per_call']:.2f}× the cost per call of today's model "
                       f"({short_name(today['ref']['model'])})")
    ties = [c["key"] for c in ranked if c is not pick
            and c["quality"].ci_low <= pick["quality"].ci_high and pick["quality"].ci_low <= c["quality"].ci_high]
    if ties:
        reasons.append(f"Statistical tie on quality with {', '.join(short_name(k.split(':', 1)[1]) for k in ties)}; "
                       "ranked by the trade-off profile")
    if judge_agreement is not None and judge_agreement < 0.7:
        reasons.append(f"Low judge agreement ({judge_agreement:.0%}): check the judged scores by hand")
    if today and today["scores"].utility > pick["scores"].utility:
        # today's model beats the best open candidate on this profile: say so, name the closest
        headline = (f"Keep today's model ({short_name(today['ref']['model'])}): no open model beats it on this "
                    f"trade-off profile; closest is {name}")
    elif q_pct is not None and cost_x:
        cost = f"1/{round(1 / cost_x)} of the cost" if cost_x < 1 else f"{cost_x:.1f}× the cost"
        headline = f"Switch to {name}: {q_pct:.0f}% of {best['label']}'s quality at {cost}"
    else:
        headline = f"Use {name}: best trade-off of quality, speed and cost in this run"
    return Recommendation(
        candidate_key=pick["key"], provider=pick["ref"]["provider"], model=pick["ref"]["model"],
        headline=headline, reasons=reasons, reference_key=best["key"] if best else None,
        quality_vs_reference_pct=q_pct, cost_multiple_vs_reference=cost_x,
        latency_delta_ms=lat_delta, statistical_tie_with=ties,
    )
