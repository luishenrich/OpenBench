You are helping me benchmark open-weight LLMs for every place this product uses an LLM.
The BIY MCP server (tools prefixed `biy_`) is connected. Work through the steps below in order.
**Do not change any application code.** Keep a short running note of what you find; you will show it at the end.

The dashboard fills in live while someone watches, so **speed to the first use case matters**: the first one should
appear within about a minute. Find call sites with grep only, create a light use case for each right away (step 2),
and leave all careful reading for step 3. Never build one big payload for everything.
**Send BIY tool calls one at a time**, never several in parallel.

## 1. Find and group every LLM call site (grep only, no deep reading yet)

First, note the **repo name**: `git remote get-url origin` (the last path part, without `.git`), or the folder name.
Every `source_refs` entry gets `"repo": "<that name>"`, so the dashboard shows the scan as one project.

Search the whole repository (all packages of a monorepo) with a few broad grep/ripgrep calls (the patterns below,
combined), plus one grep for the default model. Grep output with a few lines of context is enough to name, group and
create a use case. **Don't open prompt files, read call sites, test data or client code yet**: that's step 3.
**Large monorepo** (several apps or services): list them with a rough count of LLM call sites each, from the same
greps, and ask me which to scan first. Then scan those completely.

- **Python imports:** openai, anthropic, google.genai, google.generativeai, mistralai, groq, together, cohere, ollama, litellm, langchain*, llama_index, instructor, dspy, transformers, vllm
- **JS/TS imports:** openai, @anthropic-ai/sdk, @google/genai, ai, @ai-sdk/*, @langchain/*, llamaindex, @mastra/*
- **Calls:** chat.completions.create, responses.create, messages.create, generateContent, generateText, streamText, generateObject, streamObject, .invoke(, .stream(, completion(
- **Model strings:** gpt-, o1/o3/o4, claude-, gemini-, llama, qwen, mistral, deepseek, gemma, phi-, kimi, glm-, and `provider/model` slugs
- **Config:** `*_API_KEY`, `*_BASE_URL`, `.env.example`, deployment values (helm, terraform, docker-compose)
- **Prompts:** prompt folders, `*.prompt`, `*.prompty`, `*.jinja`, `*.j2`, `*.md` templates, long template strings, prompts fetched at runtime from a prompt registry

**Grouping rule:** one use case = **one prompt/template + one output shape**. Call sites that reuse the same prompt or the
same wrapper function are `source_refs` of that one use case, not separate use cases. Different prompts or different
output shapes are different use cases. Report every call site; don't drop or pick favourites. **Never skip a use case for lack of data**: create it and say what's
missing (step 2).
Skip embeddings, reranking and speech for now; list them at the end as "not benchmarked yet".
For a multi-step agent, benchmark **single steps**: one use case per distinct LLM step whose input you can reproduce.

## 2. Create each use case right away

Straight after the greps, before reading any file in full, call **`biy_use_cases_create` with a list of one** per
use case, one call after the other, with only the light fields. If a later read shows two were really one prompt (or one
was two), fix it in step 3 with `biy_use_cases_update`.

- `name`, `kind` (chat | batch | extraction | classification | agent | rag | summarization | generation | other)
- `description`: what it does and why it matters, in one or two sentences
- `source_refs`: `[{"repo": "<repo name>", "path": "...", "line": N, "symbol": "..."}]` for every call site in the group
- `current_model`: today's model. **Closed models run through OpenRouter**: `{"provider": "openrouter", "model": "openai/<model>"}`,
  `"anthropic/<model>"` or `"google/<model>"`, the closest current OpenRouter id for the model the code uses. BIY runs it
  as the "today" reference next to GPT-6.1 Sol and GPT-6 Luna; references are compared with, never recommended.

It shows up in the dashboard immediately. Keep its `id` and `url` for step 3 and the final list.

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
`baseline_present` (true when there is a current model), `phi_or_customer_data`, `length_bounded`, `brand_voice`,
`feedback_text` (the output is a grade or label **and** a written comment a person reads), …) and a one-paragraph
`narrative`. Use the returned `metrics` and `gates` **as they are**; don't invent metric ids.

**c. Trade-off weights** `{quality, speed, cost}` (sum 100): keep the company default unless the use case clearly differs.
A person waiting on streamed text → speed matters more. Background batch → speed near 0, cost matters. Agents → quality
first. Give a one-sentence reason for every override.

**d. Fill it in** with **`biy_use_cases_update`**: `io_spec` (`system_prompt`; `user_template` with `{{variable}}` placeholders;
`response_schema` as JSON Schema, converted from pydantic / zod / TypedDict; `tools` in OpenAI format; `params`),
`metrics`, `gates`, and `profile` only when you override the weights.

**Large fields go by upload, never through your tool arguments.** A prompt over ~4,000 characters, a big schema or tool
list: call **`biy_upload_url`** (`field`: `system_prompt`, `user_template`, `response_schema` or `tools`), then from your shell
`curl -sf --data-binary @<file> <url>`. Use the prompt's own file, or a scratch file you assemble from template literals or
f-strings, character for character. **Never truncate, shorten or paraphrase a prompt.** If you can't attach it exactly,
leave it empty and say "prompt not attached" in the description: BIY refuses to run a use case without a prompt, so a
placeholder is never benchmarked.

**Prompts built by code** (f-strings, helper functions, message lists): read the function and write its text into a
scratch file yourself, one use case at a time, with `{{variable}}` for each interpolation and the default config values
filled in. Don't write a script that imports or runs the application's code to render prompts: the repo's dependencies
may not be installed, running it needs approval, and it stalls the scan. Small helpers that only format a variable
(a JSON dump, a list join) are part of the variable, not of the template.

**e. Test cases:** collect realistic inputs from unit tests, fixtures, mocks, seed or demo data, few-shot examples inside
prompts, and docs. Add them with **`biy_cases_add`**: `input` is `{"vars": {...}}` matching the template variables, or
`{"messages": [...]}`; `reference` is the expected output when the repo has one (expected JSON, label, text); `source: "repo"`.
Many cases: write them to a JSONL file (one case per line) and send it with `biy_upload_url` field `cases_jsonl` + curl.
If the use case has fewer than ~20 cases, call **`biy_cases_generate`** (`n` up to 30, `strategy: "auto"`) to reach 20–50;
it seeds from the cases you added. If it fails or returns too few, write realistic synthetic cases yourself (vary length,
difficulty, language and edge cases; for extraction write the expected JSON first, then the document) and add them with
`biy_cases_add`, `source: "synthetic"`.

**Image / document input with no images in the repo** (OCR, vision): still create the use case, and put
"needs page images" in its description. The user adds files in the dashboard. Optionally, you can make **synthetic
documents with an exact reference**: write the expected output first (text, Markdown, JSON), render it to a PNG with a
local script (HTML → screenshot, or LaTeX → PDF → PNG), upload the image with `biy_upload_url` field `image` + curl (it
returns the image URL), then `biy_cases_add` with `input.images = [url]`, `reference` = what you wrote, `source: "synthetic"`.

Then move on to the next use case.

**Data rules, no exceptions:**
- Only templates, schemas and test data from the repo, or synthetic data, go to BIY. **Never real user content or uploads**,
  including benchmark bundles or exports that contain real users' text or files. The user decides about those in the dashboard.
- Never send secrets, API keys, tokens or anything that looks like real customer data, PII or health data. Replace names,
  emails, ids, addresses and numbers with realistic fakes. If unsure, leave it out and say so.

## 4. Estimate, then ask me

For each use case, call **`biy_runs_estimate`** with no `candidates` (BIY picks shortlisted open-weight models with
verified capabilities for it) and `repeats: 3`. Then show me one table:

| use case | kind | waiting? | weights q/s/c | quality metrics | gates | cases (repo + synthetic) | today's model | needs | est. cost |

Below it, list: call sites you grouped together, anything you skipped and why, and anything you were unsure about.
Then **"Needs your input in the dashboard:"** one line per use case that can't run yet, with its link (the `url` BIY
returned, e.g. `https://biy.studypdf.net/use-cases/<id>`) and what's missing ("needs page images", "prompt not attached").
Skip the estimate for those.

**Ask me whether to start.** Only after I say yes, call **`biy_runs_start`** for each use case with the same arguments and
`confirm_cost_usd` = that use case's estimated total. Then poll `biy_runs_status` until every run is done and summarise
each recommendation in one line. The dashboard shows the same results live.
