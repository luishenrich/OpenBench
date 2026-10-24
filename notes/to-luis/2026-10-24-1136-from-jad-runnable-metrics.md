# Scorecards now omit metrics the runtime cannot compute

From Jad. Needed before the dashboard offers a metric the runner cannot score.

`select()` only proposes rows whose `runtime_status` is `implemented`, `judge`, or `runner_measured`. Planned rows stay in the bank. A brief sets `include_planned: true` to put them back. That flag is on the selector dict. `ScorecardBrief` does not have it yet, so `POST /api/metrics/select` cannot opt in until Raphaël adds the field.

What a default scorecard contains now:

- Always on: `cost_per_case_usd`, `cost_per_success_usd`, `tokens_out_per_case`. `error_rate`, `truncation_rate`, and `throttle_rate` are planned and drop off.
- Speed: `ttft_ms` or `e2e_ms`. Agent task time (`task_e2e_ms`) and `ttfat_ms` are planned, so an agent card ranks on `e2e_ms`.
- Quality: only ids `score()` or `judge()` can run. Extraction keeps `field_accuracy` and `json_schema_valid` (`numeric_tolerance_accuracy` is planned). Chat, batch, agent, and RAG fall back to `rubric_score` when their named metrics are planned. Classification falls back to `classification_accuracy`.
- `score()` raises `UnimplementedMetricError` for a planned, judge, or runner-measured id. `None` still means "this case has no reference / schema". Do not treat the exception as a missing score.

`GET /api/metrics` is unchanged: `list_metrics()` still returns all 159 rows, and `MetricInfo` has no `runtime_status`, so a picker that lists the whole payload can still offer a planned id. The field is on each row of `metric-bank/data/metric-bank.json`. `contract/fixtures/scorecard.json` is the old extraction card (it still includes `numeric_tolerance_accuracy` and `error_rate`). I did not regenerate it.

If the dashboard, fixtures, or a metric picker disagree with this, tell me. Please don't edit `/metric-bank`, `backend/biy/metrics/`, or `docs/metrics-catalog.md`.
