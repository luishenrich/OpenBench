"""Human agreement kit for a finished run's judge scores.

Sample about 10 judged rows from a results export and write a review sheet.
After a person fills the human columns in the CSV, score agreement with the judge.

From the repo root:

    PYTHONPATH=backend python3 -m biy.metrics.agreement sheet \\
        --results results.json --cases cases.json \\
        --baseline-key provider:model --use-case "Invoice extract" \\
        --n 10 --seed 0 --out review

    PYTHONPATH=backend python3 -m biy.metrics.agreement score \\
        --sheet review.csv --out summary.md

``--results`` is a ``GET /api/runs/{id}/results`` body (``{"items": [...]}``),
a JSON list of those pages, a JSON list of result objects, or
``{"runs": [{"use_case", "baseline_key", "items", "cases"}]}``.
``--cases`` is optional: a ``GET /api/use-cases/{id}/cases`` list, or
``{"items": [...]}`` / ``{"cases": [...]}``. Without it, input and reference
are empty. If a page still has ``next_cursor``, the export is incomplete
(the route pages at 50). Concatenate every page into one items list first.

Fill ``human_agree`` (yes/no), ``human_score`` (rubric, 0–1),
``human_winner`` (candidate, baseline, or tie), and ``human_note`` in the CSV.
The HTML file is a reading copy with those columns left blank.

Jury columns sit in front of the human columns. They copy each judge's score,
reasoning, and winner, plus who abstained, whether the two judges agreed, and
the pinned reasoning effort. Inter-judge agreement is the share of sheet rows
where both judges voted and agreed. Under 70% is flagged. One abstention is
not a disagreement: the other judge decided alone.

Agreement with the human counts a reviewed row when ``human_agree`` is yes, or
when that cell is blank and the pairwise labels match, or when that cell is
blank and the rubric scores differ by at most 0.10. A note alone is not a
review. Cohen's kappa uses pairwise labels (candidate/baseline/tie). Spearman
uses rubric scores. Rows with a blank human judgment are left out of the rates.
"""

from __future__ import annotations

import argparse
import csv
import html
import json
import math
import random
import sys
from pathlib import Path

SHEET_COLUMNS = (
    "use_case",
    "candidate_key",
    "case_id",
    "repeat_idx",
    "input",
    "reference",
    "candidate_output",
    "baseline_output",
    "judge_mode",
    "judge_score",
    "judge_winner",
    "judge_reasoning",
    "judge_a_id",
    "judge_a_score",
    "judge_a_reasoning",
    "judge_a_winner",
    "judge_b_id",
    "judge_b_score",
    "judge_b_reasoning",
    "judge_b_winner",
    "judge_abstained",
    "inter_judge_agree",
    "reasoning_effort",
    "human_agree",
    "human_score",
    "human_winner",
    "human_note",
)

HUMAN_COLUMNS = ("human_agree", "human_score", "human_winner", "human_note")
_YES = {"yes", "y", "true", "1", "agree"}
_NO = {"no", "n", "false", "0", "disagree"}
_WIN = {"candidate", "win", "a"}
_LOSS = {"baseline", "loss", "b"}
_TIE = {"tie", "draw"}
RUBRIC_TOLERANCE = 0.10
# Luis's note flags low inter-judge agreement and does not set a cutoff.
# 70% is the line used by this kit: below it, the summary says to flag the use case.
LOW_INTER_JUDGE_AGREEMENT = 0.70


def pairwise_label(value: object) -> str | None:
    if value is None:
        return None
    text = str(value).strip().lower()
    if text in _WIN:
        return "candidate"
    if text in _LOSS:
        return "baseline"
    if text in _TIE:
        return "tie"
    return None


def render_value(value: object) -> str:
    if value is None:
        return ""
    if isinstance(value, str):
        return value
    return json.dumps(value, ensure_ascii=False, sort_keys=True, default=str)


