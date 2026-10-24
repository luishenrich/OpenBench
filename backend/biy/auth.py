"""Who is calling: a Supabase session (dashboard) or a workspace key "biy_…" (MCP, scripts)."""

from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache
from uuid import UUID

import jwt
from fastapi import Header, HTTPException

from .config import settings
from .services import workspace


@dataclass
class Caller:
    workspace_id: UUID
    user_id: UUID | None = None
    email: str | None = None


@lru_cache(maxsize=1)
def _jwks() -> jwt.PyJWKClient:
    return jwt.PyJWKClient(f"{settings.supabase_url.rstrip('/')}/auth/v1/.well-known/jwks.json")


def _verify_supabase(token: str) -> dict:
    """Supabase access token → claims. HS256 with the legacy secret, else the project's JWKS."""
    alg = jwt.get_unverified_header(token).get("alg")
    if alg == "HS256":
        if not settings.supabase_jwt_secret:
            raise jwt.InvalidTokenError("SUPABASE_JWT_SECRET is not set")
        key = settings.supabase_jwt_secret
    else:
        if not settings.supabase_url:
            raise jwt.InvalidTokenError("SUPABASE_URL is not set")
        key = _jwks().get_signing_key_from_jwt(token).key
    return jwt.decode(token, key, algorithms=[alg], audience="authenticated")


async def caller_from_token(token: str | None) -> Caller:
    if not token:
        if settings.biy_dev_no_auth:
            return Caller(await workspace.ensure_workspace(workspace.DEMO_USER, None))
        raise HTTPException(401, "missing bearer token")
    if token.startswith("biy_"):
        ws = await workspace.workspace_for_key(token)
        if not ws:
            raise HTTPException(401, "unknown workspace key")
        return Caller(ws)
    try:
        claims = _verify_supabase(token)
    except jwt.PyJWTError as e:
        raise HTTPException(401, f"invalid token: {e}") from e
    user_id, email = UUID(claims["sub"]), claims.get("email")
    return Caller(await workspace.ensure_workspace(user_id, email), user_id, email)


async def current_caller(authorization: str | None = Header(default=None)) -> Caller:
    """FastAPI dependency."""
    token = authorization.split(" ", 1)[1].strip() if authorization and " " in authorization else None
    return await caller_from_token(token)
