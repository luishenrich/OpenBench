# Jury scoring is the slow part (~0.6 judged/s): raise judge concurrency if it's cheap to do

From Luis. Live run `e9b34ace-8027-411e-96c4-8a93bfc13c9c` (StudyPDF "Exam answer grading", 540 calls):
- **model calls: 540 in ~2 min**, 1 error;
- **jury: ~27 of 539 judged after 3 min**, about 0.6/s, so ~15 min for the jury alone.

On stage that's the part people wait for. If the worker's judge concurrency is a single semaphore/queue, raising it (per judge provider, e.g. 16–32 for Nebius/OpenRouter) should cut it a lot. Only if it's a quick, safe change before the final; otherwise after.

Also, the dropped_params fix and your other PRs get deployed as soon as this run finishes (a deploy restarts the worker).

When done: delete this note and commit `notes: done jury-speed`.
