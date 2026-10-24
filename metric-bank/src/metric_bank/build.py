"""Assemble the metric bank and check internal references."""

from __future__ import annotations

import json
from pathlib import Path

from metric_bank.categories import CATEGORIES
from metric_bank.metrics import METRICS
from metric_bank.policy import selection_policy
from metric_bank.priors import PRIORS
from metric_bank.runtime import STATUSES, status_for
from metric_bank.spec import CATALOG_IDS

BANK_VERSION = "1.0.0"
UPDATED = "2026-10-24"

DESIGN_NOTES = (
    "The bank has one row per measurement a client benchmark can actually run. "
    "Public exams (MMLU, BIG-bench, GSM8K, HELM scenarios, Arena Elo) are priors, "
    "not metrics. Where Ragas and DeepEval name the same construct, one row is kept "
    "and the other name is an alias. Metrics marked avoid_as_primary exist so a "
    "selector can refuse BLEU, ROUGE, BERTScore, fluency, or embedding cosine as "
    "the sole quality score. Operational metrics are measured on the same run as "
    "quality. Only utility_axis=quality scores enter the 0–1 quality average, and "
    "they must already be higher-better. Lower-better risk rates are gates. "
    "A client scorecard should contain the always-on operational metrics, one speed "
    "metric chosen from the use-case kind, one to five quality metrics, and zero to "
    "five risk gates. Each row has runtime_status. The default selector proposes only "
    "metrics score() implements, judge() rows (one rubric call, pairwise in both orders), and the timing, token, and cost "
    "metrics the runner records. Planned rows stay in the bank. Set include_planned "
    "to opt in. If filtering would leave quality empty, the selector uses an "
    "implemented metric for that kind, or rubric_score. Document vision is included "
    "for pages and scans: character "
    "and word error, plus box overlap. Speech, image aesthetics, and caption "
    "preference are not. The bank is a library, not a list to run in full."
)


def build_bank() -> dict:
    errors = validate_records(METRICS)
    if errors:
        raise ValueError("Metric bank failed internal checks:\n" + "\n".join(errors))
    metrics = sorted(METRICS, key=lambda item: (item["category"], item["id"]))
    return {
        "bank_version": BANK_VERSION,
        "updated": UPDATED,
        "name": "BIY metric bank",
        "design_notes": DESIGN_NOTES,
        "selection_policy": selection_policy(),
        "categories": CATEGORIES,
        "priors": PRIORS,
        "metrics": metrics,
    }


def validate_records(metrics: list[dict]) -> list[str]:
    errors: list[str] = []
    ids = [item["id"] for item in metrics]
    if len(ids) != len(set(ids)):
        dupes = sorted({item for item in ids if ids.count(item) > 1})
        errors.append(f"duplicate ids: {dupes}")
    id_set = set(ids)
    category_ids = {item["id"] for item in CATEGORIES}
    alias_owner: dict[str, str] = {}
    for item in metrics:
        if item["category"] not in category_ids:
            errors.append(f"{item['id']}: unknown category {item['category']}")
        for related in item["related_metrics"]:
            if related not in id_set:
                errors.append(f"{item['id']}: related metric {related} does not exist")
            if related == item["id"]:
                errors.append(f"{item['id']}: related to itself")
        for alias in item["aliases"]:
            if alias in id_set:
                errors.append(f"{item['id']}: alias {alias} collides with an id")
            if alias in alias_owner:
                errors.append(f"{item['id']}: alias {alias} also used by {alias_owner[alias]}")
            alias_owner[alias] = item["id"]
        if item["score"]["direction"] != _direction_ok(item):
            pass
        if item["utility_axis"] == "quality" and not (
            item["score"]["min"] == 0 and item["score"]["max"] == 1 and item["score"]["direction"] == "higher_better"
        ):
            errors.append(f"{item['id']}: quality-axis metrics must be higher-better on [0, 1]")
        status = item.get("runtime_status")
        if status not in STATUSES:
            errors.append(f"{item['id']}: runtime_status must be one of {STATUSES}")
        elif status != status_for(item["id"]):
            errors.append(
                f"{item['id']}: runtime_status is {status}, registry says {status_for(item['id'])}"
            )
    missing = sorted(CATALOG_IDS - id_set)
    if missing:
        errors.append(f"missing catalogue ids: {missing}")
    for category in category_ids:
        count = sum(1 for item in metrics if item["category"] == category)
        if count < 3:
            errors.append(f"category {category} has only {count} metrics")
    return errors


def _direction_ok(item: dict) -> str:
    return item["score"]["direction"]


def dump_bank(path: Path) -> dict:
    bank = build_bank()
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(bank, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    return bank


def load_bank(path: Path | None = None) -> dict:
    if path is None:
        path = Path(__file__).resolve().parents[2] / "data" / "metric-bank.json"
    return json.loads(path.read_text(encoding="utf-8"))


if __name__ == "__main__":
    destination = Path(__file__).resolve().parents[2] / "data" / "metric-bank.json"
    bank = dump_bank(destination)
    print(f"wrote {destination} with {len(bank['metrics'])} metrics and {len(bank['categories'])} categories")
