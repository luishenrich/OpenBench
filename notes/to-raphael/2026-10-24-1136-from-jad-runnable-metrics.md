# Scorecards now omit metrics the runtime cannot compute

From Jad. Needed before the worker calls `score()` on a saved scorecard.

`select()` (and therefore `scorecard()`) only proposes rows whose `runtime_status` is `implemented`, `judge`, or `runner_measured`. Planned rows stay in the bank. Opt in with `include_planned: true` on the brief dict passed to `select()`.

Default scorecard changes:

- `always_on` is `cost_per_case_usd`, `cost_per_success_usd`, `tokens_out_per_case`.
- Speed is `ttft_ms` or `e2e_ms`. `task_e2e_ms` is planned, so agents rank on `e2e_ms`. `ttfat_ms` is not reported.
- Quality keeps implemented ids. Extraction with a schema is `field_accuracy` and `json_schema_valid`. Chat, RAG, batch, and agent fall back to `rubric_score`. Classification falls back to `classification_accuracy`.
- Risk gates such as `safety_violation` and `pii_leakage_rate` are planned, so those lists are empty until you opt in.
- `score()` raises `UnimplementedMetricError` for any id it does not compute (planned, judge, or runner-measured). `None` is only "not applicable". Please don't catch that exception and store it as a null score. `contract/services.md` can say so; I did not edit it.

`list_metrics()` still returns all 159 `MetricInfo` rows and drops `runtime_status`, because that field is not on `MetricInfo`. `ScorecardBrief` has no `include_planned`, so the HTTP select route cannot opt in. `contract/fixtures/scorecard.json` is stale: regenerating it with `make_fixtures` will drop `numeric_tolerance_accuracy`, `error_rate`, and `truncation_rate` from the extraction example. I left `/contract` and `prompts/scan_repo.md` alone.

Runner-measured ids, matched to the result shape: `ttft_ms` and `e2e_ms` from timing, `output_tps` from `tokens_per_s`, `tokens_in_per_case` / `tokens_out_per_case` from usage, `cost_per_case_usd` from `cost_per_call_usd`, `cost_per_success_usd` from the cost aggregate. I left `error_rate`, `truncation_rate`, `throttle_rate`, `task_e2e_ms`, `ttfat_ms`, and `monthly_cost_usd` as planned because `services.md` only commits the runner to timing, usage, and cost. If you already record any of those, tell me and I will mark them `runner_measured`.

If the contract, the worker, or `scan_repo` disagrees, tell me rather than editing `/metric-bank`, `backend/biy/metrics/`, or `docs/metrics-catalog.md`. Contract comment updates are yours.
