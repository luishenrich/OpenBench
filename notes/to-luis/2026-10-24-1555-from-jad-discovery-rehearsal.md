# Discovery rehearsal on gpt-researcher

From Jad. Public repo `assafelovic/gpt-researcher`. StudyPDF was not scanned. Real wall time about 25 minutes. Cursor claimed 80. Cost so far $0. Full estimate across all 29 use cases about $13.55.

## What scan_repo found

29 use cases: 10+ extraction, 4 classification (choose agent, select MCP tools, review draft, fact check), 9 generation, 2 summarization, 3 agent, 1 chat. Current models detected: gpt-5.4, gpt-5.4-mini, gpt-4o, o3-mini. Correct skips: embeddings, reranking, wrappers, tests and mocks, eval harnesses, the image-gen model, unused templates. Duplicate call sites were grouped.

## Quality issues

21/29 use cases have fewer than about 20 cases. Long-form generation use cases have 0 references. An image-planning reference was reused poorly. The curator "expected" JSON is mock output, not gold. The reviewer and fact-checker were classified as classification even though the reject path is free text. Choose-agent also emits a long free-text role prompt. Report writing requires citations, and no citation metric was selected. Chat was kept as one tool-using use case, which is what we want.

Selector changes now on my side, generic, no repo names:

- `citations_required` or `requires_citations` adds `citation_precision` and `citation_recall` for generation, summarization, batch, chat, and RAG. Omitting both selects nothing extra.
- `feedback_text` or `also_free_text` adds `rubric_score` beside the label. Omitting both leaves the label metric alone. `feedback_text` is already on `ScorecardBrief`.
- Generation and summarization with no gold reference keep `rubric_score`, including beside `pairwise_vs_baseline`.
- A chat with `tools` stays one use case. Tool turns use `tool_call_correct` and `tool_choice_correct`. The reply stays on the chat metrics. The card notes say so.

`generate_case_inputs` now asks for long-form cases two at a time, caps each string reference at 800 characters, repairs a truncated JSON array, and returns whatever valid cases it got instead of failing the call.

## Cheap run, not pursued

Proposed cheap run was $0.0271 for "CLI report filename title", 3 candidates plus baseline gpt-5.4-mini, repeats 1, 28 calls. I started it. Run `2eb5d005-f7c5-4c3e-b8c6-73a5711e8a44` finished 42/42 calls with 35 errors. Every OpenRouter model (gpt-oss-20b, ling-3.1-flash, gpt-6.1-sol, gpt-6-luna, gpt-5.4-mini baseline) returned no completion, 0 ms, $0. Only Nebius Nemotron-3_5-Lightning completed (p95 3966 ms), and pairwise quality was never scored. No model passed the `error_rate` gate. No recommendation. Estimate $0.1433, actual $0.0002. This looks like an OpenRouter key, credit, BYOK, or provider-pin problem, and the judge or pairwise pass did not run. I am not pursuing this use case. Raphaël has the same facts and the ask to check worker logs.

Tool errors (prompt resource, create payload, `cases_generate` JSON and HTTP 503, paid-tool warnings) are in the note to Raphaël. Those are his files.

Human agreement on the earlier support export is in `exports/judged-run-25399d5d/summary.md`: 8/10 (80%), rubric Spearman 0.68, inter-judge 0/3 flagged. The pitch line is `metric-bank/research/why-trust-the-judge.md`.
