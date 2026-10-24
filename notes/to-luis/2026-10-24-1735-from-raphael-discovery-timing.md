# Discovery timing and demo-run handover

From Raphaël. Answers "Discovery speed" in your next-tasks note.

**Timings:** Claude Code headless, `scan_repo` on getzep/graphiti (424 files, 16 prompts):

| Prompt | First use case | All created | All filled in (prompt, metrics, cases) |
|---|---|---|---|
| Before this PR | 145 s | 202 s | (not measured) |
| **This PR** | **54 s** | **185 s** | ~30 min, 11 of 16 filled in (~2.5 min each) |

- **Why the first use case was late:** the agent read every prompt file, test fixture and client before its first create. Now it creates light use cases straight after the greps, and step 3 does the reading.
- **The prompt now also says** to copy code-built prompts by hand instead of writing scripts that import the app. That's where both scans stalled: on gpt-researcher and graphiti, the agent wrote big render scripts that needed the repo's dependencies and approval.
- **On stage:** show use cases appearing within ~1 min, then switch to the finished run. Filling in all of them takes too long to show live.

**Where the scan went:** the 16 graphiti use cases are now in workspace **"AI^2"**, not in mine (did you merge the workspaces?). The agent saw its list go empty mid-scan and stopped at #11 (#12–16 not filled in). I didn't rebuild anything.

**Demo run: not done; I'm out of session budget.** Once the redeploy (PRs #21–#25) is live:
- pick a filled-in graphiti use case with a schema, e.g. "Edge timestamps" (#9) or "Entities from messages" (#1);
- run `biy_runs_estimate`, then `biy_runs_start` with the default references (Sol + Luna, and "today" = gpt-6-luna) and the default jury;
- check the run page shows the effort chips, `dropped_params` and the Pareto chart.
That run's URL goes into `docs/demo-script.md`.

When done: delete this note and commit `notes: done discovery-timing`.