def output_text(output: object) -> str:
    if not isinstance(output, dict):
        return render_value(output)
    if output.get("text"):
        return str(output["text"])
    if output.get("json") is not None:
        return render_value(output["json"])
    if output.get("tool_calls"):
        return render_value(output["tool_calls"])
    return render_value(output) if output else ""


def is_judged(item: dict) -> bool:
    judge = item.get("judge")
    if not isinstance(judge, dict):
        return False
    mode = str(judge.get("mode") or "").strip().lower()
    if mode in {"", "skipped", "none", "null"}:
        return False
    if judge.get("score") is None and pairwise_label(judge.get("winner")) is None:
        return False
    return True


def verdict_bucket(judge: dict) -> str:
    """win/tie/loss for pairwise, low/high for a rubric score split at 0.5."""
    label = pairwise_label(judge.get("winner"))
    mode = str(judge.get("mode") or "").strip().lower()
    if label is not None and "rubric" not in mode:
        return {"candidate": "win", "baseline": "loss", "tie": "tie"}[label]
    if "pairwise" in mode:
        score = _float_or_none(judge.get("score"))
        if score is None:
            return "unknown"
        if score >= 0.75:
            return "win"
        if score <= 0.25:
            return "loss"
        return "tie"
    score = _float_or_none(judge.get("score"))
    if score is None:
        return "unknown"
    return "low" if score < 0.5 else "high"


def _float_or_none(value: object) -> float | None:
    if value is None or value == "":
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _items_of(payload: object) -> list[dict]:
    if isinstance(payload, list):
        items: list[dict] = []
        for entry in payload:
            if isinstance(entry, dict) and "items" in entry and "candidate_key" not in entry:
                items.extend(_items_of(entry))
            elif isinstance(entry, dict):
                items.append(entry)
        return items
    if isinstance(payload, dict):
        if "items" in payload:
            return [row for row in payload["items"] if isinstance(row, dict)]
        if "results" in payload:
            return _items_of(payload["results"])
        if "candidate_key" in payload or "judge" in payload:
            return [payload]
    raise ValueError("results JSON must be a results page, a list of pages, or a list of result objects")


def index_cases(payload: object | None) -> dict[str, dict]:
    if payload is None:
        return {}
    if isinstance(payload, dict) and "items" in payload:
        seq = payload["items"]
    elif isinstance(payload, dict) and "cases" in payload:
        seq = payload["cases"]
    elif isinstance(payload, list):
        seq = payload
    else:
        raise ValueError("cases JSON must be a list of cases or an object with items/cases")
    indexed: dict[str, dict] = {}
    for case in seq:
        if isinstance(case, dict) and case.get("id") is not None:
            indexed[str(case["id"])] = case
    return indexed


def prepare_records(
    payload: object,
    cases_payload: object | None = None,
    *,
    use_case: str | None = None,
    baseline_key: str | None = None,
) -> tuple[list[dict], list[str]]:
    """Flatten a results export and attach use-case / baseline metadata."""
    if isinstance(payload, dict) and "runs" in payload and "items" not in payload:
        rows: list[dict] = []
        warnings: list[str] = []
        for run in payload["runs"]:
            if not isinstance(run, dict):
                continue
            part, part_warnings = prepare_records(
                run,
                run.get("cases", cases_payload),
                use_case=use_case or run.get("use_case"),
                baseline_key=baseline_key or run.get("baseline_key"),
            )
            rows.extend(part)
            warnings.extend(part_warnings)
        return rows, warnings

    warnings = []
    if isinstance(payload, dict) and payload.get("next_cursor"):
        warnings.append("results page has next_cursor; concatenate every page before sampling")
    if isinstance(payload, list):
        for entry in payload:
            if isinstance(entry, dict) and entry.get("next_cursor"):
                warnings.append("results page has next_cursor; concatenate every page before sampling")
                break

    page_use = use_case or (payload.get("use_case") if isinstance(payload, dict) else None)
    page_base = baseline_key or (payload.get("baseline_key") if isinstance(payload, dict) else None)
    cases = index_cases(cases_payload if cases_payload is not None else (payload.get("cases") if isinstance(payload, dict) else None))
    rows = []
    for item in _items_of(payload):
        row = dict(item)
        if page_use and not row.get("use_case"):
            row["use_case"] = page_use
        case = cases.get(str(row.get("case_id")))
        if case is not None:
            row["_case"] = case
            if not row.get("use_case") and case.get("use_case"):
                row["use_case"] = case["use_case"]
        if page_base:
            row["_baseline_key"] = page_base
        rows.append(row)
    return rows, warnings


