# MCP OAuth: "add the server, click Authenticate, done", like every real MCP app

From Luis. **Next priority after the jury/workspace notes.** Users should connect with `claude mcp add --transport http biy https://biy.studypdf.net/mcp` (no header) and then sign in with the browser. The `biy_…` key stays as an option for CI/headless.

**Architecture (MCP spec 2025-06-18 authorization):**
- **Authorization server = Supabase Auth's OAuth 2.1 server** (beta, free).
  - Issuer `https://jagxzvqgqxpffejpqsou.supabase.co/auth/v1`.
  - Discovery at `https://jagxzvqgqxpffejpqsou.supabase.co/.well-known/oauth-authorization-server/auth/v1`.
  - PKCE is mandatory; dynamic client registration (RFC 7591) is on.
  - Luis enables it in the Supabase dashboard; I build the consent page at `https://biy.studypdf.net/oauth/consent`.
  - Docs: https://supabase.com/docs/guides/auth/oauth-server/mcp-authentication
- **BIY MCP server = resource server (yours):**
  1. **`GET /.well-known/oauth-protected-resource`** (RFC 9728), plus the path-suffixed variant `/.well-known/oauth-protected-resource/mcp`, which some clients probe:
     ```json
     {"resource": "https://biy.studypdf.net/mcp",
      "authorization_servers": ["https://jagxzvqgqxpffejpqsou.supabase.co/auth/v1"],
      "bearer_methods_supported": ["header"],
      "resource_name": "BIY"}
     ```
  2. **HTTP 401 at the transport level** for `/mcp` requests with no or invalid token, *before* any JSON-RPC handling, with `WWW-Authenticate: Bearer resource_metadata="https://biy.studypdf.net/.well-known/oauth-protected-resource"`.
     - Today `POST /mcp` with no auth (`initialize`) returns **200** (checked live just now), so no client ever starts OAuth. The auth error only comes later, inside a tool call.
     - Keep `biy_…` keys working as they are.
  3. **Accept Supabase OAuth access tokens.**
     - They're normal Supabase JWTs (ES256, same JWKS) with `sub`, `role` and an extra `client_id` claim, so `caller_from_token` should mostly just work.
     - Please verify the `aud` value on a real OAuth token (we currently require `authenticated`), and that `email` may be missing.
     - Map `sub` → the user's workspace exactly like the dashboard does.
  4. FastMCP 4.1.3 ships `fastmcp.server.auth.providers.supabase` / `RemoteAuthProvider`, which may give you (1)–(2) for free. You'd need a custom `TokenVerifier` that accepts both `biy_…` keys and Supabase JWTs.
- **Side note:** Luis's account has **two workspaces** in `workspace_member` (ee59e849… and 727c027f…). `ensure_workspace` may have raced on first login. With OAuth, the token's user must land in the same workspace as the key ("luis's workspace", 27 use cases). Please make `ensure_workspace` idempotent (unique on user_id), and tell me which workspace is canonical so we can merge or delete the empty one.

**Test plan:**
- Claude Code: `claude mcp add --transport http biy-oauth https://biy.studypdf.net/mcp` → `/mcp` → biy-oauth → Authenticate → browser → consent → back. Then `biy_workspace_get` shows Luis's workspace.
- `curl -i -X POST https://biy.studypdf.net/mcp` → 401 with the `WWW-Authenticate` header.

When done: delete this note and commit `notes: done mcp-oauth`.
