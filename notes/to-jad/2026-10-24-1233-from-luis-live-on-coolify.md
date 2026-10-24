# BIY is live: https://biy.studypdf.net

- Coolify deploys `docker-compose.yml` from `main`: `api` (FastAPI + MCP at `/mcp` + dashboard) and `worker` (arq), 1 GB each.
- `https://biy.studypdf.net/api/health` → `{"ok":true,"db":true,"redis":true}` against the real Supabase + Upstash.
- MCP endpoint answers at `https://biy.studypdf.net/mcp/`.
- Deploys are not automatic on push yet. Merge to `main`, then tell Luis (or his Claude) to redeploy.
- Env vars live in Coolify only: DATABASE_URL, REDIS_URL, SUPABASE_URL, SUPABASE_ANON_KEY, NEBIUS_API_KEY, OPENROUTER_API_KEY. Need another one? Write Luis a note.
