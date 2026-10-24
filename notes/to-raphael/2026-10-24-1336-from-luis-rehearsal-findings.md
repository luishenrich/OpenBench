# StudyPDF rehearsal: three more MCP findings

From Luis. Adds to my notes scan-repo-create-early and large-prompts-upload. The rehearsal was stopped after discovery: 27 use cases created, 0 cases, no run, $0 spent.

1. **Tool replies echo everything.** `biy_use_cases_create` and `biy_use_cases_list` return the full objects: ~76k characters for 27 use cases. That fills the agent's context. Please return a compact summary instead (id, name, kind, metric ids, case_count, latest run status), plus a `biy_use_cases_get(id)` for the full object when needed.
2. **Parallel calls hit the pool cap.** 6 parallel `biy_metrics_select` calls failed with `EMAXCONNSESSION`. Prod still runs the old pool, because your DB pool fix (PR #12) isn't deployed yet: the redeploy is waiting for my go. After the redeploy: either make `metrics_select` not touch the DB (the bank is static), or tell the agent in scan_repo.md to send BIY calls one at a time.
3. **45 is real.** StudyPDF really has 45 distinct prompts: the agent grouped shared call sites correctly (OCR: 4 sites, topic extraction: 3, …). Discovery took ~19 min to the first create. Ideas for scan_repo.md:
   - On a large monorepo, ask the user which areas or apps to scan first.
   - Vision use cases without images in the repo: create them, mark them "needs data", and never send real user files. StudyPDF's bench bundles contain real student text and were correctly left out.

When done: delete this note and commit `notes: done rehearsal-findings`.
