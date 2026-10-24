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

from contract.schemas import IOSpec, JudgeConfig

from . import db, ranking, scoring
from .config import settings
from .providers import CallResult, ProviderClient, build_messages, response_format
from .providers.client import SKIPPED, strip_think
from .providers.references import family

log = logging.getLogger("biy.worker")

CANCEL_POLL_S = 3.0
BUDGET_SLACK = 1.2  # a run stops starting calls once it has spent 1.2 × the cost the user confirmed


class Budget:
    """Spend against the confirmed cost. Calls already in flight finish, so the overshoot is small."""

    def __init__(self, rid: UUID, confirmed: float | None, spent: float) -> None:
        self.rid, self.limit, self.spent = rid, confirmed * BUDGET_SLACK if confirmed else None, spent
        self.confirmed = confirmed

    @property
    def over(self) -> bool:
        return self.limit is not None and self.spent >= self.limit

    async def charge(self, cost: float | None) -> None:
        if cost:
            self.spent += cost
            await db.execute("update run set actual_cost_usd = actual_cost_usd + $2 where id = $1", self.rid, cost)


def _client(provider: str, clients: dict[str, ProviderClient], limit: int | None = None) -> ProviderClient:
    if provider not in clients:
        limit = limit or getattr(settings, f"{provider}_concurrency", 8)
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
    references = ranking.references_of(snap)
    refs = list(snap["candidates"]) + references
    reference_keys = {ranking.key_of(r) for r in references}

    done = {(r["candidate_key"], r["case_id"], r["repeat_idx"]) for r in await db.fetch(
        "select candidate_key, case_id, repeat_idx from result where run_id = $1", rid)}
    await db.execute("""update run set status = 'running', started_at = coalesce(started_at, now()),
                        total_jobs = $2 where id = $1""", rid, len(cases) * len(refs) * run["repeats"])

    clients: dict[str, ProviderClient] = {}
    cancelled = asyncio.Event()
    budget = Budget(rid, snap.get("confirmed_cost_usd") or (snap.get("estimate") or {}).get("total_usd"),
                    float(run["actual_cost_usd"] or 0))

    async def watch_cancel() -> None:
        while not cancelled.is_set():
            await asyncio.sleep(CANCEL_POLL_S)
            if await _status(rid) == "cancelled":
                cancelled.set()

    async def one(ref: dict, case: dict, rep: int) -> None:
        if cancelled.is_set() or budget.over:
            return
        key = ranking.key_of(ref)
        try:
            res = await _client(ref["provider"], clients).chat(
                ref["model"], build_messages(io, case["input"]),
                params={**(io.get("params") or {}), **(ref.get("params") or {})},
                tools=io.get("tools"), response_format=response_format(io.get("response_schema")),
                stop=lambda: budget.over)
        except Exception as e:  # missing key, bad request shape, …
            res = CallResult(provider=ref["provider"], model=ref["model"], error=f"{type(e).__name__}: {e}")
        # Score the answer without <think> blocks or surrounding whitespace (reasoning models often
        # start with "\n\n"); the raw text is still what gets stored.
        if res.error == SKIPPED:
            return  # over budget: no row, so it isn't counted as a model error
        out = scoring.OutputView(text=strip_think(res.text), json=res.json, tool_calls=res.tool_calls)
        scores = _score_all(metric_specs, scoring.CaseView(case["input"], case["reference"], io_spec), out) \
            if res.ok else {}
        await db.execute(
            """insert into result (run_id, candidate_key, is_baseline, case_id, repeat_idx, output, timing, usage,
                                   cost_usd, error, scores)
               values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
               on conflict (run_id, candidate_key, case_id, repeat_idx) do nothing""",
            rid, key, key in reference_keys, case["id"], rep, res.output(), res.timing(), res.usage or {},
            res.cost_usd, res.error, scores)
        await budget.charge(res.cost_usd)

    watcher = asyncio.create_task(watch_cancel())
    try:
        jobs = [one(ref, case, rep) for ref in refs for case in cases for rep in range(run["repeats"])
                if (ranking.key_of(ref), case["id"], rep) not in done]
        log.info("run %s: %d calls (%d already done)", run_id, len(jobs), len(done))
        await asyncio.gather(*jobs)
        if not cancelled.is_set():
            await _judge_pass(rid, snap, io_spec, cases, budget, cancelled)
        if cancelled.is_set():
            log.info("run %s cancelled", run_id)
            return
        from .services.runs import RANKING_RESULTS_SQL, judge_agreement
        results = await db.fetch(RANKING_RESULTS_SQL, rid)
        agreement = judge_agreement(results)
        summary = ranking.build(results, snap, done=True, judge_agreement=agreement)
        summary = {
            "judge_agreement": agreement,
            "leaderboard": [c.model_dump(mode="json") for c in summary["leaderboard"]],
            "pareto_points": [p.model_dump(mode="json") for p in summary["pareto_points"]],
            "recommendation": summary["recommendation"].model_dump(mode="json") if summary["recommendation"] else None,
            "judge_total": sum(1 for r in results if r.get("judge") is not None),
        }
        stopped = (f"Stopped at ${budget.spent:.4f}, over the confirmed ${budget.confirmed:.4f} (+20%): "
                   "results and scores so far are kept") if budget.over else None
        await db.execute("""update run set status = 'done', summary = $2, error = $3, finished_at = now()
                            where id = $1""", rid, summary, stopped)
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


