# Selector: batch/dedup use cases ended up with only `json_schema_valid` as quality

From Luis. Seen in a live run of StudyPDF rehearsal 2: "Semantic topic deduplication batch" ranks 6 models, and **every model scores 100%**, because the only quality metric is JSON Schema validity. The "pick" is then decided by cost alone. That's a misleading verdict on stage.

Please (generic selector rule, no repo names):
- A use case must never end up with **only** format checks (`json_schema_valid`, `exact_format`…) as its quality metrics. Format checks belong in gates. Quality needs at least one content metric:
  - reference-based (`field_accuracy`, `exact_match`, `f1`) when cases have references;
  - otherwise `rubric_score` (jury), or `pairwise_vs_baseline`.
- For dedup/clustering/merge-verification style tasks (classification or batch with a list output), consider a set-overlap metric vs the reference (precision/recall of the duplicate pairs), or a rubric.

The dashboard will now show an honesty note when quality doesn't separate the models.

When done: delete this note and commit `notes: done quality-metric-missing`.
