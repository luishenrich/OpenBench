"""Use cases and their test cases (dataset)."""

from __future__ import annotations

from typing import Any
from uuid import UUID

from contract.schemas import Case, CaseIn, GenerateCasesIn, RunBrief, UseCase, UseCaseIn, UseCasePatch

from .. import db
from . import metrics
from .errors import Invalid, NotFound

_JSON_FIELDS = ("source_refs", "current_model", "profile", "gates", "metrics", "judge", "io_spec")
_COLS = "id, workspace_id, name, kind, description, " + ", ".join(_JSON_FIELDS) + ", created_by, created_at"


def _dump(v: Any) -> Any:
    """Pydantic value → JSON-able (for JSONB parameters)."""
    if hasattr(v, "model_dump"):
        return v.model_dump(mode="json")
    if isinstance(v, list):
        return [_dump(x) for x in v]
    return v


async def _latest_runs(workspace_id: UUID, use_case_ids: list[UUID]) -> dict[UUID, RunBrief]:
    if not use_case_ids:
        return {}
    rows = await db.fetch(
        """select distinct on (use_case_id) use_case_id, id, status, finished_at, summary
           from run where workspace_id = $1 and use_case_id = any($2::uuid[])
           order by use_case_id, created_at desc""", workspace_id, use_case_ids)
    return {r["use_case_id"]: _brief(r) for r in rows}


def _brief(r: dict) -> RunBrief:
    rec = (r.get("summary") or {}).get("recommendation") or {}
    return RunBrief(id=r["id"], status=r["status"], finished_at=r["finished_at"],
                    recommendation_headline=rec.get("headline"),
                    est_monthly_savings_usd=rec.get("est_monthly_savings_usd"))


async def _hydrate(workspace_id: UUID, rows: list[dict]) -> list[UseCase]:
    ids = [r["id"] for r in rows]
    counts = {r["use_case_id"]: r["n"] for r in await db.fetch(
        "select use_case_id, count(*) n from test_case where use_case_id = any($1::uuid[]) group by 1", ids)}
    latest = await _latest_runs(workspace_id, ids)
    return [UseCase(**r, case_count=counts.get(r["id"], 0), latest_run=latest.get(r["id"])) for r in rows]


async def list_use_cases(workspace_id: UUID) -> list[UseCase]:
    rows = await db.fetch(f"select {_COLS} from use_case where workspace_id = $1 order by created_at", workspace_id)
    return await _hydrate(workspace_id, rows)


async def get_use_case(workspace_id: UUID, use_case_id: UUID) -> UseCase:
    r = await db.fetchrow(f"select {_COLS} from use_case where id = $1 and workspace_id = $2",
                          use_case_id, workspace_id)
    if not r:
        raise NotFound(f"use case {use_case_id} not found")
    return (await _hydrate(workspace_id, [r]))[0]


async def create_use_cases(workspace_id: UUID, items: list[UseCaseIn], created_by: str = "dashboard") -> list[UseCase]:
    items = [it.model_copy(update={"metrics": metrics.normalize_metrics(it.metrics),
                                   "gates": metrics.normalize_gates(it.gates)}) for it in items]
    ids = []
    async with (await db.pool()).acquire() as c, c.transaction():
        for it in items:
            ids.append(await c.fetchval(
                """insert into use_case (workspace_id, name, kind, description, source_refs, current_model,
                                         profile, gates, metrics, judge, io_spec, created_by)
                   values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) returning id""",
                workspace_id, it.name, it.kind, it.description,
                *(_dump(getattr(it, f)) for f in _JSON_FIELDS), created_by))
    return [await get_use_case(workspace_id, i) for i in ids]


