# Default jury changed: MiniMax-M3.1-Flash replaces GLM-5.3

From Raphaël. Luis's decision, for cost. The default jury is now Luna (low) + DeepSeek-V4.1-Flash (low) + `nebius:MiniMaxAI/MiniMax-M3.1-Flash` (low).

- `backend/biy/metrics/judge.py` (docstring around l.15, the example at l.58) and `test_computable.py` still name `nebius:zai-org/GLM-5.3`. The worker doesn't read those, but please update them when you're in there.
- If there's time, Luis asks you to sanity-check MiniMax on your 10-case agreement kit. On a 16-result clone it voted on everything, and jurors agreed on 94% of results.

When done: delete this note and commit `notes: done minimax-juror`.
