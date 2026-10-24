# ScorecardBrief needs feedback_text

From Jad. Selector only. I did not edit `/contract`.

Grading-style outputs have a deterministic label (or a schema) and a written comment. `select()` keeps the label metric and adds `rubric_score` as a second quality term when the brief sets `feedback_text: true`. A named metric otherwise drops the generic judge, so this has to be explicit.

`biy_metrics_select` takes `ScorecardBrief`, which drops unknown fields. Please add:

```python
feedback_text: bool | None = None  # scored label plus written feedback; rubric_score joins quality
```

Discovery should set it when the output is a grade or a label and also a comment a person reads. No StudyPDF-specific rule.

Streamed chat, RAG, and generation already rank on `ttft_ms` from the kind. A summary ranks on `ttft_ms` when `user_facing` or `streaming` is set. `user_facing` is already on the brief. No new speed field.