async def update_use_case(workspace_id: UUID, use_case_id: UUID, patch: UseCasePatch) -> UseCase:
    fields = patch.model_dump(exclude_unset=True)
    if "metrics" in fields:
        patch.metrics = metrics.normalize_metrics(patch.metrics)
    if "gates" in fields:
        patch.gates = metrics.normalize_gates(patch.gates)
    if fields:
        sets = ", ".join(f"{k} = ${i}" for i, k in enumerate(fields, start=3))
        values = [_dump(getattr(patch, k)) for k in fields]
        status = await db.execute(f"update use_case set {sets} where id = $1 and workspace_id = $2",
                                  use_case_id, workspace_id, *values)
        if status.endswith(" 0"):
            raise NotFound(f"use case {use_case_id} not found")
    return await get_use_case(workspace_id, use_case_id)


async def delete_use_case(workspace_id: UUID, use_case_id: UUID) -> None:
    status = await db.execute("delete from use_case where id = $1 and workspace_id = $2", use_case_id, workspace_id)
    if status.endswith(" 0"):
        raise NotFound(f"use case {use_case_id} not found")


# --- cases -------------------------------------------------------------------

async def _check_owner(workspace_id: UUID, use_case_id: UUID) -> None:
    if not await db.fetchval("select 1 from use_case where id = $1 and workspace_id = $2", use_case_id, workspace_id):
        raise NotFound(f"use case {use_case_id} not found")


async def list_cases(workspace_id: UUID, use_case_id: UUID) -> list[Case]:
    await _check_owner(workspace_id, use_case_id)
    rows = await db.fetch("""select id, use_case_id, input, reference, tags, source from test_case
                             where use_case_id = $1 order by created_at, id""", use_case_id)
    return [Case(**r) for r in rows]


async def add_cases(workspace_id: UUID, use_case_id: UUID, items: list[CaseIn]) -> list[Case]:
    await _check_owner(workspace_id, use_case_id)
    out = []
    async with (await db.pool()).acquire() as c, c.transaction():
        for it in items:
            r = await c.fetchrow(
                """insert into test_case (use_case_id, input, reference, tags, source)
                   values ($1, $2, $3, $4, $5) returning id, use_case_id, input, reference, tags, source""",
                use_case_id, it.input, it.reference, it.tags, it.source)
            out.append(Case(**db.row(r)))
    return out


async def generate_cases(workspace_id: UUID, use_case_id: UUID, req: GenerateCasesIn) -> list[Case]:
    """Synthetic cases from the metrics runtime's generator (Jad's), written by the use case's judge model.

    Existing cases are the seeds; every generated case has a reference (validated against the
    response schema when there is one). Fewer than n may come back.
    """
    from ..metrics import generate_case_inputs
    from ..providers import ProviderClient
    from .workspace import get_workspace

    uc = await get_use_case(workspace_id, use_case_id)
    existing = await list_cases(workspace_id, use_case_id)
    judge = uc.judge or (await get_workspace(workspace_id)).default_judge
    async with ProviderClient(judge.provider) as client:
        async def call_llm(messages: list[dict]) -> str:
            res = await client.chat(judge.model, messages, params={"temperature": 0.8, "max_tokens": 8192})
            if not res.ok:
                raise RuntimeError(res.error)
            return res.text

        try:
            items = await generate_case_inputs(
                use_case={"name": uc.name, "kind": uc.kind, "description": uc.description},
                io_spec=uc.io_spec.model_dump(),
                seeds=[{"input": c.input, "reference": c.reference, "tags": list(c.tags)} for c in existing],
                n=req.n, strategy=req.strategy, call_llm=call_llm)
        except (ValueError, RuntimeError) as e:
            raise Invalid(f"no valid synthetic cases came back ({e}); add cases with biy_cases_add instead") from e
    return await add_cases(workspace_id, use_case_id, [CaseIn(**it) for it in items])


async def delete_case(workspace_id: UUID, use_case_id: UUID, case_id: UUID) -> None:
    await _check_owner(workspace_id, use_case_id)
    status = await db.execute("delete from test_case where id = $1 and use_case_id = $2", case_id, use_case_id)
    if status.endswith(" 0"):
        raise NotFound(f"case {case_id} not found")
