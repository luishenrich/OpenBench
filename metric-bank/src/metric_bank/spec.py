"""Constructors and closed vocabularies for metric records.

Every user-facing field is explicit. The constructor only checks shape so a
missing limitation or a dangling category fails at build time, not in a client
benchmark.
"""

from __future__ import annotations

import re

from metric_bank.runtime import status_for

ID_RE = re.compile(r"^[a-z][a-z0-9_]{1,63}$")

CATEGORIES = (
    "accuracy",
    "reasoning",
    "knowledge",
    "rag_grounding",
    "summarization",
    "code",
    "conversation",
    "instruction_following",
    "structured_output",
    "vision",
    "agents_tools",
    "multilingual",
    "safety",
    "bias_fairness",
    "privacy",
    "robustness",
    "calibration_hallucination",
    "efficiency",
    "cost",
    "reliability",
    "business_ux",
    "judging",
)

# Kinds from docs/architecture.md. The bank does not invent a parallel taxonomy.
KINDS = (
    "chat",
    "batch",
    "extraction",
    "agent",
    "classification",
    "rag",
    "summarization",
    "generation",
    "other",
)

INDUSTRIES = (
    "general",
    "healthcare",
    "finance",
    "insurance",
    "legal",
    "public_sector",
    "retail",
    "advertising",
    "customer_support",
    "education",
    "software",
    "hr",
    "media",
    "telecom",
    "manufacturing",
)

INPUTS = (
    "model_output",
    "prompt_or_input",
    "reference_answer",
    "source_document",
    "retrieved_context",
    "gold_context",
    "labels",
    "human_raters",
    "llm_judge",
    "embedding_model",
    "nli_model",
    "tool_trace",
    "expected_tool_calls",
    "tool_schema",
    "allowed_tools",
    "plan",
    "unit_tests",
    "execution_environment",
    "static_analyzer",
    "server_logs",
    "usage_tokens",
    "timestamps",
    "price_table",
    "repeat_samples",
    "token_logprobs",
    "confidence",
    "demographic_metadata",
    "subgroup_labels",
    "policy_spec",
    "constraints",
    "json_schema",
    "toxicity_classifier",
    "pii_detector",
    "language_id_model",
    "reference_translation",
    "locale_spec",
    "brand_guide",
    "monthly_volume",
    "gpu_price",
    "conversation_history",
    "copyright_corpus",
    "production_outcomes",
    "user_feedback",
    "attack_set",
    "benign_set",
)

METHODS = (
    "deterministic",
    "statistical",
    "llm_judge",
    "human",
    "classifier",
    "log_derived",
    "execution",
    "hybrid",
)

DIRECTIONS = (
    "higher_better",
    "lower_better",
    "closer_to_zero",
    "target_band",
    "report_only",
)

UNITS = (
    "ratio",
    "score",
    "milliseconds",
    "tokens_per_second",
    "requests_per_second",
    "usd",
    "tokens",
    "usd_per_million_tokens",
    "minutes",
    "dimensionless",
)

GRANULARITY = ("case", "run", "corpus", "conversation")
LAYERS = ("quality", "risk", "operational", "business", "method")
PRIORITIES = ("core", "supporting", "diagnostic", "avoid_as_primary")
UTILITY_AXES = ("quality", "speed", "cost", "gate_only", "none")
TRANSFORMS = ("identity", "one_minus", "not_a_quality_input")
GROUP_ROLES = ("primary", "alternate", "gate_form", "diagnostic", "method")
COST_LEVELS = ("low", "medium", "high")

# IDs already published in docs/metrics-catalog.md. The bank is a superset.
CATALOG_IDS = frozenset(
    {
        "ttft_ms",
        "ttfat_ms",
        "output_tps",
        "e2e_ms",
        "task_e2e_ms",
        "throughput_rps",
        "cost_per_case_usd",
        "cost_per_success_usd",
        "tokens_out_per_case",
        "monthly_cost_usd",
        "error_rate",
        "truncation_rate",
        "throttle_rate",
        "flip_rate",
        "pass_hat_k",
        "exact_match",
        "token_f1",
        "regex_match",
        "contains_all",
        "contains_none",
        "classification_accuracy",
        "classification_f1",
        "json_valid",
        "json_schema_valid",
        "field_accuracy",
        "tool_call_correct",
        "tool_choice_correct",
        "length_within",
        "language_is",
        "code_tests_pass",
        "rubric_score",
        "pairwise_vs_baseline",
        "g_eval",
        "faithfulness",
        "answer_relevancy",
        "instruction_following",
        "tone_brand_fit",
        "safety_violation",
        "over_refusal",
        "hallucination",
    }
)


def _strings(name: str, values, minimum: int) -> list[str]:
    if not isinstance(values, (list, tuple)) or len(values) < minimum:
        raise ValueError(f"{name} needs at least {minimum} strings")
    out = []
    for value in values:
        if not isinstance(value, str) or not value.strip():
            raise ValueError(f"{name} contains an empty string")
        out.append(value.strip())
    return out


def _choice(name: str, value: str, allowed: tuple[str, ...]) -> str:
    if value not in allowed:
        raise ValueError(f"{name}={value!r} is not one of {allowed}")
    return value


