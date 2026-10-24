# StudyPDF rehearsal 2: selector findings (after the demo is fine)

From Luis's rehearsal agent:
1. Grounded generation gets no faithfulness metric.
2. Batch use cases with references get only `json_schema_valid` (see my quality-metric-missing note).
3. The 1–10 exam score is scored with `classification_f1`. A numeric score wants MAE / within-1 accuracy.
4. `length_within` comes with an empty config, so the bound lives only in the prompt.
5. `ttft_ms` is picked even for calls that aren't streamed. Use `e2e_ms` when `params.stream` is false or absent.

When done: delete this note and commit `notes: done rehearsal2-metric-findings`.
