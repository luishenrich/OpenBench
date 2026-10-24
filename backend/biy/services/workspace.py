"""Workspaces: one per user, created on first login; MCP keys."""

from __future__ import annotations

import hashlib
import secrets
import time
from uuid import UUID

from contract.schemas import JudgeConfig, Me, Profile, Workspace

from .. import db
from .errors import NotFound

DEMO_USER = UUID("00000000-0000-0000-0000-000000000001")  # BIY_DEV_NO_AUTH only


def hash_key(key: str) -> str:
    return hashlib.sha256(key.encode()).hexdigest()


async def ensure_workspace(user_id: UUID, email: str | None) -> UUID:
    """Workspace of this user; creates one on first sight."""
    ws = await db.fetchval("select workspace_id from workspace_member where user_id = $1 limit 1", user_id)
    if ws:
        return ws
    name = f"{email.split('@')[0]}'s workspace" if email else "Demo workspace"
    ws = await db.fetchval("insert into workspace (name) values ($1) returning id", name)
    await db.execute("insert into workspace_member (workspace_id, user_id, email) values ($1, $2, $3)",
                     ws, user_id, email)
    return ws


_KEY_TTL_S = 60
_key_cache: dict[str, tuple[float, UUID]] = {}  # key hash → (expiry, workspace id)


async def workspace_for_key(key: str) -> UUID | None:
    """Workspace of an MCP key. Cached for a minute: an agent makes many calls in a row, and each one
    would otherwise take a pooled DB connection just to authenticate (the session pooler caps us at 15)."""
    h = hash_key(key)
    hit = _key_cache.get(h)
    if hit and hit[0] > time.monotonic():
        return hit[1]
    ws = await db.fetchval("select id from workspace where mcp_key_hash = $1", h)
    if ws:
        _key_cache[h] = (time.monotonic() + _KEY_TTL_S, ws)
    return ws


async def get_workspace(workspace_id: UUID) -> Workspace:
    r = await db.fetchrow("select id, name, default_profile, default_judge from workspace where id = $1",
                          workspace_id)
    if not r:
        raise NotFound("workspace not found")
    return Workspace(id=r["id"], name=r["name"], default_profile=Profile(**r["default_profile"]),
                     default_judge=JudgeConfig(**r["default_judge"]))


async def get_me(workspace_id: UUID, user_id: UUID | None, email: str | None) -> Me:
    ws = await get_workspace(workspace_id)
    last4 = await db.fetchval("select mcp_key_last4 from workspace where id = $1", workspace_id)
    return Me(user_id=user_id or DEMO_USER, email=email or "", workspace=ws, mcp_key_last4=last4)


async def rotate_mcp_key(workspace_id: UUID) -> str:
    """New "biy_…" key, returned once; only its hash is stored."""
    key = "biy_" + secrets.token_urlsafe(32)
    await db.execute("update workspace set mcp_key_hash = $2, mcp_key_last4 = $3 where id = $1",
                     workspace_id, hash_key(key), key[-4:])
    _key_cache.clear()  # the replaced key stops working here at once (other api replicas: within a minute)
    return key
