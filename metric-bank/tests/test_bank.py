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
    by_id = {item["id"]: item for item in bank["metrics"]}
    assert "field_f1" not in by_id["field_accuracy"]["aliases"]
    assert by_id["field_f1"]["utility_axis"] == "quality"
    assert len(bank["metrics"]) == 159
    assert len(bank["categories"]) == 22
    on_disk = json.loads((ROOT / "data" / "metric-bank.json").read_text(encoding="utf-8"))
    assert on_disk == bank


def test_catalogue_names_every_bank_id():
    catalogue = (Path(__file__).resolve().parents[2] / "docs" / "metrics-catalog.md").read_text(encoding="utf-8")
    missing = [item["id"] for item in build_bank()["metrics"] if f"`{item['id']}`" not in catalogue]
    assert missing == []


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


def test_scanned_page_uses_vision_metrics():
    card = select(
        {
            "id": "scanned_page",
            "title": "Scanned page",
            "kind": "extraction",
            "industry": "insurance",
            "narrative": "Read a scanned explanation of benefits and return the text plus field boxes.",
            "ocr": True,
            "layout_boxes": True,
            "has_schema": True,
            "waiting": True,
        }
    )
    assert card["quality"] == [
        "character_accuracy",
        "bbox_f1",
        "field_accuracy",
        "json_schema_valid",
    ]
    assert card["also_report"] == ["cer", "wer", "bbox_iou"]
    assert "bbox_iou" not in card["quality"]
    assert "cer" not in card["quality"]
    assert "wer" not in card["quality"]


def test_numeric_fields_survive_a_scanned_page():
    card = select(
        {
            "kind": "extraction",
            "ocr": True,
            "layout_boxes": True,
            "has_schema": True,
            "numeric_fields": True,
        }
    )
    assert "numeric_tolerance_accuracy" in card["quality"]
    assert "bbox_iou" not in card["quality"]
    assert "bbox_f1" in card["quality"]


def test_select_does_not_require_id_title_or_narrative():
    card = select({"kind": "classification"})
    assert card["example_id"] == "brief"
    assert card["title"] == "classification"
    assert card["narrative"] == ""
    assert card["quality"] == ["classification_f1"]


def test_fintech_with_secrets_keeps_refusal_gates():
    card = select(
        {
            "kind": "chat",
            "industry": "finance",
            "user_facing": True,
            "regulated_advice": True,
            "secrets_possible": True,
            "phi_or_customer_data": True,
        }
    )
    ids = [item["id"] for item in card["risk_gates"]]
    assert ids[:3] == ["safety_violation", "over_refusal", "non_advice_compliance"]
    assert "secret_leakage_rate" in ids
    promoted = select(
        {
            "kind": "chat",
            "user_facing": True,
            "regulated_advice": True,
            "secrets_possible": True,
            "phi_or_customer_data": True,
            "risk_priorities": ["secret_leakage_rate"],
        }
    )
    assert promoted["risk_gates"][0]["id"] == "secret_leakage_rate"


def test_formula_sketches():
    assert sketch.exact_match("The Cat.", "the cat")
    assert sketch.exact_match("北京", "上海") is False
    assert sketch.token_f1("北京", "上海") == 0
    assert sketch.exact_match("Ärger", "Rger") is False
    assert sketch.exact_match("Ärger", "ärger")
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
    assert sketch.character_error_rate("cat", "cat") == 0
    assert abs(sketch.character_error_rate("car", "cat") - 1 / 3) < 1e-12
    assert abs(sketch.character_accuracy("car", "cat") - (2 / 3)) < 1e-12
    assert abs(sketch.word_error_rate("the cat sat", "the cat") - 0.5) < 1e-12
    assert sketch.bbox_iou((0, 0, 2, 2), (0, 0, 2, 2)) == 1
    assert sketch.bbox_iou((0, 0, 1, 1), (2, 2, 3, 3)) == 0
    assert sketch.percentile([1, 2, 3, 4], 100) == 4
