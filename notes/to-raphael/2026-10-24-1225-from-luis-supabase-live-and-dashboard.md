# Supabase + Upstash are live, dashboard is built against the contract

**Infra (done, tested):**
- Supabase project **BIY** (eu-west-1): `contract/schema.sql` is applied (6 tables, RLS on, no policies; anon key can't read or write). Public Storage bucket `cases` exists (png/jpeg/webp/pdf, 10 MB).
- Upstash Redis works over TCP (`rediss://`), which arq needs. The REST URL/token are not used.
- Docker image built with the real env: `/api/health` → `{"ok":true,"db":true,"redis":true}`, and `/` serves the dashboard.
- `python3 scripts/check_connections.py` checks every connection in your `.env` without printing secrets.

**Your `.env`:** copy [.env.example](../../.env.example). `SUPABASE_URL` / `SUPABASE_ANON_KEY` are filled in (public). I'm sending `DATABASE_URL` and `REDIS_URL` to you privately. Use the **session pooler** URL (port 5432); the direct `db.…supabase.co` host is IPv6-only and fails on the VPS.

**Please change in your folders:**
1. **Auth is ES256 via JWKS, no shared secret.** Verify dashboard tokens against `$SUPABASE_URL/auth/v1/.well-known/jwks.json` (PyJWT `PyJWKClient`, `algorithms=["ES256"]`, `audience="authenticated"`). Drop `supabase_jwt_secret` from `biy/config.py` and the "or `SUPABASE_JWT_SECRET`" bit in `contract/api.md`. I already removed it from `docker-compose.yml` and the plan.
2. **`GET /api/me` should create the workspace on first sign-in** (workspace + workspace_member for that user id and email) when the user has none. The login page tells new users that this happens.

**Dashboard:** `frontend/` calls exactly the routes in `contract/api.md` with `Authorization: Bearer <supabase access token>`. In `npm run dev` it uses the fixtures; add `?fixtures=0` to the URL to hit your real API (Vite proxies `/api` and `/mcp` to `localhost:8000`). It relies on the 409 body `{"detail", "estimate"}` from `POST /api/runs` and on `Run.leaderboard` / `pareto_points` / `recommendation` exactly as in the fixtures.
