"""Postgres (Supabase) connection pool. JSON/JSONB columns come back as Python objects."""

from __future__ import annotations

import json
from decimal import Decimal
from typing import Any

import asyncpg

from .config import settings

_pool: asyncpg.Pool | None = None


async def _init(conn: asyncpg.Connection) -> None:
    for t in ("json", "jsonb"):
        await conn.set_type_codec(t, encoder=json.dumps, decoder=json.loads, schema="pg_catalog")


async def pool() -> asyncpg.Pool:
    global _pool
    if _pool is None:
        if not settings.database_url:
            raise RuntimeError("DATABASE_URL is not set")
        # statement_cache_size=0: Supabase's pooler doesn't support prepared statement caching.
        # Supabase's session pooler allows 15 clients in total, shared by the api, the worker and
        # any script: keep each pool small and give idle connections back quickly.
        _pool = await asyncpg.create_pool(settings.database_url, min_size=0, max_size=settings.db_pool_size,
                                          max_inactive_connection_lifetime=30, statement_cache_size=0,
                                          init=_init)
    return _pool


async def close() -> None:
    global _pool
    if _pool is not None:
        await _pool.close()
        _pool = None


def row(r: asyncpg.Record | None) -> dict[str, Any] | None:
    """Record → dict, with numeric columns as float."""
    if r is None:
        return None
    return {k: float(v) if isinstance(v, Decimal) else v for k, v in r.items()}


async def fetch(sql: str, *args) -> list[dict[str, Any]]:
    async with (await pool()).acquire() as c:
        return [row(r) for r in await c.fetch(sql, *args)]


async def fetchrow(sql: str, *args) -> dict[str, Any] | None:
    async with (await pool()).acquire() as c:
        return row(await c.fetchrow(sql, *args))


async def fetchval(sql: str, *args) -> Any:
    async with (await pool()).acquire() as c:
        v = await c.fetchval(sql, *args)
        return float(v) if isinstance(v, Decimal) else v


async def execute(sql: str, *args) -> str:
    async with (await pool()).acquire() as c:
        return await c.execute(sql, *args)
