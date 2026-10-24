"""Made-up examples for score(), judge(), aggregate(), and percentiles()."""

import asyncio
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "backend"))
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "metric-bank" / "src"))

from biy.metrics import (  # noqa: E402
    METRICS,
    CaseView,
    OutputView,
    UnimplementedMetricError,
    aggregate,
    judge,
    percentiles,
    score,
)
from biy.metrics.judge import load_prompt  # noqa: E402
from biy.metrics.score import SCORERS  # noqa: E402
from metric_bank.runtime import IMPLEMENTED, JUDGE, RUNNER_MEASURED  # noqa: E402


def _case(reference, schema=None):
    return CaseView(input={"vars": {"q": "amount"}}, reference=reference, io_spec={"response_schema": schema})


def _out(text=None, payload=None):
    return OutputView(text=text, json=payload, tool_calls=None)


def test_runtime_status_matches_score_dispatch():
    implemented = {metric_id for metric_id, info in METRICS.items() if info is not None}
    assert set(SCORERS) <= implemented
    assert set(SCORERS) == set(IMPLEMENTED)
    assert {"rubric_score", "pairwise_vs_baseline"} <= set(JUDGE)
    assert set(JUDGE).isdisjoint(SCORERS)
    assert RUNNER_MEASURED.isdisjoint(SCORERS)
    for metric_id in SCORERS:
        assert METRICS[metric_id].id == metric_id


def test_unimplemented_ids_fail_loudly():
    case = _case("hello")
    output = _out(text="hello")
    with pytest.raises(UnimplementedMetricError, match="runtime_status=planned"):
        score("thumbs_up_rate", case, output, {})
    with pytest.raises(UnimplementedMetricError, match="runtime_status=judge"):
        score("faithfulness", case, output, {})
    with pytest.raises(UnimplementedMetricError, match="runtime_status=judge"):
        score("rubric_score", case, output, {})
    with pytest.raises(UnimplementedMetricError, match="runtime_status=runner_measured"):
        score("ttft_ms", case, output, {})
    with pytest.raises(KeyError):
        score("not_a_metric", case, output, {})
    assert score("exact_match", _case(None), output, {}) is None


def test_classification_label_ignores_whitespace_think_blocks_and_trailing_punctuation():
    billing = _case("billing")
    assert score("classification_accuracy", billing, _out(text="\n\nbilling"), {}) == 1.0
    assert score("classification_accuracy", billing, _out(text="<think>reason</think>\n\nBilling."), {}) == 1.0
    assert score("classification_accuracy", billing, _out(text="shipping"), {}) == 0.0
    assert score("classification_precision", billing, _out(text="\n\nbilling"), {}) == 1.0


def test_registry_uses_bank_direction_and_aliases():
    assert METRICS["cer"].utility_axis == "none"
    assert METRICS["cer"].direction == "lower_better"
    assert METRICS["character_accuracy"].utility_axis == "quality"
    assert METRICS["field_f1"].id == "field_f1"
    assert score("label_accuracy", _case("billing"), _out(text="Billing"), {}) == 1.0


def test_schema_and_fields():
    schema = {"type": "object", "required": ["amount"], "properties": {"amount": {"type": "number"}}}
    case = _case({"amount": 10, "code": "A"}, schema)
    good = _out(payload={"amount": 10, "code": "A"})
    extra = _out(payload={"amount": 10, "code": "A", "note": "invented"})
    wrong = _out(payload={"amount": "ten"})
    assert score("json_schema_valid", case, good, {}) == 1.0
    assert score("json_schema_valid", case, wrong, {}) == 0.0
    assert score("json_schema_valid", _case({"amount": 1}), good, {}) is None
    assert score("field_accuracy", case, extra, {}) == 1.0
    assert score("field_f1", case, extra, {}) < 1.0
    assert score("field_f1", case, good, {}) == 1.0
    assert score("field_accuracy", case, _out(payload={"amount": 10.0, "code": "a"}), {"matchers": {"code": {"type": "casefold"}}}) == 1.0


