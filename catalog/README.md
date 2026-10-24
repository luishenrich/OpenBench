# Model catalogue

Every open-weight model BIY can benchmark, with capabilities **verified by calling the real API**, not copied from provider listings.

| File | What's in it |
|---|---|
| `models.json` | The merged catalogue. Use this one |
| `nebius.json` | Nebius Token Factory, every model it lists |
| `openrouter/<group>.json` | OpenRouter models Nebius doesn't have, by lab group |
| `openrouter/<group>.licenses.json` | License per OpenRouter model, checked on the HF Hub |
| `openrouter/*.retry.json` | Re-probes; the newest probe of a model wins when merging |
| `reference_prices.json` | Official first-party API prices from the model makers |

## Refresh

```bash
python3 scripts/probe_models.py nebius
python3 scripts/probe_models.py openrouter --only <id> ... --out catalog/openrouter/<group>.json
python3 scripts/build_catalog.py
```

Keys come from `.env` (`NEBIUS_API_KEY`, `OPENROUTER_API_KEY`). The probe costs about $0.04 for ~100 OpenRouter models.

## What the probe tests

| Check | How | Pass |
|---|---|---|
| `text` | Streaming chat, "reply with: pong". Records TTFT, E2E, usage | Any non-empty answer. "ping" still counts as reachable |
| `vision` | PNG with a blue left half and a yellow right half | Names blue, then yellow (gold/amber count). Text-only models usually return HTTP 400 |
| `tools` / `tools_auto` | One `get_weather(city)` tool | Calls it with Berlin. `tools` also accepts a forced `tool_choice` when `auto` is unsupported |
| `json_schema` | `response_format: json_schema`, strict, `{answer: int}` | Exactly `{"answer": 42}`, so extra keys fail |
| `reasoning` | Reasoning deltas, `<think>`, or reasoning tokens seen | Informational |
| `embedding` | `/embeddings` | Returns a vector |

`claimed` stores what the provider lists, and `verified` stores what we measured. They differ often, so trust `verified`. Examples from 2026-10-24:
- Nebius lists Gemma-3-27b, MiniMax-M3 and Kimi-K2.7-Code as text-only, but all three accept images.
- OpenRouter lists image input for Inkling and MiMo-V2.6-Flash, but both fail the colour test.

TTFT/E2E come from one call. They show reachability, not benchmark latency.

## Pricing

- **`pricing`** is what the endpoint we call bills, from the provider's own API. **Benchmarks score cost with this**, because a model's speed and price both belong to the endpoint that serves it.
- **`endpoints`** (OpenRouter only) lists one entry per upstream provider, with its own price, quantization and context. OpenRouter's model-level price is the *cheapest* provider's, so a benchmark must pin a provider (`provider.only`, `allow_fallbacks: false`) and use that endpoint's price. `served_by` records which provider answered the probe.
- **`probe.text_call_cost_usd`** is the billed cost of the probe's text call. On OpenRouter it is the real charge (`usage.cost`). On Nebius it is tokens × list price.
- **`reference_price`** is the maker's own API price, for comparison only. As of 2026-10-24, Nebius charges exactly the makers' list price for 12 of 13 models with the same weights; Qwen3.8-27B is slightly cheaper. DeepSeek halves its own price off-peak, so Nebius costs 2× DeepSeek off-peak and the same at peak.

## Shortlist (default benchmark set)

`shortlist.json` picks **29 of the 134 models**: 16 on Nebius (including the embedding model) and 13 OpenRouter gap-fillers. The picks come from the Artificial Analysis Intelligence Index (open-weights page, v4.3.2), and the file records the reasons. `build_catalog.py` copies `shortlist`, `role` and `aa_index` onto each model. The rest stay in the catalogue for users who pick them on purpose.

Rules:
- Use only the newest version of each model line.
- If Nebius serves the same weights, use Nebius.
- Use OpenRouter only for models with AA ≥ 38, the best small model of a family, or a niche (EU origin, a tiny baseline).

Cost of one standard run per use case (200 cases × 3 repeats × 3K in / 2K out, cheapest endpoint):

| Set | Models | $ per run |
|---|---|---|
| OpenRouter, all paid + reachable | 97 | ~$185 |
| **OpenRouter shortlist** | 13 | **~$16** (Step-5 alone ~$5). Qwen3.8-2.4T (~$11) was dropped: same AA score as Qwen3.8-Flash |
| Nebius, all | 29 | ~$122 (free credits) |
| Nebius shortlist | 15 | ~$68 (Kimi-K3 alone ~$23) |

Reasoning models often write 2–4× more output than 2K tokens, so treat these figures as a lower bound. The runner's cost estimate before each run is what counts.

## Flags

- `available`: the text (or embedding) check worked.
- `legacy`: first listed on OpenRouter before 2026-01-01. Kept, but hidden by default in pickers.
- `free_tier`: a `:free` route. It is rate-limited and not benchmark-grade.
- `license` (OpenRouter models): from the HF Hub. Non-commercial or custom licenses are kept and flagged, not dropped.
