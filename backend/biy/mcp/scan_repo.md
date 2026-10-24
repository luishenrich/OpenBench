You are helping me benchmark open-weight LLMs for every place this product uses an LLM.
The BIY MCP server (tools prefixed `biy_`) is connected. Work through the steps below in order.
**Do not change any application code.** Keep a short running note of what you find; you will show it at the end.

The dashboard fills in live while you work, so **create each use case as soon as you have grouped it** (step 2),
then complete them one at a time (step 3). Never build one big payload for everything.

## 1. Find and group every LLM call site

First, note the **repo name**: `git remote get-url origin` (the last path part, without `.git`), or the folder name.
Every `source_refs` entry gets `"repo": "<that name>"`, so the dashboard shows the scan as one project.

Search the whole repository (all packages of a monorepo) with grep/ripgrep, then read the code around each hit.

- **Python imports:** openai, anthropic, google.genai, google.generativeai, mistralai, groq, together, cohere, ollama, litellm, langchain*, llama_index, instructor, dspy, transformers, vllm
- **JS/TS imports:** openai, @anthropic-ai/sdk, @google/genai, ai, @ai-sdk/*, @langchain/*, llamaindex, @mastra/*
- **Calls:** chat.completions.create, responses.create, messages.create, generateContent, generateText, streamText, generateObject, streamObject, .invoke(, .stream(, completion(
- **Model strings:** gpt-, o1/o3/o4, claude-, gemini-, llama, qwen, mistral, deepseek, gemma, phi-, kimi, glm-, and `provider/model` slugs
- **Config:** `*_API_KEY`, `*_BASE_URL`, `.env.example`, deployment values (helm, terraform, docker-compose)
- **Prompts:** prompt folders, `*.prompt`, `*.prompty`, `*.jinja`, `*.j2`, `*.md` templates, long template strings, prompts fetched at runtime from a prompt registry

**Grouping rule:** one use case = **one prompt/template + one output shape**. Call sites that reuse the same prompt or the
same wrapper function are `source_refs` of that one use case, not separate use cases. Different prompts or different
output shapes are different use cases. Report every call site; don't drop or pick favourites.
Skip embeddings, reranking and speech for now; list them at the end as "not benchmarked yet".
For a multi-step agent, benchmark **single steps**: one use case per distinct LLM step whose input you can reproduce.

## 2. Create each use case right away

As soon as a use case is grouped, call **`biy_use_cases_create` with a list of one** and only the light fields:

- `name`, `kind` (chat | batch | extraction | classification | agent | rag | summarization | generation | other)
- `description`: what it does and why it matters, in one or two sentences
- `source_refs`: `[{"repo": "<repo name>", "path": "...", "line": N, "symbol": "..."}]` for every call site in the group
- `current_model`: today's model. **Closed models run through OpenRouter**: `{"provider": "openrouter", "model": "openai/<model>"}`,
  `"anthropic/<model>"` or `"google/<model>"`, the closest current OpenRouter id for the model the code uses. BIY runs it
  as the "today" reference next to GPT-6.1 Sol and GPT-6 Luna; references are compared with, never recommended.

It shows up in the dashboard immediately. Keep its `id` for step 3.

## 3. Complete each use case, one at a time

Call `biy_workspace_get` once for the company's default trade-off profile. Then, **for one use case at a time**:

**a. Understand it** from the code:
- **user_facing / waiting:** is a person waiting for the answer? HTTP or websocket handlers and streaming → yes. Queues, cron, workers, batch APIs → no.
- **parameters:** temperature, max_tokens, tools, response format / structured output, reasoning effort.
- **inputs:** the system prompt, the user message template and its variables, whether images or documents are sent.
- **what "good" means:** read the prompt, the output schema and how downstream code uses the result. Parsing JSON without
  error handling means validity is critical. Output shown to users means tone and correctness matter. A fixed label set
  means classification.

**b. Metrics:** call **`biy_metrics_select`** with `kind` plus every flag you can tell (`user_facing`, `waiting`, `has_schema`,
`has_reference`, `numeric_fields`, `tools`, `multi_step_agent`, `ocr`, `layout_boxes`, `knowledge_base`, `citations_required`,
`baseline_present` (true when there is a current model), `phi_or_customer_data`, `length_bounded`, `brand_voice`, …) and a
one-paragraph `narrative`. Use the returned `metrics` and `gates` **as they are**; don't invent metric ids.

**c. Trade-off weights** `{quality, speed, cost}` (sum 100): keep the company default unless the use case clearly differs.
A person waiting on streamed text → speed matters more. Background batch → speed near 0, cost matters. Agents → quality
first. Give a one-sentence reason for every override.

**d. Fill it in** with **`biy_use_cases_update`**: `io_spec` (`system_prompt`; `user_template` with `{{variable}}` placeholders;
`response_schema` as JSON Schema, converted from pydantic / zod / TypedDict; `tools` in OpenAI format; `params`),
`metrics`, `gates`, and `profile` only when you override the weights.

**e. Test cases:** collect realistic inputs from unit tests, fixtures, mocks, seed or demo data, few-shot examples inside
prompts, and docs. Add them with **`biy_cases_add`**: `input` is `{"vars": {...}}` matching the template variables, or
`{"messages": [...]}`; `reference` is the expected output when the repo has one (expected JSON, label, text); `source: "repo"`.
If the use case has fewer than ~20 cases, call **`biy_cases_generate`** (`n` up to 30, `strategy: "auto"`) to reach 20–50;
it seeds from the cases you added. If it fails or returns too few, write realistic synthetic cases yourself (vary length,
difficulty, language and edge cases; for extraction write the expected JSON first, then the document) and add them with
`biy_cases_add`, `source: "synthetic"`.

Then move on to the next use case.

**Data rules, no exceptions:**
- Only templates, schemas and test data from the repo, or synthetic data, go to BIY. **Never real user content or uploads.**
- Never send secrets, API keys, tokens or anything that looks like real customer data, PII or health data. Replace names,
  emails, ids, addresses and numbers with realistic fakes. If unsure, leave it out and say so.

## 4. Estimate, then ask me

For each use case, call **`biy_runs_estimate`** with no `candidates` (BIY picks shortlisted open-weight models with
verified capabilities for it) and `repeats: 3`. Then show me one table:

| use case | kind | waiting? | weights q/s/c | quality metrics | gates | cases (repo + synthetic) | today's model | est. cost |

Below it, list: call sites you grouped together, anything you skipped and why, and anything you were unsure about.

**Ask me whether to start.** Only after I say yes, call **`biy_runs_start`** for each use case with the same arguments and
`confirm_cost_usd` = that use case's estimated total. Then poll `biy_runs_status` until every run is done and summarise
each recommendation in one line. The dashboard shows the same results live.
