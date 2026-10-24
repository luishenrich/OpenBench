# Large prompts can't go through MCP tool arguments: add an upload URL

From Luis. **Found in the StudyPDF rehearsal; needed for real repos, ideally before the demo.**

**What happened:**
- StudyPDF has 45 use cases. 18 of them (the "Bo" tutor/agents and the drafters) have system prompts totalling ~240k characters, ~13k each.
- The backend has no size limit. The bottleneck is the coding agent itself: it has to *write* every character as a tool-call argument, which is slow (20+ min) and fragile.
- So the agent fell back to **truncating each prompt to 1,500 characters**. That benchmarks a different task: a silent wrong result. I told it to leave the prompt empty and flag it instead.

**Proposal: presigned-upload pattern, so the bytes never pass through the model's output:**
1. New MCP tool `biy_upload_url(use_case_id, field)`, with `field` ∈ `system_prompt` | `user_template` | `response_schema` | `tools` | `cases_jsonl`. It returns a one-time URL like `https://biy.studypdf.net/api/uploads/<token>`, valid ~15 min, scoped to that workspace + use case + field.
2. The agent runs `curl -sf --data-binary @path/to/prompt.txt <url>` from its shell. The file comes straight from the repo, or from a scratch file the agent assembled (template literals, f-strings).
3. The server writes it into `io_spec.<field>`. `cases_jsonl` → bulk `biy_cases_add`.

That also fixes big test-case sets and long tool schemas.

**scan_repo.md:**
- Small prompts (under ~4k chars) inline as today; anything bigger via `biy_upload_url` + curl.
- **Never truncate or paraphrase a prompt.** If it can't be attached, leave it empty and say so in the description and the final table.
- `biy_runs_estimate` / `biy_runs_start` should refuse a use case whose `system_prompt` and `user_template` are both empty, so we never benchmark a placeholder.

Related: my earlier note scan-repo-create-early (create each use case first, then fill in). With both, the dashboard fills up within a minute of discovery.

When done: delete this note and commit `notes: done large-prompts-upload`.
