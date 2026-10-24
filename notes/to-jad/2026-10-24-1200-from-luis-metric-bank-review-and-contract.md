# Metric bank: review + contract update

From Luis. Pull first: the contract now follows your bank (commit `fadbe9c`).

The catalogue is careful work: limitations, "when not to use", and a clean split between quality metrics and gates. Validator and the 6 tests pass, and rebuilding reproduces the committed JSON. The problem: the runner can't call any of it yet. `backend/biy/metrics/__init__.py` is only a docstring, and Raphaël's worker needs `score()` at **T+1:30**.

## What the contract now says (already decided, no need to discuss)

- Metric names are **bank names**; old names are accepted as aliases (`label_accuracy` → `classification_accuracy`).
- `score()` returns values in the bank's own direction, with no `1 - x`. `cer`/`wer` are reported only; `character_accuracy`/`word_accuracy` go into the quality score.
- The quality score uses only metrics with `utility_axis == "quality"`.
- `contract/metric_bank_mapping.py` already maps bank rows and `select()` output into contract shapes. `GET /api/metrics` and `POST /api/metrics/select` are in `contract/api.md`. Your bank ships in the Docker image.

## Please do, in this order

1. **Build `backend/biy/metrics/` to `contract/services.md`.** This unblocks the runner.
   - `METRICS` built from the bank (direction, range, `utility_axis`).
   - `score()` for `json_schema_valid`, `field_accuracy`, `field_f1`, `exact_match`, `classification_accuracy`, `character_accuracy`, `word_accuracy`, `cer`, `wer`, `bbox_iou`, `bbox_f1`, plus `aggregate()` (bootstrap 95% CI) and `percentiles()`.
   - Unit tests on small made-up examples.
   - **Fix `_tokens()` in `illustrative.py:15` before porting the sketches.** It deletes everything outside `[a-z0-9]`, so `exact_match("北京", "上海")` is `True`, `token_f1` is `1.0` for any two Chinese strings, and `"Ärger"` matches `"Rger"`. Instead: NFKC, then `casefold()`, then strip punctuation by Unicode category.
2. **`field_f1` as its own metric.** It's an alias of `field_accuracy` today, but F1 punishes extra or hallucinated fields and accuracy doesn't.
3. **Judges.** Write `/prompts/judge/` (rubric + pairwise) and `judge()`. Pairwise runs both orders; a winner counts only if both orders agree, otherwise it's a tie (0.5).
4. **Sync `docs/metrics-catalog.md`.** 118 bank ids are missing from it, including `cer`, `wer`, `bbox_iou` and `bbox_f1`. At minimum add every id `score()` and `judge()` accept.
5. **Selector cleanup** (after the T+2:30 freeze is fine).
   - `select()` raises `KeyError` without `id`, `title` and `narrative`. Make them optional; the adapter fills them in for now.
   - For a scanned page, `bbox_f1` **and** `bbox_iou` both enter the quality score and push out `numeric_tolerance_accuracy`. Keep one as quality and report the other.
   - The risk-gate cap drops gates by fixed list order (`selector.py:211`), so for a fintech chat that handles secrets, `over_refusal` and `non_advice_compliance` get cut. Rank by the client's priorities or raise the cap.
   - Remove the dead `if ...: pass` (`selector.py:250`) and the unused `BATCH_LIKE_SPEED`, and give notebook cells fixed ids so rebuilds don't create diffs.

The selection rules (speed metric by kind, always-on metrics, caps, no double-counting) and most formula sketches look right and are worth reusing directly.

When done: delete this note and commit `notes: done metric-bank-review`. Questions → a note in `notes/to-luis/`.
