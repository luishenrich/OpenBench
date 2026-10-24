# BIY — instructions for Claude

BIY (Benchmark It Yourself) is a 48h hackathon project built by 3 people, each working with their own Claude. Read [README.md](README.md) and [docs/](docs/) for the product and architecture.

## Who owns what

| Folder | Owner | Scope |
|---|---|---|
| `/frontend` | A: Frontend | React + Vite + TS dashboard |
| `/backend` | B: Backend + runner | FastAPI, DB, providers, runner, scoring |
| `/demo-app`, `backend/.../mcp`, discovery prompt | C: MCP + discovery + data | FastMCP tools, demo repo, synthetic data |

Stay inside the folder of the task you are working on. **Shared files** (OpenAPI contract, DB schema/migrations, `docs/`) can be changed, but say so in the commit message and the PR so the others know.

## Git workflow

- **Start of every session:** `git pull` on `main` before doing anything.
- **One branch per task**, named `<area>/<short-name>`, e.g. `frontend/run-view`, `backend/runner`, `mcp/scan-repo`, `docs/metrics`.
- Never commit directly on `main`. Merge through a PR (`gh pr create`); a quick look from a teammate is enough.
- Commit small and often. Push at least every hour so nobody drifts too far from `main`.
- Before opening a PR, `git pull origin main` into the branch and resolve conflicts locally.
- Only commit or push when the user asks.

## Secrets

- API keys live **only** in `.env` (gitignored). `.env.example` lists the variables with empty values — keep it up to date when you add one.
- Never write a key in code, docs, tests, fixtures or commit messages. If one gets committed, tell the user immediately: the key must be revoked, not just deleted.
- We hold customers' provider keys: do not add LiteLLM as a dependency (see [docs/architecture.md](docs/architecture.md)). Pin dependencies (`uv lock`).

## Conventions

- Docs and code in English; chat with the team in whatever language they use.
- REST and MCP are thin layers over the same `services/` functions: no feature exists in only one of them.
