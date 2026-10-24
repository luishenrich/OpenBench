"""JSON Schema for the metric bank. The file on disk is this document, dumped."""

from __future__ import annotations

import json
from pathlib import Path

from metric_bank.spec import (
    CATEGORIES,
    COST_LEVELS,
    DIRECTIONS,
    GRANULARITY,
    GROUP_ROLES,
    INDUSTRIES,
    INPUTS,
    KINDS,
    LAYERS,
    METHODS,
    PRIORITIES,
    TRANSFORMS,
    UNITS,
    UTILITY_AXES,
)

SCHEMA_PATH = Path(__file__).resolve().parents[2] / "schema" / "metric-bank.schema.json"


def _enum(values) -> dict:
    return {"type": "string", "enum": list(values)}


def _strings(min_items: int, min_length: int = 1) -> dict:
    return {
        "type": "array",
        "minItems": min_items,
        "items": {"type": "string", "minLength": min_length},
    }


def schema_document() -> dict:
    metric = {
        "type": "object",
        "additionalProperties": False,
        "required": [
            "id",
            "name",
            "category",
            "description",
            "measures",
            "when_to_use",
            "when_not_to_use",
            "required_inputs",
            "computation",
            "score",
            "cost_effort",
            "limitations",
            "related_metrics",
            "tags",
            "provenance",
            "granularity",
            "layer",
            "selector_priority",
            "gate_suitable",
            "always_on",
            "default_for_kinds",
            "utility_axis",
            "quality_transform",
            "construct_group",
            "group_role",
            "aliases",
            "config",
            "reported_statistics",
            "catalog_match",
            "runtime_status",
        ],
        "properties": {
            "id": {"type": "string", "pattern": "^[a-z][a-z0-9_]{1,63}$"},
            "name": {"type": "string", "minLength": 2},
            "category": _enum(CATEGORIES),
            "description": {"type": "string", "minLength": 80},
            "measures": {"type": "string", "minLength": 40},
            "when_to_use": {
                "type": "object",
                "additionalProperties": False,
                "required": ["use_cases", "industries", "signals"],
                "properties": {
                    "use_cases": _strings(1),
                    "industries": {"type": "array", "minItems": 1, "items": _enum(INDUSTRIES)},
                    "signals": _strings(2),
                },
            },
            "when_not_to_use": _strings(2),
            "required_inputs": {
                "type": "object",
                "additionalProperties": False,
                "required": ["inputs", "notes"],
                "properties": {
                    "inputs": {"type": "array", "minItems": 1, "items": _enum(INPUTS)},
                    "notes": {"type": "string", "minLength": 20},
                },
            },
            "computation": {
                "type": "object",
                "additionalProperties": False,
                "required": ["method", "formula", "procedure", "implementations"],
                "properties": {
                    "method": _enum(METHODS),
                    "formula": {"type": "string", "minLength": 12},
                    "procedure": _strings(3),
                    "implementations": _strings(1),
                },
            },
            "score": {
                "type": "object",
                "additionalProperties": False,
                "required": [
                    "min",
                    "max",
                    "unit",
                    "direction",
                    "interpretation",
                    "aggregation",
                    "suggested_gate",
                ],
                "properties": {
                    "min": {"type": "number"},
                    "max": {"type": ["number", "null"]},
                    "unit": _enum(UNITS),
                    "direction": _enum(DIRECTIONS),
                    "interpretation": {
                        "type": "array",
                        "minItems": 2,
                        "items": {
                            "type": "object",
                            "additionalProperties": False,
                            "required": ["at", "meaning"],
                            "properties": {
                                "at": {"type": "string", "minLength": 1},
                                "meaning": {"type": "string", "minLength": 12},
                            },
                        },
                    },
                    "aggregation": {"type": "string", "minLength": 3},
                    "suggested_gate": {"type": ["string", "null"]},
                },
            },
            "cost_effort": {
                "type": "object",
                "additionalProperties": False,
                "required": ["level", "driver", "notes"],
                "properties": {
                    "level": _enum(COST_LEVELS),
                    "driver": {"type": "string", "minLength": 3},
                    "notes": {"type": "string", "minLength": 20},
                },
            },
            "limitations": _strings(2),
            "related_metrics": _strings(1),
            "tags": _strings(4),
            "provenance": _strings(1),
            "granularity": _enum(GRANULARITY),
            "layer": _enum(LAYERS),
            "selector_priority": _enum(PRIORITIES),
            "gate_suitable": {"type": "boolean"},
            "always_on": {"type": "boolean"},
            "default_for_kinds": {"type": "array", "items": _enum(KINDS)},
            "utility_axis": _enum(UTILITY_AXES),
            "quality_transform": _enum(TRANSFORMS),
            "construct_group": {"type": "string", "minLength": 2},
            "group_role": _enum(GROUP_ROLES),
            "aliases": _strings(0),
            "config": {"type": "object"},
            "reported_statistics": _strings(0),
            "catalog_match": {"type": "boolean"},
            "runtime_status": {
                "type": "string",
                "enum": ["implemented", "judge", "runner_measured", "planned"],
            },
        },
    }
    return {
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "$id": "https://biy.local/schema/metric-bank.schema.json",
        "title": "BIY metric bank",
        "type": "object",
        "additionalProperties": False,
        "required": [
            "bank_version",
            "updated",
            "name",
            "design_notes",
            "selection_policy",
            "categories",
            "priors",
            "metrics",
        ],
        "properties": {
            "bank_version": {"type": "string", "pattern": "^[0-9]+\\.[0-9]+\\.[0-9]+$"},
            "updated": {"type": "string", "format": "date"},
            "name": {"type": "string", "minLength": 3},
            "design_notes": {"type": "string", "minLength": 80},
            "selection_policy": {"$ref": "#/$defs/policy"},
            "categories": {
                "type": "array",
                "minItems": 1,
                "items": {"$ref": "#/$defs/category"},
            },
            "priors": {"type": "array", "minItems": 1, "items": {"$ref": "#/$defs/prior"}},
            "metrics": {"type": "array", "minItems": 1, "items": {"$ref": "#/$defs/metric"}},
        },
        "$defs": {
            "metric": metric,
            "category": {
                "type": "object",
                "additionalProperties": False,
                "required": ["id", "name", "description", "always_on", "selector_notes"],
                "properties": {
                    "id": _enum(CATEGORIES),
                    "name": {"type": "string", "minLength": 2},
                    "description": {"type": "string", "minLength": 20},
                    "always_on": {"type": "boolean"},
                    "selector_notes": {"type": "string", "minLength": 20},
                },
            },
            "prior": {
                "type": "object",
                "additionalProperties": False,
                "required": [
                    "id",
                    "name",
                    "kind",
                    "what_it_measures",
                    "useful_as",
                    "do_not_use_as",
                    "citation",
                ],
                "properties": {
                    "id": {"type": "string", "pattern": "^[a-z][a-z0-9_]{1,63}$"},
                    "name": {"type": "string", "minLength": 2},
                    "kind": {"type": "string", "minLength": 2},
                    "what_it_measures": {"type": "string", "minLength": 20},
                    "useful_as": {"type": "string", "minLength": 20},
                    "do_not_use_as": {"type": "string", "minLength": 20},
                    "citation": {"type": "string", "minLength": 5},
                },
            },
            "policy": {
                "type": "object",
                "additionalProperties": False,
                "required": [
                    "caps",
                    "always_on",
                    "speed_by_kind",
                    "quality_rule",
                    "gate_rule",
                    "judge_rule",
                    "runnable_rule",
                    "double_count_groups",
                ],
                "properties": {
                    "caps": {
                        "type": "object",
                        "additionalProperties": False,
                        "required": [
                            "quality_metrics",
                            "risk_metrics",
                            "business_metrics",
                            "judging_metrics",
                        ],
                        "properties": {
                            "quality_metrics": {"type": "integer", "minimum": 1},
                            "risk_metrics": {"type": "integer", "minimum": 0},
                            "business_metrics": {"type": "integer", "minimum": 0},
                            "judging_metrics": {"type": "integer", "minimum": 0},
                        },
                    },
                    "always_on": _strings(1),
                    "speed_by_kind": {
                        "type": "object",
                        "additionalProperties": False,
                        "required": list(KINDS),
                        "properties": {kind: {"type": ["string", "null"]} for kind in KINDS},
                    },
                    "quality_rule": {"type": "string", "minLength": 20},
                    "gate_rule": {"type": "string", "minLength": 20},
                    "judge_rule": {"type": "string", "minLength": 20},
                    "runnable_rule": {"type": "string", "minLength": 20},
                    "double_count_groups": _strings(1),
                },
            },
        },
    }


def dump_schema(path: Path | None = None) -> Path:
    destination = path or SCHEMA_PATH
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(
        json.dumps(schema_document(), indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    return destination


if __name__ == "__main__":
    written = dump_schema()
    print(f"wrote {written}")
