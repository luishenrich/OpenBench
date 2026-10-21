# Research: providers and open-weight models

> Research brief, 2026-10-21.
> - **[live]** marks facts we checked by calling the public API that day.
> - The model landscape (§3) leans on third-party ranking blogs. Treat it as directional, and **re-pull it from the APIs at demo time**.

## 1. Providers

### OpenRouter (start here)

- **API:** OpenAI-compatible at `https://openrouter.ai/api/v1`, with a Bearer key.
- **`GET /api/v1/models`:** public, no auth **[live: 468 text models]**.
  - **Fields:** `id`, `hugging_face_id`, `context_length`, `pricing` (USD per token as strings: `prompt`, `completion`, `input_cache_read`, `internal_reasoning`, …), `supported_parameters`, `reasoning`, `top_provider`.
  - **Server-side filters:** `supported_parameters=tools`, `max_price`, `zdr=true`, `region=eu`, and sorts by throughput, latency or price.
- **`GET /api/v1/models/{author}/{slug}/endpoints`:** one entry per provider, public **[live]**.
  - **Fields:** `provider_name`, `quantization`, `context_length`, `max_completion_tokens`, `pricing`, `supported_parameters`, `uptime_*`, and latency/throughput p50–p99.
  - The latency fields were null without a key (not checked with one).
- **Pinning a provider** (needed for fair benchmarks): send `provider: { only: [...], allow_fallbacks: false, quantizations: [...] }` and `require_parameters: true`. Without this, OpenRouter silently falls back to another provider.
- **Per-call stats:** `GET /api/v1/generation?id=…` returns the cost and latency of a single call.
- **Exacto routing:** `:exacto` routes to providers with better tool-calling quality.

### Hyperscalers

| Provider | OpenAI-compatible | Auth | Notes |
|---|---|---|---|
| **Azure AI Foundry** | Yes: `https://<resource>.openai.azure.com/openai/v1/` works for non-OpenAI models too | API key or Entra ID | You must **create a deployment** first, and the `model` field is the deployment name. Choose serverless (per token) or managed compute (GPU per hour). Open models include gpt-oss, Llama 4, Qwen3.x, Mistral Large 3, DeepSeek |
| **AWS Bedrock** | Yes: `bedrock-runtime.{region}.amazonaws.com/openai/v1` or `bedrock-mantle.{region}.api.aws/v1` | SigV4, or a Bedrock API key (`ABSK…`) | DeepSeek, Llama, MiniMax, Mistral, Kimi, Nemotron, gpt-oss, Qwen, GLM, Gemma |
| **Google Vertex (MaaS)** | Yes: `…/endpoints/openapi/chat/completions` | OAuth token from a service account (no static key) | IDs end in `-maas`. The thinking toggle is set per model through `chat_template_kwargs` |

### Inference clouds and self-hosting

All use Bearer API keys and an OpenAI-compatible base URL.

| Provider | Base URL | Machine-readable pricing | Notable |
|---|---|---|---|
| Together | `api.together.xyz/v1` | needs a key | Wide catalog, fine-tuning |
| Fireworks | `api.fireworks.ai/inference/v1` | ? | Fast day-0 releases; scored 100% on Kimi's tool-call verifier |
| Groq | `api.groq.com/openai/v1` | no | Very fast; narrow catalog; free tier is 8K TPM |
| Cerebras | `api.cerebras.ai/v1` | **yes, public** `/public/v1/models` **[live]** | Fastest (~1,200 tok/s on gpt-oss-120b); only 2 models; 5 RPM on the dev tier |
| SambaNova | `api.sambanova.ai/v1` | ? | RDU chips |
| DeepInfra | `api.deepinfra.com/v1/openai` | **yes, public** `/models/list` with quantization **[live]** | Usually the cheapest |
| **HF Inference Providers** | `router.huggingface.co/v1`, model suffix `:fastest` / `:cheapest` / `:<provider>` | **yes, public** `/v1/models` with per-provider price, TTFT, throughput, tools and structured-output flags **[live]** | One HF token reaches ~15 backends |
| Nebius Token Factory | `api.tokenfactory.nebius.com/v1` | needs a key | EU hosting |
| Baseten | `inference.baseten.co/v1` | ? | Often the fastest for large MoE models |
| vLLM / SGLang | `host:8000/v1` | n/a | Tool calls need `--tool-call-parser`, and the parser matters |
| Ollama | `localhost:11434/v1` | n/a | `/v1` ignores `num_ctx`, so set `OLLAMA_CONTEXT_LENGTH` |

Artificial Analysis also has a free API (`/api/v2/data/llms/models`) with intelligence index, price, tok/s and TTFT. Per-provider data costs money.

## 2. One abstraction?

**Mostly yes.** Every provider above speaks OpenAI Chat Completions, so the differences are in **auth**:
- **Azure:** Entra ID or an API key.
- **Bedrock:** SigV4, or use an API key.
- **Vertex:** a short-lived OAuth token minted from a service account.

Store each connection as `{base_url, auth_type, credential, extra_headers, model_id_map}` and drive all of them through one OpenAI client. A small adapter per provider covers the quirks: reasoning flags, rejected parameters, and how thinking is toggled.

