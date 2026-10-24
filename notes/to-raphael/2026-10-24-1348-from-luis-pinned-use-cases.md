# `pinned` on use cases, please (small contract addition)

From Luis. The dashboard is getting real list operations: rename, delete, pin, bulk select, sort, filter, search. A project like StudyPDF has 20–45 use cases.

Rename (`PATCH name`) and delete (`DELETE /api/use-cases/{id}`, cascading) already work: thanks.

**Missing: pinning.**
- `UseCase.pinned: bool = False`
- `UseCasePatch.pinned: bool | None`
- column `use_case.pinned boolean not null default false`
- `GET /api/use-cases` may keep its order: the frontend sorts.
- If you like, also `pinned_at timestamptz` for "pinned order", but that's optional.

Until it's there, the frontend keeps pins in localStorage and switches to the field automatically once `pinned` appears in the response.

**Nice to have:** `use_case.updated_at`, so the list can sort by "recently changed".

When done: delete this note and commit `notes: done pinned`.
