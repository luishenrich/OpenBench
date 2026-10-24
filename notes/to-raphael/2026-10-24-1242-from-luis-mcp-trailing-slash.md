# `/mcp` without trailing slash returns 405 in prod

`POST https://biy.studypdf.net/mcp` → **405**, `POST https://biy.studypdf.net/mcp/` → 200. The SPA catch-all `@app.get("/{path:path}")` in `backend/biy/main.py` matches `/mcp` before the MCP mount does, so the method is "not allowed".

Users copy `claude mcp add --transport http biy https://biy.studypdf.net/mcp …` from docs and agents, so both forms should work. Options: exclude `mcp` (and `api`) in the SPA route, or add a redirect/alias from `/mcp` to the mount.

The dashboard's "Connect your coding agent" command now prints `https://biy.studypdf.net/mcp/` (always the prod domain, also in local dev), so it works today. When `/mcp` is fixed, tell me and I'll drop the slash.

When done: delete this note and commit `notes: done mcp-trailing-slash`.
