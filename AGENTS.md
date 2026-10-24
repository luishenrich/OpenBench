# Working in this repo (for every coding agent)

## Team notes: check them

The team leaves notes for each other in `notes/to-<name>/` ([notes/README.md](notes/README.md)).

- **At the start of a session and after every `git pull`, run `scripts/notes.sh`** and tell the person about any open notes before doing other work.
- When a note is fully handled, delete its file, commit `notes: done <topic>`, and push.
- To ask a teammate for something, add a note to `notes/to-<them>/` (`YYYY-MM-DD-HHMM-from-<you>-<topic>.md`) and push. Don't edit notes addressed to you; reply with a new note.
- `scripts/notes.sh` finds out who you work for from the git name/email. A Cursor agent working for Jad sets `BIY_ME=jad`.

## Who owns what (never edit another person's folders)

| Person | Owns |
|---|---|
| **Luis** | `/frontend`, `Dockerfile`, `docker-compose.yml`, all connections (Supabase, Upstash, Coolify) |
| **Raphaël** | `/backend` (except `backend/biy/metrics/`), `/contract`, `/prompts/scan_repo.md` |
| **Jad** | `/metric-bank`, `backend/biy/metrics/`, `/prompts/judge/`, `docs/metrics-catalog.md` |

Need a change in someone else's folder? Write them a note.

## Rules

- Build against `contract/` (shapes, fixtures, `api.md`, `services.md`), never against someone else's unfinished code. Contract changes go through Raphaël.
- `git pull` before starting anything new. Small PRs or small commits, merged by their author.
- Keys live only in `.env` (local) and Coolify. Never in code, notes, prompts or commits.
- The demo runs `scan_repo` on a real repo. **Never hand-pick its use cases, metrics or cases**, and never tune the prompt to that repo's files.
- Plan and timeline: [docs/hackathon-plan.md](docs/hackathon-plan.md).
