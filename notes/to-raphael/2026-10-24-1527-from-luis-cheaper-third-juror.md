# Decision: replace GLM-5.3 as the third juror (too expensive), use MiniMax-M3.1-Flash

From Luis. Live run `e9b34ace…`: the jury cost ~$4.1 of $4.56 total. GLM-5.3 at provider-default reasoning spends ~1.7k reasoning tokens per call and is the most expensive juror by far.

**New default jury:** GPT-6 Luna (low) + DeepSeek-V4.1-Flash-1017 (low) + **`nebius:MiniMaxAI/MiniMax-M3.1-Flash`** (AA 43, shortlisted, json_schema verified; reasoning low if it accepts it, else provider default).
- Three families still: OpenAI / DeepSeek / MiniMax. Each abstains on its own family; every output keeps ≥ 2 votes.
- Fallback if MiniMax misbehaves as a judge: `openrouter:qwen/qwen3.8-flash` (AA 40).
- Make sure the estimate uses the new juror's price + realistic reasoning tokens (see the estimate-undercounts-jury note).

Jad: please sanity-check MiniMax on your 10-case agreement kit if there's time; otherwise after the demo.

When done: delete this note and commit `notes: done cheaper-third-juror`.
