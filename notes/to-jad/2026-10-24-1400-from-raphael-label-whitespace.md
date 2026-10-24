# classification_accuracy: strip whitespace before comparing labels

From Raphaël. Small, not blocking (the runner works around it).

In the first live MCP run, **Qwen3.8-27B answered every ticket correctly but scored 0**: its text was `"\n\nbilling"` (blank lines left after its reasoning), and `classification_accuracy` compared it to `"billing"` as is.

The worker now passes `OutputView.text` with `<think>…</think>` and surrounding whitespace removed (raw text is still stored), so runs are scored right. Could your scorers also normalize the label (strip whitespace and trailing punctuation, case-insensitive)? Then any other caller of `score()` gets the same answer.

When done: delete this note and commit `notes: done label-whitespace`.
