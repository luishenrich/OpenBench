# BIY — speaker notes (about 2 minutes)

Six slides. Arrow keys move. This deck is Jad’s, in `pitch/`, so it does not replace the pitch slides the plan assigns to Luis. The metric slide is the one Jad owns.

The StudyPDF card is the verdict screenshot from that run (`pitch/verdict.png`). Figures on the slide are the ones on that card.

## 0:00 — Models get picked by vibes (20s)

Your product calls an LLM in several places. Each one is on a model someone picked once, usually from a leaderboard. Those boards score someone else’s prompts. There are more than 15 families, and each is served by 5 to 25 providers. The same weights do not even behave the same: Kimi K2’s tool-call accuracy ran from 72% to 100% depending on the provider. Meanwhile the closed model you started with keeps the bill, because building your own eval feels like a second product.

## 0:20 — One command (25s)

BIY is one MCP command in the coding agent: `scan_repo`. The agent has not been told the file names. It finds every LLM call, classifies the job, picks metrics and gates from the bank, and builds test cases from the repo. Nothing runs until a person reads the cost and confirms it.

## 0:45 — How a run is scored (25s)

The bank has 159 metrics. 118 of them are computed on a run: deterministic scores, the judge, and what the runner measures. Open-ended answers go to a jury from three families. A judge abstains on its own family. Pairwise comparison is run in both orders, and a win counts only when they agree. Otherwise it is a tie. You get a mean and a 95% interval. Overlapping intervals are a statistical tie. Gates disqualify. Then Pareto. Then one recommendation. Closed models are the reference line, never the pick. The catalogue is 134 open models we actually called. 29 are the default shortlist.

## 1:10 — StudyPDF (25s)

This card is a real run on StudyPDF, Luis’s product. Verdict: switch to DeepSeek-V4-Flash-0731. Same quality as GPT-6.1 Sol, 100% against 100%, at an eighth of the cost, 8.4 times cheaper per call. It is 11 seconds slower at p95, 16 seconds against 5. It passes every gate. Quality is a statistical tie with MiMo, Kimi-K2.7-Code, Qwen3.8-27B, DeepSeek-V4-Pro, and GLM-5.3, so the trade-off profile ranks them. It costs 3.1 times today’s model, gpt-6-luna. Luis is implementing the suggestions. The same discovery, on the public repo gpt-researcher, found 29 use cases. Nobody named them in advance.

## 1:35 — Why trust the judge (15s)

On 10 rubric cases a person agreed with the judge 8 times. That is 80%. Spearman against the human scores is 0.68. Where both judges scored the same answer, they disagreed, and we flag it. The judge is not the label until a person has looked.

## 1:50 — Close (10s)

Which open model should do each job. On your cases. Luis builds the product and the dashboard. Raphaël builds the backend and MCP. Jad builds the metrics and the judge.