def test_exact_match_keeps_non_ascii():
    assert score("exact_match", _case("北京"), _out(text="上海"), {}) == 0.0
    assert score("exact_match", _case("北京"), _out(text="北京"), {}) == 1.0
    assert score("exact_match", _case("Ärger"), _out(text="Rger"), {}) == 0.0
    assert score("exact_match", _case("The Cat."), _out(text="the cat"), {}) == 1.0


def test_ocr_and_boxes():
    case = _case({"text": "cat", "boxes": [[0, 0, 2, 2]]})
    slipped = _out(payload={"text": "car", "boxes": [[0, 0, 2, 2]]})
    cer = score("cer", case, slipped, {})
    assert cer == 1 / 3
    assert score("character_accuracy", case, slipped, {}) == 1 - cer
    word_case = _case("the cat")
    assert score("wer", word_case, _out(text="the cat sat"), {}) == 0.5
    assert score("word_accuracy", word_case, _out(text="the cat"), {}) == 1.0
    assert score("bbox_iou", case, slipped, {}) == 1.0
    assert score("bbox_f1", case, _out(payload={"boxes": [[10, 10, 12, 12]]}), {}) == 0.0
    partial = _out(payload={"boxes": [[0, 0, 2, 2], [10, 10, 11, 11]]})
    # one hit and one extra → precision 0.5, recall 1 → F1 2/3
    assert abs(score("bbox_f1", case, partial, {}) - (2 / 3)) < 1e-9


def test_aggregate_and_percentiles():
    stat = aggregate([1, 2, 3], n_boot=200, seed=1)
    assert stat.n == 3
    assert stat.mean == 2
    assert stat.std == 1
    assert stat.ci_low <= stat.mean <= stat.ci_high
    flat = aggregate([5, 5, 5], n_boot=20, seed=0)
    assert flat.ci_low == flat.ci_high == 5
    pct = percentiles([10, 20, 30, 40])
    assert pct.p50 == 25
    assert pct.p95 > pct.p50


def test_prompts_match_and_judges_parse():
    for name in ("rubric.md", "pairwise.md", "named.md"):
        repo = Path(__file__).resolve().parents[3] / "prompts" / "judge" / name
        packaged = Path(__file__).resolve().parent / "prompt_templates" / name
        assert repo.read_text(encoding="utf-8") == packaged.read_text(encoding="utf-8")
        assert load_prompt(name) == repo.read_text(encoding="utf-8")

    async def rubric_llm(messages):
        assert "be brief" in messages[0]["content"]
        assert "Instructions the model was given" in messages[0]["content"]
        assert "(none)" in messages[0]["content"]
        return '{"score": 0.25, "reasoning": "too long"}'

    rubric = asyncio.run(
        judge("rubric_score", _case("x"), _out(text="hello"), None, {"rubric": "be brief"}, rubric_llm)
    )
    assert rubric.score == 0.25 and rubric.winner is None

    calls = {"n": 0}

    async def agree(messages):
        calls["n"] += 1
        # First order: A is the candidate. Second order: B is the candidate.
        winner = "A" if calls["n"] == 1 else "B"
        return '{"winner": "%s", "reasoning": "clearer"}' % winner

    pairwise = asyncio.run(
        judge("pairwise_vs_baseline", _case("x"), _out(text="better"), _out(text="worse"), {}, agree)
    )
    assert calls["n"] == 2
    assert pairwise.winner == "candidate" and pairwise.score == 1.0

    calls["n"] = 0

    async def disagree(messages):
        calls["n"] += 1
        return '{"winner": "A", "reasoning": "first listed"}'

    tie = asyncio.run(
        judge("pairwise_vs_baseline", _case("x"), _out(text="a"), _out(text="b"), {}, disagree)
    )
    assert tie.winner == "tie" and tie.score == 0.5
