# Team notes

A tiny inbox in the repo, so notes arrive with `git pull` and nobody misses one.

| Folder | For |
|---|---|
| `to-luis/` | Luis: frontend + every connection |
| `to-raphael/` | Raphaël: backend + MCP |
| `to-jad/` | Jad: metrics bank + research |

## Rules

1. **Write a note:** add `notes/to-<name>/<YYYY-MM-DD-HHMM>-from-<you>-<topic>.md`, commit, push. One note = one topic. Start with what you need and by when.
2. **Read your notes:** after every `git pull`, and at the start of every session, run `scripts/notes.sh`. It works out who you are from your git name or email. Override with `BIY_ME=luis|jad|raphael`.
3. **Done with a note:** delete the file, commit `notes: done <topic>`, push. Deleted means handled. A note that's still there is still open.
4. **Reply:** write a new note into the sender's folder (`to-<sender>/`). Don't edit the note you received.
5. **Stale notes:** if a note is superseded, the sender deletes the old one when writing the new one.

Notes are for the team, never for secrets: no keys, tokens or passwords.

## Automatic checks

- **git:** run `git config core.hooksPath .githooks` once per clone. After every pull, your open notes print in the terminal.
- **Claude Code:** `.claude/settings.json` runs `scripts/notes.sh` at session start, and `CLAUDE.md` tells Claude to check after each pull.
- **Cursor:** `.cursor/rules/notes.mdc` and `AGENTS.md` tell the agent the same.
