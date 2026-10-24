"""Validate data/metric-bank.json against its schema and the builder.

Exit status is 0 when the file, the schema, and build_bank() agree.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import jsonschema

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT / "src"))

from metric_bank.build import build_bank, validate_records  # noqa: E402
from metric_bank.policy import ALWAYS_ON, SPEED_BY_KIND  # noqa: E402
from metric_bank.runtime import is_runnable  # noqa: E402
from metric_bank.schema_doc import SCHEMA_PATH, schema_document  # noqa: E402
from metric_bank.selector import EXAMPLES, select  # noqa: E402
from metric_bank.spec import CATALOG_IDS  # noqa: E402

BANK_PATH = ROOT / "data" / "metric-bank.json"
HTML_PATH = ROOT / "research" / "metric-bank-summary.html"
GUIDE_PATH = ROOT / "selection" / "GUIDE.md"
EXAMPLES_PATH = ROOT / "selection" / "examples.json"


def check_bank(bank: dict, schema: dict) -> list[str]:
    errors: list[str] = []
    validator = jsonschema.Draft202012Validator(schema, format_checker=jsonschema.Draft202012Validator.FORMAT_CHECKER)
    schema_errors = sorted(validator.iter_errors(bank), key=lambda item: list(item.path))
    for item in schema_errors:
        path = "/".join(str(part) for part in item.path) or "(root)"
        errors.append(f"schema: {path}: {item.message}")
    errors.extend(validate_records(bank["metrics"]))
    ids = {item["id"] for item in bank["metrics"]}
    for metric_id in ALWAYS_ON:
        if metric_id not in ids:
            errors.append(f"always-on id missing: {metric_id}")
    for item in bank["metrics"]:
        if item["id"] in ALWAYS_ON and not item["always_on"]:
            errors.append(f"{item['id']}: policy says always-on but the row does not")
        if item["selector_priority"] == "avoid_as_primary" and item["utility_axis"] == "quality":
            errors.append(f"{item['id']}: avoid_as_primary must not enter Q")
        if item["catalog_match"] != (item["id"] in CATALOG_IDS):
            errors.append(f"{item['id']}: catalog_match does not match the catalogue set")
    for kind, metric_id in SPEED_BY_KIND.items():
        if metric_id is not None and metric_id not in ids:
            errors.append(f"speed metric {metric_id} for {kind} is not in the bank")
    category_ids = [item["id"] for item in bank["categories"]]
    if len(category_ids) != len(set(category_ids)):
        errors.append("duplicate category ids")
    missing_categories = sorted(set(category_ids) - {item["category"] for item in bank["metrics"]})
    if missing_categories:
        errors.append(f"categories with no metrics: {missing_categories}")
    return errors


def check_selector(bank: dict) -> list[str]:
    errors: list[str] = []
    caps = bank["selection_policy"]["caps"]
    by_id = {item["id"]: item for item in bank["metrics"]}
    for example in EXAMPLES:
        card = select(example, bank)
        if len(card["quality"]) > caps["quality_metrics"]:
            errors.append(f"{example['id']}: quality cap exceeded")
        if len(card["quality"]) < 1:
            errors.append(f"{example['id']}: no quality metric")
        if len(card["risk_gates"]) > caps["risk_metrics"]:
            errors.append(f"{example['id']}: risk cap exceeded")
        if len(card["judging"]) > caps["judging_metrics"]:
            errors.append(f"{example['id']}: judging cap exceeded")
        for metric_id in card["quality"]:
            metric = by_id[metric_id]
            if metric["utility_axis"] != "quality":
                errors.append(f"{example['id']}: {metric_id} is not a quality metric")
            if metric["selector_priority"] == "avoid_as_primary":
                errors.append(f"{example['id']}: selected avoid_as_primary {metric_id}")
        for metric_id in card["always_on"] + card["reliability_extra"] + card["also_report"]:
            if metric_id not in by_id:
                errors.append(f"{example['id']}: unknown id {metric_id}")
        speed = card["speed"]["ranking"]
        if speed is not None and by_id[speed]["utility_axis"] != "speed":
            errors.append(f"{example['id']}: {speed} is not a speed metric")
        proposed = _proposed(card)
        planned = [metric_id for metric_id in proposed if not is_runnable(metric_id)]
        if planned:
            errors.append(f"{example['id']}: default scorecard includes planned metrics {planned}")
    return errors


def _proposed(card: dict) -> list[str]:
    ids = list(card["always_on"])
    ids.extend(card["quality"])
    ids.extend(card["quality_alternates"])
    ids.extend(card["also_report"])
    ids.extend(card["reliability_extra"])
    ids.extend(card["speed"]["also_report"])
    if card["speed"]["ranking"]:
        ids.append(card["speed"]["ranking"])
    ids.extend(item["id"] for item in card["risk_gates"])
    ids.extend(item["id"] for item in card["task_gates"])
    ids.extend(card["judging"])
    return ids


def check_artifacts(bank: dict) -> list[str]:
    errors: list[str] = []
    count = len(bank["metrics"])
    categories = len(bank["categories"])
    if HTML_PATH.exists():
        html = HTML_PATH.read_text(encoding="utf-8")
        if f"{count} metrics" not in html or f"{categories} categories" not in html:
            errors.append("HTML summary does not state the live metric and category counts")
        if "<script src=" in html or "http://" in html or "https://" in html:
            errors.append("HTML summary should be self-contained, with no external URLs")
    else:
        errors.append(f"missing {HTML_PATH}")
    if GUIDE_PATH.exists():
        guide = GUIDE_PATH.read_text(encoding="utf-8")
        for example in EXAMPLES:
            card = select(example, bank)
            if example["id"] not in guide:
                errors.append(f"guide is missing example {example['id']}")
            for metric_id in card["quality"]:
                if metric_id not in guide:
                    errors.append(f"guide is missing quality metric {metric_id}")
    else:
        errors.append(f"missing {GUIDE_PATH}")
    if EXAMPLES_PATH.exists():
        on_disk = json.loads(EXAMPLES_PATH.read_text(encoding="utf-8"))
        live = [select(example, bank) for example in EXAMPLES]
        if on_disk != live:
            errors.append("selection/examples.json does not match the reference selector")
    else:
        errors.append(f"missing {EXAMPLES_PATH}")
    return errors


def main() -> int:
    errors: list[str] = []
    if not BANK_PATH.exists():
        print(f"missing {BANK_PATH}", file=sys.stderr)
        return 1
    if not SCHEMA_PATH.exists():
        print(f"missing {SCHEMA_PATH}", file=sys.stderr)
        return 1
    bank = json.loads(BANK_PATH.read_text(encoding="utf-8"))
    schema_on_disk = json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))
    if schema_on_disk != schema_document():
        errors.append("schema/metric-bank.schema.json does not match schema_document()")
    if bank != build_bank():
        errors.append("data/metric-bank.json does not match build_bank()")
    errors.extend(check_bank(bank, schema_on_disk))
    errors.extend(check_selector(bank))
    errors.extend(check_artifacts(bank))
    if errors:
        print(f"{len(errors)} problem(s):", file=sys.stderr)
        for item in errors:
            print(f"- {item}", file=sys.stderr)
        return 1
    print(
        f"ok: {len(bank['metrics'])} metrics, {len(bank['categories'])} categories, "
        f"schema and builder agree"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
