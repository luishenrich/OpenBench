# BIY judge-round demo script (2–3 min, no slides)

Deck for the final: https://claude.ai/artifact/8ZvtknjtNsukP5N4FGGxKR (private until shared from its Share menu).

## Pre-flight (before each judge table)

- **Check first: `/mcp__biy__scan_repo` shows up in Claude Code (CLI).** Connect with OAuth: `claude mcp add --transport http biy https://biy.studypdf.net/mcp`, then `/mcp` → biy → Authenticate (browser consent page). No key on screen. The first use cases appear in the dashboard within ~1 min; filling all of them in takes minutes, so switch to a finished run.
- Laptop with three things open:
  1. **Claude Code in the demo repo**, BIY connected via OAuth (Connections page shows it under "Connected apps").
  2. **Dashboard tab**, logged in, on Use cases (sidebar: studypdf, gpt-researcher, graphiti).
  3. **Dashboard tab** on a **finished run** (below).

### Finished runs to show (Luis's workspace, 2026-10-24)

| Show | Repo · use case | Verdict | Run |
|---|---|---|---|
| **Lead** | graphiti · Entity summaries from episodes | Switch to DeepSeek-V4-Flash: 95% of GPT-6.1 Sol's quality at 1/29 of the cost (jury agreement 96%) | https://biy.studypdf.net/runs/5a64a5ad-08bf-4cde-bb70-6292fdb8efb6 |
| Backup | gpt-researcher · Deep research: clarify-query questions (today o3-mini) | Switch to DeepSeek-V4-Flash: 100% of GPT-6.1 Sol's quality at 1/15 of the cost | https://biy.studypdf.net/runs/5e594ffe-c4dc-498d-b392-bae08f8565b2 |
| Backup | gpt-researcher · Summarize scraped URL (today GPT-5.4) | Switch to Qwen3.8-27B: 98% of today's quality at 1/2 of the cost (jury agreement 98.6%) | https://biy.studypdf.net/runs/f070f4d8-ae06-42c7-8835-34321298c8d4 |
| Honest "keep" | graphiti · Entity extraction from text | Keep today's model (GPT-6 Luna): no open model beats it | https://biy.studypdf.net/runs/5990e180-9097-4833-a96c-2d742a262821 |
- Rehearse on the demo repo *and* a public repo. Don't pre-pick or name use cases. Discovery runs live.

## Script

| Time | Screen | Do | Say |
|---|---|---|---|
| 0:00–0:15 | Dashboard landing | Nothing yet | "Your product calls an LLM in several places, each on a model someone picked once. BIY tells you which open-weight model should do each job, benchmarked on *your* cases." |
| 0:15–0:50 | Claude Code | Show the `claude mcp add … /mcp` line, then type `/mcp__biy__scan_repo` and press Enter | "BIY is an MCP server, so discovery happens where the code is. The agent has never seen this repo. It finds every LLM call, classifies it, proposes metrics and gates from our metric bank, reads today's model from the code and seeds test cases from data in the repo." (Narrate what it does, not what it will find.) |
| 0:50–1:05 | Claude Code | When the use cases and the **cost estimate** appear, read the estimate aloud and say yes | "Nothing runs until somebody confirms the cost. The run tool refuses without it." |
| 1:05–1:35 | Dashboard → Use cases | Refresh. Point at the **"found by agent"** badge. Open one use case | "Each one shows where it's called from, the model today, the gates it must pass and how quality is measured." |
| 1:35–1:50 | Use case page | Drag a border in the **"What matters for this job"** bar (quality / speed / cost) | "This is the trade-off. A chat reply cares about speed, a nightly batch about cost. The ranking uses these weights." Click Discard or Save. |
| 1:50–2:10 | Finished-run tab | **Verdict card**: read the headline and the figures (quality vs today, × cheaper per call, p95 latency vs today, $ saved per month) | "That run takes minutes, so here's one that finished earlier. It's a recommendation you can defend." |
| 2:10–2:25 | Same page | **Pareto chart** ("Quality against cost") | "Cost per successful call on a log scale. Coral squares are the Pareto front: nobody is both better and cheaper. Today's model is on here too." |
| 2:25–2:40 | Same page | **Leaderboard** | "Quality with 95% confidence intervals over cases × 3 repeats, p95 latency, cost per call, errors. Gates first: a model that fails one isn't ranked." If the card says "statistical tie", point at it. |
| 2:40–2:55 | Same page | **Outputs per case**: pick one case, show two models' outputs | "And you can check every single output, plus the judge's reasoning where a judge scored it." |
| 2:55–3:00 | Back to Claude Code or the live run | Glance at progress | "Same thing for your repo, in minutes." |

If discovery is slow or fails, skip to the finished run at 1:05 and say "here's the discovery we ran earlier".

## Likely judge questions

**1. "Why not just use public leaderboards?"**
They rank generic skills on someone else's prompts. They don't test your schema, your inputs or the provider you'd actually call. The same open weights behave differently per provider: Moonshot's K2 Vendor Verifier measured Kimi K2's tool-call schema accuracy between 72% and 100% depending on the provider. We do use a leaderboard, the Artificial Analysis Intelligence Index, but only to pick the 29-model default shortlist out of 135. Your own run decides.

**2. "How do you trust the LLM judge?"**
We use it as little as possible. Extraction, classification and OCR-type tasks use deterministic metrics: schema validity, field accuracy, exact match, CER/WER, bounding boxes. Where a judge is needed, the pairwise judge compares two outputs **in both orders**, and a win counts only when both orders agree. Otherwise it's a tie, which cancels position bias. The judge model is pinned per use case and you can change it (the default is DeepSeek-V4.1-Flash on Nebius). Its reasoning is stored for every score, so you can audit any case in "Outputs per case". Results are means over cases × 3 repeats with 95% bootstrap CIs. When two models' intervals overlap we call it a statistical tie.

**3. "What does it cost to run?"**
You see an estimate before every run, and the run won't start until the cost is confirmed. Rough numbers from our plan, assuming ~2K input and ~1.5K output tokens per call:
- 8 candidates × 50 cases × 3 repeats = 1,200 calls per use case.
- That costs about **$3** with the cheapest shortlist models, **$8** with mid-priced ones, and up to **$46** with the 8 most expensive.
- The judge adds about $5 per demo run with DeepSeek-V4.1-Flash.

A real data point: our first end-to-end test, a 48-call benchmark, ran in about 40 s for **$0.0047**. Compare that with what one wrong model choice costs you every month in production.

Possible follow-ups:
- **"Is my data sent to providers?"** Discovery sends prompt templates, schemas and test data from the repo, never user uploads or secrets.
- **"How do you know a model can do vision or tools?"** We called every model ourselves. Provider listings were wrong in both directions: three Nebius "text-only" models read images, and two OpenRouter "vision" models fail a colour test.