def metric(
    *,
    id: str,
    name: str,
    category: str,
    description: str,
    measures: str,
    use_cases: list[str],
    industries: list[str],
    signals: list[str],
    when_not_to_use: list[str],
    inputs: list[str],
    input_notes: str,
    method: str,
    formula: str,
    procedure: list[str],
    implementations: list[str],
    score_min: float,
    score_max: float | None,
    unit: str,
    direction: str,
    interpretation: list[dict],
    aggregation: str,
    suggested_gate: str | None,
    cost_level: str,
    cost_driver: str,
    cost_note: str,
    limitations: list[str],
    related_metrics: list[str],
    tags: list[str],
    provenance: list[str],
    granularity: str,
    layer: str,
    selector_priority: str,
    gate_suitable: bool,
    always_on: bool,
    default_for_kinds: list[str],
    utility_axis: str,
    quality_transform: str,
    construct_group: str,
    group_role: str,
    aliases: list[str] | None = None,
    config: dict | None = None,
    reported_statistics: list[str] | None = None,
) -> dict:
    """Build one metric record. Raises ValueError on authoring mistakes."""
    if not ID_RE.match(id):
        raise ValueError(f"bad id {id!r}")
    if not name.strip() or len(description.strip()) < 80 or len(measures.strip()) < 40:
        raise ValueError(f"{id}: name, description, or measures is too thin")
    if score_max is not None and score_max < score_min:
        raise ValueError(f"{id}: score max below min")
    if direction == "higher_better" and utility_axis == "quality" and quality_transform != "identity":
        raise ValueError(f"{id}: higher-better quality metrics use identity transform")
    if direction == "lower_better" and utility_axis == "quality" and quality_transform != "one_minus":
        raise ValueError(f"{id}: lower-better quality metrics must transform with one_minus")
    if utility_axis != "quality" and quality_transform != "not_a_quality_input":
        raise ValueError(f"{id}: non-quality axis cannot carry a quality transform")
    if suggested_gate and not gate_suitable:
        raise ValueError(f"{id}: suggested gate set but gate_suitable is false")
    if always_on and layer not in {"operational"}:
        raise ValueError(f"{id}: always-on metrics are operational")
    points = []
    for point in interpretation:
        if set(point) != {"at", "meaning"} or len(point["meaning"]) < 12:
            raise ValueError(f"{id}: interpretation points need at and meaning")
        points.append({"at": str(point["at"]), "meaning": point["meaning"].strip()})
    if len(points) < 2:
        raise ValueError(f"{id}: need at least two interpretation points")
    for industry in industries:
        _choice(f"{id} industry", industry, INDUSTRIES)
    for kind in default_for_kinds:
        _choice(f"{id} kind", kind, KINDS)
    for item in inputs:
        _choice(f"{id} input", item, INPUTS)
    record = {
        "id": id,
        "name": name.strip(),
        "category": _choice("category", category, CATEGORIES),
        "description": description.strip(),
        "measures": measures.strip(),
        "when_to_use": {
            "use_cases": _strings("use_cases", use_cases, 1),
            "industries": list(industries),
            "signals": _strings("signals", signals, 2),
        },
        "when_not_to_use": _strings("when_not_to_use", when_not_to_use, 2),
        "required_inputs": {
            "inputs": list(inputs),
            "notes": input_notes.strip(),
        },
        "computation": {
            "method": _choice("method", method, METHODS),
            "formula": formula.strip(),
            "procedure": _strings("procedure", procedure, 3),
            "implementations": _strings("implementations", implementations, 1),
        },
        "score": {
            "min": score_min,
            "max": score_max,
            "unit": _choice("unit", unit, UNITS),
            "direction": _choice("direction", direction, DIRECTIONS),
            "interpretation": points,
            "aggregation": aggregation.strip(),
            "suggested_gate": suggested_gate,
        },
        "cost_effort": {
            "level": _choice("cost_level", cost_level, COST_LEVELS),
            "driver": cost_driver.strip(),
            "notes": cost_note.strip(),
        },
        "limitations": _strings("limitations", limitations, 2),
        "related_metrics": _strings("related_metrics", related_metrics, 1),
        "tags": _strings("tags", tags, 4),
        "provenance": _strings("provenance", provenance, 1),
        "granularity": _choice("granularity", granularity, GRANULARITY),
        "layer": _choice("layer", layer, LAYERS),
        "selector_priority": _choice("selector_priority", selector_priority, PRIORITIES),
        "gate_suitable": gate_suitable,
        "always_on": always_on,
        "default_for_kinds": list(default_for_kinds),
        "utility_axis": _choice("utility_axis", utility_axis, UTILITY_AXES),
        "quality_transform": _choice("quality_transform", quality_transform, TRANSFORMS),
        "construct_group": construct_group.strip(),
        "group_role": _choice("group_role", group_role, GROUP_ROLES),
        "aliases": _strings("aliases", aliases, 0) if aliases else [],
        "config": config or {},
        "reported_statistics": _strings("reported_statistics", reported_statistics, 1)
        if reported_statistics
        else [],
        "catalog_match": id in CATALOG_IDS,
        "runtime_status": status_for(id),
    }
    if len(record["required_inputs"]["notes"]) < 20:
        raise ValueError(f"{id}: input notes too thin")
    if len(record["computation"]["formula"]) < 12:
        raise ValueError(f"{id}: formula too thin")
    if len(record["cost_effort"]["notes"]) < 20:
        raise ValueError(f"{id}: cost note too thin")
    return record
