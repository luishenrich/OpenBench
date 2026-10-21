# Research: metrics and eval methods

> Research brief, gathered 2026-10-21 via web search. Items tagged **[not re-verified]** are cited from memory. Section 7 lists open doubts.

## 0. Takeaways for the product

- Build the catalogue in **three layers**:
  1. **Gates** are hard pass/fail rules, e.g. "JSON valid ≥ 99%", "p95 latency < 2s", "≤ $0.01/task".
  2. **Task-quality metrics** are chosen per use case.
  3. **Operational metrics** (speed, cost, reliability) are measured on the *same run*.
- For open-weight models, the thing you rank is a **(model, provider, quantization, settings) tuple**, not a model. The same weights give measurably different quality depending on who serves them. This is our edge over model-level leaderboards.
- Rank in this order: **gates → Pareto frontier → optional weighted utility**. Report **cost per successful task** and **bootstrap confidence intervals**.

## 1. Speed metrics

| Metric | Definition | Notes |
|---|---|---|
| TTFT | Request sent → first token received | Includes network, queueing and prefill. For reasoning models, Artificial Analysis (AA) also reports *time to first answer token* ([AA](https://artificialanalysis.ai/methodology/performance-benchmarking)) |
| ITL / TPOT | (E2E − TTFT) / (output tokens − 1) | Per-request average vs per-token average can differ a lot ([Anyscale](https://docs.anyscale.com/llm/serving/benchmarking/metrics), [NVIDIA NIM](https://docs.nvidia.com/nim/benchmarking/llm/metrics)) |
| Output tokens/sec | Tokens after the first chunk ÷ streaming time | AA method |
| E2E latency | TTFT + generation time | AA also gives "response time for 100 tokens" = TTFT + 100/speed |
| System TPS / RPS | Throughput under concurrency | Per-user TPS falls as concurrency rises |
| **Goodput** | Request rate you can sustain while meeting both TTFT and ITL SLOs (p99) | Best single capacity metric ([Cerebrium/vLLM](https://cerebrium.ai/resources/llm-serving-goodput-latency-slos)) |
| p50 / p95 / p99 | Percentiles | Medians can match while the tail is ~6× worse |
| Cold start | Time to first success on a scaled-to-zero endpoint | ~10–15s quoted for TensorRT-LLM (a single vendor's figure) |

**How AA measures:**
- **Input sizes:** 1k / 10k / 100k tokens in. The default is 10k in, ≥1.5k out.
- **Schedule:** runs 8×/day, reports the median over 72h, from GCP us-central1.
- **Settings:** temperature 0.
- **Prompts:** fresh prompts each run, because speculative decoding makes speed depend on content.
- **Tokens:** counted with one tokenizer so models are comparable.

**Pitfalls we must handle:**
1. **Prompt length.** TTFT scales with input length. Benchmark at the customer's real input/output length distribution.
2. **Region / network.** Measure from the customer's region, or report RTT separately.
3. **Streaming.** TTFT and ITL need streaming. Chunk sizes vary by provider, so count tokens rather than chunks.
4. **Provider variance.** Kimi K2 Thinking: 0.53s / 189 tps on Vertex vs 1.79s / 44 tps on Novita ([OpenRouter](https://openrouter.ai/moonshotai/kimi-k2-thinking)).
5. **Time of day.** Sample repeatedly.
6. **Formulas differ between tools.** Publish ours.

**Reusable tools:** `vllm bench serve`, NVIDIA AIPerf.

## 2. Cost metrics

- **List prices.** $/1M input and $/1M output, per provider. Store a **blended price** at the customer's input:output ratio.
- **Cached-input price and cache hit rate.** These matter a lot for RAG and agents with long repeated prefixes.
- **Cost per task** = Σ (in × p_in + cached × p_cache + out × p_out) / tasks. Use provider-reported token counts, so reasoning tokens are included.
- **Cost per *successful* task** = spend / tasks passed. This is the most decision-useful single cost number.
- **Reasoning-token overhead.** There is a ~4× spread in output tokens per task between models, so per-token price alone misleads. Offer reasoning-effort levels as separate candidates.
- **Tokenizer efficiency.** The same text gives different token counts per model. Normalise to cost per task.
- **Self-hosting cost:**
  - **Formula:** $/1M tokens = GPU $/hr × #GPUs ÷ sustained tokens/hr at goodput × 10⁶ ÷ utilisation.
  - **GPU prices (Oct 2026):** H100 median ~$4.20/hr, H200 ~$5.70, B200 ~$8.19 ([Uvik](https://uvik.net/blog/gpu-price-index/)). Prices are rising, so store dated snapshots.

## 3. Quality metrics by task type

| Task type | Metrics | Reference / reusable implementation |
|---|---|---|
| Extraction / short QA | Exact match, token F1 | lm-eval-harness, Inspect scorers |
| Classification / routing | Precision / recall / F1, confusion matrix, calibration | trivial |
| Structured output | JSON parse rate, **schema compliance**, field-level accuracy | [JSONSchemaBench](https://github.com/guidance-ai/jsonschemabench), jsonschema |
| Tool calling | AST match of call + arguments, tool choice, abstention, multi-turn | [BFCL V4](https://gorilla.cs.berkeley.edu/leaderboard.html), [K2 Vendor Verifier](https://github.com/MoonshotAI/K2-Vendor-Verifier) |
| Code | pass@k, unit-test pass rate | Inspect sandboxes |
| RAG | Faithfulness, context precision / recall, relevancy | [Ragas](https://docs.ragas.io/), DeepEval |
| Hallucination | % of outputs inconsistent with the source | Vectara HHEM-2.1-open, a cheap local judge |
| Summarization | Faithfulness, coverage, conciseness | G-Eval; ROUGE alone is weak |
| Open-ended / domain | Rubric score, pairwise win rate | LLM-as-judge, G-Eval (DeepEval, promptfoo) |
| Instruction following | Constraint satisfaction | IFEval is saturated, use [IFBench](https://github.com/allenai/IFBench) |
| Long context | Accuracy vs length, effective context | [RULER](https://github.com/NVIDIA/RULER): only ~half of models claiming 32k+ hold up at 32k |
| Agentic | Task success, **pass^k**, steps/cost per success | [τ-bench](https://arxiv.org/abs/2406.12045), Inspect |
| Safety / refusal | Harmful-compliance rate, **over-refusal rate**, prompt-injection success | promptfoo red-team |
| Multilingual | All of the above, per language | lighteval |
| Human eval | Pairwise preference, Likert | Calibrates the LLM judge on 50–200 items; Bradley–Terry ([Arena-Rank](https://arena.ai/blog/arena-rank)) |

**LLM-as-judge biases and mitigations:**
- **Position bias.** Judge both orders; an inconsistent verdict counts as a tie.
- **Verbosity bias.** Use length control (LMArena "style control").
- **Self-preference.** Use a judge from a different model family than the candidates, or a panel of judges.
- **Authority / sycophancy.** Fake citations can flip verdicts ([CALM](https://llm-judge-bias.github.io/)).
- **Judge drift.** Pin the judge version and report judge–human agreement on the customer's calibration set.

## 4. Reliability metrics

- **Run-to-run variance.** Temperature 0 is *not* deterministic on shared inference, because of batch effects ([Thinking Machines](https://thinkingmachines.ai/blog/defeating-nondeterminism-in-llm-inference/)). Run N ≥ 3 repeats and report mean ± CI plus the per-item flip rate.
- **pass^k.** The fraction of items solved in all k trials. A task that passes 70% of the time passes 8 of 8 trials only ~6% of the time.
- **Error rates.** Track 4xx/5xx, timeouts, `finish_reason=length`, empty completions, and malformed tool calls.
- **Provider fidelity.**
  - On Kimi K2, tool-call schema accuracy ranged from **72% to 100% across providers** ([K2VV](https://github.com/MoonshotAI/K2-Vendor-Verifier)).
  - OpenRouter introduced "Exacto" endpoints in response.
  - Product implication: run a scheduled canary suite per provider.
- **Uptime and rate limits.** Measure the 429 rate at the target concurrency.

## 5. Frameworks: build on or compete with

| Tool | What it does | License | For us |
|---|---|---|---|
| **Inspect AI** (UK AISI) | Eval framework, scorers, sandboxes, 200+ evals | MIT, Python | **Strong candidate for the core runner** |
| lm-evaluation-harness | Academic benchmarks | MIT, Python | Public-benchmark priors |
| DeepEval | 50+ metrics, G-Eval, agents | Apache-2.0, Python | Metric library |
| Ragas | RAG metrics | Apache-2.0, Python | RAG metrics |
| promptfoo | YAML matrix, assertions, red-team | MIT, TS. Being acquired by OpenAI (Mar 2026) | Red-team ideas; neutrality risk |
| Langfuse | Tracing, datasets, judges | MIT, TS. Acquired by ClickHouse | Import production traces |
| Arize Phoenix | OTel tracing and evals | **Elastic 2.0, which bans hosted resale** | Don't embed |
| HELM | Holistic leaderboards | Maintenance mode since June 2026 | Borrow ideas only |
| OpenAI Evals | Registry | Stale | No |
| lighteval | Multilingual tasks | — | Multilingual priors |
| Braintrust, LangSmith | Commercial eval SaaS | Closed | Competitors |
| Artificial Analysis | Speed / price / intelligence per model and provider | Commercial data | Priors and pre-filtering |
| OpenRouter | Unified API, provider pinning, quantization filters | SaaS | **Hackathon inference gateway** |

## 6. Aggregation recommendation

1. **Gates first.** Drop any candidate that breaks a hard constraint.
2. **Pareto frontier.** Plot quality (0–1) × cost per successful task × p95 latency. No weights are needed, and the frontier is often the answer.
3. **Weighted utility, if a single rank is needed:**
   - Keep quality **absolute** (0–1). Don't min-max it across candidates, because HELM dropped win-rate for being dependent on the comparison set.
   - Score cost and latency against **customer targets on a log scale**: 1 at or below target, falling to 0 at "max acceptable".
   - Combine with a **weighted geometric mean**, `U = Q^wq · C^wc · L^wl`. It punishes a near-zero on any axis.
4. **Uncertainty.** Bootstrap CIs over items and repeats. Overlapping CIs are a "statistical tie".
5. **Stamp every result** with provider, quantization, region, date, judge version and price snapshot. Offer scheduled re-runs.

## 7. Not verified

- **Cited from memory:** the Codex pass@k paper, XSTest, the HELM license, the lighteval / Opik / autoevals licenses, AA API terms.
- **Single third-party survey:** several license facts come from one survey. Confirm in each repo, especially Phoenix's ELv2.
- **Anecdotal:** Kimi-on-Bedrock tool-call drops (a Hacker News comment).
- **Volatile:** GPU prices change weekly.
