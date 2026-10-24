"""Build notebooks/metric_bank_overview.ipynb with saved outputs."""

from __future__ import annotations

import io
import sys
import traceback
from contextlib import redirect_stdout
from pathlib import Path

import nbformat
from nbformat.v4 import new_code_cell, new_markdown_cell, new_notebook, new_output

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "notebooks" / "metric_bank_overview.ipynb"

MARKDOWN = [
    """# BIY metric bank

This notebook loads the metric bank, shows how the inventory splits by category and by selector priority, runs the five worked client selections, and computes a few formulas locally. Nothing here calls a model.

Open it from the `metric-bank` directory, or from `notebooks/`. The first cell finds `src`.
""",
    """## Overview

Counts come from `data/metric-bank.json` when that file is present, and the next cell checks it still matches the builder. `runtime_status` is implemented, judge, runner_measured, or planned. Default scorecards use the first three. `include_planned` opts into the roadmap.
""",
    """## Category breakdown
""",
    """## What the selector is allowed to average

Quality-axis metrics are higher-better on 0–1. Avoid-as-primary rows are in the bank so they can be refused.
""",
    """## Five client scorecards

The reference selector is deterministic. These are the same cards as `selection/examples.json` and the guide.
""",
    """## Formula sketches

Token F1, a schema check, faithfulness from claim verdicts, cost, calibration, pass@k, pass^k, and the product's log target for speed and cost.
""",
    """## Priors

Public benchmarks that informed the bank and are not themselves rows.
""",
]

CODE = [
    r'''
from pathlib import Path
import sys

def find_src() -> Path:
    here = Path.cwd().resolve()
    for candidate in [here, *here.parents]:
        if (candidate / "src" / "metric_bank").is_dir():
            return candidate / "src"
    raise RuntimeError("Run this notebook from the metric-bank directory.")

SRC = find_src()
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

from metric_bank.build import build_bank, load_bank
from collections import Counter

bank = load_bank()
built = build_bank()
assert bank == built, "data/metric-bank.json is stale; rebuild it"
metrics = bank["metrics"]
print(f"{len(metrics)} metrics, {len(bank['categories'])} categories, {len(bank['priors'])} priors")
print("Priorities:", dict(Counter(m["selector_priority"] for m in metrics)))
print("Catalogue matches:", sum(m["catalog_match"] for m in metrics))
print("Runtime:", dict(Counter(m["runtime_status"] for m in metrics)))
print(bank["design_notes"])
''',
    r'''
from collections import Counter

counts = Counter(m["category"] for m in metrics)
core = Counter(m["category"] for m in metrics if m["selector_priority"] == "core")
names = {c["id"]: c["name"] for c in bank["categories"]}
width = max(counts.values())
print(f"{'category':<28} {'rows':>5} {'core':>5}  ")
for category in bank["categories"]:
    cid = category["id"]
    bar = "#" * counts[cid]
    print(f"{cid:<28} {counts[cid]:>5} {core[cid]:>5}  {bar}")
    print(f"  {names[cid]}")
    print(f"  {category['selector_notes']}")
''',
    r'''
print("Quality-axis metrics by category")
for category in bank["categories"]:
    chosen = [
        m["id"] for m in metrics
        if m["category"] == category["id"] and m["utility_axis"] == "quality" and m["selector_priority"] == "core"
    ]
    if chosen:
        print(f"  {category['id']}: {', '.join(chosen)}")

print("\nRefused as a primary quality score")
for metric in metrics:
    if metric["selector_priority"] == "avoid_as_primary":
        print(f"  {metric['id']}: {metric['when_not_to_use'][0]}")
''',
    r'''
from metric_bank.selector import EXAMPLES, select

for example in EXAMPLES:
    card = select(example, bank)
    print("=" * 72)
    print(card["title"], f"({card['kind']}, {card['industry']})")
    print(card["narrative"])
    print("quality:    ", ", ".join(card["quality"]))
    if card["quality_alternates"]:
        print("alternates: ", ", ".join(card["quality_alternates"]))
    speed = card["speed"]["ranking"] or "none"
    extra = ", ".join(card["speed"]["also_report"])
    print("speed:      ", speed + (f"  also {extra}" if extra else ""))
    print("risk gates: ", ", ".join(f"{g['id']} {g['threshold']}" for g in card["risk_gates"]) or "none")
    print("task gates: ", ", ".join(f"{g['id']} {g['threshold']}" for g in card["task_gates"]))
    reported = card["reliability_extra"] + card["also_report"]
    if reported:
        print("reported:   ", ", ".join(reported))
    for note in card["notes"]:
        print("note:       ", note)
''',
    r'''
from metric_bank.illustrative import (
    ambiguous_context_bias,
    bbox_iou,
    case_cost_usd,
    character_accuracy,
    character_error_rate,
    expected_calibration_error,
    faithfulness_from_verdicts,
    json_schema_valid,
    pass_at_k,
    pass_hat_k,
    percentile,
    rouge_l,
    target_score,
    token_f1,
)

print("token F1", round(token_f1("the cat sat on the mat", "cat on mat"), 3))
schema = {"type": "object", "required": ["billed_amount"], "properties": {"billed_amount": {"type": "number"}}}
print("schema ok", json_schema_valid({"billed_amount": 120.5}, schema))
print("schema bad", json_schema_valid({"billed_amount": "120.50"}, schema))
print("faithfulness", faithfulness_from_verdicts([True, True, True, False]))
prices = {"input": 3.0, "cached": 0.3, "output": 15.0}
print("cost usd", case_cost_usd(1_000_000, 200_000, 100_000, prices))
print("ECE", expected_calibration_error([0.9, 0.9, 0.2, 0.2], [True, False, False, True], n_bins=5))
print("pass@2", round(pass_at_k(n=10, c=4, k=2), 3))
print("pass^2", round(pass_hat_k(n=10, c=4, k=2), 3))
print("p95 of e2e ms", percentile([80, 90, 100, 110, 400], 95))
print("target score at 2x", round(target_score(200, 100, 1000), 3))
print("ROUGE-L, for contrast only", round(rouge_l("the claim was denied", "the claim was paid"), 3))
print("BBQ-style bias", round(ambiguous_context_bias(accuracy=0.4, stereotype_aligned=7, non_unknown=10), 3))
print("CER", round(character_error_rate("120.50", "120.00"), 3), "accuracy", round(character_accuracy("120.50", "120.00"), 3))
print("box IoU", round(bbox_iou((0, 0, 10, 10), (5, 5, 15, 15)), 3))
''',
    r'''
print(f"{'prior':<28} {'kind':<22} citation")
for prior in bank["priors"]:
    print(f"{prior['id']:<28} {prior['kind']:<22} {prior['citation']}")
print()
print("Example of a prior boundary:")
helm = next(item for item in bank["priors"] if item["id"] == "helm")
print(helm["name"])
print("useful as:", helm["useful_as"])
print("not as:   ", helm["do_not_use_as"])
''',
]


