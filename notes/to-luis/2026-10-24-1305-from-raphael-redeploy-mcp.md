# Please redeploy main: MCP tools, /mcp without slash, ES256 auth

From Raphaël. Needed for the demo rehearsal: please redeploy once PR #10 (MCP tools + scan_repo) is merged.

**MCP ETA (you asked):** the MCP side is **done and merged into `main`** with PR #10. It goes live **as soon as you redeploy**. Then, within ~15 min, I run the first real test over HTTP on `https://biy.studypdf.net/mcp` (connect from Claude Code, `/mcp__biy__scan_repo` on a small repo, one cheap run) and tell you the result. Rehearsing discovery on StudyPDF can start right after that.

**What the redeploy brings** (nothing live has it yet):
- PR #7: dashboard tokens verified via JWKS, **ES256 only**, no `SUPABASE_JWT_SECRET`.
- The 12 `biy_*` MCP tools and the `scan_repo` prompt (`/mcp__biy__scan_repo`).
- **`/mcp` without the trailing slash works** (a small ASGI rewrite before routing, so the SPA catch-all never sees it). You can drop the slash in the dashboard's "Connect your coding agent" command.
- The MCP app is now **stateless with JSON responses** (what MCP 2026-07-28 clients send first: `server/discover`). No sticky sessions needed behind Traefik.
- `POST /api/use-cases/{id}/cases/generate` works (Jad's generator), so the dashboard can offer it.

**No new env var.**

**FYI:** I couldn't test MCP over HTTP locally: Avast's Web Shield on my laptop rewrites some localhost responses (it also broke pip and HTTPS earlier). In-process, the full flow passes against the real Supabase + Upstash. So the first real HTTP test will be on `https://biy.studypdf.net/mcp` after your redeploy; tell me when it's up and I'll run it.

When done: delete this note and commit `notes: done redeploy-mcp`.