def _baseline_key_for(records: list[dict], baseline_key: str | None) -> str | None:
    if baseline_key:
        return baseline_key
    tagged = {r.get("_baseline_key") for r in records if r.get("_baseline_key")}
    if len(tagged) == 1:
        return next(iter(tagged))
    flagged = {r.get("candidate_key") for r in records if r.get("is_baseline") is True and r.get("candidate_key")}
    if len(flagged) == 1:
        return next(iter(flagged))
    return None


def _is_baseline_row(row: dict, baseline_key: str | None) -> bool:
    if row.get("is_baseline") is True:
        return True
    key = baseline_key or row.get("_baseline_key")
    return bool(key) and row.get("candidate_key") == key


def baseline_outputs(records: list[dict], baseline_key: str | None) -> dict[tuple[str, int], object]:
    found: dict[tuple[str, int], object] = {}
    for row in records:
        if not _is_baseline_row(row, baseline_key):
            continue
        try:
            repeat = int(row.get("repeat_idx") or 0)
        except (TypeError, ValueError):
            repeat = 0
        found[(str(row.get("case_id")), repeat)] = row.get("output")
    return found


def sample_judged(records: list[dict], *, n: int = 10, seed: int = 0, baseline_key: str | None = None) -> list[dict]:
    """Round-robin across (use case, candidate, verdict) until ``n`` rows or the pool ends."""
    key = _baseline_key_for(records, baseline_key)
    eligible = [row for row in records if is_judged(row) and not _is_baseline_row(row, key)]
    groups: dict[tuple[str, str, str], list[dict]] = {}
    for row in eligible:
        stratum = (
            str(row.get("use_case") or ""),
            str(row.get("candidate_key") or ""),
            verdict_bucket(row["judge"]),
        )
        groups.setdefault(stratum, []).append(row)
    rng = random.Random(seed)
    for stratum_rows in groups.values():
        rng.shuffle(stratum_rows)
    picked: list[dict] = []
    keys = sorted(groups)
    while len(picked) < n and any(groups[name] for name in keys):
        for name in keys:
            if groups[name] and len(picked) < n:
                picked.append(groups[name].pop())
    return picked


def _panel_cell(row: object, key: str) -> str:
    if not isinstance(row, dict) or row.get(key) is None:
        return ""
    value = row.get(key)
    if isinstance(value, float):
        return format(value, "g")
    return str(value)


def jury_fields(judge: dict) -> dict:
    """Per-judge columns. Missing panel fields stay blank so old exports still score."""
    panel = judge.get("judges") if isinstance(judge.get("judges"), list) else []
    first = panel[0] if panel else {}
    second = panel[1] if len(panel) > 1 else {}
    abstained = judge.get("abstained")
    if isinstance(abstained, list):
        abstained_text = ",".join(str(item) for item in abstained)
    else:
        abstained_text = ""
    agreement = judge.get("agreement")
    if agreement is None:
        agree = ""
    else:
        agree = "yes" if float(agreement) >= 1 else "no"
    effort = judge.get("reasoning_effort")
    return {
        "judge_a_id": _panel_cell(first, "id"),
        "judge_a_score": _panel_cell(first, "score"),
        "judge_a_reasoning": _panel_cell(first, "reasoning"),
        "judge_a_winner": _panel_cell(first, "winner"),
        "judge_b_id": _panel_cell(second, "id"),
        "judge_b_score": _panel_cell(second, "score"),
        "judge_b_reasoning": _panel_cell(second, "reasoning"),
        "judge_b_winner": _panel_cell(second, "winner"),
        "judge_abstained": abstained_text,
        "inter_judge_agree": agree,
        "reasoning_effort": "" if not effort else render_value(effort),
    }


