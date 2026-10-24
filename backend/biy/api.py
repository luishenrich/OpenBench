"""REST routes (/api). Thin wrappers over biy.services; see contract/api.md."""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, FastAPI, Request, Response
from fastapi.responses import JSONResponse

from contract.schemas import (Case, CaseIn, Estimate, GenerateCasesIn, Me, MetricInfo, ResultsPage, Run, RunBrief, RunIn,
                              Scorecard, ScorecardBrief, UseCase, UseCaseIn, UseCasePatch)

from .auth import Caller, current_caller
from .services import CostNotConfirmed, Invalid, NotFound, metrics, runs, uploads, use_cases, workspace

router = APIRouter(prefix="/api")


def install_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(NotFound)
    async def _404(_: Request, e: NotFound):
        return JSONResponse({"detail": str(e)}, status_code=404)

    @app.exception_handler(Invalid)
    async def _422(_: Request, e: Invalid):
        return JSONResponse({"detail": str(e)}, status_code=422)

    @app.exception_handler(CostNotConfirmed)
    async def _409(_: Request, e: CostNotConfirmed):
        return JSONResponse({"detail": str(e), "estimate": e.estimate.model_dump(mode="json")}, status_code=409)


# --- workspace ---------------------------------------------------------------

@router.get("/me", response_model=Me)
async def me(c: Caller = Depends(current_caller)):
    return await workspace.get_me(c.workspace_id, c.user_id, c.email)


@router.post("/me/mcp-key")
async def new_mcp_key(c: Caller = Depends(current_caller)) -> dict:
    return {"key": await workspace.rotate_mcp_key(c.workspace_id)}


# --- metric bank -------------------------------------------------------------

@router.get("/metrics", response_model=list[MetricInfo])
def list_metrics(kind: str | None = None, category: str | None = None):
    return metrics.list_metrics(kind=kind, category=category)


@router.post("/metrics/select", response_model=Scorecard)
def select_metrics(brief: ScorecardBrief):
    return metrics.scorecard(brief)


# --- use cases + cases -------------------------------------------------------

@router.get("/use-cases", response_model=list[UseCase])
async def list_use_cases(c: Caller = Depends(current_caller)):
    return await use_cases.list_use_cases(c.workspace_id)


@router.post("/use-cases", response_model=UseCase | list[UseCase], status_code=201)
async def create_use_cases(body: UseCaseIn | list[UseCaseIn], c: Caller = Depends(current_caller)):
    items = body if isinstance(body, list) else [body]
    created = await use_cases.create_use_cases(c.workspace_id, items, "dashboard")
    return created if isinstance(body, list) else created[0]


@router.get("/use-cases/{use_case_id}", response_model=UseCase)
async def get_use_case(use_case_id: UUID, c: Caller = Depends(current_caller)):
    return await use_cases.get_use_case(c.workspace_id, use_case_id)


@router.patch("/use-cases/{use_case_id}", response_model=UseCase)
async def update_use_case(use_case_id: UUID, patch: UseCasePatch, c: Caller = Depends(current_caller)):
    return await use_cases.update_use_case(c.workspace_id, use_case_id, patch)


@router.delete("/use-cases/{use_case_id}", status_code=204)
async def delete_use_case(use_case_id: UUID, c: Caller = Depends(current_caller)):
    await use_cases.delete_use_case(c.workspace_id, use_case_id)
    return Response(status_code=204)


@router.get("/use-cases/{use_case_id}/cases", response_model=list[Case])
async def list_cases(use_case_id: UUID, c: Caller = Depends(current_caller)):
    return await use_cases.list_cases(c.workspace_id, use_case_id)


@router.post("/use-cases/{use_case_id}/cases", response_model=list[Case], status_code=201)
async def add_cases(use_case_id: UUID, body: list[CaseIn], c: Caller = Depends(current_caller)):
    return await use_cases.add_cases(c.workspace_id, use_case_id, body)


@router.delete("/use-cases/{use_case_id}/cases/{case_id}", status_code=204)
async def delete_case(use_case_id: UUID, case_id: UUID, c: Caller = Depends(current_caller)):
    await use_cases.delete_case(c.workspace_id, use_case_id, case_id)
    return Response(status_code=204)


@router.post("/use-cases/{use_case_id}/cases/generate", response_model=list[Case], status_code=201)
async def generate_cases(use_case_id: UUID, body: GenerateCasesIn, c: Caller = Depends(current_caller)):
    return await use_cases.generate_cases(c.workspace_id, use_case_id, body)


@router.get("/use-cases/{use_case_id}/runs", response_model=list[RunBrief])
async def list_runs(use_case_id: UUID, c: Caller = Depends(current_caller)):
    return await runs.list_runs(c.workspace_id, use_case_id)


# --- uploads (agents: biy_upload_url, then curl) -----------------------------

@router.post("/use-cases/{use_case_id}/upload-url")
async def create_upload_url(use_case_id: UUID, field: str, c: Caller = Depends(current_caller)) -> dict:
    return await uploads.create_upload_url(c.workspace_id, use_case_id, field)


@router.post("/uploads/{token}")
async def receive_upload(token: str, request: Request) -> dict:
    """No bearer token: the one-time URL is the credential."""
    return await uploads.receive(token, await request.body())


# --- runs --------------------------------------------------------------------

@router.post("/runs/estimate", response_model=Estimate)
async def estimate_run(body: RunIn, c: Caller = Depends(current_caller)):
    return await runs.estimate_run(c.workspace_id, body)


@router.post("/runs", response_model=Run, status_code=202)
async def start_run(body: RunIn, c: Caller = Depends(current_caller)):
    return await runs.start_run(c.workspace_id, body)


@router.get("/runs/{run_id}", response_model=Run)
async def get_run(run_id: UUID, c: Caller = Depends(current_caller)):
    return await runs.get_run(c.workspace_id, run_id)


@router.post("/runs/{run_id}/cancel", response_model=Run)
async def cancel_run(run_id: UUID, c: Caller = Depends(current_caller)):
    return await runs.cancel_run(c.workspace_id, run_id)


@router.get("/runs/{run_id}/results", response_model=ResultsPage)
async def list_results(run_id: UUID, candidate_key: str | None = None, case_id: UUID | None = None,
                       cursor: str | None = None, limit: int = 50, c: Caller = Depends(current_caller)):
    return await runs.list_results(c.workspace_id, run_id, candidate_key, case_id, cursor, limit)
