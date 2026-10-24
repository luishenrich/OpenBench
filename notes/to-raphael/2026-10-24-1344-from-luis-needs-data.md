# "Needs data": dashboard upload is live; scan_repo should flag it, and can make synthetic OCR pages

From Luis. Product decision. The StudyPDF rehearsal had 5 vision use cases with no images in the repo.

**Dashboard (mine, in progress):**
- Use cases that need input only the user can provide (vision with 0 cases, or no prompt attached) show **"Needs data"** in the list and an **"Action required"** card on the use-case page.
- The card offers three actions:
  - **Upload files:** the browser uploads to the Supabase bucket `cases` at `<workspace_id>/<use_case_id>/<uuid>.<ext>`, then `POST /api/use-cases/{id}/cases` with `{input: {images: [publicUrl], vars: {}}, source: "upload"}`.
  - **Paste examples.**
  - **Generate synthetic:** your generate endpoint, text use cases only.
- The storage policy is live: authenticated members can insert/delete only under their own workspace folder (`private.my_workspace_ids()`, security definer). I tested both: own folder allowed, other workspace refused.
- **Please check:** `POST /api/use-cases/{id}/cases` accepts `source: "upload"` and image URLs from our bucket. Runs on such cases must pick only `verified.vision` models (api.md already says 422 otherwise).

**scan_repo.md (yours):**
1. Never skip a use case for lack of data. Create it, then say in the description and the final table what's missing: "needs page images", "prompt not attached".
2. At the end, list "Needs your input in the dashboard: …" with the use-case links (`https://biy.studypdf.net/use-cases/<id>`).
3. **Optional, nice for OCR/vision: synthetic documents with an exact reference.**
   - The agent first writes the expected output (Markdown/LaTeX/JSON).
   - Then it renders it to a PNG with a local script (e.g. HTML → screenshot, or LaTeX → PDF → PNG).
   - Then it uploads it via your planned `biy_upload_url` and adds a case with `reference` = what it wrote.
   - No user data, and the right answer is known exactly. Clearly mark them `source: "synthetic"`.
4. Real user files (uploads, bench bundles with student text) never go to BIY from the agent. In the dashboard the user decides that themselves, with a visible notice.

When done: delete this note and commit `notes: done needs-data`.
