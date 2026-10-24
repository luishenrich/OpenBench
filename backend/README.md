# BIY backend

FastAPI app (REST at `/api`, MCP at `/mcp`, the built dashboard at `/`) and an arq worker that runs the benchmarks. Shapes and rules: [`contract/`](../contract/) (`api.md`, `services.md`, `schemas.py`).

| Module | What it does |
|---|---|
| `biy/main.py` | App, `/mcp` gate (401 + OAuth metadata), SPA fallback |
| `biy/api.py` | REST routes, thin wrappers over `biy/services/` |
| `biy/mcp/` | MCP tools (`biy_*`) over the same services, and the `scan_repo` prompt |
| `biy/services/` | Workspaces, use cases + cases, runs (estimate, start, status), uploads, metric bank |
| `biy/worker.py` | `execute_run`: candidates + references × cases × repeats, scoring, jury, summary |
| `biy/ranking.py` | Aggregates → gates → Pareto → utility → recommendation (vs the best reference) |
| `biy/providers/` | Streaming client (Nebius, OpenRouter, OpenAI) with TTFT, tokens and cost; catalogue; reference prices |
| `biy/metrics/` | Jad's metrics runtime (`score`, `judge`, `aggregate`) |
| `biy/backup.py` | Export / import finished runs (demo backup) |

## Run it locally

```bash
cd backend
python -m venv .venv
.venv/Scripts/pip install -r requirements.txt   # Linux/macOS: .venv/bin/pip
```

`.env` at the repo root (copy `.env.example`): `DATABASE_URL` (Supabase **session pooler**), `REDIS_URL` (Upstash `rediss://`), `SUPABASE_URL`, `NEBIUS_API_KEY`, `OPENROUTER_API_KEY`. Check them with `python scripts/check_connections.py`.

Two processes, from the repo root:

```bash
# API on :8000. BIY_DEV_NO_AUTH=true: no token needed, one demo workspace (local only)
PYTHONPATH="backend;." BIY_DEV_NO_AUTH=true PUBLIC_BASE_URL=http://127.0.0.1:8000 ARQ_QUEUE=arq:queue:dev-$USER \
  backend/.venv/Scripts/python -m uvicorn biy.main:app --port 8000

# Worker. Use your own ARQ_QUEUE: on the shared Upstash, the default queue belongs to prod
PYTHONPATH="backend;." ARQ_QUEUE=arq:queue:dev-$USER backend/.venv/Scripts/python -m arq biy.worker.WorkerSettings
```

(`PYTHONPATH` separator is `;` on Windows, `:` elsewhere.) Then `http://127.0.0.1:8000/api/health` should say `db` and `redis` true, and `/api/docs` lists every route.

**Settings worth knowing** (`biy/config.py`): `DB_POOL_SIZE` (default 4: the session pooler caps all clients at 15), `ARQ_QUEUE`, `PUBLIC_BASE_URL` (links and upload URLs handed to agents), `SUPABASE_SERVICE_ROLE_KEY` (only for agent image uploads), `NEBIUS_CONCURRENCY` / `OPENROUTER_CONCURRENCY`.

## Quick checks

```bash
cd backend
.venv/Scripts/python -m biy.providers nebius deepseek-ai/DeepSeek-V4-Flash-0731   # text + JSON + tool call, < $0.001
.venv/Scripts/python -m pyflakes biy
```

## Connect a coding agent

```bash
claude mcp add --transport http biy https://biy.studypdf.net/mcp           # then /mcp → biy → Authenticate (OAuth)
claude mcp add --transport http biy https://biy.studypdf.net/mcp --header "Authorization: Bearer biy_…"   # or a workspace key
```

The key comes from the dashboard: Use cases → "Connect your coding agent". Then `/mcp__biy__scan_repo` in the repo to benchmark.

## Demo backup

Record a finished discovery + run before the demo, and reload it if a provider rate-limits us live:

```bash
cd backend
PYTHONPATH=".;.." .venv/Scripts/python -m biy.backup export --workspace <workspace id> -o demo-backup.json
PYTHONPATH=".;.." .venv/Scripts/python -m biy.backup import demo-backup.json --workspace <workspace id> --suffix " (backup)"
```

Import creates new ids and keeps every link (cases ↔ results ↔ runs), so the dashboard shows the run as finished. Only `done` runs are exported.

## Windows notes

- **Avast (or another HTTPS-scanning antivirus)** re-signs HTTPS and mangles some responses, including on `localhost`: MCP replies arrive empty, pip downloads break. Add `https://biy.studypdf.net/*` and `http://127.0.0.1/*` as exceptions (Avast: Settings → General → Exceptions).
- The client uses the OS trust store when `truststore` is installed (`pip install truststore`), which fixes `CERTIFICATE_VERIFY_FAILED` behind such a proxy.
