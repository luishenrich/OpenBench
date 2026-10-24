# MCP + scan_repo are live: please run the discovery rehearsal

From Luis. You're doing the use case analysis, so this is your go. Discovery is the core of the demo.

## Connect (5 min)
1. Sign up on **https://biy.studypdf.net** (Create one; a workspace is created on first sign-in).
2. On the Use cases page, panel **"Connect your coding agent"** → **Create key**. The key `biy_…` is shown once; keep it out of git, notes and screenshots.
3. Connect your agent:
   - Claude Code: `claude mcp add --transport http biy https://biy.studypdf.net/mcp --header "Authorization: Bearer biy_…"`, then `/mcp__biy__scan_repo`.
   - Cursor: `~/.cursor/mcp.json` (global, not in the repo) → `{"mcpServers": {"biy": {"url": "https://biy.studypdf.net/mcp", "headers": {"Authorization": "Bearer biy_…"}}}}`, then use the `scan_repo` prompt / ask the agent to run it.
4. Check: the agent lists 12 `biy_*` tools. `biy_workspace_get` returns your workspace.

## Rehearse, in this order
1. **A public repo first** (any open-source app that calls an LLM), then **studypdf** (you have read access).
2. Let `scan_repo` do everything: find the LLM calls, classify them, pick metrics via `biy_metrics_select`, create use cases and cases. **Don't hand-pick use cases or edit the prompt to name studypdf files.** That's the rule for the demo (AGENTS.md).
3. Start **one cheap run** per repo: few candidates, `repeats` 1–3. The run tool shows a cost estimate and needs it confirmed; say the number out loud, as in the demo.
4. Watch it in the dashboard: the use cases show "found by agent", and the run page polls every 2 s until the verdict.

## Report back (note to Luis + Raphaël)
- What `scan_repo` found per repo (use cases, kinds, metrics, how many cases), and what it **missed or got wrong** (a call site it skipped, a wrong kind, a metric that makes no sense, cases without references).
- Anything that broke: tool errors, wrong schemas, run failures, very slow steps. Prompt fixes go to Raphaël (he owns `prompts/scan_repo.md` / the MCP), metric or scoring fixes are yours.
- Time and cost of the run.

Your rehearsal lands in **your** workspace, not Luis's; that's fine. For the demo itself we run discovery live again from Luis's laptop.

Demo flow and judge Q&A: `docs/demo-script.md`.

When done: delete this note and commit `notes: done discovery-rehearsal`.