def execute(source: str, namespace: dict) -> tuple[str, str | None]:
    buffer = io.StringIO()
    try:
        with redirect_stdout(buffer):
            exec(compile(source, "<notebook>", "exec"), namespace)
    except Exception:
        return buffer.getvalue(), traceback.format_exc()
    return buffer.getvalue(), None


def main() -> None:
    notebook = new_notebook()
    notebook.metadata["kernelspec"] = {
        "display_name": "Python 3",
        "language": "python",
        "name": "python3",
    }
    notebook.metadata["language_info"] = {"name": "python", "pygments_lexer": "ipython3"}
    namespace: dict = {"__name__": "__main__"}
    cells = []
    # Fixed ids so a rebuild does not churn the notebook diff.
    cell_ids = [
        "mb-intro",
        "mb-load",
        "mb-categories",
        "mb-category-table",
        "mb-axes",
        "mb-axis-table",
        "mb-scorecards",
        "mb-scorecard-run",
        "mb-formulas",
        "mb-formula-run",
        "mb-priors",
        "mb-prior-table",
    ]
    next_id = iter(cell_ids)
    for markdown, code in zip(MARKDOWN, CODE):
        markdown_cell = new_markdown_cell(markdown.strip() + "\n")
        markdown_cell["id"] = next(next_id)
        cells.append(markdown_cell)
        text, error = execute(code, namespace)
        outputs = []
        if text:
            outputs.append(new_output(output_type="stream", name="stdout", text=text))
        if error:
            outputs.append(
                new_output(
                    output_type="stream",
                    name="stderr",
                    text=error,
                )
            )
            print(error, file=sys.stderr)
            raise SystemExit(1)
        cell = new_code_cell(code.strip() + "\n")
        cell["id"] = next(next_id)
        cell.outputs = outputs
        cell.execution_count = len([item for item in cells if item.cell_type == "code"]) + 1
        cells.append(cell)
    notebook.cells = cells
    OUT.parent.mkdir(parents=True, exist_ok=True)
    nbformat.write(notebook, OUT)
    print(f"wrote {OUT}")


if __name__ == "__main__":
    main()
