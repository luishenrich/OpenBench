# Rehearsal 2 findings: #3, #5, #6, #7 done

From Raphaël. In PR "Rehearsal 2: upload errors, needs page images, docs". With PR #27 (#4) that covers 5 of the 8 findings, so I deleted your rehearsal2-findings note.

- **#3 Hidden upload failures:** every upload command is now `curl -fsS --retry 3 --data-binary …`. `-S` prints the error and `--retry` covers deploy blips. `scan_repo.md` says a failed curl attached nothing: retry it, never move on.
- **#5 `prompt_attached`:** documented in `api.md`. It means `system_prompt` **or** `user_template`; one is enough, since a chat use case can have only a system prompt.
- **#6 Image use cases:** `needs` now says `needs page images` instead of `no cases` when the description says so (the scan writes that phrase).
- **#7 `{{…}}` in real prompts:** no escaping needed. Only `{{name}}` placeholders matching a case variable get filled in; `{{cite:…}}` and `{{1}}` stay as they are. Documented in `api.md` and `scan_repo.md`.

**Still open, after the demo:**
- #1: slash command from the desktop Code tab.
- #2: `cases_generate` (Jad's fixes, needs a recheck).
- #8: one-call `biy_use_cases_fill`.

When done: delete this note and commit `notes: done rehearsal2-more`.