AGREE_WITHIN = 0.25  # rubric: two jurors agree when their 0–1 scores are this close


def _jury_rubric(scores: list[float]) -> tuple[float, bool | None]:
    agree = (max(scores) - min(scores) <= AGREE_WITHIN) if len(scores) >= 2 else None
    return sum(scores) / len(scores), agree


def _jury_pairwise(winners: list[str]) -> tuple[float, str, bool | None]:
    """A win counts only if every non-abstaining juror (each already both orders) agrees."""
    agree = (len(set(winners)) == 1) if len(winners) >= 2 else None
    w = winners[0] if len(set(winners)) == 1 else "tie"
    return {"candidate": 1.0, "baseline": 0.0}.get(w, 0.5), w, agree


async def _judge_pass(rid: UUID, snap: dict, io_spec: IOSpec, cases: list[dict],
                      budget: Budget, cancelled: asyncio.Event) -> None:
    """Judge metrics with the run's jury (contract JudgeConfig).

    Rubric: every output (candidates and references), score = mean of the jurors.
    Pairwise: candidates against the pairwise reference (the first reference).
    A juror abstains on outputs from its own model family (and, pairwise, on the reference's).
    """
    judge_specs = [m for m in snap["use_case"].get("metrics") or [] if scoring.is_judge_metric(m["metric_id"])]
    if not judge_specs:
        return
    if not scoring.has_judge():
        log.warning("judge metrics %s skipped: biy.metrics.judge is not available yet",
                    [m["metric_id"] for m in judge_specs])
        return
    await db.execute("update run set status = 'scoring' where id = $1", rid)
    judge_cfg = JudgeConfig(**snap["judge"])
    by_key = {ranking.key_of(r): r for r in list(snap["candidates"]) + ranking.references_of(snap)}
    pair_key = snap.get("pairwise_reference") or next((ranking.key_of(r) for r in ranking.references_of(snap)), None)
    case_by_id = {c["id"]: c for c in cases}
    rows = await db.fetch("""select id, candidate_key, case_id, repeat_idx, output, scores from result
                             where run_id = $1 and error is null and judge is null""", rid)
    pair_out = {(r["case_id"], r["repeat_idx"]): r["output"] for r in rows if r["candidate_key"] == pair_key}
    await db.execute("update run set summary = $2 where id = $1", rid, {"judge_total": len(rows)})

    def juror_call(j):
        async def call_llm(messages: list[dict]) -> str:
            res = await _client(j.provider, judge_clients, settings.judge_concurrency).chat(
                j.model, messages, params=dict(j.params), stop=lambda: budget.over)
            if not res.ok:
                raise RuntimeError(res.error)
            await budget.charge(res.cost_usd)
            return res.text
        return call_llm

    judge_clients: dict[str, ProviderClient] = {}  # the jury's own connections, closed below
    jurors = [(j, ranking.candidate_key(j.provider, j.model, j.params), juror_call(j)) for j in judge_cfg.judges]

    def view(o: dict | None) -> scoring.OutputView | None:
        return scoring.OutputView(strip_think(o.get("text") or ""), o.get("json"), o.get("tool_calls")) if o else None

    async def one(r: dict) -> None:
        if cancelled.is_set() or budget.over:  # over budget: keep what's judged, leave the rest unscored
            return
        model = (by_key.get(r["candidate_key"]) or {}).get("model", r["candidate_key"].split(":", 1)[-1])
        case = case_by_id[r["case_id"]]
        cv = scoring.CaseView(case["input"], case["reference"], io_spec)
        scores, judge_info = dict(r["scores"] or {}), None
        for m in judge_specs:
            pairwise = scoring.is_pairwise(m["metric_id"])
            opponent = view(pair_out.get((r["case_id"], r["repeat_idx"]))) if pairwise else None
            if pairwise and (opponent is None or r["candidate_key"] == pair_key or r["candidate_key"] not in by_key
                             or r["candidate_key"] in {ranking.key_of(x) for x in ranking.references_of(snap)}):
                continue
            own = {family(model)} | ({family(by_key[pair_key]["model"])} if pairwise and pair_key in by_key else set())
            cfg = {**(m.get("config") or {}), "mode": judge_cfg.mode, "rubric": judge_cfg.rubric}
            abstained = [jkey for j, jkey, _ in jurors if family(j.model) in own]

            async def vote(j, jkey, call) -> dict | None:
                try:
                    jr = await scoring.judge(m["metric_id"], cv, view(r["output"]), opponent, cfg, call)
                except Exception as e:
                    if SKIPPED not in str(e):
                        log.warning("juror %s failed on result %s: %s", jkey, r["id"], e)
                    return None
                return {"key": jkey, "reasoning_effort": j.params.get("reasoning_effort"),
                        "score": float(jr.score), "reasoning": jr.reasoning, "winner": getattr(jr, "winner", None)}

            # jurors in parallel: a result waits for the slowest juror, not for all three in a row
            votes = [v for v in await asyncio.gather(*(vote(*jr) for jr in jurors if jr[1] not in abstained)) if v]
            if not votes:
                judge_info = {"mode": m["metric_id"], "score": None, "abstained": abstained, "jurors": [],
                              "agreement": None}
                continue
            if pairwise:
                score, winner, agree = _jury_pairwise([v["winner"] or "tie" for v in votes])
            else:
                (score, agree), winner = _jury_rubric([v["score"] for v in votes]), None
            scores[m["metric_id"]] = round(score, 4)
            judge_info = {"mode": m["metric_id"], "score": round(score, 4), "winner": winner, "agreement": agree,
                          "abstained": abstained, "jurors": votes,
                          # one string for readers of the single-judge shape (dashboard, agreement kit)
                          "reasoning": "  |  ".join(f"{v['key'].split(':', 1)[1]}: {v['reasoning']}" for v in votes)}
        if budget.over and not (judge_info or {}).get("jurors"):
            return  # no juror got to it before the budget ran out: leave it unjudged, not "no votes"
        await db.execute("update result set scores = $2, judge = $3 where id = $1", r["id"], scores,
                         judge_info or {"mode": "skipped"})

    try:
        await asyncio.gather(*(one(r) for r in rows))
    finally:
        for c in judge_clients.values():
            await c.aclose()


class WorkerSettings:
    functions = [execute_run]
    redis_settings = RedisSettings.from_dsn(settings.redis_url or "redis://localhost:6379")
    queue_name = settings.arq_queue
    max_jobs = 4
    job_timeout = 3600
    max_tries = 3  # a retried run resumes: results are idempotent
