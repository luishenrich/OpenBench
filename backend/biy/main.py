"""FastAPI app: REST at /api, MCP at /mcp, built frontend at /. Owner: Raphaël."""

import asyncio

from fastapi import FastAPI
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from contract.schemas import CatalogModel

from . import catalog
from .api import install_error_handlers, router
from .config import settings
from .mcp import mcp

# Stateless + JSON responses: what MCP 2026-07-28 clients expect, and no sticky sessions behind the proxy.
mcp_app = mcp.http_app(path="/", stateless_http=True, json_response=True)

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


# --- MCP authorization (MCP spec 2025-06-18): BIY is the resource server, Supabase Auth's OAuth 2.1
# server is the authorization server. Clients learn that from a 401 on /mcp, then sign the user in.

def _resource_url() -> str:
    return f"{settings.public_base_url.rstrip('/')}/mcp"


def _metadata_url() -> str:
    return f"{settings.public_base_url.rstrip('/')}/.well-known/oauth-protected-resource"


@app.get("/.well-known/oauth-protected-resource", include_in_schema=False)
@app.get("/.well-known/oauth-protected-resource/mcp", include_in_schema=False)
def protected_resource_metadata() -> dict:
    """RFC 9728. The path-suffixed variant is what some clients probe for /mcp."""
    return {"resource": _resource_url(),
            "authorization_servers": [f"{(settings.supabase_url or '').rstrip('/')}/auth/v1"],
            "bearer_methods_supported": ["header"], "resource_name": "BIY"}


app.mount("/mcp", mcp_app)


class _McpGate:
    """In front of /mcp, before any JSON-RPC handling:

    - `/mcp` → `/mcp/` (else the SPA catch-all below matches `/mcp` and a POST gets 405);
    - no token or a bad one → 401 + `WWW-Authenticate: Bearer resource_metadata=…`, which is what makes
      MCP clients start the OAuth sign-in. A `biy_…` workspace key or a Supabase access token
      (dashboard session or OAuth) passes; the tools resolve the workspace from it again.
    """

    def __init__(self, asgi_app):
        self.app = asgi_app

    async def __call__(self, scope, receive, send):
        if scope["type"] == "http" and (scope["path"] == "/mcp" or scope["path"].startswith("/mcp/")):
            if scope["path"] == "/mcp":
                scope = {**scope, "path": "/mcp/", "raw_path": b"/mcp/"}
            if scope["method"] != "OPTIONS" and (error := await _mcp_auth_error(scope)) is not None:
                challenge = f'Bearer resource_metadata="{_metadata_url()}"'
                if error != "missing bearer token":
                    challenge += ', error="invalid_token"'
                await JSONResponse({"error": "unauthorized", "detail": error}, status_code=401,
                                   headers={"WWW-Authenticate": challenge})(scope, receive, send)
                return
        await self.app(scope, receive, send)


async def _mcp_auth_error(scope) -> str | None:
    from fastapi import HTTPException

    from .auth import caller_from_token
    auth = dict(scope.get("headers") or []).get(b"authorization", b"").decode()
    token = auth.split(" ", 1)[1].strip() if " " in auth else None
    if not token and settings.biy_dev_no_auth:
        return None
    try:
        await caller_from_token(token)
        return None
    except HTTPException as e:
        return str(e.detail)


app.add_middleware(_McpGate)

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
