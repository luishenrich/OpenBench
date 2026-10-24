"""Schema, formula sketches, and the five worked scorecards."""

import json
from pathlib import Path

import jsonschema

from metric_bank.build import build_bank
from metric_bank import illustrative as sketch
from metric_bank.schema_doc import schema_document
from metric_bank.selector import EXAMPLES, select
from metric_bank.spec import CATALOG_IDS

ROOT = Path(__file__).resolve().parents[1]


def test_bank_matches_schema_and_catalogue():
    bank = build_bank()
    schema = schema_document()
    jsonschema.Draft202012Validator.check_schema(schema)
    jsonschema.Draft202012Validator(
        schema, format_checker=jsonschema.Draft202012Validator.FORMAT_CHECKER
    ).validate(bank)
    ids = {item["id"] for item in bank["metrics"]}
    assert CATALOG_IDS <= ids
    assert len(bank["metrics"]) == 152
    assert len(bank["categories"]) == 21
    on_disk = json.loads((ROOT / "data" / "metric-bank.json").read_text(encoding="utf-8"))
    assert on_disk == bank


def test_quality_axis_is_higher_better_unit_interval():
    for metric in build_bank()["metrics"]:
        if metric["utility_axis"] != "quality":
            continue
        assert metric["score"]["direction"] == "higher_better"
        assert metric["score"]["min"] == 0
        assert metric["score"]["max"] == 1
        assert metric["quality_transform"] == "identity"


def test_worked_scorecards():
    bank = build_bank()
    cards = {example["id"]: select(example, bank) for example in EXAMPLES}
    health = cards["health_claim_extraction"]
    assert health["quality"] == ["field_accuracy", "numeric_tolerance_accuracy", "json_schema_valid"]
    assert health["speed"]["ranking"] == "e2e_ms"
    assert health["risk_gates"][0]["id"] == "pii_leakage_rate"
    assert "ttft_ms" not in health["quality"]

    chat = cards["fintech_support_chat"]
    assert chat["quality"] == ["faithfulness", "tone_brand_fit", "answer_relevancy"]
    assert chat["speed"] == {"ranking": "ttft_ms", "also_report": ["ttfat_ms"]}
    assert [item["id"] for item in chat["risk_gates"]] == [
        "safety_violation",
        "over_refusal",
        "non_advice_compliance",
    ]
    assert "rubric_score" not in chat["quality"]

    batch = cards["nightly_ad_copy"]
    assert batch["quality"] == ["tone_brand_fit", "contains_none", "length_within"]
    assert batch["speed"]["ranking"] is None
    assert batch["also_report"] == ["monthly_cost_usd"]

    agent = cards["coding_agent"]
    assert agent["quality"] == [
        "tool_call_correct",
        "tool_choice_correct",
        "code_tests_pass",
        "agent_task_success",
    ]
    assert "tool_argument_schema_valid" not in agent["quality"]
    assert any(item["id"] == "tool_argument_schema_valid" for item in agent["task_gates"])
    assert agent["reliability_extra"] == ["pass_hat_k"]
    assert agent["speed"]["ranking"] == "task_e2e_ms"

    legal = cards["legal_contract_rag"]
    assert legal["quality"] == [
        "faithfulness",
        "citation_precision",
        "citation_recall",
        "unknown_abstention",
        "context_recall",
    ]
    assert legal["quality_alternates"][0] == "answer_relevancy"
    assert any(item["id"] == "faithfulness" and item["threshold"] == ">= 0.9" for item in legal["task_gates"])
    assert all(item["id"] != "hallucination" for item in legal["risk_gates"])


def test_open_ended_falls_back_to_one_judge():
    card = select(
        {
            "id": "open_copy",
            "title": "Open copy",
            "kind": "generation",
            "industry": "media",
            "narrative": "Write something good. There is no rubric yet and no reference.",
            "open_ended_without_spec": True,
            "waiting": True,
        }
    )
    assert card["quality"] == ["rubric_score"]
    assert card["judging"] == ["rubric_score"]


def test_formula_sketches():
    assert sketch.exact_match("The Cat.", "the cat")
    assert sketch.token_f1("the cat sat", "cat sat") == 0.8
    assert sketch.classification_f1(["a", "b", "a"], ["a", "a", "a"]) == 0.4
    assert sketch.faithfulness_from_verdicts([True, True, False]) == 2 / 3
    assert sketch.pass_at_k(5, 2, 1) == 0.4
    assert sketch.pass_at_k(5, 5, 2) == 1.0
    assert sketch.pass_hat_k(5, 2, 2) == 0.1
    assert sketch.pass_hat_k(5, 1, 2) == 0.0
    assert sketch.target_score(50, 100, 1000) == 1.0
    assert sketch.target_score(1000, 100, 1000) == 0.0
    assert abs(sketch.target_score(200, 100, 1000) - (1 - __import__("math").log(2) / __import__("math").log(10))) < 1e-12
    assert sketch.expected_calibration_error([1, 1, 0, 0], [True, True, False, False]) == 0
    assert sketch.rouge_l("a b c", "a b c") == 1
    assert sketch.strict_instruction_pass([True, False]) is False
    assert abs(sketch.ambiguous_context_bias(0.5, 8, 10) - 0.3) < 1e-12
    assert sketch.json_schema_valid({"a": 1}, {"type": "object", "required": ["a"]})
    assert not sketch.json_schema_valid({}, {"type": "object", "required": ["a"]})
    assert sketch.case_cost_usd(1_000_000, 200_000, 100_000, {"input": 3, "cached": 0.3, "output": 15}) == 3.96
    assert sketch.percentile([1, 2, 3, 4], 100) == 4
