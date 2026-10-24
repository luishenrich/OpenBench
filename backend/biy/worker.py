"""arq worker (owner: Raphaël). Run: arq biy.worker.WorkerSettings. See contract/services.md#biyworker.

execute_run: candidates × cases × repeats through the streaming client, scored as results arrive,
then a judge pass for judge metrics, then the summary (leaderboard, Pareto, recommendation).
Results are idempotent per (candidate, case, repeat), so a retried job resumes where it stopped.
"""

from __future__ import annotations

import asyncio
import logging
from uuid import UUID

from arq.connections import RedisSettings

from contract.schemas import IOSpec

from . import db, ranking, scoring
from .config import settings
from .providers import CallResult, ProviderClient, build_messages, response_format

log = logging.getLogger("biy.worker")

CANCEL_POLL_S = 3.0


def _client(provider: str, clients: dict[str, ProviderClient]) -> ProviderClient:
    if provider not in clients:
        limit = getattr(settings, f"{provider}_concurrency", 8)
        clients[provider] = ProviderClient(provider, concurrency=limit)
    return clients[provider]


def _score_all(metric_specs: list[dict], case: scoring.CaseView, out: scoring.OutputView) -> dict[str, float]:
    scores = {}
    for m in metric_specs:
        if scoring.is_judge_metric(m["metric_id"]):
            continue
        try:
            v = scoring.score(m["metric_id"], case, out, m.get("config") or {})
        except Exception as e:  # a broken metric must not kill the run
            log.warning("metric %s failed: %s", m["metric_id"], e)
            v = None
        if v is not None:
            scores[m["metric_id"]] = float(v)
    return scores


async def _status(run_id: UUID) -> str | None:
    return await db.fetchval("select status from run where id = $1", run_id)


async def execute_run(ctx, run_id: str) -> None:
    rid = UUID(run_id)
    run = await db.fetchrow("select * from run where id = $1", rid)
    if not run or run["status"] in ("done", "cancelled"):
        return
    snap = run["config_snapshot"]
    uc = snap["use_case"]
    io = uc.get("io_spec") or {}
    io_spec = IOSpec(**io)
    metric_specs = uc.get("metrics") or []
    cases = await db.fetch("select id, input, reference from test_case where use_case_id = $1 order by created_at, id",
                           run["use_case_id"])
    refs = list(snap["candidates"]) + ([snap["baseline"]] if snap.get("baseline") else [])
    baseline_key = ranking.candidate_key(snap["baseline"]["provider"], snap["baseline"]["model"]) \
        if snap.get("baseline") else None

    done = {(r["candidate_key"], r["case_id"], r["repeat_idx"]) for r in await db.fetch(
        "select candidate_key, case_id, repeat_idx from result where run_id = $1", rid)}
    await db.execute("""update run set status = 'running', started_at = coalesce(started_at, now()),
                        total_jobs = $2 where id = $1""", rid, len(cases) * len(refs) * run["repeats"])

    clients: dict[str, ProviderClient] = {}
    cancelled = asyncio.Event()

    async def watch_cancel() -> None:
        while not cancelled.is_set():
            await asyncio.sleep(CANCEL_POLL_S)
            if await _status(rid) == "cancelled":
                cancelled.set()

    async def one(ref: dict, case: dict, rep: int) -> None:
        if cancelled.is_set():
            return
        key = ranking.candidate_key(ref["provider"], ref["model"])
        try:
            res = await _client(ref["provider"], clients).chat(
                ref["model"], build_messages(io, case["input"]),
                params={**(io.get("params") or {}), **(ref.get("params") or {})},
                tools=io.get("tools"), response_format=response_format(io.get("response_schema")))
        except Exception as e:  # missing key, bad request shape, …
            res = CallResult(provider=ref["provider"], model=ref["model"], error=f"{type(e).__name__}: {e}")
        out = scoring.OutputView(text=res.text, json=res.json, tool_calls=res.tool_calls)
        scores = _score_all(metric_specs, scoring.CaseView(case["input"], case["reference"], io_spec), out) \
            if res.ok else {}
        await db.execute(
            """insert into result (run_id, candidate_key, is_baseline, case_id, repeat_idx, output, timing, usage,
                                   cost_usd, error, scores)
               values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
               on conflict (run_id, candidate_key, case_id, repeat_idx) do nothing""",
            rid, key, key == baseline_key, case["id"], rep, res.output(), res.timing(), res.usage or {},
            res.cost_usd, res.error, scores)
        if res.cost_usd:
            await db.execute("update run set actual_cost_usd = actual_cost_usd + $2 where id = $1", rid, res.cost_usd)

    watcher = asyncio.create_task(watch_cancel())
    try:
        jobs = [one(ref, case, rep) for ref in refs for case in cases for rep in range(run["repeats"])
                if (ranking.candidate_key(ref["provider"], ref["model"]), case["id"], rep) not in done]
        log.info("run %s: %d calls (%d already done)", run_id, len(jobs), len(done))
        await asyncio.gather(*jobs)
        if not cancelled.is_set():
            await _judge_pass(rid, snap, io_spec, cases, baseline_key, clients, cancelled)
        if cancelled.is_set():
            log.info("run %s cancelled", run_id)
            return
        results = await db.fetch("select * from result where run_id = $1", rid)
        summary = ranking.build(results, snap, done=True)
        summary = {
            "leaderboard": [c.model_dump(mode="json") for c in summary["leaderboard"]],
            "pareto_points": [p.model_dump(mode="json") for p in summary["pareto_points"]],
            "recommendation": summary["recommendation"].model_dump(mode="json") if summary["recommendation"] else None,
            "judge_total": sum(1 for r in results if r.get("judge") is not None),
        }
        await db.execute("update run set status = 'done', summary = $2, finished_at = now() where id = $1",
                         rid, summary)
        log.info("run %s done", run_id)
    except Exception as e:
        log.exception("run %s failed", run_id)
        await db.execute("update run set status = 'failed', error = $2, finished_at = now() where id = $1",
                         rid, f"{type(e).__name__}: {e}"[:1000])
    finally:
        cancelled.set()
        watcher.cancel()
        for c in clients.values():
            await c.aclose()


