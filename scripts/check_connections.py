"""Check every connection in .env without printing secrets.

    pip install -r backend/requirements.txt
    python3 scripts/check_connections.py

Postgres: connects, lists the BIY tables and does an insert inside a transaction that is rolled back.
Redis: PING + a short-lived key. Supabase: JWKS reachable. Model keys: GET /models.
"""

import asyncio
import os
import sys
import urllib.parse
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
EXPECTED_TABLES = {"workspace", "workspace_member", "use_case", "test_case", "run", "result"}


def load_env() -> dict[str, str]:
    env = dict(os.environ)
    path = ROOT / ".env"
    if path.exists():
        for line in path.read_text().splitlines():
            if "=" in line and not line.lstrip().startswith("#"):
                k, v = line.split("=", 1)
                env.setdefault(k.strip(), v.strip().strip('"').strip("'"))
    return env


class Rollback(Exception):
    pass


async def check_db(url: str) -> str:
    import asyncpg

    p = urllib.parse.urlparse(url)
    conn = await asyncpg.connect(url, timeout=10, statement_cache_size=0)
    try:
        rows = await conn.fetch("select table_name from information_schema.tables where table_schema = 'public'")
        missing = EXPECTED_TABLES - {r[0] for r in rows}
        if missing:
            return f"connected to {p.hostname}, but tables missing: {sorted(missing)} (run contract/schema.sql)"
        try:
            async with conn.transaction():
                ws = await conn.fetchval("insert into workspace(name) values ('connection check') returning id")
                await conn.execute("insert into use_case(workspace_id, name, kind) values ($1, 'check', 'chat')", ws)
                raise Rollback
        except Rollback:
            pass
        return f"ok ({p.hostname}:{p.port}, user {p.username}, 6 tables, insert + rollback)"
    finally:
        await conn.close()


def check_redis(url: str) -> str:
    import redis

    r = redis.from_url(url, socket_timeout=8)
    r.ping()
    r.set("biy:connection-check", "1", ex=30)
    assert r.get("biy:connection-check") == b"1"
    return f"ok ({urllib.parse.urlparse(url).hostname})"


def check_http(url: str, headers: dict[str, str] | None = None) -> str:
    import httpx

    resp = httpx.get(url, headers=headers or {}, timeout=15)
    resp.raise_for_status()
    return "ok"


def main() -> int:
    env = load_env()
    checks = [
        ("DATABASE_URL", lambda v: asyncio.run(check_db(v))),
        ("REDIS_URL", check_redis),
        ("SUPABASE_URL", lambda v: check_http(f"{v.rstrip('/')}/auth/v1/.well-known/jwks.json")),
        ("NEBIUS_API_KEY", lambda v: check_http("https://api.tokenfactory.nebius.com/v1/models",
                                                {"Authorization": f"Bearer {v}"})),
        ("OPENROUTER_API_KEY", lambda v: check_http("https://openrouter.ai/api/v1/key",
                                                    {"Authorization": f"Bearer {v}"})),
    ]
    failed = 0
    for name, fn in checks:
        value = env.get(name, "")
        if not value:
            print(f"  {name:20} missing")
            failed += 1
            continue
        try:
            print(f"  {name:20} {fn(value)}")
        except Exception as e:  # report and keep going
            print(f"  {name:20} FAILED: {type(e).__name__}: {str(e)[:160]}")
            failed += 1
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
