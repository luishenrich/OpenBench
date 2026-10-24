"""FastAPI app: REST at /api, MCP at /mcp, built frontend at /. Owner: Raphaël."""

import asyncio

from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from contract.schemas import CatalogModel

from . import catalog
from .api import install_error_handlers, router
from .config import settings
from .mcp import mcp

mcp_app = mcp.http_app(path="/")
app = FastAPI(title="BIY API", lifespan=mcp_app.lifespan, docs_url="/api/docs", openapi_url="/api/openapi.json")
app.include_router(router)  # before the SPA catch-all below
install_error_handlers(app)


async def _db_ok() -> bool:
    if not settings.database_url:
        return False
    import asyncpg
    try:
        conn = await asyncio.wait_for(asyncpg.connect(settings.database_url, statement_cache_size=0), 5)
        await conn.close()
        return True
    except Exception:
        return False


async def _redis_ok() -> bool:
    if not settings.redis_url:
        return False
    from redis.asyncio import from_url
    try:
        r = from_url(settings.redis_url)
        ok = await asyncio.wait_for(r.ping(), 5)
        await r.aclose()
        return bool(ok)
    except Exception:
        return False


@app.get("/api/health")
async def health() -> dict:
    db, redis = await asyncio.gather(_db_ok(), _redis_ok())
    return {"ok": True, "db": db, "redis": redis}


@app.get("/api/models", response_model=list[CatalogModel])
def models(shortlist: bool | None = None, type: str | None = None, provider: str | None = None):
    return catalog.list_models(shortlist=shortlist, type=type, provider=provider)


app.mount("/mcp", mcp_app)

# The built Vite app (frontend/dist), with SPA fallback to index.html.
if (settings.static_dir / "index.html").exists():
    app.mount("/assets", StaticFiles(directory=settings.static_dir / "assets", check_dir=False), name="assets")

    @app.get("/{path:path}", include_in_schema=False)
    def spa(path: str):
        f = settings.static_dir / path
        return FileResponse(f if path and f.is_file() else settings.static_dir / "index.html")
else:
    @app.get("/", include_in_schema=False)
    def no_frontend() -> dict:
        return {"biy": "api is up; no frontend build yet", "docs": "/api/docs"}
