# Discovery rehearsal: tool errors, and one cheap run to check

From Jad. Public repo `assafelovic/gpt-researcher`. I did not edit `prompts/scan_repo.md`, `/contract`, or your backend. Metric and `cases_generate` fixes are on the PR. I am not debugging the failed run.

## Please check the worker logs

Run `2eb5d005-f7c5-4c3e-b8c6-73a5711e8a44`, use case "CLI report filename title", finished 42/42 calls with 35 errors. Every OpenRouter model (gpt-oss-20b, ling-3.1-flash, gpt-6.1-sol, gpt-6-luna, and the gpt-5.4-mini baseline) returned no completion, 0 ms, $0. Only Nebius Nemotron-3_5-Lightning completed (p95 3966 ms). Pairwise quality was never scored. No model passed the `error_rate` gate. No recommendation. Estimate $0.1433 versus actual $0.0002. Likely an OpenRouter key, credit, BYOK, or provider-pin issue, and the judge or pairwise pass did not run. I am not pursuing this use case further.

The run I had meant to confirm was the $0.0271 estimate: 3 candidates plus baseline gpt-5.4-mini, repeats 1, 28 calls. What actually ran was the 42-call result above.

## Tool errors from the rehearsal

- `prompt://scan_repo` was not found (MCP -32602). The agent read `scan_repo.md` from the repo instead.
- `biy_use_cases_create` with many long prompts failed (`mcpDetails` expected an object, then a JSON parse error). I had to split the create.
- `biy_cases_generate` failed on long outputs: unterminated JSON, `finish_reason=length`, not a JSON array. Parallel calls also got HTTP 503 from nginx. Each call was 10–60 s. On my side, `generate_case_inputs` now uses batches of 2 for long-form, caps a string reference at 800 characters, salvages complete objects from a truncated array, and returns the cases it accepted instead of raising. The 503 and the parallel fan-out are still yours.
- Cursor auto-review flagged estimate and cases calls as paid runs. The tool descriptions should say the estimate is free.

## What the scan found, for the prompt

29 use cases: 10+ extraction, 4 classification (choose agent, select MCP tools, review draft, fact check), 9 generation, 2 summarization, 3 agent, 1 chat. Skips that looked right: embeddings, reranking, wrappers, tests and mocks, eval harnesses, the image-gen model, unused templates. Duplicate call sites were grouped. Current models: gpt-5.4, gpt-5.4-mini, gpt-4o, o3-mini. Real time about 25 minutes (Cursor claimed 80). Full estimate across all 29 use cases about $13.55. 21/29 use cases have fewer than about 20 cases. Long-form generation had 0 references. An image-planning reference was reused poorly. The curator "expected" JSON is mock output, not gold.

Please set these brief flags from the prompt. Both are optional on the selector; omitting them changes nothing.

- `citations_required` when the prompt requires citations or sources (report writing). That now selects `citation_precision` and `citation_recall`. `requires_citations` is accepted as the same flag if you would rather not touch the contract name.
- `feedback_text` when a classification also returns free text (reviewer reject path, fact-checker, the choose-agent role prompt). That already adds `rubric_score` beside the label. `also_free_text` is the same switch if the contract field is the wrong word for a reject reason.

Chat with tools should stay one use case. The selector now scores tool turns with `tool_call_correct` and `tool_choice_correct` and leaves the reply on the chat metrics, and the notes say so.

Luis has the same rehearsal write-up, including this run.
