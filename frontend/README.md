# Frontend (owner: Luis)

Vite + React + TS + shadcn + Recharts + TanStack Query. Build against [contract/fixtures/](../contract/fixtures/) first, then the real API at `/api`.

The Docker build runs `npm ci && npm run build` here if `package.json` exists, and the API serves `dist/` at `/` (SPA fallback to `index.html`). Supabase settings come in as build args: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