**Python choice:**
- Plain `openai` SDK + `boto3` (Bedrock SigV4, optional) + `google-auth` (Vertex tokens).
- **LiteLLM** covers more ground, but **versions 1.82.7 and 1.82.8 shipped a credential stealer on PyPI (2026-03-24, TeamPCP)** ([Datadog](https://securitylabs.datadoghq.com/articles/litellm-compromised-pypi-teampcp-supply-chain-campaign/)). We hold customers' keys, so if we use it, **pin with hashes**.
- Our recommendation is the plain `openai` SDK, with LiteLLM's `model_prices_and_context_window.json` used only as a data file for prices.

**Fastest demo path:** OpenRouter + the HF router as aggregator connections (20+ backends, per-provider price, quantization and latency built in). Add Azure as the "enterprise" direct connection.

## 3. Leading open-weight families (Oct 2026, directional)

| Family | Headline models | Size (total/active) | License | Strength |
|---|---|---|---|---|
| MiMo (Xiaomi) | V2.6-Pro, V2.6-Flash | 1.02T/42B; 309B/15B | MIT | Reported #1 open model on the AA index |
| GLM (Z.ai) | GLM-5.3, 5.3-Flash | ~750B/40B; 320B/18B | 5.3: custom **[live]**; Flash: MIT | Agentic coding, 1M context |
| DeepSeek | V4-Pro, V4.1-Flash | 1.6T/49B; 552B/16B | MIT | Best value, 1M context |
| Kimi (Moonshot) | K3, K2.7-Code | 2.8T/104B; 1T/32B | Custom K3 license | Agents; expensive |
| Qwen (Alibaba) | Qwen3.5-397B, Qwen3.6, **Qwen3.8-27B** | 0.8B–2.4T | Mostly Apache 2.0 | Widest size range; 3.8-27B reportedly the best single-GPU model |
| Step (StepFun) | Step 5 Preview | 600B/27B | Custom | Top-3 on the AA index |
| Hunyuan (Tencent) | Hy4 Preview, Hy3 | 770B/49B | Apache 2.0 (reported) | Permissive at frontier scale |
| MiniMax | M3, M2.7 | ~428B/23B | Community license | Multimodal agents |
| Meta | Llama 4 Scout/Maverick, Muse Spark Open, Muse Glimmer 30B | — | Llama 4 Community (gated) **[live]**; Glimmer Apache 2.0 | Ecosystem |
| Gemma 4 (Google) | E2B … 31B | ≤31B | Apache 2.0 | Edge, function calling |
| gpt-oss (OpenAI) | 120b / 20b | 117B/5.1B; 21B/3.6B | Apache 2.0 | Cheap reasoning, MXFP4 |
| Mistral | Large 3, Medium 3.5, Devstral 2, Small 4 | — | Mixed | EU origin |
| Nemotron (NVIDIA) | Nemotron 3 / 3.5 | — | OpenMDW | Transparent data and recipes |
| Phi (Microsoft) | Phi-4, Phi-4-mini | 14B, 3.8B | MIT | Small tier |

## 4. Benchmarking gotchas (same model, different provider)

1. **Quantization labels are unreliable.** gpt-oss-120b has 24 OpenRouter endpoints labelled fp4, bf16, fp8, int4 or unknown **[live]**. Record the label, but measure quality.
2. **The serving stack matters more than quantization.** Chat templates and tool parsers drive the differences. Kimi K2 tool-call schema accuracy ranged **100% → 72%** across providers on the same weights ([K2VV](https://github.com/MoonshotAI/K2-Vendor-Verifier)). **Provider must be a first-class axis.**
3. **Context and output limits differ per endpoint.** Qwen3.8-27B has 64K context on Cerebras but 1M on Novita. Pre-filter using endpoint metadata.
4. **Tool and structured-output support is per provider.** Use `require_parameters` and `allow_fallbacks: false`.
5. **Reasoning controls are not uniform.** Expect `reasoning_effort`, `reasoning.effort` and `chat_template_kwargs`. Normalise them, and track reasoning tokens separately.
6. **Rate limits throttle runs.** Use per-connection concurrency, retry using `x-ratelimit-*`, and show a "throttled" state so slow ≠ bad.
7. **Latency is noisy.** Stream, warm up, repeat, and record region and time.
8. **Price traps.** OpenRouter's model-level price is the *cheapest* provider's: GLM-5.3 shows $0.079/M there but $1.40/M on Together. Always use per-endpoint pricing.
9. **Non-determinism.** Run n ≥ 3.
10. **Run cost.** 200 cases × (3K in + 2K out) ≈ $0.33 on gpt-oss-120b, $2.60 on GLM-5.3 and $7.80 on Kimi K3, per provider per repeat. **Show an estimate before every run.**

## 5. Defining "open-weight" in code

1. A non-empty OpenRouter `hugging_face_id` means the weights are on HF (177 of 468 models **[live]**). This misses some (e.g. Mistral Large 3), so keep a manual override list.
2. Presence on the HF router's `/v1/models` is a strong signal.
3. The HF Hub API (`/api/models/{repo}?expand[]=cardData&expand[]=gated&expand[]=inferenceProviderMapping`) gives `license` / `license_name`, gating status, and which providers serve the model.
4. **License tiers for the UI:**
   - **Permissive:** Apache, MIT.
   - **Open-weight with restrictions:** Llama, GLM-5.3, Kimi K3, MiniMax, Step, …
   - **Non-commercial.**
   - Label the category "open-weight", not "open source".

## Not verified

- Pricing APIs for Together, Fireworks, Baseten and SambaNova.
- Whether OpenRouter's latency fields fill in with a key.
- Azure's full catalogue.
- Most individual license texts.
