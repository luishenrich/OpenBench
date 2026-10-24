"""Write the self-contained research summary from the live bank."""

from __future__ import annotations

import html
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from metric_bank.build import build_bank  # noqa: E402
from metric_bank.selector import EXAMPLES, select  # noqa: E402

OUT = ROOT / "research" / "metric-bank-summary.html"


def esc(value: object) -> str:
    return html.escape(str(value), quote=True)


def rows(items: list[list[object]]) -> str:
    body = []
    for item in items:
        cells = "".join(f"<td>{esc(cell)}</td>" for cell in item)
        body.append(f"<tr>{cells}</tr>")
    return "\n".join(body)


def build() -> str:
    bank = build_bank()
    metrics = bank["metrics"]
    categories = bank["categories"]
    by_category = Counter(item["category"] for item in metrics)
    by_priority = Counter(item["selector_priority"] for item in metrics)
    names = {item["id"]: item["name"] for item in categories}
    notes = {item["id"]: item["selector_notes"] for item in categories}
    core = sum(1 for item in metrics if item["selector_priority"] == "core")
    catalog = sum(1 for item in metrics if item["catalog_match"])
    count = len(metrics)
    category_count = len(categories)

    category_table = rows(
        [
            [
                item["id"],
                item["name"],
                by_category[item["id"]],
                sum(1 for metric in metrics if metric["category"] == item["id"] and metric["selector_priority"] == "core"),
                item["selector_notes"],
            ]
            for item in categories
        ]
    )
    index_table = rows(
        [
            [metric["category"], metric["id"], metric["name"], metric["selector_priority"], metric["utility_axis"], metric["runtime_status"], metric["layer"]]
            for metric in metrics
        ]
    )
    prior_table = rows(
        [[item["name"], item["kind"], item["useful_as"], item["do_not_use_as"], item["citation"]] for item in bank["priors"]]
    )
    avoid = [metric for metric in metrics if metric["selector_priority"] == "avoid_as_primary"]
    avoid_table = rows(
        [[metric["id"], metric["name"], metric["when_not_to_use"][0]] for metric in avoid]
    )

    cards = []
    for example in EXAMPLES:
        card = select(example, bank)
        speed = card["speed"]["ranking"] or "none"
        extra_speed = ", ".join(card["speed"]["also_report"]) or "—"
        quality = ", ".join(card["quality"])
        alternate = ", ".join(card["quality_alternates"]) or "—"
        risk = ", ".join(f"{item['id']} {item['threshold']}" for item in card["risk_gates"]) or "—"
        task = ", ".join(f"{item['id']} {item['threshold']}" for item in card["task_gates"]) or "—"
        always = ", ".join(card["always_on"]) or "—"
        extra = ", ".join(card["reliability_extra"] + card["also_report"]) or "—"
        points = "".join(f"<li>{esc(point)}</li>" for point in card["teaching_points"])
        cards.append(
            f"""
            <article class="card">
              <h3>{esc(card['title'])}</h3>
              <p class="meta">{esc(card['kind'])} · {esc(card['industry'])}</p>
              <p>{esc(card['narrative'])}</p>
              <table>
                <tr><th>Always on</th><td>{esc(always)}</td></tr>
                <tr><th>Quality</th><td>{esc(quality)}</td></tr>
                <tr><th>First left out</th><td>{esc(alternate)}</td></tr>
                <tr><th>Speed</th><td>{esc(speed)}</td></tr>
                <tr><th>Also timed</th><td>{esc(extra_speed)}</td></tr>
                <tr><th>Risk gates</th><td>{esc(risk)}</td></tr>
                <tr><th>Task gates</th><td>{esc(task)}</td></tr>
                <tr><th>Reported, not averaged</th><td>{esc(extra)}</td></tr>
              </table>
              <ul>{points}</ul>
            </article>
            """
        )

    priority_bits = ", ".join(f"{count_} {name}" for name, count_ in sorted(by_priority.items()))
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>BIY metric bank — research summary</title>
<style>
  :root {{
    --ink: #1c1917;
    --muted: #57534e;
    --line: #e7e5e4;
    --paper: #fafaf9;
    --card: #ffffff;
    --accent: #1f4b3a;
    --accent-soft: #e7f0eb;
  }}
  * {{ box-sizing: border-box; }}
  body {{
    margin: 0;
    background: var(--paper);
    color: var(--ink);
    font: 17px/1.55 Georgia, "Iowan Old Style", "Palatino Linotype", serif;
  }}
  header, main {{ max-width: 920px; margin: 0 auto; padding: 32px 20px; }}
  header {{ padding-bottom: 0; }}
  h1 {{ font-size: 2rem; line-height: 1.2; margin: 0 0 8px; letter-spacing: -0.02em; }}
  h2 {{ font-size: 1.35rem; margin: 2.2rem 0 0.6rem; letter-spacing: -0.01em; }}
  h3 {{ font-size: 1.05rem; margin: 0 0 0.2rem; }}
  p {{ margin: 0.6rem 0; }}
  a {{ color: var(--accent); }}
  .lede {{ font-size: 1.15rem; color: var(--ink); }}
  .muted {{ color: var(--muted); }}
  .statrow {{ display: flex; flex-wrap: wrap; gap: 10px; margin: 18px 0; }}
  .stat {{
    background: var(--accent-soft);
    color: var(--accent);
    border-radius: 8px;
    padding: 10px 14px;
    min-width: 140px;
  }}
  .stat b {{ display: block; font-size: 1.4rem; font-family: ui-sans-serif, system-ui, sans-serif; }}
  .stat span {{ font-family: ui-sans-serif, system-ui, sans-serif; font-size: 0.78rem; letter-spacing: 0.02em; }}
  nav {{ font-family: ui-sans-serif, system-ui, sans-serif; font-size: 0.92rem; }}
  nav a {{ margin-right: 12px; text-decoration: none; }}
  table {{
    width: 100%;
    border-collapse: collapse;
    background: var(--card);
    font-family: ui-sans-serif, system-ui, sans-serif;
    font-size: 0.86rem;
    line-height: 1.4;
    margin: 12px 0 18px;
  }}
  th, td {{ border-bottom: 1px solid var(--line); text-align: left; vertical-align: top; padding: 7px 8px; }}
  th {{ font-weight: 650; color: var(--muted); }}
  code, .mono {{ font-family: ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace; font-size: 0.86em; }}
  .card {{
    background: var(--card);
    border: 1px solid var(--line);
    border-radius: 10px;
    padding: 14px 16px 6px;
    margin: 14px 0;
  }}
  .meta {{ color: var(--muted); font-family: ui-sans-serif, system-ui, sans-serif; font-size: 0.82rem; margin-top: 0; }}
  ul {{ padding-left: 1.2rem; }}
  li {{ margin: 0.25rem 0; }}
  footer {{ max-width: 920px; margin: 0 auto; padding: 8px 20px 40px; color: var(--muted); font-size: 0.9rem; }}
