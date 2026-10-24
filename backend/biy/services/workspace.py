"""Workspaces: one per user, created on first login; MCP keys."""

from __future__ import annotations

import hashlib
import secrets
import time
from uuid import UUID

from contract.schemas import CandidatePool, JudgeConfig, Me, ModelRef, Profile, Workspace, WorkspacePatch

from .. import db
from .errors import NotFound

DEMO_USER = UUID("00000000-0000-0000-0000-000000000001")  # BIY_DEV_NO_AUTH only


def hash_key(key: str) -> str:
    return hashlib.sha256(key.encode()).hexdigest()


# If a user somehow has several workspaces (two first-login requests raced before this lock existed),
# always pick the same one: the one with the most use cases, then the oldest.
_USER_WORKSPACE = """select m.workspace_id from workspace_member m join workspace w on w.id = m.workspace_id
                     where m.user_id = $1
                     order by (select count(*) from use_case u where u.workspace_id = w.id) desc, w.created_at
                     limit 1"""


async def ensure_workspace(user_id: UUID, email: str | None) -> UUID:
    """Workspace of this user; creates one on first sight. Safe when the dashboard (or a dashboard and
    an MCP client) send several first requests at once: creation is serialised per user."""
    ws = await db.fetchval(_USER_WORKSPACE, user_id)
    if ws:
        return ws
    name = f"{email.split('@')[0]}'s workspace" if email else "Demo workspace"
    async with (await db.pool()).acquire() as c, c.transaction():
        await c.execute("select pg_advisory_xact_lock(hashtextextended($1::text, 0))", str(user_id))
        ws = await c.fetchval(_USER_WORKSPACE, user_id)  # created meanwhile by a concurrent request?
        if ws:
            return ws
        ws = await c.fetchval("insert into workspace (name) values ($1) returning id", name)
        await c.execute("insert into workspace_member (workspace_id, user_id, email) values ($1, $2, $3)",
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


_WS_COLS = ("id, name, default_profile, default_judge, default_references, candidate_pool, default_repeats, "
            "max_run_cost_usd")


async def get_workspace(workspace_id: UUID) -> Workspace:
    r = await db.fetchrow(f"select {_WS_COLS} from workspace where id = $1", workspace_id)
    if not r:
        raise NotFound("workspace not found")
    extra = {"default_references": [ModelRef(**x) for x in r["default_references"]]} \
        if r["default_references"] is not None else {}  # null = the built-in references
    return Workspace(id=r["id"], name=r["name"], default_profile=Profile(**r["default_profile"]),
                     default_judge=JudgeConfig(**r["default_judge"]),
                     candidate_pool=CandidatePool(**(r["candidate_pool"] or {})),
                     default_repeats=r["default_repeats"], max_run_cost_usd=r["max_run_cost_usd"], **extra)


async def update_workspace(workspace_id: UUID, patch: WorkspacePatch) -> Workspace:
    """Change company defaults. Sending a field as null resets it to the built-in default."""
    fields = patch.model_dump(mode="json", exclude_unset=True)
    resets = {"default_profile": Profile().model_dump(mode="json"), "default_judge": {"mode": "rubric"},
              "candidate_pool": {}, "default_repeats": 3}
    if fields.get("name", "") is None:
        fields.pop("name")
    values = {k: (resets[k] if v is None and k in resets else v) for k, v in fields.items()}
    if values:
        sets = ", ".join(f"{k} = ${i}" for i, k in enumerate(values, start=2))
        await db.execute(f"update workspace set {sets} where id = $1", workspace_id, *values.values())
    return await get_workspace(workspace_id)


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
