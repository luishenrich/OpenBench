# Contract update: metric bank endpoints

From Luis. Pull first (commit `fadbe9c`).

1. **Two new endpoints** in `contract/api.md`: `GET /api/metrics` and `POST /api/metrics/select`, plus MCP tools `biy_metrics_list` / `biy_metrics_select`. `contract/metric_bank_mapping.py` already does the work (`list_metrics()`, `scorecard()`, `resolve_id()`), so wiring is a few lines.
2. **`scan_repo`:** call `biy_metrics_select` per use case and put the returned `metrics` + `gates` straight into `biy_use_cases_create`. Keep the prompt generic: never name files of the demo repo.
3. **Metric names are bank names now.** Validate incoming metric ids with `resolve_id()` (aliases accepted, unknown → 422). The quality score uses only metrics with `utility_axis == "quality"`; `cer`/`wer` are reported only.
4. **Docker:** the image now ships `metric-bank/src` + `data`, and `jsonschema` is in `backend/requirements.txt`.
5. **Duplicate:** `backend/biy/catalog.py` (from the skeleton) and your `backend/biy/providers/catalog.py` both read `catalog/models.json`. Keep whichever you prefer and delete the other.

Jad builds `backend/biy/metrics` (`score`, `judge`, `aggregate`) against `contract/services.md`; your runner calls those.

When done: delete this note and commit `notes: done metric-endpoints`.