</style>
</head>
<body>
<header>
  <p class="muted">Benchmark It Yourself · metric bank {esc(bank['bank_version'])} · {esc(bank['updated'])}</p>
  <h1>A metric bank for client-specific LLM benchmarks</h1>
  <p class="lede">Companies do not need another copy of MMLU. They need a small scorecard, chosen from a library, that measures the task they actually run. This note is the research decision behind that library, and a map of what is in it.</p>
  <div class="statrow">
    <div class="stat"><b>{count}</b><span>metrics</span></div>
    <div class="stat"><b>{category_count}</b><span>categories</span></div>
    <div class="stat"><b>{core}</b><span>core rows</span></div>
    <div class="stat"><b>{catalog}</b><span>catalogue ids kept</span></div>
    <div class="stat"><b>{len(bank['priors'])}</b><span>priors, not rows</span></div>
  </div>
  <nav>
    <a href="#decision">Decision</a>
    <a href="#studied">What was studied</a>
    <a href="#inventory">Inventory</a>
    <a href="#scorecard">Scorecards</a>
    <a href="#scoring">Scoring</a>
    <a href="#sources">Sources</a>
  </nav>
</header>
<main>
  <h2 id="decision">How many metrics are warranted</h2>
  <p>{esc(bank['design_notes'])}</p>
  <p>{count} metrics sit in {category_count} categories ({priority_bits}). Core rows are the ones a selector should consider first when the brief matches. The avoid-as-primary rows exist so BLEU, ROUGE-L, BERTScore, summary fluency, and embedding cosine can be refused as the quality score. The remaining rows are supporting measurements or diagnostics.</p>
  <p>A row earned a place when three things were true. A client can compute it on their own cases. Two teams would otherwise implement it under different names. And the number can change a ship decision: quality, a hard gate, speed, cost, or a business outcome. A public exam fails the first test. An alias fails the second. A vanity score fails the third.</p>
  <p>The existing product catalogue, in <span class="mono">docs/metrics-catalog.md</span>, already fixed forty ids. Every one of those ids is in this bank with the same spelling, so a later <span class="mono">biy_metrics_list</span> can serve this file without a rename. This folder does not edit that catalogue. The bank is the superset.</p>
  <p>A client scorecard is not the bank. It is a few operational metrics, one speed metric chosen from the kind, one to five quality metrics, and zero to five risk gates. The reference selector in <span class="mono">src/metric_bank/selector.py</span> applies that budget, and by default it keeps only rows the runtime can compute. Planned rows stay in the bank. A brief sets include_planned to opt in. The five clients further down are the default cards.</p>

  <h2 id="studied">What was studied, and what was left out</h2>
  <p>HELM is the argument for the shape of the bank. Liang and colleagues scored accuracy together with calibration, robustness, fairness, toxicity, and efficiency, and they warned against a win rate that depends on who else was in the set. That is why quality here is an absolute 0–1 mean, not a rank against the other candidates, and why speed and cost stay on their own axes.</p>
  <p>MMLU, MMLU-Pro, BIG-bench, BBH, GSM8K, MATH, and GPQA measure stored knowledge or textbook reasoning. They are useful as a prior that a model family has a skill. They are useless as the score for a claims extractor or a support bot, because the client's wrong answers are different. The scoring idea that does transfer — final-answer equivalence for math, atomic-fact precision for long biographies, attempted-versus-correct for short factoid questions — is in the bank as <span class="mono">math_equivalence</span>, <span class="mono">factscore</span>, and <span class="mono">short_form_factuality</span>.</p>
  <p>Ragas, DeepEval, and the TruLens RAG triad name the same grounding constructs more than once. Faithfulness, answer relevancy, context precision, and context recall each have one row. The other library's name is an alias. Summary consistency is an alias of faithfulness, not a second quality term. Where a claim-level ratio and an NLI classifier estimate the same thing, the claim-level ratio is primary and the classifier (<span class="mono">groundedness_nli</span>) is the cheaper alternate.</p>
  <p>IFEval contributes the instruction metrics: a prompt passes strictly when every verifiable constraint passes on the raw output. The client's constraints replace the public constraint list, which frontier models have saturated. BFCL contributes tool-call AST match, tool choice, and irrelevance. τ-bench contributes task success in a sandbox and pass^k, the probability that all k trials succeed. SWE-bench contributes patch resolution when the client has a repository and tests. Those are rows. The leaderboards themselves are priors.</p>
  <p>OpenAI Evals contributes the small deterministic assertions: exact match, contains, and a pattern. LMSYS Arena and AlpacaEval contribute pairwise comparison against a fixed baseline, both orders, and a warning that uncorrected win rates follow length. The length-controlled win rate is in the bank as a diagnostic, not as the quality score. Artificial Analysis contributes the operational vocabulary — time to first token, output tokens per second, price — and is explicit that an intelligence index is not the client's quality.</p>
  <p>Safety and bias are gates and diagnostics, not quality-average terms. BBQ's ambiguous-context score is signed and best at zero, so it cannot enter a higher-better average. RealToxicityPrompts, XSTest, and HarmBench justify measuring toxicity, over-refusal, and harmful compliance on a reviewed set. The bank records how to score those sets. It does not contain attack strings, and the selector is told not to synthesize any in order to produce a number.</p>
  <p>Perplexity is not comparable across tokenizers and is not a task score, so it is not a row. MAUVE compares a distribution of generations to a reference distribution; a client with a few dozen cases cannot estimate it, and it does not say whether the answer was supported. Speech, image aesthetics, and caption preference are out of scope. Document vision is in scope: when the model reads a page, character error, word error, and box overlap are things the client can compute from a transcription and a set of rectangles. Arena Elo was left out because it moves when the field of opponents moves.</p>

  <h2>How a row is shaped</h2>
  <p>Every metric carries an id, a name, a category, a description, what it measures, when to use it, when not to, the inputs it requires, a computation method and formula, a score range with an interpretation, a cost, known limitations, related metrics, and tags. Around that, the selector needs a few controls the prose fields cannot express.</p>
  <ul>
    <li><span class="mono">utility_axis</span> is quality, speed, cost, gate_only, or none. Only quality enters Q, and only when the stored score is higher-better on 0–1.</li>
    <li><span class="mono">quality_transform</span> is identity for those quality rows and not_a_quality_input otherwise. Nothing in this bank asks the runner to subtract a risk rate from 1 and then average it.</li>
    <li><span class="mono">group_role</span> separates a primary measurement from its alternate, its gate form, a diagnostic, and a judging method. Hallucination rate is the gate form of grounding. Faithfulness is the primary.</li>
    <li><span class="mono">selector_priority</span> is core, supporting, diagnostic, or avoid_as_primary.</li>
    <li><span class="mono">runtime_status</span> is implemented, judge, runner_measured, or planned. The default selector proposes the first three. score() computes implemented ids only and raises on the others.</li>
    <li>Inputs are a closed vocabulary: references, labels, retrieved context, human raters, an LLM judge, logs, prices, a schema, a tool trace, and the rest of the list in the schema. If the client cannot supply the input, the metric is not eligible.</li>
  </ul>
  <p>The schema is <span class="mono">schema/metric-bank.schema.json</span> (JSON Schema draft 2020-12, additional properties forbidden). <span class="mono">validate.py</span> checks the data file against that schema, against <span class="mono">build_bank()</span>, and against the catalogue ids.</p>

  <h2 id="inventory">Inventory</h2>
  <p>Category notes are instructions to the selector, not marketing copy.</p>
  <table>
    <thead><tr><th>Id</th><th>Category</th><th>Rows</th><th>Core</th><th>Selector note</th></tr></thead>
    <tbody>
      {category_table}
    </tbody>
  </table>
  <p class="muted">Names in the source: {esc(', '.join(names[item['id']] for item in categories))}.</p>

  <h3>Refused as a primary quality score</h3>
  <table>
    <thead><tr><th>Id</th><th>Name</th><th>Why it is not the quality score</th></tr></thead>
    <tbody>{avoid_table}</tbody>
  </table>

  <h3>Full index</h3>
  <p class="muted">Sorted by category, then id. Priority and axis are what the selector filters on. The description, formula, and limitations stay in the JSON, where an LLM can read the whole row.</p>
  <table>
    <thead><tr><th>Category</th><th>Id</th><th>Name</th><th>Priority</th><th>Axis</th><th>Runtime</th><th>Layer</th></tr></thead>
    <tbody>{index_table}</tbody>
  </table>

  <h2 id="scorecard">Five scorecards</h2>
  <p>The default card keeps the operational metrics the runner records: cost per case, cost per success, and output tokens per case, plus time to first token or end-to-end latency when someone is waiting. Error rate, truncation, and throttle stay planned. Cost per success is the cost used for ranking. If a kind has no implemented quality metric, the quality slot is rubric_score.</p>
  <p>Selection rules, the signal table, and a prompt for the app's model are in <span class="mono">selection/GUIDE.md</span>. The cards below are the reference selector, not a hand-edited illustration, so they stay aligned with the guide and the tests.</p>
  {''.join(cards)}

  <h2 id="scoring">How this lines up with BIY scoring</h2>
  <p>The product ranks in three steps: gates, then the Pareto front, then utility. Gates disqualify. A schema failure, an error rate above the kind's ceiling, a confirmed privacy leak, or a latency ceiling the client named are gates. A preference is not.</p>
  <p>Quality Q is the weighted mean of the scorecard's quality metrics. Each one is already on 0–1, higher better. Q is not rescaled against the other candidates in the run. A model that scores 0.9 is a 0.9 even if every candidate is excellent.</p>
  <p>Speed S and cost C use the log target from the architecture. At or under the target the score is 1. At or over the maximum it is 0. Between them it is 1 minus log(x / target) divided by log(max / target). Speed uses a metric the runner records: time to first token for chat, end-to-end for a sync call, and nothing for a batch. Agent task wall time is planned, so the default agent card ranks on end-to-end latency. Cost uses dollars per successful case. Utility is the weighted geometric mean of Q, S, and C. A zero on a weighted axis sinks the candidate.</p>
  <p>The judge, when one is used, is pinned, from a different family than the candidates, and pairwise runs are judged in both orders. The bank's judging category is an instrument. Rubric score, G-Eval, and pairwise against a baseline compete for a single slot. They do not stack on top of a named metric for the same construct.</p>
  <p>Illustrative formulas — token F1, classification F1, faithfulness from claim verdicts, the cost identity, expected calibration error, unbiased pass@k and pass^k, ROUGE-L, and the log target — live in <span class="mono">src/metric_bank/illustrative.py</span> and are exercised in the notebook. They do not call a model.</p>

  <h2 id="sources">Priors and sources</h2>
  <p>These are the public artifacts the inventory was checked against. Each one says what it is allowed to influence, and what it must not be used as.</p>
  <table>
    <thead><tr><th>Source</th><th>Kind</th><th>Use it as</th><th>Do not use it as</th><th>Citation</th></tr></thead>
    <tbody>{prior_table}</tbody>
  </table>
  <p>Within the repo, the constraints this bank respects are the metric catalogue, the scoring section of the architecture note, and the research brief on metrics. Those files are the product's. This summary does not replace them.</p>
</main>
<footer>
  Generated from the metric bank so the counts cannot drift. {count} metrics, {category_count} categories. Selector notes for the first category, accuracy: {esc(notes['accuracy'])}
</footer>
</body>
</html>
"""


def main() -> None:
    OUT.write_text(build(), encoding="utf-8")
    print(f"wrote {OUT}")


if __name__ == "__main__":
    main()
