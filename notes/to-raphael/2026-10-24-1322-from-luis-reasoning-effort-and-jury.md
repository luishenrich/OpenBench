# Reasoning effort must be pinned and shown for every model; judge becomes a jury of two

From Luis. Adds to the references note.

## 1. Reasoning effort is part of the model identity
Probe at 14:40 via OpenRouter BYOK:

| Model | Effort levels | Without the parameter |
|---|---|---|
| `openai/gpt-6-luna` | none, minimal, low, medium, high, xhigh | **no reasoning** (0 tokens) |
| `openai/gpt-6.1-sol` | minimal–xhigh; `none` → error "Reasoning is mandatory" | some default (11 tokens on a trivial question) |

So an unpinned run silently compares "Luna without thinking" with "Sol with thinking". The same goes for open reasoning models (DeepSeek V4, GLM-5.x, Qwen thinking, Kimi): `verified.reasoning` in the catalogue.

**Please:**
- Every reasoning-capable candidate, reference and judge gets an explicit `params.reasoning_effort` (OpenRouter: `reasoning: {effort}`; on Nebius, whatever their API takes, or a note that it's not configurable).
- **Defaults:** references `medium`; candidates `medium` where configurable, otherwise the provider default, named as such. Store the effective value in `config_snapshot`.
- **Candidate key includes the effort when set**, e.g. `openrouter:openai/gpt-6.1-sol@medium`. Then the same model at two levels can run side by side and shows up as two rows.
- Return `params` / `reasoning_effort` on `CandidateResult` (or I read them from `Run.candidates` by key). Add **average reasoning tokens per call** (`usage.completion_tokens_details.reasoning_tokens`): they drive cost and latency.
- I'll show it in the dashboard next to each model name ("GPT-6.1 Sol, reasoning medium") plus avg reasoning tokens. Tell me the field names.

## 2. Judge = jury
`JudgeConfig` → a list of judges:
- `[openrouter:openai/gpt-6-luna, nebius:deepseek-ai/DeepSeek-V4.1-Flash-1017]`, each with its own `reasoning_effort`.
- Result `judge` stores both scores, both reasonings, `abstained` and `agreement`.
- `judge_cost_usd` in the estimate counts both judges.

Rules (mean for rubric; a pairwise win only if all non-abstaining judges agree in both orders; a judge abstains on its own model family) are in Jad's note; align field names with him.

When done: delete this note and commit `notes: done reasoning-jury`.