async def _judge_pass(rid: UUID, snap: dict, io_spec: IOSpec, cases: list[dict], baseline_key: str | None,
                      clients: dict[str, ProviderClient], cancelled: asyncio.Event) -> None:
    """Score judge metrics (rubric, pairwise vs baseline) with the run's judge model."""
    judge_specs = [m for m in snap["use_case"].get("metrics") or [] if scoring.is_judge_metric(m["metric_id"])]
    if not judge_specs:
        return
    if not scoring.has_judge():
        log.warning("judge metrics %s skipped: biy.metrics.judge is not available yet",
                    [m["metric_id"] for m in judge_specs])
        return
    await db.execute("update run set status = 'scoring' where id = $1", rid)
    judge_cfg = snap["judge"]
    judge_client = _client(judge_cfg["provider"], clients)
    case_by_id = {c["id"]: c for c in cases}
    rows = await db.fetch("""select id, candidate_key, case_id, repeat_idx, output, scores from result
                             where run_id = $1 and error is null and judge is null""", rid)
    baseline_out = {(r["case_id"], r["repeat_idx"]): r["output"] for r in rows if r["candidate_key"] == baseline_key}
    judge_total = sum(1 for r in rows if r["candidate_key"] != baseline_key)
    await db.execute("update run set summary = $2 where id = $1", rid, {"judge_total": judge_total})

    async def call_llm(messages: list[dict]) -> str:
        res = await judge_client.chat(judge_cfg["model"], messages, params={"temperature": 0})
        if not res.ok:
            raise RuntimeError(res.error)
        if res.cost_usd:
            await db.execute("update run set actual_cost_usd = actual_cost_usd + $2 where id = $1", rid, res.cost_usd)
        return res.text

    def view(o: dict | None) -> scoring.OutputView | None:
        return scoring.OutputView(o.get("text"), o.get("json"), o.get("tool_calls")) if o else None

    async def one(r: dict) -> None:
        if cancelled.is_set() or r["candidate_key"] == baseline_key:
            return
        case = case_by_id[r["case_id"]]
        cv = scoring.CaseView(case["input"], case["reference"], io_spec)
        scores, judge_info = dict(r["scores"] or {}), None
        for m in judge_specs:
            base = view(baseline_out.get((r["case_id"], r["repeat_idx"])))
            if m["metric_id"] == "pairwise_vs_baseline" and base is None:
                continue
            cfg = {**(m.get("config") or {}), "mode": judge_cfg.get("mode"), "rubric": judge_cfg.get("rubric")}
            try:
                jr = await scoring.judge(m["metric_id"], cv, view(r["output"]), base, cfg, call_llm)
            except Exception as e:
                log.warning("judge %s failed on result %s: %s", m["metric_id"], r["id"], e)
                continue
            scores[m["metric_id"]] = float(jr.score)
            judge_info = {"mode": m["metric_id"], "score": jr.score, "reasoning": jr.reasoning,
                          "winner": getattr(jr, "winner", None)}
        await db.execute("update result set scores = $2, judge = $3 where id = $1", r["id"], scores,
                         judge_info or {"mode": "skipped"})

    await asyncio.gather(*(one(r) for r in rows))


class WorkerSettings:
    functions = [execute_run]
    redis_settings = RedisSettings.from_dsn(settings.redis_url or "redis://localhost:6379")
    max_jobs = 4
    job_timeout = 3600
    max_tries = 3  # a retried run resumes: results are idempotent
