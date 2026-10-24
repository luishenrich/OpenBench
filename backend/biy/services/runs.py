"""Runs: estimate (with cost confirmation), start (enqueue on arq), status + leaderboard, results."""

from __future__ import annotations

import json
from uuid import UUID

import httpx

from contract.schemas import (Estimate, EstimateLine, ModelRef, Progress, ResultOut, ResultsPage, Run, RunBrief,
                              RunIn, UseCase)

from .. import db, ranking, scoring
from ..config import settings
from ..providers import build_messages, catalog
from .errors import CostNotConfirmed, Invalid, NotFound
from .use_cases import _brief, get_use_case, list_cases
from .workspace import get_workspace

# Expected output tokens per call when the use case sets no max_tokens. Reasoning models
# spend more before answering, hence the multiplier.
OUTPUT_TOKENS = {"classification": 30, "extraction": 400, "chat": 400, "summarization": 350, "batch": 400}
REASONING_FACTOR = 2.5
JUDGE_PROMPT_TOKENS, JUDGE_OUTPUT_TOKENS = 600, 250

_or_prices: dict[str, dict] | None = None


async def _openrouter_price(model: str) -> dict | None:
    """Live OpenRouter price for models outside the catalogue (closed baselines)."""
    global _or_prices
    if _or_prices is None:
        try:
            async with httpx.AsyncClient(timeout=15) as c:
                data = (await c.get("https://openrouter.ai/api/v1/models")).json()["data"]
            _or_prices = {m["id"]: {"input": float(m["pricing"]["prompt"]) * 1e6,
                                    "output": float(m["pricing"]["completion"]) * 1e6} for m in data}
        except Exception:
            _or_prices = {}
    return _or_prices.get(model)


async def _price(ref: ModelRef) -> dict:
    p = catalog.price_per_1m(ref.provider, ref.model)
    if not p and ref.provider == "openrouter":
        p = await _openrouter_price(ref.model)
    return p or {"input": 0.0, "output": 0.0}


def _validate(uc: UseCase, candidates: list[ModelRef], needs_vision: bool) -> None:
    if not candidates:
        raise Invalid("pick at least one candidate (see GET /api/models)")
    for c in candidates:
        m = catalog.get_model(c.provider, c.model)
        if not m:
            raise Invalid(f"unknown model {c.provider}:{c.model}; candidates must come from GET /api/models")
        if needs_vision and not (m.get("verified") or {}).get("vision"):
            raise Invalid(f"{c.model} has no verified vision support, and this use case has image input")


def _baseline(uc: UseCase, req: RunIn) -> ModelRef | None:
    if not (req.include_baseline and uc.current_model):
        return None
    if any(c.provider == uc.current_model.provider and c.model == uc.current_model.model for c in req.candidates):
        return None
    return uc.current_model


