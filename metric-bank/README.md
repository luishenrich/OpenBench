# Metric bank

A selectable library of LLM evaluation metrics for Benchmark It Yourself. An LLM selector picks a small scorecard from this bank for each client. The bank is a superset of the ids in `docs/metrics-catalog.md`. It does not replace that catalogue or the architecture notes.

| Deliverable | Path |
|---|---|
| Metric records (source of truth) | `src/metric_bank/metrics/` |
| Machine-readable bank | `data/metric-bank.json` |
| JSON Schema | `schema/metric-bank.schema.json` |
| Selection guide, with five worked clients | `selection/GUIDE.md` |
| Reference selector output | `selection/examples.json` |
| Notebook | `notebooks/metric_bank_overview.ipynb` |
| Research summary | `research/metric-bank-summary.html` |
| Validation | `validate.py` |

Regenerate the artifacts from this directory:

```bash
PYTHONPATH=src python3 -m metric_bank.build
PYTHONPATH=src python3 -m metric_bank.schema_doc
PYTHONPATH=src python3 -m metric_bank.selector
PYTHONPATH=src python3 research/build_html.py
PYTHONPATH=src python3 notebooks/build_notebook.py
PYTHONPATH=src python3 validate.py
```

Tests:

```bash
PYTHONPATH=src python3 -m pytest -q tests
```

Public exams (MMLU, HELM scenarios, BIG-bench, Arena Elo, and the rest) are priors inside the bank, not metrics. A scorecard is the always-on operational metrics, one speed metric for the product kind, one to five quality metrics, and zero to five risk gates. By default the selector keeps only rows the runtime can compute (`runtime_status` of implemented, judge, or runner_measured). Pass `include_planned` to include the rest.
