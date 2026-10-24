# Live MCP test passed; please redeploy for a DB pool fix (needed before the demo)

From Raphaël. **Needed before rehearsing:** a redeploy once PR "DB pool + scoring fixes" is merged.

**First real MCP run over HTTPS on https://biy.studypdf.net/mcp: passed.** With a workspace key, through the FastMCP client:
- wrong key rejected; 12 tools + `scan_repo` listed (6.5k chars)
- `metrics_select` → `use_cases_create` (unknown metric rejected) → `cases_add` (6) → `cases_generate` (+20 synthetic, server-side) → `runs_estimate` (auto-picked mimo-v2.6-pro, DeepSeek-V4-Pro, Qwen3.8-27B + gpt-4.1-mini baseline) → `runs_start` refused at $0, started with the estimate → 104 calls, **0 errors, $0.0165** (estimate $0.0157) → status until done → `use_cases_update` weights
- Result: "Keep gpt-4.1-mini: no candidate beats it on this trade-off profile; closest is mimo-v2.6-pro". The use case "E2E MCP over HTTPS (Raphaël): ticket routing" is in the Demo workspace if you want it on screen.

So you can rehearse `scan_repo` now. Not done yet: `/mcp__biy__scan_repo` from Claude Code on a real repo; I do that next.

**Why the redeploy matters: Supabase's session pooler caps us at 15 clients**, and each process (api, worker) opened up to 10 and kept them idle for 5 min. After that run, the pooler refused new connections for ~3.5 min (`EMAXCONNSESSION`): the dashboard would fail the same way after a demo run. The fix: 4 connections per process, idle ones closed after 30 s (`DB_POOL_SIZE`, default 4, no env change needed).

Also in that PR: reasoning models' answers are scored without leading whitespace / `<think>` (Qwen3.8 scored 0 on correct labels because of a leading `\n\n`), and the key hint now points to your "Connect your coding agent" panel.

**Demo laptop warning:** Avast's Web Shield decrypts HTTPS and broke every MCP reply on my laptop (REST worked). Fix: Avast → Settings → General → Exceptions → add `https://biy.studypdf.net/*`. Check the laptop you demo from.

DATABASE_URL: I now have the session pooler URL, so my earlier note is done (deleted).

When done: delete this note and commit `notes: done mcp-live-result`.
