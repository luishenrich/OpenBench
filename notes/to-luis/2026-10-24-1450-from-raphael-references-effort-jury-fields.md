# References, reasoning effort, jury: field names (breaking), plus one decision for you

From Raphaël. **PR #14 is merged into `main`, so `main` now has the new backend + contract.** ⚠️ **Don't redeploy `main` until the dashboard uses the new field names below**, or the live dashboard breaks (it would read `is_baseline` / `*_vs_baseline`, which are gone). Redeploy once your frontend change is in.

## Field names (contract/schemas.py, fixtures regenerated)

| Where | Before | Now |
|---|---|---|
| `RunIn` | `include_baseline` | `references: ModelRef[]` (default Sol + Luna, both `reasoning_effort: "medium"`), `include_references: bool` |
| `CandidateResult` | `is_baseline` | `is_reference`, **`reference_label`** ("GPT-6.1 Sol", "GPT-6 Luna", or "today"), **`reasoning_effort`** (pinned value, or "default" = provider default), **`avg_reasoning_tokens`** |
| `ParetoPoint` | `is_baseline` | `is_reference` (grey; never `pareto: true`), `label` = reference label |
| `Recommendation` | `quality_vs_baseline_pct`, `cost_multiple_vs_baseline` | `quality_vs_reference_pct`, `cost_multiple_vs_reference`, **`reference_key`** (best reference by quality). Headline: "Switch to X: 97% of GPT-6.1 Sol's quality at 1/20 of the cost" |
| `Run` | – | `references: ModelRef[]` (as run, incl. "today"), `judge_agreement: float \| null` |
| `JudgeConfig` | `provider`, `model` | `judges: [{provider, model, params}]` (default Luna + DeepSeek-V4.1-Flash, both `reasoning_effort: "low"`), `mode`, `rubric`. Old single-judge configs read as the default jury |
| `ResultOut.judge` | `{mode, score, reasoning, winner}` | same keys **plus** `jurors: [{key, reasoning_effort, score, reasoning, winner}]`, `abstained: [key]`, `agreement: bool \| null`. `reasoning` is now all jurors in one string |

Candidate keys include the effort: `openrouter:openai/gpt-6.1-sol@medium`. References have `rank: null` always; their `failed_gates` is informative only.

The use case's `current_model` becomes a third reference labelled **"today"** when it's a closed model (not in the catalogue). The "Keep today's model" headline only appears when that "today" reference beats the best candidate on utility.

## What I found while testing (live, 2 runs)

- **Nebius accepts `reasoning_effort` but models react inconsistently:** gpt-oss-120b follows it (61 / 94 / 164 tokens for low / default / high), DeepSeek ignores it, and **GLM-5.3-Flash nearly stops reasoning at any value** (4 tokens at `high` vs 408 without). So Nebius models keep the provider default and show `reasoning_effort: "default"`. OpenRouter models get `medium` where the endpoint supports `reasoning`.
- **Decision for you (and Jad): the jury is biased against the references.** With "abstain on your own family", Sol and Luna (OpenAI) are judged by DeepSeek alone, while open candidates get Luna + DeepSeek. In the test, DeepSeek gave 1.0 almost everywhere, while Luna was stricter (0.5–0.9). So "X% of Sol's quality" compares a lenient score with a mixed one. Options: (a) when comparing candidate vs reference, use only the jurors that judged both (here DeepSeek); (b) add a third juror from another family (e.g. GLM or Qwen) so every output gets two votes; (c) accept it and say so. I'd go with (b). Tell me and I'll implement it.

## Also in the PR
- `scan_repo` creates each use case **as soon as it's grouped** (light fields, `source_refs[].repo` set from `git remote` or the folder), then fills in one use case at a time. New grouping rule: one use case = one prompt/template + one output shape. Your note is closed.
- Separate arq queue per environment (`ARQ_QUEUE`, default `arq:queue`), so local workers never steal prod runs. No change on Coolify.
- Candidates with no quality score (all jurors abstained) are not ranked ("quality not scored") instead of ranking with 0.

When done: delete this note and commit `notes: done references-fields`.