def sheet_rows(
    records: list[dict],
    *,
    n: int = 10,
    seed: int = 0,
    baseline_key: str | None = None,
) -> list[dict]:
    key = _baseline_key_for(records, baseline_key)
    bases = baseline_outputs(records, key)
    rows = []
    for record in sample_judged(records, n=n, seed=seed, baseline_key=key):
        case = record.get("_case") or {}
        judge = record["judge"]
        try:
            repeat = int(record.get("repeat_idx") or 0)
        except (TypeError, ValueError):
            repeat = 0
        base = bases.get((str(record.get("case_id")), repeat))
        score = _float_or_none(judge.get("score"))
        rows.append(
            {
                "use_case": str(record.get("use_case") or ""),
                "candidate_key": str(record.get("candidate_key") or ""),
                "case_id": str(record.get("case_id") or ""),
                "repeat_idx": str(repeat),
                "input": render_value(case.get("input", record.get("input"))),
                "reference": render_value(case.get("reference", record.get("reference"))),
                "candidate_output": output_text(record.get("output")),
                "baseline_output": output_text(base),
                "judge_mode": str(judge.get("mode") or ""),
                "judge_score": "" if score is None else format(score, "g"),
                "judge_winner": str(judge.get("winner") or ""),
                "judge_reasoning": str(judge.get("reasoning") or ""),
                **jury_fields(judge),
                "human_agree": "",
                "human_score": "",
                "human_winner": "",
                "human_note": "",
            }
        )
    return rows


def write_sheet(rows: list[dict], out: Path) -> tuple[Path, Path]:
    csv_path, html_path = _sheet_paths(out)
    csv_path.parent.mkdir(parents=True, exist_ok=True)
    with csv_path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(SHEET_COLUMNS))
        writer.writeheader()
        for row in rows:
            writer.writerow({column: row.get(column, "") for column in SHEET_COLUMNS})
    html_path.write_text(_render_html(rows), encoding="utf-8")
    return csv_path, html_path


def _sheet_paths(out: Path) -> tuple[Path, Path]:
    if out.is_dir():
        return out / "review.csv", out / "review.html"
    if out.suffix.lower() == ".csv":
        return out, out.with_suffix(".html")
    if out.suffix.lower() == ".html":
        return out.with_suffix(".csv"), out
    return out.with_suffix(".csv"), out.with_suffix(".html")


