# Next tasks (in priority order), from Luis

Everything you shipped today is **live** (deployed at ~17:05): jury of 3, case editing, pinned, workspace settings + inheritance, uploads, compact replies, MCP OAuth gate. Verified live:
- `/mcp` → 401 + `WWW-Authenticate`
- resource metadata OK
- Supabase OAuth server on, dynamic registration 201
- the `biy_…` key still works
- `/api/me` returns the new workspace fields and 3 jurors

**OAuth E2E passed live** (17:20): dynamic registration 201 → consent → code → PKCE token 200 (1 h + refresh token) → `/mcp` initialize 200 → `biy_workspace_get` = luis's workspace. **Real token `aud` = `authenticated`**, `client_id` and `email` present, so no change is needed on your side.

## 1. Demo readiness (most important, before the final)
- **A clean demo workspace.** The judge-round demo shows discovery live, then switches to a finished run. Please create a finished run **on the current contract**: references Sol + Luna (+ "today"), jury of 3, effort chips, a real Pareto front. Use a small, fast public repo use case (not StudyPDF), so the run page shows everything we built. Tell me the run URL; it goes into `docs/demo-script.md`.
- **Discovery speed.** The rehearsal took ~22 min to finish creating. On stage we need the first use cases visible in **< 2 min**.
  - With create-early this should be much better; please time a fresh `scan_repo` on a mid-size public repo and tell me "first use case after X s, done after Y min".
  - If it's still slow, ideas: the prompt tells the agent to create light use cases right after grep, before reading deeply; metrics_select is batched server-side.
- **Rehearse the full flow once on prod with OAuth** (once my test passes): `claude mcp add --transport http biy https://biy.studypdf.net/mcp` → `/mcp` → Authenticate → `/mcp__biy__scan_repo` → estimate → confirm → run → dashboard.

## 2. OAuth follow-ups
- **Token lifetime / refresh:** check that Claude Code refreshes silently (Supabase access tokens expire after 1 h by default) and that a revoked or refreshed token doesn't leave a broken MCP session.
- **Scopes (later):** right now an OAuth client gets full workspace access. Fine for the demo; note it in docs.

## 3. Data hygiene
- Luis's empty duplicate workspace `727c027f…`: **Luis has to say yes before it's deleted** (I'll ask him). After that, add `unique (user_id)` on `workspace_member`.
- `/api/me` returns `email: ""` for key auth (minor): return the owner's email or `null`.

## 4. After the demo
- A real `project` entity (one per repo; `use_case.project_id`; settings inherit workspace → project → use case).
- Scoped OAuth permissions (read-only vs run).
- Agent image uploads (`biy_upload_url field=image`): the service-role key is now set in Coolify (api only). Please run one live test.

When done: delete this note and commit `notes: done next-tasks`.
