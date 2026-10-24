# Uploads, compact replies, needs-data: done; one env var for image uploads

From Raphaël. Closes your notes large-prompts-upload, rehearsal-findings and needs-data. In PR "uploads + compact replies + needs-data".

**Needed from you (for agent image uploads only):** set `SUPABASE_SERVICE_ROLE_KEY` in Coolify (api service). Without it, everything below works except `biy_upload_url` with `field: "image"`, which says so clearly. Nothing else needs a new env var: `PUBLIC_BASE_URL` defaults to `https://biy.studypdf.net`.

**Deploy order reminder:** `main` already has PR #14 (new field names), so redeploy together with your dashboard update.

## 1. Large prompts: `biy_upload_url` + curl
- MCP tool `biy_upload_url(use_case_id, field)` (also `POST /api/use-cases/{id}/upload-url?field=…`) returns a single-use URL `https://biy.studypdf.net/api/uploads/<token>`, valid 15 min, scoped to workspace + use case + field (token in Redis, no table).
- The agent runs `curl -sf --data-binary @file <url>`. `POST /api/uploads/{token}` needs no bearer token (the URL is the credential).
- Fields: `system_prompt`, `user_template` (text) · `response_schema`, `tools` (JSON) · `cases_jsonl` (one CaseIn per line, bulk add) · `image` (PNG/JPEG/WebP/PDF → bucket `cases/<ws>/<uc>/<uuid>.<ext>`, returns the public URL).
- Tested: a 17,635-character prompt with accents and CJK arrived byte-identical; a second use of the URL → 404; bad JSON → 422.
- **Runs refuse a use case with no prompt** (`system_prompt` and `user_template` both empty, unless the cases carry `messages`): `422` "no prompt attached… use biy_upload_url". So a placeholder is never benchmarked.

## 2. Rehearsal findings
- **Compact replies:** `biy_use_cases_create` / `_list` / `_update` return `{id, name, kind, url, metrics, case_count, prompt_attached, needs, latest_run}`. 6 use cases ≈ 1.3k characters, instead of ~2.8k per use case before. New **`biy_use_cases_get(id)`** returns the full object.
- **Pool:** the MCP key → workspace lookup is cached for 60 s (cleared on key rotation), so a burst of tool calls no longer takes a DB connection each. The prompt also says to send BIY calls one at a time. The 4-connection pool (PR #12) helps once deployed.
- **scan_repo:** on a large monorepo, it lists apps/services with call-site counts and asks which to scan first.

## 3. Needs data
- `scan_repo` never skips a use case for lack of data. It creates it, writes what's missing in the description ("needs page images", "prompt not attached"), adds a **needs** column to the final table, and ends with "**Needs your input in the dashboard:**" plus the use-case links (`url` from the tool replies).
- **Optional synthetic OCR documents** with an exact reference: write the expected output, render a PNG locally, upload with `field: "image"`, add the case with `reference`, `source: "synthetic"`.
- **Real user files never come from the agent**, including bench bundles with real users' text.
- **Checked:** `POST /api/use-cases/{id}/cases` accepts `source: "upload"` with `input.images: [publicUrl]`; runs on image cases accept only `verified.vision` candidates (422 otherwise). The `needs` field in the MCP replies uses the same rules you described (no prompt, no cases), if you want to reuse them in the dashboard.

When done: delete this note and commit `notes: done uploads-needs-data`.
