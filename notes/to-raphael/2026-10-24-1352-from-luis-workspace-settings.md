# Workspace settings that use cases inherit: `PATCH /api/workspace`

From Luis. **Wanted before the demo if you can (~15–20 min), otherwise right after.** A real `project` entity (one per repo) comes after the demo; for now workspace = project.

**Why:** StudyPDF has 27–45 use cases. Changing weights, references or the jury on each one by hand doesn't scale. Use cases should inherit and override only what differs.

**Inheritance (already half there):** use case field → workspace default → built-in default. `profile = null` and `judge = null` already mean "workspace default". Please make the rest work the same way.

**Contract, proposal (rename freely, just tell me):**
```python
class CandidatePool(BaseModel):
    shortlist_only: bool = True
    exclude_providers: list[Provider] = []
    max_output_usd_per_1m: float | None = None

class Workspace(BaseModel):          # existing + new defaults
    id: UUID; name: str
    default_profile: Profile
    default_judge: JudgeConfig
    default_references: list[ModelRef] = [Sol@medium, Luna@medium]   # new
    candidate_pool: CandidatePool = CandidatePool()                  # new
    default_repeats: int = 3                                         # new
    max_run_cost_usd: float | None = None                            # new: estimate above this → warn/refuse

class WorkspacePatch(BaseModel):     # any subset
    name: str | None = None
    default_profile: Profile | None = None
    default_judge: JudgeConfig | None = None
    default_references: list[ModelRef] | None = None
    candidate_pool: CandidatePool | None = None
    default_repeats: int | None = None
    max_run_cost_usd: float | None = None
```
- `PATCH /api/workspace` with `WorkspacePatch` → `Workspace`; `GET /api/me` keeps returning `workspace`.
- **Run start / estimate apply the inheritance:**
  - `RunIn.references` omitted → `default_references`;
  - `repeats` omitted → `default_repeats`;
  - candidates omitted → auto-pick within `candidate_pool`;
  - the profile and judge already fall back to the workspace.
- A use case already shows `profile = null` / `judge = null` when inheriting. To **reset** a use case to the workspace value, `PATCH` with `{"profile": null}` must actually clear the field, not mean "not sent". Pydantic `model_fields_set` can tell the two apart.
- MCP: `biy_workspace_get` returns these too, so the scan agent uses the company defaults.

**Frontend (mine, in progress):**
- A Settings page (weights, targets, references, jury, candidate pool, repeats, cost cap).
- On each use case: "Inherited from workspace" / "Custom · Reset" for weights, judge and references.
- Until your endpoint exists, Save on the settings page shows "Saving workspace settings needs the backend update", and the inheritance badges still work for profile/judge.

When done: delete this note and commit `notes: done workspace-settings`.
