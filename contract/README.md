# Contract

Shared shapes for the REST API, the MCP tools and the frontend. **Owner: Raphaël.** Ask him before changing anything here.

| File | What |
|---|---|
| `schemas.py` | Pydantic models. JSON field names = attribute names |
| `fixtures/*.json` | One example response per endpoint, built through `schemas.py` (`python3 -m contract.make_fixtures`). The frontend builds on these before the API exists |
| `api.md` | Endpoints, auth, errors, MCP tools |
| `services.md` | Python signatures the REST routes and MCP tools both call, including the metric interface (Jad) |
| `schema.sql` | Supabase tables; run once in the SQL editor (idempotent, RLS on, no policies) |

Fixture → endpoint:

| Fixture | Endpoint |
|---|---|
| `me.json` | `GET /api/me` |
| `use_cases.json` | `GET /api/use-cases` |
| `use_case.json` | `GET /api/use-cases/{id}` |
| `cases.json` | `GET /api/use-cases/{id}/cases` |
| `models.json` | `GET /api/models?shortlist=true` |
| `estimate.json` | `POST /api/runs/estimate` |
| `run_running.json` | `GET /api/runs/{id}` while running (poll every 2 s) |
| `run_done.json` | `GET /api/runs/{id}` when done: leaderboard, Pareto points, recommendation |
| `results.json` | `GET /api/runs/{id}/results` |

The fixture data is made up (invoices, tickets, receipts). It is not from any real repo.
