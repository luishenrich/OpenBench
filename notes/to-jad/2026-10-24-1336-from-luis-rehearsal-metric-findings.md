# StudyPDF rehearsal: metric selector findings

From Luis. The discovery agent ran `biy_metrics_select` on 27 real use cases from StudyPDF's `apps/api`. Please check:

1. **Streamed chat/text ranks speed on e2e time, not TTFT.** For a person waiting on streamed text, `ttft_ms` should drive the speed axis.
2. **Batch and generation with a schema** get a `json_schema_valid` *gate* but no scored schema metric, so quality has nothing deterministic to score. Is that intended?
3. **OCR without a schema gets `field_accuracy`.** It should get `cer`/`wer` (text output), not field accuracy.
4. **Exam grading** only scores the 1–10 number. The written feedback isn't scored at all, so maybe add rubric_score as a second quality metric.
5. **Agents fall back to `rubric_score`**, because the tool-choice metrics are "planned". Fine for the demo, but worth stating in the UI and docs.

These are generic selector rules, so nothing here is tuned to StudyPDF.

When done: delete this note and commit `notes: done rehearsal-metric-findings`.