def _render_html(rows: list[dict]) -> str:
    intro = (
        f"{len(rows)} judged case(s). Read the judge columns here. "
        "Fill human_agree, human_score, human_winner, and human_note in the CSV."
    )
    heads = "".join(f"<th>{html.escape(column)}</th>" for column in SHEET_COLUMNS)
    body = []
    for row in rows:
        cells = []
        for column in SHEET_COLUMNS:
            value = row.get(column, "")
            css = "blank" if column in HUMAN_COLUMNS else "text"
            cells.append(f'<td class="{css}"><pre>{html.escape(value)}</pre></td>')
        body.append("<tr>" + "".join(cells) + "</tr>")
    table_body = "\n".join(body)
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Judge agreement review</title>
<style>
body {{ font-family: Georgia, serif; margin: 1.5rem; color: #1a1a1a; background: #fafaf7; }}
h1 {{ font-size: 1.4rem; }}
p {{ color: #444; max-width: 46rem; }}
table {{ border-collapse: collapse; width: 100%; background: #fff; }}
th, td {{ border: 1px solid #ccc; padding: 0.4rem 0.5rem; vertical-align: top; text-align: left; }}
th {{ background: #eee; }}
td.blank {{ background: #fff8e8; min-width: 6rem; }}
pre {{ white-space: pre-wrap; font-family: ui-monospace, monospace; margin: 0; }}
</style>
</head>
<body>
<h1>Judge agreement review</h1>
<p>{html.escape(intro)}</p>
<table>
<thead><tr>{heads}</tr></thead>
<tbody>
{table_body}
</tbody>
</table>
</body>
</html>
"""


def load_json(path: Path) -> object:
    return json.loads(path.read_text(encoding="utf-8"))


def read_sheet(path: Path) -> list[dict]:
    with path.open(encoding="utf-8-sig", newline="") as handle:
        return list(csv.DictReader(handle))


def _agree_mark(value: object) -> bool | None:
    text = str(value or "").strip().lower()
    if text in _YES:
        return True
    if text in _NO:
        return False
    return None


def _is_rubric(row: dict) -> bool:
    mode = str(row.get("judge_mode") or "").strip().lower()
    if "rubric" in mode:
        return True
    if "pairwise" in mode:
        return False
    return pairwise_label(row.get("judge_winner")) is None and _float_or_none(row.get("judge_score")) is not None


def _row_agrees(row: dict) -> bool | None:
    """True/False when the row has a human judgment, else None (not reviewed)."""
    mark = _agree_mark(row.get("human_agree"))
    if mark is not None:
        return mark
    if _is_rubric(row):
        human = _float_or_none(row.get("human_score"))
        judge = _float_or_none(row.get("judge_score"))
        if human is None or judge is None:
            return None
        return abs(human - judge) <= RUBRIC_TOLERANCE
    human_label = pairwise_label(row.get("human_winner"))
    judge_label = pairwise_label(row.get("judge_winner"))
    if human_label is None or judge_label is None:
        return None
    return human_label == judge_label


def _pairwise_labels(row: dict) -> tuple[str, str] | None:
    if _is_rubric(row):
        return None
    judge_label = pairwise_label(row.get("judge_winner"))
    if judge_label is None:
        return None
    human_label = pairwise_label(row.get("human_winner"))
    if human_label is None and _agree_mark(row.get("human_agree")) is True:
        human_label = judge_label
    if human_label is None:
        return None
    return judge_label, human_label


def cohens_kappa(left: list[str], right: list[str]) -> float | None:
    if not left or len(left) != len(right):
        return None
    n = len(left)
    observed = sum(a == b for a, b in zip(left, right)) / n
    labels = set(left) | set(right)
    expected = sum((left.count(label) / n) * (right.count(label) / n) for label in labels)
    if math.isclose(expected, 1.0):
        return 1.0 if math.isclose(observed, 1.0) else 0.0
    return (observed - expected) / (1.0 - expected)


def _average_ranks(values: list[float]) -> list[float]:
    order = sorted(range(len(values)), key=lambda index: values[index])
    ranks = [0.0] * len(values)
    start = 0
    while start < len(order):
        end = start
        while end + 1 < len(order) and values[order[end + 1]] == values[order[start]]:
            end += 1
        average = (start + 1 + end + 1) / 2
        for cursor in range(start, end + 1):
            ranks[order[cursor]] = average
        start = end + 1
    return ranks


def _pearson(xs: list[float], ys: list[float]) -> float | None:
    n = len(xs)
    if n == 0 or n != len(ys):
        return None
    mean_x = sum(xs) / n
    mean_y = sum(ys) / n
    diff_x = [value - mean_x for value in xs]
    diff_y = [value - mean_y for value in ys]
    denom_x = math.sqrt(sum(value * value for value in diff_x))
    denom_y = math.sqrt(sum(value * value for value in diff_y))
    if denom_x == 0 or denom_y == 0:
        return None
    return sum(x * y for x, y in zip(diff_x, diff_y)) / (denom_x * denom_y)


def spearman(xs: list[float], ys: list[float]) -> float | None:
    if len(xs) < 2 or len(xs) != len(ys):
        return None
    return _pearson(_average_ranks(xs), _average_ranks(ys))


def _judges_agree(row: dict) -> bool | None:
    """True/False when both judges voted, else None (one abstained, or no jury)."""
    mark = str(row.get("inter_judge_agree") or "").strip().lower()
    if mark in _YES:
        return True
    if mark in _NO:
        return False
    left = _float_or_none(row.get("judge_a_score"))
    right = _float_or_none(row.get("judge_b_score"))
    left_winner = pairwise_label(row.get("judge_a_winner"))
    right_winner = pairwise_label(row.get("judge_b_winner"))
    if left_winner and right_winner:
        return left_winner == right_winner
    if left is not None and right is not None:
        return abs(left - right) <= RUBRIC_TOLERANCE
    return None


def score_rows(rows: list[dict]) -> dict:
    reviewed = [(row, _row_agrees(row)) for row in rows]
    judged = [(row, flag) for row, flag in reviewed if flag is not None]
    agreements = sum(1 for _, flag in judged if flag)
    pairs = [labels for row in rows if (labels := _pairwise_labels(row)) is not None]
    rubric = []
    for row in rows:
        if not _is_rubric(row):
            continue
        human = _float_or_none(row.get("human_score"))
        judge = _float_or_none(row.get("judge_score"))
        if human is None or judge is None:
            continue
        rubric.append((judge, human))
    kappa = cohens_kappa([left for left, _ in pairs], [right for _, right in pairs])
    rho = spearman([left for left, _ in rubric], [right for _, right in rubric])
    rate = (agreements / len(judged)) if judged else None
    jury = [(row, flag) for row in rows if (flag := _judges_agree(row)) is not None]
    jury_hits = sum(1 for _, flag in jury if flag)
    jury_rate = (jury_hits / len(jury)) if jury else None
    low_jury = None if jury_rate is None else jury_rate < LOW_INTER_JUDGE_AGREEMENT
    return {
        "sheet_rows": len(rows),
        "reviewed": len(judged),
        "agreements": agreements,
        "agreement": rate,
        "pairwise_n": len(pairs),
        "kappa": kappa,
        "rubric_n": len(rubric),
        "spearman": rho,
        "inter_judge_n": len(jury),
        "inter_judge_agreements": jury_hits,
        "inter_judge_agreement": jury_rate,
        "low_inter_judge_agreement": low_jury,
    }


def _kappa_band(kappa: float) -> str:
    if kappa < 0:
        return "poor (below chance)"
    for threshold, name in ((0.8, "almost perfect"), (0.6, "substantial"), (0.4, "moderate"), (0.2, "fair"), (0.0, "slight")):
        if kappa >= threshold:
            return name
    return "slight"


def render_summary(stats: dict) -> str:
    if stats["reviewed"] == 0:
        rate = "n/a (no human judgments in the sheet)"
        headline = "No reviewed rows yet. Fill the human columns in the CSV and score again."
    else:
        rate = f"{stats['agreements']}/{stats['reviewed']} ({100 * stats['agreement']:.0f}%)"
        headline = (
            f"On {stats['reviewed']} reviewed cases, the human matched the judge on "
            f"{100 * stats['agreement']:.0f}% of rows."
        )
    if stats["kappa"] is None:
        kappa = "n/a (need pairwise human_winner values, or human_agree=yes)"
    else:
        kappa = f"{stats['kappa']:.2f} ({_kappa_band(stats['kappa'])}, n={stats['pairwise_n']})"
    if stats["spearman"] is None:
        rho = "n/a (need at least two rubric rows with human_score)"
    else:
        rho = f"{stats['spearman']:.2f} (n={stats['rubric_n']})"
    if stats.get("inter_judge_n"):
        jury_rate = (
            f"{stats['inter_judge_agreements']}/{stats['inter_judge_n']} "
            f"({100 * stats['inter_judge_agreement']:.0f}%)"
        )
        if stats.get("low_inter_judge_agreement"):
            jury_rate += ". Low agreement: flag this use case."
    else:
        jury_rate = "n/a (no row where both judges voted)"
    small = ""
    if 0 < stats["reviewed"] < 10:
        small = "\n\nThis is a small sanity check, not a confidence interval."
    return (
        "## Judge agreement\n\n"
        f"{headline}\n\n"
        f"- Agreement: {rate}\n"
        f"- Inter-judge agreement: {jury_rate}\n"
        f"- Pairwise Cohen's kappa: {kappa}\n"
        f"- Rubric Spearman: {rho}"
        f"{small}\n\n"
        "Agreement is human_agree=yes, or a blank agree cell whose pairwise label matches "
        "or whose rubric score is within 0.10 of the judge. "
        "Kappa uses candidate/baseline/tie. Spearman uses rubric scores. "
        "Inter-judge agreement counts rows where both judges voted and agreed "
        "(rubric scores within 0.10, or the same pairwise winner). "
        "Below 70% the summary flags the use case. An abstention is left out.\n"
    )


def _load_results_file(path: Path, cases_path: Path | None, use_case: str | None, baseline_key: str | None):
    cases_payload = load_json(cases_path) if cases_path else None
    return prepare_records(load_json(path), cases_payload, use_case=use_case, baseline_key=baseline_key)


def cmd_sheet(args: argparse.Namespace) -> int:
    records, warnings = _load_results_file(
        Path(args.results),
        Path(args.cases) if args.cases else None,
        args.use_case,
        args.baseline_key,
    )
    for warning in warnings:
        print(f"warning: {warning}", file=sys.stderr)
    rows = sheet_rows(records, n=args.n, seed=args.seed, baseline_key=args.baseline_key)
    if not rows:
        print("warning: no judged rows to sample", file=sys.stderr)
    csv_path, html_path = write_sheet(rows, Path(args.out))
    print(f"wrote {csv_path} and {html_path} ({len(rows)} rows)")
    return 0


def cmd_score(args: argparse.Namespace) -> int:
    rows = read_sheet(Path(args.sheet))
    summary = render_summary(score_rows(rows))
    if args.out:
        Path(args.out).write_text(summary, encoding="utf-8")
        print(f"wrote {args.out}")
    sys.stdout.write(summary)
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Sample judged cases and score human agreement.")
    sub = parser.add_subparsers(dest="command", required=True)

    sheet = sub.add_parser("sheet", help="sample judged rows into a CSV and HTML review sheet")
    sheet.add_argument("--results", required=True, help="results JSON from GET /api/runs/{id}/results")
    sheet.add_argument("--cases", help="optional cases JSON from GET /api/use-cases/{id}/cases")
    sheet.add_argument("--baseline-key", help="candidate_key of the baseline, used to attach its output")
    sheet.add_argument("--use-case", help="use-case name when the results export does not carry one")
    sheet.add_argument("--n", type=int, default=10, help="how many judged rows to sample (default 10)")
    sheet.add_argument("--seed", type=int, default=0, help="sampler seed (default 0)")
    sheet.add_argument("--out", required=True, help="path stem, .csv/.html path, or directory")
    sheet.set_defaults(func=cmd_sheet)

    score = sub.add_parser("score", help="score a filled review CSV")
    score.add_argument("--sheet", required=True, help="filled review CSV")
    score.add_argument("--out", help="optional markdown path")
    score.set_defaults(func=cmd_score)
    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    try:
        return args.func(args)
    except (OSError, ValueError, json.JSONDecodeError, KeyError) as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