async def estimate_run(workspace_id: UUID, req: RunIn) -> Estimate:
    uc = await get_use_case(workspace_id, req.use_case_id)
    cases = await list_cases(workspace_id, req.use_case_id)
    if not cases:
        raise Invalid("this use case has no cases yet; add some before running")
    _validate(uc, req.candidates, any(c.input.get("images") for c in cases))
    io = uc.io_spec.model_dump()
    in_tokens = sum(len(json.dumps(build_messages(io, c.input))) // 4 + 20 for c in cases)
    in_tokens += len(json.dumps(io.get("tools") or [])) // 4 * len(cases)
    out_default = io.get("params", {}).get("max_tokens") or OUTPUT_TOKENS.get(uc.kind, 500)

    lines, total_in, total_out, cand_cost = [], 0, 0, 0.0
    refs = list(req.candidates) + ([b] if (b := _baseline(uc, req)) else [])
    for ref in refs:
        m = catalog.get_model(ref.provider, ref.model) or {}
        out = out_default * (REASONING_FACTOR if (m.get("verified") or {}).get("reasoning") else 1)
        n_in, n_out = in_tokens * req.repeats, int(out * len(cases) * req.repeats)
        p = await _price(ref)
        cost = (n_in * (p.get("input") or 0) + n_out * (p.get("output") or 0)) / 1e6
        lines.append(EstimateLine(provider=ref.provider, model=ref.model, calls=len(cases) * req.repeats,
                                  est_cost_usd=round(cost, 6)))
        total_in, total_out, cand_cost = total_in + n_in, total_out + n_out, cand_cost + cost

    judge_cost = 0.0
    judge_metrics = [m for m in uc.metrics if scoring.is_judge_metric(m.metric_id)]
    if judge_metrics:
        judge = uc.judge or (await get_workspace(workspace_id)).default_judge
        jp = await _price(ModelRef(provider=judge.provider, model=judge.model))
        calls = sum(len(cases) * req.repeats * len(req.candidates) * (2 if m.metric_id == "pairwise_vs_baseline" else 1)
                    for m in judge_metrics)
        per_call_in = in_tokens / len(cases) + out_default * 2 + JUDGE_PROMPT_TOKENS
        judge_cost = calls * (per_call_in * (jp.get("input") or 0) + JUDGE_OUTPUT_TOKENS * (jp.get("output") or 0)) / 1e6

    return Estimate(
        calls=sum(l.calls for l in lines), est_input_tokens=total_in, est_output_tokens=total_out,
        est_cost_usd=round(cand_cost, 6), judge_cost_usd=round(judge_cost, 6),
        total_usd=round(cand_cost + judge_cost, 6), per_candidate=lines,
    )


async def start_run(workspace_id: UUID, req: RunIn) -> Run:
    est = await estimate_run(workspace_id, req)
    if req.confirm_cost_usd is None or req.confirm_cost_usd + 1e-9 < est.total_usd:
        raise CostNotConfirmed(est)
    uc = await get_use_case(workspace_id, req.use_case_id)
    ws = await get_workspace(workspace_id)
    baseline = _baseline(uc, req)
    n_cases = uc.case_count
    snapshot = {
        "use_case": uc.model_dump(mode="json", exclude={"latest_run"}),
        "default_profile": ws.default_profile.model_dump(mode="json"),
        "judge": (uc.judge or ws.default_judge).model_dump(mode="json"),
        "candidates": [c.model_dump(mode="json") for c in req.candidates],
        "baseline": baseline.model_dump(mode="json") if baseline else None,
        "estimate": est.model_dump(mode="json"),
    }
    total = n_cases * req.repeats * (len(req.candidates) + (1 if baseline else 0))
    run_id = await db.fetchval(
        """insert into run (workspace_id, use_case_id, candidates, repeats, include_baseline, config_snapshot,
                            est_cost_usd, total_jobs) values ($1, $2, $3, $4, $5, $6, $7, $8) returning id""",
        workspace_id, req.use_case_id, snapshot["candidates"], req.repeats, req.include_baseline, snapshot,
        est.total_usd, total)
    await _enqueue(run_id)
    return await get_run(workspace_id, run_id)


async def _enqueue(run_id: UUID) -> None:
    from arq import create_pool
    from arq.connections import RedisSettings
    if not settings.redis_url:
        raise RuntimeError("REDIS_URL is not set: runs need the worker")
    redis = await create_pool(RedisSettings.from_dsn(settings.redis_url))
    try:
        await redis.enqueue_job("execute_run", str(run_id), _job_id=f"run:{run_id}")
    finally:
        await redis.aclose()


_RESULT_COLS = ("id, candidate_key, is_baseline, case_id, repeat_idx, output, timing, usage, cost_usd, error, "
                "scores, judge")


async def get_run(workspace_id: UUID, run_id: UUID) -> Run:
    r = await db.fetchrow("select * from run where id = $1 and workspace_id = $2", run_id, workspace_id)
    if not r:
        raise NotFound(f"run {run_id} not found")
    snap = r["config_snapshot"]
    counts = await db.fetchrow(
        """select count(*) done, count(*) filter (where error is not null) errors,
                  count(*) filter (where judge is not null) judged
           from result where run_id = $1""", run_id)
    if r["status"] == "done" and r["summary"]:
        summary = r["summary"]
    else:
        results = await db.fetch(f"select {_RESULT_COLS} from result where run_id = $1", run_id)
        summary = ranking.build(results, snap, done=False)
        summary = {k: (v.model_dump(mode="json") if hasattr(v, "model_dump") else
                       [x.model_dump(mode="json") for x in v] if isinstance(v, list) else v)
                   for k, v in summary.items()}
    return Run(
        id=r["id"], use_case_id=r["use_case_id"], status=r["status"],
        progress=Progress(done=counts["done"], total=r["total_jobs"], errors=counts["errors"],
                          judged=counts["judged"], judge_total=(r["summary"] or {}).get("judge_total", 0)),
        candidates=[ModelRef(**c) for c in r["candidates"]], repeats=r["repeats"],
        est_cost_usd=r["est_cost_usd"], actual_cost_usd=r["actual_cost_usd"], created_at=r["created_at"],
        started_at=r["started_at"], finished_at=r["finished_at"], error=r["error"],
        leaderboard=summary.get("leaderboard") or [], pareto_points=summary.get("pareto_points") or [],
        recommendation=summary.get("recommendation"),
    )


async def list_runs(workspace_id: UUID, use_case_id: UUID) -> list[RunBrief]:
    rows = await db.fetch("""select id, status, finished_at, summary from run
                             where workspace_id = $1 and use_case_id = $2 order by created_at desc""",
                          workspace_id, use_case_id)
    return [_brief(r) for r in rows]


async def cancel_run(workspace_id: UUID, run_id: UUID) -> Run:
    await db.execute("""update run set status = 'cancelled', finished_at = now()
                        where id = $1 and workspace_id = $2 and status in ('queued', 'running', 'scoring')""",
                     run_id, workspace_id)
    return await get_run(workspace_id, run_id)


async def list_results(workspace_id: UUID, run_id: UUID, candidate_key: str | None = None,
                       case_id: UUID | None = None, cursor: str | None = None, limit: int = 50) -> ResultsPage:
    if not await db.fetchval("select 1 from run where id = $1 and workspace_id = $2", run_id, workspace_id):
        raise NotFound(f"run {run_id} not found")
    offset = int(cursor or 0)
    limit = max(1, min(limit, 200))
    where, args = ["run_id = $1"], [run_id]
    if candidate_key:
        args.append(candidate_key)
        where.append(f"candidate_key = ${len(args)}")
    if case_id:
        args.append(case_id)
        where.append(f"case_id = ${len(args)}")
    rows = await db.fetch(
        f"""select {_RESULT_COLS} from result where {' and '.join(where)}
            order by case_id, candidate_key, repeat_idx limit {limit + 1} offset {offset}""", *args)
    items = [ResultOut(**{k: v for k, v in x.items() if k != "is_baseline"}) for x in rows[:limit]]
    return ResultsPage(items=items, next_cursor=str(offset + limit) if len(rows) > limit else None)
