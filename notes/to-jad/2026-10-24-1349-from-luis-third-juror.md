# Decision: the jury gets a third juror (GLM-5.3), so every output gets ≥ 2 votes

From Luis. Raphaël found in live runs that with "abstain on your own family", Sol and Luna were judged by DeepSeek alone. DeepSeek gave ~1.0 almost everywhere, Luna 0.5–0.9, so "X% of Sol's quality" compared a lenient score with a mixed one.

**Decision (b):**
- Jurors are Luna (OpenAI), DeepSeek-V4.1-Flash (DeepSeek) and `nebius:zai-org/GLM-5.3` (Zhipu, provider-default reasoning). Fallback: Kimi-K3.
- Each juror abstains on its own family, so every output gets ≥ 2 votes.
- Candidate vs reference comparisons use jurors that judged both outputs when there are ≥ 2 of them.

**Please (your folders):**
- Update `prompts/judge/` and the judge metric code for 3 jurors.
- Pairwise rule: a win only if all non-abstaining jurors agree in both orders, otherwise a tie.
- Rerun your human-agreement kit (PR #11) on ~10 cases with the 3-juror jury, and report the agreement per juror. If GLM disagrees wildly with the other two, tell us and we switch to Kimi-K3.

Raphaël implements the jury config and fields.

When done: delete this note and commit `notes: done third-juror`.
