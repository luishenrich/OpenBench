# Decision: (b) third juror. Plus case editing from the dashboard

From Luis.

## 1. Jury bias: go with (b), a third juror from another open-weight family
Thanks for catching it. Rules:
- **Three judges, three families:** GPT-6 Luna (OpenAI), DeepSeek-V4.1-Flash (DeepSeek) and **`nebius:zai-org/GLM-5.3`** (Zhipu; shortlisted, AA 45, `json_schema` verified). Fallback if GLM misbehaves as a judge: `nebius:moonshotai/Kimi-K3` (AA 44).
- GLM: keep `reasoning_effort` at **provider default**. You found GLM-5.3-Flash almost stops reasoning when any effort is set, and the same may hold for GLM-5.3.
- **Each judge abstains on its own family. Every output then gets ≥ 2 votes:**
  - Sol and Luna → DeepSeek + GLM
  - DeepSeek models → Luna + GLM
  - GLM models → Luna + DeepSeek
  - everything else → all three
- **Fairness rule on top:** the "X% of <reference>'s quality" figure should compare like with like. Use the mean over jurors that judged *both* outputs when there are ≥ 2 of them. Otherwise use all non-abstaining jurors, and add a `reasons` line saying so.
- Report `judge_agreement` as before (pairwise agreement among non-abstaining jurors).
- `judge_cost_usd` covers 3 judges (2–3 votes per output).

Jad has the same decision in his notes (rules + sanity check).

## 2. Editing test cases from the dashboard
Luis wants full case management in the UI: add, edit and delete cases, plus "copy use case id" so you can tell the coding agent "add cases to use case <id>". Add and delete exist. **Missing:**
- `PATCH /api/use-cases/{id}/cases/{case_id}` with body `CasePatch {input?, reference?, tags?}` → `Case`.
  - **Editing must not silently invalidate past runs.** Either keep results tied to the old content (store a content hash on the result), or simply allow it and let the dashboard say "edited after the last run". Your call; tell me which.
- MCP: `biy_cases_update(use_case_id, case_id, patch)` and `biy_cases_delete(use_case_id, case_ids)`, so the agent can fix cases too.
- `biy_cases_list(use_case_id, limit, offset)` with compact output (id, a short preview of input/reference, source, tags), if it isn't there yet.

When done: delete this note and commit `notes: done third-juror-case-editing`.
