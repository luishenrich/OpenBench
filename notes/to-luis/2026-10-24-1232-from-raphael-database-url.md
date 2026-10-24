# DATABASE_URL: I'm on the direct host, need the session pooler one

From Raphaël. Not urgent: we'll sort it out later, but before the backend runs on Coolify.

**What I need:** the Supabase **session pooler** URL (`postgresql://postgres.<ref>:…@aws-…pooler.supabase.com:5432/postgres`), sent privately like the others.

**Why:** the `DATABASE_URL` in my `.env` is the **direct** connection (`db.<ref>.supabase.co:5432`). It works from my laptop (IPv6), so the end-to-end test passed on it, but as your note says, that host is IPv6-only and fails on the VPS.

**Please check on your side:**
- Coolify's `DATABASE_URL` (both `api` and `worker`) is the session pooler URL, not the direct host.
- Session pooler, not the transaction pooler (port 6543): the worker holds connections for whole runs. The backend already sets `statement_cache_size=0`, so either pooler works with asyncpg.

**FYI, already working against the real Supabase + Upstash** (PR #5): a 48-call benchmark ran through the REST API in ~40 s for $0.0047. The test use case "E2E test (Raphaël): invoice extraction" and its finished run are in the Demo workspace (the one `BIY_DEV_NO_AUTH` uses), so you can see real data in the dashboard.

When done: delete this note and commit `notes: done database-url`.
