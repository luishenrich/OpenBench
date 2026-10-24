"""Backup and restore finished discoveries + runs, for the demo: if a provider rate-limits us live,
load a run recorded earlier and the dashboard shows it as if it had just finished.

    cd backend
    python -m biy.backup export --use-case <id> [--use-case <id> …] -o demo.json
    python -m biy.backup export --workspace <id> -o demo.json       # every use case in it
    python -m biy.backup import demo.json --workspace <id> [--suffix " (backup)"]

A bundle holds use cases, their cases, their finished runs (with the stored summary) and every
result. Import creates new ids and keeps every link (case ↔ result ↔ run), so it never touches or
collides with the originals. Only runs with status "done" are exported.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from uuid import UUID, uuid4

from . import db

VERSION = 1
UC_COLS = ["name", "kind", "description", "source_refs", "current_model", "profile", "gates", "metrics", "judge",
           "io_spec", "created_by", "pinned"]
CASE_COLS = ["input", "reference", "tags", "source"]
RUN_COLS = ["status", "candidates", "repeats", "include_baseline", "config_snapshot", "est_cost_usd",
            "actual_cost_usd", "total_jobs", "summary", "error", "created_at", "started_at", "finished_at"]
RESULT_COLS = ["candidate_key", "is_baseline", "repeat_idx", "output", "timing", "usage", "cost_usd", "error",
               "scores", "judge"]


def _jsonable(v: Any) -> Any:
    if isinstance(v, (UUID,)):
        return str(v)
    if isinstance(v, datetime):
        return v.isoformat()
    return v


async def export(use_case_ids: list[UUID]) -> dict:
    bundle: dict[str, Any] = {"version": VERSION, "exported_at": datetime.now(timezone.utc).isoformat(),
                              "use_cases": []}
    for uc_id in use_case_ids:
        uc = await db.fetchrow(f"select id, {', '.join(UC_COLS)} from use_case where id = $1", uc_id)
        if not uc:
            raise SystemExit(f"use case {uc_id} not found")
        cases = await db.fetch(f"select id, {', '.join(CASE_COLS)} from test_case where use_case_id = $1 "
                               "order by created_at, id", uc_id)
        runs = []
        for run in await db.fetch(f"select id, {', '.join(RUN_COLS)} from run where use_case_id = $1 and status = 'done' "
                                  "order by created_at", uc_id):
            results = await db.fetch(f"select case_id, {', '.join(RESULT_COLS)} from result where run_id = $1", run["id"])
            runs.append({**{k: _jsonable(v) for k, v in run.items()},
                         "results": [{k: _jsonable(v) for k, v in r.items()} for r in results]})
        bundle["use_cases"].append({**{k: _jsonable(v) for k, v in uc.items()},
                                    "cases": [{k: _jsonable(v) for k, v in c.items()} for c in cases], "runs": runs})
    return bundle


def _ts(v: str | None) -> datetime | None:
    return datetime.fromisoformat(v) if v else None


async def restore(bundle: dict, workspace_id: UUID, suffix: str = "") -> list[UUID]:
    if bundle.get("version") != VERSION:
        raise SystemExit(f"unsupported bundle version {bundle.get('version')!r}")
    if not await db.fetchval("select 1 from workspace where id = $1", workspace_id):
        raise SystemExit(f"workspace {workspace_id} not found")
    new_ids = []
    async with (await db.pool()).acquire() as c, c.transaction():
        for uc in bundle["use_cases"]:
            uc_id = uuid4()
            vals = [uc[k] for k in UC_COLS]
            vals[0] = uc["name"] + suffix
            await c.execute(f"""insert into use_case (id, workspace_id, {', '.join(UC_COLS)})
                                values ($1, $2, {', '.join(f'${i}' for i in range(3, len(UC_COLS) + 3))})""",
                            uc_id, workspace_id, *vals)
            case_map = {}
            for case in uc["cases"]:
                case_map[case["id"]] = uuid4()
                await c.execute(f"insert into test_case (id, use_case_id, {', '.join(CASE_COLS)}) values ($1, $2, $3, $4, $5, $6)",
                                case_map[case["id"]], uc_id, *[case[k] for k in CASE_COLS])
            for run in uc["runs"]:
                run_id = uuid4()
                snap = dict(run["config_snapshot"] or {})
                if "use_case" in snap:  # keep the snapshot pointing at the restored use case
                    snap["use_case"] = {**snap["use_case"], "id": str(uc_id), "workspace_id": str(workspace_id)}
                vals = [run[k] for k in RUN_COLS]
                vals[RUN_COLS.index("config_snapshot")] = snap
                for k in ("created_at", "started_at", "finished_at"):
                    vals[RUN_COLS.index(k)] = _ts(run[k])
                await c.execute(f"""insert into run (id, workspace_id, use_case_id, {', '.join(RUN_COLS)})
                                    values ($1, $2, $3, {', '.join(f'${i}' for i in range(4, len(RUN_COLS) + 4))})""",
                                run_id, workspace_id, uc_id, *vals)
                rows = [(uuid4(), run_id, case_map[r["case_id"]], *[r[k] for k in RESULT_COLS])
                        for r in run["results"] if r["case_id"] in case_map]
                await c.executemany(f"""insert into result (id, run_id, case_id, {', '.join(RESULT_COLS)})
                                        values ($1, $2, $3, {', '.join(f'${i}' for i in range(4, len(RESULT_COLS) + 4))})""",
                                    rows)
            new_ids.append(uc_id)
    return new_ids


async def _main(args: argparse.Namespace) -> None:
    try:
        if args.cmd == "export":
            ids = [UUID(x) for x in args.use_case or []]
            if args.workspace:
                ids += [r["id"] for r in await db.fetch("select id from use_case where workspace_id = $1 order by created_at",
                                                        UUID(args.workspace))]
            if not ids:
                raise SystemExit("nothing to export: pass --use-case or --workspace")
            bundle = await export(ids)
            Path(args.out).write_text(json.dumps(bundle, ensure_ascii=False, indent=1), encoding="utf-8")
            n_runs = sum(len(u["runs"]) for u in bundle["use_cases"])
            n_res = sum(len(r["results"]) for u in bundle["use_cases"] for r in u["runs"])
            print(f"wrote {args.out}: {len(bundle['use_cases'])} use cases, {n_runs} finished runs, {n_res} results")
        else:
            bundle = json.loads(Path(args.bundle).read_text(encoding="utf-8"))
            ids = await restore(bundle, UUID(args.workspace), args.suffix)
            print(f"restored {len(ids)} use cases into workspace {args.workspace}:")
            for i in ids:
                print(f"  {i}")
    finally:
        await db.close()


def main() -> None:
    ap = argparse.ArgumentParser(prog="python -m biy.backup", description=__doc__.split("\n\n")[0])
    sub = ap.add_subparsers(dest="cmd", required=True)
    e = sub.add_parser("export", help="write use cases + finished runs to a JSON bundle")
    e.add_argument("--use-case", action="append", help="use case id (repeatable)")
    e.add_argument("--workspace", help="export every use case of this workspace")
    e.add_argument("-o", "--out", required=True)
    i = sub.add_parser("import", help="load a bundle into a workspace (new ids)")
    i.add_argument("bundle")
    i.add_argument("--workspace", required=True)
    i.add_argument("--suffix", default="", help='appended to every use case name, e.g. " (backup)"')
    asyncio.run(_main(ap.parse_args()))


if __name__ == "__main__":
    sys.exit(main())
