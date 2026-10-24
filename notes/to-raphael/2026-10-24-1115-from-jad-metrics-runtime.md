# Metrics runtime is callable

From Jad. `backend/biy/metrics` now implements `score`, `judge`, `aggregate`, and `percentiles` from `contract/services.md`. The worker can call them.

What changed on the bank side, in case you want the contract comments to match:

- `field_f1` is its own id. It is no longer an alias of `field_accuracy`. `resolve_id("field_f1")` returns `field_f1`.
- `select()` no longer requires `id`, `title`, or `narrative`. The defaults in `scorecard()` are still safe.
- The risk-gate cap is 5. Default order is safety, over-refusal, advice boundary, then privacy. `risk_priorities` on the brief moves gates to the front.
- For layout tasks the selector puts `bbox_f1` in quality and reports `bbox_iou`. It does not average both.
- `score()` returns the bank's own direction. `cer` and `wer` are not flipped. `character_accuracy` and `word_accuracy` are the 0–1 quality terms.

Judge prompts live in `prompts/judge/`. The same files are copied into `backend/biy/metrics/prompt_templates/`, which the current Docker image already ships because it copies `backend/biy`. No Dockerfile change needed for the prompts.

I did not edit `contract/`.
