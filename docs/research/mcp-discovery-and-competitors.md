# Research: MCP, repo discovery, competitors, synthetic data

> Research brief, 2026-10-21. **[V]** = checked against a primary source. **[U]** = unverified or secondary.

## 1. MCP: current state

**Spec.** The current version is **`2026-07-28`** [V] ([versioning](https://modelcontextprotocol.io/specification/versioning)). What changed:
- **Stateless protocol.** There is no `initialize` handshake and no `Mcp-Session-Id`. Version and capabilities travel in `_meta` on every request.
  - Round-robin load balancing works, which suits serverless hosting.
  - Cross-call state is passed as explicit handles in tool arguments. For us, that means returning a `run_id`.
- **Long-running work** uses the official Tasks extension (`tasks/get` polling).
- **Tool schemas.** `inputSchema` and `outputSchema` accept full JSON Schema 2020-12, and `structuredContent` can be any JSON.
- **Deprecated:** Sampling, Roots, Logging, and the legacy SSE transport.
- **Compatibility.** It interoperates with `2025-11-25` servers. **Build on the stable v1 SDKs.** The v2 SDKs are still beta: TS `@modelcontextprotocol/server@beta`, Python `mcp==2.0.0b1`.

**Auth for remote servers** is OAuth 2.1 [V]:
1. The server answers `401` with `WWW-Authenticate` pointing at `/.well-known/oauth-protected-resource`.
2. The client discovers the authorization server.
3. The client registers, preferably via a Client ID Metadata Document (DCR is now deprecated).
4. The client runs PKCE with the `resource` parameter.
5. The server checks the token audience.

**Hackathon plan:** ship **static bearer API keys** on day 1, and add OAuth later via WorkOS AuthKit, Clerk, Auth0 or similar. Don't hand-roll an authorization server.

**Adding the server in each client** [V]:
```bash
# Claude Code
claude mcp add --transport http biy https://<host>/mcp --header "Authorization: Bearer $BIY_KEY"
claude mcp add --transport http biy --scope project https://<host>/mcp   # writes .mcp.json
```
- **Cursor:** `.cursor/mcp.json` → `{"mcpServers":{"biy":{"url":"https://<host>/mcp","headers":{"Authorization":"Bearer ${env:BIY_KEY}"}}}}`
- **VS Code:** `.vscode/mcp.json` → `{"servers":{"biy":{"type":"http","url":"https://<host>/mcp"}}}`

**Python server option:** **FastMCP** (`mcp.run(transport="http")`, or mount it as an ASGI app inside FastAPI). It has auth providers for WorkOS, Auth0, Google and others.

**Tool design** ([Anthropic, writing tools for agents](https://www.anthropic.com/engineering/writing-tools-for-agents)) [V]:
- **Fewer, workflow-shaped tools.** For example, a batch `create_benchmarks` rather than one tool per endpoint.
- **Clear names.** Namespace tool names, and use unambiguous parameter names (`benchmark_id`, not `id`).
- **Lean, structured output.** Return high-signal fields, offer `response_format: concise|detailed`, and paginate. Claude Code caps tool output at ~25k tokens.
- **Actionable errors** that show the correct input.
- **Structured content plus text.** Declare `outputSchema` and return `structuredContent`, but **mirror a text summary in `content`**, because some clients ignore structured content [U].
- **Annotations:** `readOnlyHint`, `destructiveHint`, `idempotentHint`.
- **Prompts.** MCP prompts appear as slash commands in Claude Code, e.g. `/mcp__biy__scan_repo` [U on exact format]. That removes the copy-paste step.

## 2. Scanning a repo for LLM usage

**Existing tools to borrow from:**
- SafeDep `vet` AI-BOM: matches call sites across Python, JS, TS, Java and Go, with CycloneDX output [V].
- `aibom-scanner` (PyPI) [U].
- The OpenLLMetry and OpenInference auto-instrumentation lists double as a checklist of SDK surfaces.
- **SKILL.md / AGENTS.md** are open standards supported by Cursor, Codex and others. We could ship the scanner both as an MCP prompt and as a skill.

**Detection heuristics.** Grep first, then let the agent read the surrounding context.
1. **Imports.**
   - Python: `openai`, `anthropic`, `litellm`, `langchain*`, `llama_index`, `instructor`, `dspy`, `google.genai`, `mistralai`, `groq`, `together`, `ollama`, `transformers`, `vllm`.
   - JS/TS: `openai`, `@anthropic-ai/sdk`, `ai` / `@ai-sdk/*`, `@langchain/*`, `llamaindex`, `@mastra/*`.
2. **Call patterns.** `chat.completions.create`, `responses.create`, `messages.create`, `generateText`, `streamText`, `generateObject`, `.invoke(`, `completion(`, `embeddings.create`.
3. **Model-name literals.** `gpt-|claude-|gemini-|llama|qwen|mistral|deepseek|gemma|phi-|kimi|glm-` plus `provider/model` slugs.
4. **Env and config.** `*_API_KEY`, `*_BASE_URL`, `localhost:11434`, `:8000/v1`, `.env.example`, Helm and Terraform files.
5. **Prompt assets.** `prompts/`, `*.prompt`, `*.prompty`, `*.jinja`, `*.j2`, large template strings, and runtime prompt fetches from Langfuse or LangSmith.

**Classification signals:**

| Signal | Use case | Priority |
|---|---|---|
| `stream=True` / `streamText` in an HTTP or websocket handler | User-facing chat | TTFT, tok/s, quality |
| Called from a queue, cron, worker or Batch API | Background batch | Cost, throughput |
| `response_format` json_schema, `generateObject`, pydantic/instructor | Extraction | Schema validity, field accuracy |
| `tools=` + a loop | Agent | Tool-call accuracy, task success |
| Small `max_tokens` + a label list | Classification | Accuracy, p95 latency |
| Embeddings / rerank | Retrieval | Recall@k (later track) |

Also record the current model, temperature, max_tokens and typical prompt length, and whether downstream code is fragile (e.g. `json.loads` with no try/except means validity is critical).

**Seeding data from the repo.** Look at unit tests and fixtures, few-shot examples inside prompts, template variables (synthesize values matching their types), docs, and optional trace exports.

## 3. Competitors and adjacent products

| Product | Status in 2026 |
|---|---|
| **Together Evaluations** | Closest adjacent product: LLM-as-judge over open models. Since Feb 2026 it also accepts any OpenAI-compatible endpoint [V] |
| Artificial Analysis | Generic public benchmarks. Our "prior", not custom |
| Braintrust | Eval and observability platform; "Loop" agent; $80M Series B [U] |
| promptfoo | Open-source evals and red-teaming; **being acquired by OpenAI** (Mar 2026) [V] |
| Langfuse | Open-source observability; acquired by ClickHouse (Jan 2026) [V] |
| Galileo | Acquired by Cisco (2026) [U] |
| Humanloop | **Shut down** Sept 2025; team joined Anthropic [V] |
| Patronus | Pivoted to "digital world models" [V] |
| Vellum | Reportedly pivoted to a consumer assistant [U] |
| Martian, Not Diamond | Per-prompt routers. OpenRouter's Not Diamond auto-router is deprecated in favour of `auto-beta` [U] |
| Fireworks Eval Protocol, Kiln, HF YourBench, DeepEval / Confident AI, Opik, Arize | Open-source eval and synthetic-data tooling |

**Where we stand out:**
1. **Open-weight first, with real infra economics.** Benchmark per provider and quantization, and compare against self-hosted GPU $/hr.
2. **Codebase-aware discovery.** We found no competitor that starts from the repo; they all start from traces or uploaded datasets.
3. **MCP-native control plane** with full dashboard parity.
4. **Close the loop.** A recommendation per call site, and later a patch or PR that swaps `model=` / `base_url`.
5. **Privacy posture.** A bring-your-own-cloud runner later.

The 2025–26 consolidation (Humanloop, promptfoo, Galileo and Langfuse all absorbed) suggests generic evals are commoditising. **The migration decision to open-weight models is a sharper wedge.**

## 4. Synthetic data and privacy

**Ways to bootstrap test data:**
- **Few-shot expansion (Self-Instruct):** expand seed examples plus the extracted system prompt into N diverse inputs, then deduplicate by embedding.
- **Evol-Instruct:** make cases harder. DeepEval's Synthesizer implements this.
- **Persona × intent × edge case × language grids** for coverage.
- **Document-grounded QA** (YourBench) for RAG.
- **Schema-first generation for extraction:** sample the target JSON, then generate the document from it. The ground truth is then known by construction, which makes these the most reliable labels.
- **References and judging:** a gold answer from a frontier model plus an LLM judge, **calibrated on about 20 human-labelled cases**. Use deterministic checks wherever possible.
- **Practical recipe:** redacted real samples plus synthetic expansion, about 50–200 cases per use case, with human review in the dashboard.

**Privacy:**
- **HIPAA** has two de-identification routes: Safe Harbor (remove 18 identifier types) or Expert Determination.
- **Presidio** does PII detection. Run it **in-process**. Scrubbing with an LLM sends the raw data to that LLM first.
- **Defaults for us:**
  - The agent sends **templates, schemas and metadata only**. Raw data goes only with opt-in.
  - Generate synthetic look-alikes.
  - Use zero-data-retention (ZDR) providers only.
  - Offer a BYOC runner later.
