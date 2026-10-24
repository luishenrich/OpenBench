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
    """Supabase access token → claims, verified against the project's JWKS (ES256 only).

    The algorithm is fixed, never taken from the token header, so a token can't pick a
    weaker one (e.g. HS256 or "none").
    """
    if not settings.supabase_url:
        raise jwt.InvalidTokenError("SUPABASE_URL is not set")
    key = _jwks().get_signing_key_from_jwt(token).key
    # "authenticated": dashboard sessions; the /mcp resource URL: OAuth tokens issued for this server
    audiences = ["authenticated", f"{settings.public_base_url.rstrip('/')}/mcp"]
    try:
        return jwt.decode(token, key, algorithms=["ES256"], audience=audiences)
    except jwt.InvalidAudienceError as e:
        aud = jwt.decode(token, options={"verify_signature": False}).get("aud")
        raise jwt.InvalidAudienceError(f"audience {aud!r} not accepted (expected one of {audiences})") from e


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
    # OAuth tokens may carry no email; the user id alone finds (or creates) the same workspace
    user_id, email = UUID(claims["sub"]), claims.get("email")
    return Caller(await workspace.ensure_workspace(user_id, email), user_id, email)


async def current_caller(authorization: str | None = Header(default=None)) -> Caller:
    """FastAPI dependency."""
    token = authorization.split(" ", 1)[1].strip() if authorization and " " in authorization else None
    return await caller_from_token(token)
