You are helping me benchmark open-weight LLMs for every place this product uses an LLM.
The BIY MCP server (tools prefixed `biy_`) is connected. Work through the steps below in order.
**Do not change any application code.** Keep a short running note of what you find; you will show it at the end.

## 1. Find every LLM call site

Search the whole repository (all packages of a monorepo) with grep/ripgrep, then read the code around each hit.

- **Python imports:** openai, anthropic, google.genai, google.generativeai, mistralai, groq, together, cohere, ollama, litellm, langchain*, llama_index, instructor, dspy, transformers, vllm
- **JS/TS imports:** openai, @anthropic-ai/sdk, @google/genai, ai, @ai-sdk/*, @langchain/*, llamaindex, @mastra/*
- **Calls:** chat.completions.create, responses.create, messages.create, generateContent, generateText, streamText, generateObject, streamObject, .invoke(, .stream(, completion(
- **Model strings:** gpt-, o1/o3/o4, claude-, gemini-, llama, qwen, mistral, deepseek, gemma, phi-, kimi, glm-, and `provider/model` slugs
- **Config:** `*_API_KEY`, `*_BASE_URL`, `.env.example`, deployment values (helm, terraform, docker-compose)
- **Prompts:** prompt folders, `*.prompt`, `*.prompty`, `*.jinja`, `*.j2`, `*.md` templates, long template strings, prompts fetched at runtime from a prompt registry

Group call sites that do the **same job** into one use case (same prompt and purpose, called from several places).
Skip embeddings, reranking and speech for now; list them at the end as "not benchmarked yet".
For a multi-step agent, benchmark **single steps**: one use case per distinct LLM step whose input you can reproduce.

## 2. Understand each use case

For each one, work out from the code:

- **kind:** chat | batch | extraction | classification | agent | rag | summarization | generation | other
- **user_facing / waiting:** is a person waiting for the answer? HTTP or websocket handlers and streaming → yes. Queues, cron, workers, batch APIs → no.
- **current model and parameters:** model name, temperature, max_tokens, tools, response format / structured output.
- **inputs:** the system prompt, the user message template and its variables, whether images or documents are sent.
- **what "good" means:** read the prompt, the output schema and how downstream code uses the result. Parsing JSON without error handling means validity is critical. Output shown to users means tone and correctness matter. A fixed label set means classification accuracy.
- **typical volume**, only if the code makes it clear (a cron schedule, batch size). Otherwise leave it out.

## 3. Pick metrics and gates

Call `biy_workspace_get` once for the company's default trade-off profile.

For each use case, call **`biy_metrics_select`** with a brief built from what you saw: `kind` plus every flag you can tell
(`user_facing`, `waiting`, `has_schema`, `has_reference`, `numeric_fields`, `tools`, `multi_step_agent`, `ocr`, `layout_boxes`,
`knowledge_base`, `citations_required`, `baseline_present` (true when there is a current model), `phi_or_customer_data`,
`length_bounded`, `brand_voice`, …) and a one-paragraph `narrative`. Use the returned `metrics` and `gates` **as they are**.
Don't invent metric ids; if you need to look one up, use `biy_metrics_list`.

**Trade-off weights** `{quality, speed, cost}` (sum 100): keep the company default unless the use case clearly differs.
A person waiting on streamed text → speed matters more. Background batch → speed near 0, cost matters. Agents → quality first.
Give a one-sentence reason for every override.

## 4. Create the use cases

Call **`biy_use_cases_create` once** with all of them. For each:

- `name`, `kind`, `description` (what it does and why it matters; mention the override reason here)
- `source_refs`: `[{"path": "...", "line": N, "symbol": "..."}]` for every call site in the group
- `current_model`: today's model. **Closed models run through OpenRouter**: `{"provider": "openrouter", "model": "openai/<model>"}`,
  `"anthropic/<model>"` or `"google/<model>"`. Use the closest current OpenRouter id for the model the code uses.
- `io_spec`: `system_prompt`; `user_template` with `{{variable}}` placeholders; `response_schema` as JSON Schema
  (convert pydantic / zod / TypedDict definitions); `tools` in OpenAI format; `params` (temperature, max_tokens)
- `metrics` and `gates` from step 3; `profile` only when you override the weights

## 5. Add test cases

For each use case, collect realistic inputs from unit tests, fixtures, mocks, seed or demo data, few-shot examples
inside prompts, and docs. Add them with **`biy_cases_add`**: `input` is `{"vars": {...}}` matching the template variables,
or `{"messages": [...]}`; `reference` is the expected output when the repo has one (expected JSON, label, text); `source: "repo"`.

If a use case has fewer than ~20 cases, call **`biy_cases_generate`** (`n` up to 30, `strategy: "auto"`) to reach 20–50.
It seeds from the cases you added, so add the repo cases first. If it fails or returns too few, write realistic synthetic
cases yourself: vary length, difficulty, language and the edge cases the code handles, derive the `reference` when you can
do so reliably (for extraction, write the expected JSON first, then the document that contains it), and add them with
`biy_cases_add`, `source: "synthetic"`.

**Data rules, no exceptions:**
- Only templates, schemas and test data from the repo, or synthetic data, go to BIY. **Never real user content or uploads.**
- Never send secrets, API keys, tokens or anything that looks like real customer data, PII or health data. Replace names,
  emails, ids, addresses and numbers with realistic fakes. If unsure, leave it out and say so.

## 6. Estimate, then ask me

For each use case, call **`biy_runs_estimate`** with no `candidates` (BIY picks shortlisted models with verified
capabilities for it) and `repeats: 3`. Then show me one table:

| use case | kind | waiting? | weights q/s/c | quality metrics | gates | cases (repo + synthetic) | today's model | est. cost |

Below it, list: call sites you grouped together, anything you skipped and why, and anything you were unsure about.

**Ask me whether to start.** Only after I say yes, call **`biy_runs_start`** for each use case with the same arguments and
`confirm_cost_usd` = that use case's estimated total. Then poll `biy_runs_status` until every run is done and summarise
each recommendation in one line. The dashboard shows the same results live.
