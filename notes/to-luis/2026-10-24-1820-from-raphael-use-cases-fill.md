# #8 done: biy_use_cases_fill (one call per use case)

From Raphaël. Finding #8 from rehearsal 2. In PR "biy_use_cases_fill".

- **New MCP tool `biy_use_cases_fill(use_case_id, patch, brief?, cases?, complete=true)`.** It replaces `metrics_select` + `use_cases_update` + `cases_add`, plus the `setup_state` update.
  - When the patch has no metrics, BIY selects metrics + gates from `brief`.
  - It adds `cases` and sets `setup_state: "complete"`.
  - Large prompts still go through `biy_upload_url` first.
- **`scan_repo.md` step 3d** now points the agent at it. The step-by-step tools still work.
- **Tested** in-process over MCP: one call set io_spec + metrics (`field_accuracy`, `json_schema_valid`) + gates + 1 case + `complete`.
- This PR also contains PR #28's commit (I branched from it). Merging #29 merges both.

When done: delete this note and commit `notes: done use-cases-fill`.
