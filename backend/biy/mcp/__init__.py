"""MCP server (owner: Raphaël). Tools wrap biy.services, like the REST routes; see contract/api.md#mcp-mcp.

Auth: the same bearer token as REST (the workspace key "biy_…" for agents). Every tool returns
structured content plus a short text summary with names next to ids. Errors say how to fix the call.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any
from uuid import UUID

from fastapi import HTTPException
from fastmcp import FastMCP
from fastmcp.exceptions import ToolError
from fastmcp.server.dependencies import get_http_headers
from fastmcp.tools import ToolResult

from contract.schemas import (CaseIn, CasePatch, GenerateCasesIn, ModelRef, RunIn, ScorecardBrief, UseCaseIn,
                              UseCasePatch, WorkspacePatch)

from .. import catalog
from ..auth import caller_from_token
from ..config import settings
from ..services import CostNotConfirmed, Invalid, NotFound, metrics, runs, uploads, workspace
from ..services import use_cases as uc_service

SCAN_REPO = Path(__file__).with_name("scan_repo.md")

mcp = FastMCP("biy", instructions=(
    "BIY: benchmark open-weight models on your own use cases. Start with the scan_repo prompt "
    "(/mcp__biy__scan_repo) to discover use cases in the current repo. Runs cost money: "
    "biy_runs_start needs confirm_cost_usd from biy_runs_estimate, after the user agrees."))

READ = {"readOnlyHint": True}


async def _ws() -> UUID:
    headers = get_http_headers(include={"authorization"})
    auth = headers.get("authorization", "")
    token = auth.split(" ", 1)[1].strip() if " " in auth else None
    try:
        return (await caller_from_token(token)).workspace_id
    except HTTPException as e:
        raise ToolError(f"{e.detail}. Connect with: claude mcp add --transport http biy <url>/mcp "
                        "--header \"Authorization: Bearer biy_…\". Get the key from the dashboard: Use cases page, "
                        "\"Connect your coding agent\" panel (Create key / Replace key).") from e


def _result(text: str, data: Any) -> ToolResult:
    if hasattr(data, "model_dump"):
        data = data.model_dump(mode="json")
    elif isinstance(data, list):
        data = {"items": [d.model_dump(mode="json") if hasattr(d, "model_dump") else d for d in data]}
    return ToolResult(content=text, structured_content=data)


async def _call(coro):
    """Service errors → actionable tool errors."""
    try:
        return await coro
    except NotFound as e:
        raise ToolError(f"{e}. List ids with biy_use_cases_list.") from e
    except Invalid as e:
        raise ToolError(str(e)) from e


def _short(model: str) -> str:
    return model.split("/")[-1]


def _brief(u) -> dict:
    """Compact use case for tool replies (full objects filled agents' context: ~76k chars for 27).
    The full object is biy_use_cases_get."""
    prompt = bool(u.io_spec.system_prompt or u.io_spec.user_template)
    # image use cases: scan_repo writes "needs page images" in the description when the repo has none
    data = "needs page images" if "needs page images" in (u.description or "").lower() else "no cases"
    needs = ([] if prompt else ["prompt not attached"]) + ([] if u.case_count else [data]) \
        + ([] if u.metrics else ["no metrics"])
    return {"id": str(u.id), "name": u.name, "kind": u.kind,
            "url": f"{settings.public_base_url.rstrip('/')}/use-cases/{u.id}",
            "metrics": [m.metric_id for m in u.metrics], "case_count": u.case_count, "prompt_attached": prompt,
            "needs": needs, "latest_run": u.latest_run.status if u.latest_run else None}


def _brief_line(b: dict) -> str:
    needs = f"; needs: {', '.join(b['needs'])}" if b["needs"] else ""
    return (f"{b['id']}  {b['name']} ({b['kind']}, {b['case_count']} cases, metrics "
            f"{', '.join(b['metrics']) or 'none'}{needs})")


# --- workspace, catalogue, metrics --------------------------------------------

@mcp.tool(annotations=READ)
async def biy_workspace_get() -> ToolResult:
    """The company defaults that use cases and runs inherit: trade-off profile, jury, references,
    candidate pool, repeats and the per-run cost cap."""
    ws = await workspace.get_workspace(await _ws())
    return _result(_workspace_text(ws), ws)


def _workspace_text(ws) -> str:
    w, pool = ws.default_profile.weights, ws.candidate_pool
    cap = f"${ws.max_run_cost_usd:.2f}" if ws.max_run_cost_usd is not None else "none"
    return (f"Workspace '{ws.name}': weights quality {w['quality']} / speed {w['speed']} / cost {w['cost']}; "
            f"jury {', '.join(_short(j.model) for j in ws.default_judge.judges)}; "
            f"references {', '.join(_short(r.model) for r in ws.default_references)}; "
            f"pool {'shortlist' if pool.shortlist_only else 'whole catalogue'}"
            + (f" without {', '.join(pool.exclude_providers)}" if pool.exclude_providers else "")
            + (f", output ≤ ${pool.max_output_usd_per_1m}/1M" if pool.max_output_usd_per_1m is not None else "")
            + f"; {ws.default_repeats} repeats; cost cap per run {cap}.")


@mcp.tool
async def biy_workspace_update(patch: WorkspacePatch) -> ToolResult:
    """Change company defaults that every use case and run inherits (any subset): default_profile,
    default_judge, default_references, candidate_pool, default_repeats, max_run_cost_usd. A field set to
    null resets to the built-in default. Only when the user asks for it."""
    ws = await workspace.update_workspace(await _ws(), patch)
    return _result("Updated. " + _workspace_text(ws), ws)


@mcp.tool(annotations=READ)
async def biy_models_list(shortlist: bool = True, type: str | None = None, provider: str | None = None) -> ToolResult:
    """Benchmarkable open-weight models with VERIFIED capabilities (text, vision, tools, json_schema) and prices.

    type: text | vision | embedding. provider: nebius | openrouter. Candidates must come from this list.
    """
    await _ws()
    ms = catalog.list_models(shortlist=shortlist, type=type, provider=provider)
    lines = [f"{m.provider}:{m.id} ({m.role or '-'}, AA {m.aa_index or '-'}, "
             f"${m.pricing_usd_per_1m.get('input')}/{m.pricing_usd_per_1m.get('output')} per 1M, "
             f"{'+'.join(k for k, v in m.verified.items() if v)})" for m in ms]
    return _result(f"{len(ms)} models:\n" + "\n".join(lines), ms)


@mcp.tool(annotations=READ)
async def biy_metrics_list(kind: str | None = None, category: str | None = None) -> ToolResult:
    """Metrics from the metric bank. kind filters to the defaults for a use-case kind (e.g. extraction)."""
    await _ws()
    ms = metrics.list_metrics(kind=kind, category=category)
    lines = [f"{m.id} [{m.utility_axis}, {m.method}]: {m.description[:90]}" for m in ms]
    return _result(f"{len(ms)} metrics:\n" + "\n".join(lines), ms)


@mcp.tool(annotations=READ)
async def biy_metrics_select(brief: ScorecardBrief) -> ToolResult:
    """Pick metrics + gates for ONE use case from what you saw in the code. Only `kind` is required;
    set every flag you can tell (has_schema, has_reference, user_facing, tools, ocr, …).
    Put the returned `metrics` and `gates` straight into biy_use_cases_create."""
    await _ws()
    try:
        card = metrics.scorecard(brief)
    except Exception as e:
        raise ToolError(f"metric selection failed: {e}. Check the brief fields (kind is required).") from e
    gates = ", ".join(f"{g.metric_id} {g.op} {g.value}" for g in card.gates) or "none"
    return _result(f"{brief.kind}: quality metrics {', '.join(card.quality)}; gates {gates}; "
                   f"speed ranked by {card.speed_ranking or 'n/a'}.", card)


# --- use cases + cases --------------------------------------------------------

@mcp.tool(annotations=READ)
async def biy_use_cases_list() -> ToolResult:
    """All use cases in the workspace, with case counts and the latest run's recommendation."""
    ucs = await uc_service.list_use_cases(await _ws())
    briefs = [_brief(u) for u in ucs]
    lines = [_brief_line(b) + (f" — latest run {u.latest_run.status}: {u.latest_run.recommendation_headline or ''}"
                               if u.latest_run else "") for b, u in zip(briefs, ucs)]
    return _result(f"{len(ucs)} use cases:\n" + "\n".join(lines) if ucs else "No use cases yet.", {"items": briefs})


@mcp.tool(annotations=READ)
async def biy_use_cases_get(use_case_id: UUID) -> ToolResult:
    """One use case in full (io_spec with prompts and schema, metrics, gates, profile, judge)."""
    u = await _call(uc_service.get_use_case(await _ws(), use_case_id))
    return _result(f"{u.name} ({u.kind}): {u.case_count} cases. Dashboard: {_brief(u)['url']}", u)


@mcp.tool
async def biy_use_cases_create(use_cases: list[UseCaseIn]) -> ToolResult:
    """Create use cases. Discovery creates each one AS SOON AS it is found, with the light fields only
    (name, kind, description, source_refs with `repo` set, current_model), so it shows up in the
    dashboard right away; then fills it in with biy_use_cases_update and biy_cases_add. A list of one is fine.

    current_model is today's model; when it is a closed model it runs as the "today" reference.
    Closed models go through OpenRouter: {"provider": "openrouter", "model": "openai/<model>"}
    (or anthropic/…, google/…).
    io_spec: system_prompt, user_template with {{var}} placeholders, response_schema (JSON schema),
    tools (OpenAI format), params (temperature, max_tokens).
    """
    created = await _call(uc_service.create_use_cases(await _ws(), use_cases, created_by="mcp"))
    briefs = [_brief(u) for u in created]
    return _result("Created:\n" + "\n".join(_brief_line(b) + f"  {b['url']}" for b in briefs), {"items": briefs})


@mcp.tool
async def biy_use_cases_update(use_case_id: UUID, patch: UseCasePatch) -> ToolResult:
    """Change part of a use case, e.g. the trade-off: {"profile": {"weights": {"quality": 50, "speed": 10, "cost": 40}}}.
    Weights sum to 100. Re-run with biy_runs_estimate / biy_runs_start to see the new ranking.
    When you have finished filling a use case in (or gave up on part of it, said in its description),
    set {"setup_state": "complete"}: until then the dashboard shows it as being set up by the agent."""
    u = await _call(uc_service.update_use_case(await _ws(), use_case_id, patch))
    w = (u.profile.weights if u.profile else None)
    return _result(f"Updated: {_brief_line(_brief(u))}" + (f"; weights q{w['quality']}/s{w['speed']}/c{w['cost']}" if w else ""),
                   _brief(u))


@mcp.tool
async def biy_cases_add(use_case_id: UUID, cases: list[CaseIn]) -> ToolResult:
    """Add test cases. input is {"vars": {...}} for io_spec.user_template, or {"messages": [...]};
    reference is the expected output (JSON / label / text) when known. source: repo | synthetic.
    Never send secrets or real customer data: replace them with realistic fakes."""
    added = await _call(uc_service.add_cases(await _ws(), use_case_id, cases))
    return _result(f"Added {len(added)} cases to {use_case_id}.", {"added": len(added), "ids": [str(c.id) for c in added]})


def _preview(v: Any, n: int = 80) -> str:
    text = v if isinstance(v, str) else json.dumps(v, ensure_ascii=False)
    return text if len(text) <= n else text[:n - 1] + "…"


@mcp.tool(annotations=READ)
async def biy_cases_list(use_case_id: UUID, limit: int = 50, offset: int = 0) -> ToolResult:
    """Cases of a use case, compact: id, a short preview of input and reference, source, tags. Paginated."""
    limit = max(1, min(limit, 200))
    cases = await _call(uc_service.list_cases(await _ws(), use_case_id, limit=limit, offset=offset))
    items = [{"id": str(c.id), "input": _preview(c.input.get("vars") or c.input),
              "reference": _preview(c.reference) if c.reference is not None else None,
              "source": c.source, "tags": c.tags, "images": len(c.input.get("images") or [])} for c in cases]
    lines = [f"{i['id']}  [{i['source']}] {i['input']}" + (f"  → {i['reference']}" if i["reference"] else "") for i in items]
    more = f"\n(next page: offset={offset + limit})" if len(items) == limit else ""
    return _result(f"{len(items)} cases (offset {offset}):\n" + "\n".join(lines) + more,
                   {"items": items, "next_offset": offset + limit if len(items) == limit else None})


@mcp.tool
async def biy_cases_update(use_case_id: UUID, case_id: UUID, patch: CasePatch) -> ToolResult:
    """Edit one case: any of input, reference (null clears it), tags. Past runs keep their results."""
    c = await _call(uc_service.update_case(await _ws(), use_case_id, case_id, patch))
    return _result(f"Updated case {c.id}: {_preview(c.input.get('vars') or c.input)}", {"id": str(c.id)})


@mcp.tool(annotations={"destructiveHint": True})
async def biy_cases_delete(use_case_id: UUID, case_ids: list[UUID]) -> ToolResult:
    """Delete cases from a use case (ids from biy_cases_list). Past runs keep their results."""
    n = await _call(uc_service.delete_cases(await _ws(), use_case_id, case_ids))
    return _result(f"Deleted {n} of {len(case_ids)} cases.", {"deleted": n})


@mcp.tool
async def biy_cases_generate(use_case_id: UUID, n: int = 20, strategy: str = "auto") -> ToolResult:
    """Generate synthetic test cases server-side, seeded from the use case's existing cases.

    strategy: auto | schema_first (extraction: writes the expected JSON first) | persona_grid (chat).
    Every case gets a reference; fewer than n can come back. Takes ~10–60 s. Add repo cases first.
    """
    req = GenerateCasesIn(n=n, strategy=strategy)
    added = await _call(uc_service.generate_cases(await _ws(), use_case_id, req))
    return _result(f"Generated {len(added)} synthetic cases for {use_case_id}"
                   + (f" (asked for {n})" if len(added) < n else "") + ".",
                   {"added": len(added), "ids": [str(c.id) for c in added]})


@mcp.tool
async def biy_upload_url(use_case_id: UUID, field: str) -> ToolResult:
    """One-time URL to upload a large field straight from a file, so its bytes never go through your
    tool arguments. Use it for any prompt over ~4,000 characters, big schemas or tool lists, many cases,
    and images. Then run from your shell:  curl -fsS --retry 3 --data-binary @path/to/file <url>

    field: system_prompt | user_template (text) | response_schema | tools (JSON) |
           cases_jsonl (one CaseIn JSON object per line) | image (PNG/JPEG/WebP/PDF → returns its URL;
           then biy_cases_add with input.images = [url]). Valid ~15 min, single use.
    Never truncate or paraphrase a prompt to make it fit."""
    data = await _call(uploads.create_upload_url(await _ws(), use_case_id, field))
    return _result(f"Upload {field}: {data['curl']}  (valid {data['expires_in_s'] // 60} min, single use)", data)


# --- runs --------------------------------------------------------------------

def _run_in(use_case_id: UUID, candidates: list[ModelRef] | None, repeats: int | None, include_references: bool,
            confirm_cost_usd: float | None = None) -> RunIn:
    """Left-out fields inherit the workspace (candidates → auto-pick in its pool, repeats, references)."""
    return RunIn(use_case_id=use_case_id, candidates=candidates or [], repeats=repeats,
                 include_references=include_references, confirm_cost_usd=confirm_cost_usd)


def _estimate_text(est) -> str:
    rows = "\n".join(f"  {l.provider}:{_short(l.model)}: {l.calls} calls, ${l.est_cost_usd:.4f}" for l in est.per_candidate)
    cap = (f"\nOver the workspace cap of ${est.max_run_cost_usd:.4f}: this run would be refused."
           if est.over_cap else "")
    return (f"Estimate: {est.calls} calls ({est.repeats} repeats), ${est.total_usd:.4f} total "
            f"(models ${est.est_cost_usd:.4f} + judge ${est.judge_cost_usd:.4f}).\n{rows}{cap}")


@mcp.tool(annotations=READ)
async def biy_runs_estimate(use_case_id: UUID, candidates: list[ModelRef] | None = None, auto: int = 6,
                            repeats: int | None = None, include_references: bool = True) -> ToolResult:
    """Free: computes the cost and call count of a run, calls no model and spends nothing. Leave candidates empty to let BIY pick `auto` shortlisted open-weight
    models with verified capabilities for this use case. References (GPT-6.1 Sol, GPT-6 Luna, and today's
    model when it is closed) run on the same cases for comparison and are never recommended.
    repeats left out → the workspace default. Show the total to the user before starting."""
    ws = await _ws()
    est = await _call(runs.estimate_run(ws, _run_in(use_case_id, candidates, repeats, include_references), auto))
    return _result(_estimate_text(est) + "\nPass the same candidates and confirm_cost_usd to biy_runs_start.",
                   est)


@mcp.tool
async def biy_runs_start(use_case_id: UUID, confirm_cost_usd: float, candidates: list[ModelRef] | None = None,
                         auto: int = 6, repeats: int | None = None, include_references: bool = True) -> ToolResult:
    """Start a benchmark run. Only after the user agreed to the estimate: confirm_cost_usd must be ≥ the
    estimate's total_usd, or the run is refused and the new estimate is returned."""
    ws = await _ws()
    req = _run_in(use_case_id, candidates, repeats, include_references, confirm_cost_usd)
    try:
        run = await _call(runs.start_run(ws, req, auto))
    except CostNotConfirmed as e:
        raise ToolError(f"Not started: {e}. {_estimate_text(e.estimate)}\nAsk the user, then retry with "
                        f"confirm_cost_usd ≥ {e.estimate.total_usd:.4f}.") from e
    return _result(f"Run {run.id} queued: {run.progress.total} calls, est. ${run.est_cost_usd:.4f}. "
                   "Poll biy_runs_status; results also show live in the dashboard.", run)


@mcp.tool(annotations=READ)
async def biy_runs_status(run_id: UUID) -> ToolResult:
    """Progress, leaderboard so far, and the recommendation once done."""
    try:
        run = await runs.get_run(await _ws(), run_id)
    except NotFound as e:
        raise ToolError(f"{e}. Run ids come from biy_runs_start.") from e
    p = run.progress
    lines = [f"Run {run.id}: {run.status}, {p.done}/{p.total} calls ({p.errors} errors), ${run.actual_cost_usd:.4f} spent."]
    for c in run.leaderboard[:8]:
        lines.append(f"  #{c.rank or '-'} {c.candidate_key}{f' (reference: {c.reference_label})' if c.is_reference else ''}: "
                     f"quality {c.quality.mean:.3f}, p95 {c.e2e_ms.p95:.0f} ms, ${c.cost_per_call_usd:.6f}/call"
                     + (f", fails {', '.join(c.failed_gates)}" if c.failed_gates else ""))
    if run.recommendation:
        lines.append(f"Recommendation: {run.recommendation.headline}")
    return _result("\n".join(lines), run)


# --- discovery prompt -----------------------------------------------------------

@mcp.prompt(name="scan_repo", description="Find every LLM call in this repo, create a BIY benchmark for each, "
                                          "estimate the cost and run after you confirm.")
def scan_repo() -> str:
    return SCAN_REPO.read_text(encoding="utf-8")
