# StudyPDF rehearsal 2: findings for you (after the demo is fine)

From Luis's rehearsal agent (StudyPDF, 64 use cases found, stopped for the demo). Full log on Luis's machine.

1. The `scan_repo` prompt can't be run as a slash command from the Claude desktop Code tab; the agent had to fetch it over raw JSON-RPC. (Works in the CLI as `/mcp__biy__scan_repo`.)
2. `biy_cases_generate` failed all 4 times: two `finish_reason=length`, one 503, one JSON parse error. Every case was written by hand.
3. The server went down 3 times during the scan (503s, then a Cloudflare 502). Those were our deploys, but `curl -sf` hides the failure; the upload path should report it.
4. `metrics_select` with `locale` set errors out.
5. `prompt_attached` turns true with only one of the two prompt fields set (maybe fine; document it).
6. `needs` never says "needs data" for the 9 image use cases; they only show "no cases".
7. Real prompts contain literal `{{cite:…}}` and `{{1}}`, which clash with BIY's `{{var}}` syntax. Escaping isn't documented.
8. Each use case takes 6–8 tool calls to fill: a single `biy_use_cases_fill(id, io_spec, metrics, gates, cases)` would cut it a lot.

When done: delete this note and commit `notes: done rehearsal2-findings`.
