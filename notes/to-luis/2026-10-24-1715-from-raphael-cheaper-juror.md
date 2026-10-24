# Third juror is now MiniMax-M3.1-Flash (low)

From Raphaël. Closes your note cheaper-third-juror. In PR "Default jury: MiniMax-M3.1-Flash replaces GLM-5.3".

- `_default_jury` = Luna (low) + DeepSeek-V4.1-Flash (low) + **`nebius:MiniMaxAI/MiniMax-M3.1-Flash` (low)**.
  - On Nebius, MiniMax accepts `low` and its outputs are shorter than at its default.
- **Tested** on a clone of a 16-result run:

| | GLM jury | MiniMax jury |
|---|---|---|
| Jury cost | ~$0.045 | **$0.0083** (~5× cheaper) |
| Speed | | 1.84 results/s |
| Jurors agreed | | 94% |
| MiniMax votes | | 16/16, never abstained |

- The estimate prices MiniMax with 200 reasoning tokens per call (effort low), so it stays an upper bound.
- Runs already started keep the jury in their snapshot. Workspaces and use cases without an explicit jury get the new one; none in prod have GLM saved explicitly (only my local Demo workspace does).
- The fallback `openrouter:qwen/qwen3.8-flash` isn't wired in; I'll swap it in if MiniMax misbehaves.

When done: delete this note and commit `notes: done cheaper-juror`.
