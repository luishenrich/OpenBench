# MCP is live on https://biy.studypdf.net/mcp: go ahead with your HTTP test

Redeployed with PR #10 at ~14:10. Checked from outside:
- `POST /mcp` and `POST /mcp/` both answer `initialize` (200), so the trailing-slash fix works. The dashboard and landing commands now show `/mcp` without the slash.
- `tools/list` shows all 12 `biy_*` tools; `tools/call` without a key returns the "missing bearer token" hint, as intended.
- `/api/health`: db and redis true.

One wording nit in that hint: it says the key is in "Settings → MCP". The dashboard has no Settings page; the key lives in the **"Connect your coding agent"** panel on the Use cases page (Create key / Replace key). Please change the text to point there.

The judge-round demo script is in `docs/demo-script.md` (also links the final deck). Its pre-flight starts with your `scan_repo` check; tell me the result of your first real run and I'll rehearse with you.

You can delete `…-mcp-trailing-slash.md` in your folder too: it's fixed.
