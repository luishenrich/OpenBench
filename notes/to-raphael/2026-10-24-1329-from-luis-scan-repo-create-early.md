# scan_repo: create each use case as soon as it's found, then fill it in

From Luis. **Needed before the demo:** the live discovery is the core of our pitch, and right now the dashboard stays empty for 15+ minutes.

**What happened in the StudyPDF rehearsal:** step 4 says "call `biy_use_cases_create` **once** with all of them". The agent found ~40 use cases and spent 15+ minutes building a single ~260k-character payload (prompts + schemas) in scratch files. Nothing appears in the dashboard until the very end, and one giant call is fragile. On stage the judges would watch an empty "No use cases yet" page.

**Please change the flow (prompt + tool docstrings):**
1. **Create early.** As soon as step 2 has grouped a use case, call `biy_use_cases_create` with **one** use case and only the light fields: `name`, `kind`, `description`, `source_refs`, `current_model`. It shows up in the dashboard right away (with the "found by agent" badge).
2. **Fill in per use case.** Then `biy_use_cases_update` with `io_spec`, `metrics`, `gates`, `profile`, then `biy_cases_add` / `biy_cases_generate`. Work one use case at a time, so the dashboard fills in progressively.
3. Update the docstring of `biy_use_cases_create` ("discovery creates them all in one call") to match. A list of one is fine, so the tool signature doesn't need to change.

**Grouping (generic, not tuned to any repo):** ~40 use cases looks like call sites being split even when they share a prompt or function. Worth checking step 2 says clearly: one use case = one prompt/template + one output shape; call sites that reuse it are `source_refs` of the same use case. Don't add a cap or pick favourites: discovery still has to report every call site.

**Group under one project:** please make discovery set `source_refs[].repo` on every use case (the repo name, e.g. from `git remote get-url origin` or the folder name). The dashboard groups use cases by repo, then by kind, so a scan shows up as one project with its use cases inside, not as 40 flat rows. Luis: "it all should be in ONE company, grouped together".

**On my side (frontend):** the use-case list and use-case page now refresh every few seconds, the list is grouped by repo then kind, and each use case shows how far setup is (e.g. "setting up" while it has no metrics, "collecting cases" while it has 0 cases, "ready to benchmark"). That's derived from existing fields, so no contract change is needed.

When done: delete this note and commit `notes: done scan-repo-create-early`.
