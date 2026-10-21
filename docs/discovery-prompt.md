# Discovery prompt

This prompt turns a coding agent (Claude Code, Cursor, Codex, …) into the BIY use-case scanner. There are two ways to deliver it:

- **MCP prompt `scan_repo`.** In Claude Code, run `/mcp__biy__scan_repo`.
- **Copy-paste.** Paste everything inside the block below into the agent while you're in your repo. The BIY MCP server must be connected (see [mcp-server.md](mcp-server.md)).

Later we can also ship it as a `SKILL.md` for agents that support Agent Skills.

---

```markdown
You are helping me benchmark open-weight LLMs for every place my product uses an LLM.
The BIY MCP server (tools prefixed `biy_`) is connected. Work through the
steps below. Do NOT change any application code.

## 1. Find every LLM call site
Search the repo, including monorepo packages, with grep/ripgrep, then read the surrounding code:
- Python imports: openai, anthropic, litellm, langchain*, llama_index, instructor, dspy,
  google.genai, mistralai, groq, together, ollama, transformers, vllm
- JS/TS imports: openai, @anthropic-ai/sdk, ai, @ai-sdk/*, @langchain/*, llamaindex, @mastra/*
- Calls: chat.completions.create, responses.create, messages.create, generateText,
  streamText, generateObject, .invoke(, completion(, embeddings.create
- Model strings matching: gpt-|o[1-9]|claude-|gemini-|llama|qwen|mistral|deepseek|gemma|phi-|kimi|glm-
- Config: *_API_KEY, *_BASE_URL, localhost:11434, :8000/v1, .env.example, helm/terraform values
- Prompt files: prompts/, *.prompt, *.prompty, *.jinja, *.j2, large template strings
Group call sites that do the same job into ONE use case, e.g. the same prompt used from two routes.
Skip embeddings and reranking for now; list them at the end as "not benchmarked yet".

## 2. Classify each use case
For each one, decide:
- kind: chat | batch | extraction | classification | agent | rag | summarization | generation | other
- user_facing: is a human waiting on the response? Look for HTTP/websocket handlers and
  streaming → yes. Queues, cron, workers, batch APIs → no.
- what "good" means here, based on the prompt, the output schema and how downstream code
  uses the result (e.g. json.loads with no try/except means validity is critical; output
  shown in the UI means tone matters)
- current model and params (temperature, max_tokens, tools, response_format)
- typical input size (estimate from the template plus variables)
- rough monthly call volume, if you can infer it (otherwise leave it null)

## 3. Choose metrics, gates and the trade-off
Call `biy_workspace_get` (company default profile) and `biy_metrics_list`.
For each use case:
- Start from the default metric set for its kind and adjust it. Prefer deterministic metrics
  (json_schema_valid, field_accuracy, classification_f1, tool_call_correct) where the task
  has a checkable answer. Use rubric_score / pairwise_vs_baseline only for open-ended outputs,
  and draft a concrete rubric from the system prompt (3-6 criteria).
- Gates: only real hard requirements, e.g. json_schema_valid ≥ 0.99 if the code would crash.
- Trade-off weights {quality, speed, cost} (sum 100). Only override the company default
  when the use case clearly differs:
  user-facing chat → speed matters (TTFT); background batch → speed ≈ 0, cost matters;
  agents → quality first. Give a one-sentence reason for each override.

## 4. Create the use cases
Call `biy_use_cases_create` once, with all use cases. For each, include: name,
kind, description, source_refs (path + line), current_model, io_spec (system prompt,
template, variable names and types, tool definitions, response JSON schema converted
from pydantic/zod), metrics, gates, profile_override + reason, monthly_volume.

## 5. Seed test cases
For each use case, collect realistic inputs from: unit tests, fixtures, mocks, seed or demo data,
few-shot examples in the prompt, and docs. Add them with `biy_cases_add`
(source: "repo"); include the expected output as `reference` when the repo has one.
PRIVACY: never send secrets, API keys, or anything that looks like real customer data,
PII or PHI. Replace names, emails, IDs and numbers with realistic fakes. If unsure, don't
send it; describe it instead.
If a use case has fewer than 20 cases, call `biy_cases_generate` (strategy: schema_first
for extraction, persona_grid for chat, expand otherwise) to reach ~50.

## 6. Estimate, then ask me
For each use case, call `biy_runs_estimate` with `auto: 6` candidates and 3 repeats.
Then show me a table: use case | kind | user-facing | weights (q/s/c) | key metrics |
gates | #cases | estimated cost. Also list anything you skipped and why.
Ask whether to start the runs. Only call `biy_runs_start` after I say yes, passing
`confirm_cost_usd`.
```

---

## Notes for implementers

- **Keep the prompt and `biy_metrics_list` in sync.** The prompt names metric IDs.
- **Expect the agent to over-group or under-group call sites.** The dashboard review step exists to fix that, so make merging and splitting use cases easy there.
- **Optional fast pre-pass.** Run SafeDep `vet` AI-BOM or `aibom-scanner` locally, and paste its output in as a hint list.
