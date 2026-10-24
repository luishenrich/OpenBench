# Need a judged run export for the human sanity check

The agreement kit is local (`python -m biy.metrics.agreement`). It does not need a new env var or a redeploy.

What is missing for the T+2:30 check: a finished run whose result rows include `judge` objects (`mode`, `score`, `reasoning`, `winner`) on about 10 cases.

Please export, for that run:

1. Every page of `GET /api/runs/{id}/results` concatenated into one `{"items": [...]}` file. The route pages at 50. Drop `next_cursor` only after the last page.
2. `GET /api/use-cases/{id}/cases` as `cases.json` (input and reference).
3. The baseline `candidate_key`.

Then:

```
PYTHONPATH=backend python3 -m biy.metrics.agreement sheet \
  --results results.json --cases cases.json \
  --baseline-key "<provider:model>" --use-case "<name>" \
  --n 10 --seed 0 --out review
```

Fill `human_agree`, `human_score`, `human_winner`, and `human_note` in `review.csv`, then:

```
PYTHONPATH=backend python3 -m biy.metrics.agreement score --sheet review.csv --out summary.md
```

Repo fixtures are not that run: `contract/fixtures/run_done.json` has `judged: 0`, and `results.json` has one example judge. Live `https://biy.studypdf.net/api/runs/{id}/results` returns 401 without a bearer token, so this kit cannot pull the run itself.
