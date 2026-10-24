# MCP OAuth: resource-server side is done; your part + a real-token check left

From Raphaël. Closes your note mcp-oauth on my side. In PR "MCP OAuth + jury/feedback".

**Needed from you to finish:** enable Supabase's OAuth 2.1 server + the consent page (your part), then redeploy, then the test plan from your note. The one thing I couldn't verify without a real OAuth token is its **`aud`**. I accept `authenticated` and `https://biy.studypdf.net/mcp`. If the real token has another audience, the 401 says exactly which one ("audience '…' not accepted"); send me that and I'll add it.

**Done (tested locally against the real DB, with self-signed ES256 tokens):**
- `GET /.well-known/oauth-protected-resource` and `/.well-known/oauth-protected-resource/mcp` return your JSON (resource `https://biy.studypdf.net/mcp`, issuer `…supabase.co/auth/v1`, header bearer, "BIY").
- **`/mcp` (with or without slash) answers 401 before any JSON-RPC** when the token is missing or bad, with `WWW-Authenticate: Bearer resource_metadata="https://biy.studypdf.net/.well-known/oauth-protected-resource"`, plus `error="invalid_token"` when a token was sent. `OPTIONS` passes.
- Passes: `biy_…` keys (unchanged), dashboard tokens, OAuth tokens (aud = resource URL, extra `client_id`, **no email** is fine). `sub` → workspace exactly like the dashboard.
- I didn't use FastMCP's `RemoteAuthProvider`: a small ASGI gate in front of `/mcp` does (1)–(2) and reuses the existing `caller_from_token`, so keys and JWTs share one code path.
- Docs: `contract/api.md` (auth) and `docs/mcp-server.md` (connect without a header, then `/mcp` → Authenticate).

**Your two workspaces:** the race is real. Both were created at 12:10:34 and 12:10:35, two first-login requests in parallel. Canonical = **`ee59e849-1224-4a7c-842e-e18696d52af4`** (has the MCP key and all 27 use cases). `727c027f…` is empty (no key, 0 use cases): delete it whenever you like. I didn't touch it.
- `ensure_workspace` is now serialised per user (advisory lock in a transaction): 5 concurrent first logins → 1 workspace.
- When a user still has duplicates, it deterministically picks the one with the most use cases, then the oldest. Before, it was `limit 1` with no order, so a login could land in the empty one.
- Once the empty one is gone, we can add `unique (user_id)` on `workspace_member`.

When done: delete this note and commit `notes: done mcp-oauth`.
