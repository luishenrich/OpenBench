"""Made-up cases for the new deterministic scorers and the three-juror jury."""

import asyncio
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "backend"))
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "metric-bank" / "src"))

from biy.metrics import CaseView, OutputView, judge, score  # noqa: E402
from biy.metrics.deterministic import EXTRA_SCORERS  # noqa: E402
from biy.metrics.judge import DEFAULT_JURY  # noqa: E402
from biy.metrics.judge_rubrics import RUBRICS  # noqa: E402
from biy.metrics.score import SCORERS  # noqa: E402
from metric_bank.build import build_bank  # noqa: E402
from metric_bank.runtime import IMPLEMENTED, JUDGE, PLANNED_REASONS, RUNNER_MEASURED, status_for  # noqa: E402

JURY = [dict(item) for item in DEFAULT_JURY]


def _case(reference=None, schema=None, tools=None, payload=None):
    io_spec = {}
    if schema is not None:
        io_spec["response_schema"] = schema
    if tools is not None:
        io_spec["tools"] = tools
    return CaseView(input=payload or {"vars": {"q": "q"}}, reference=reference, io_spec=io_spec)


def _out(text=None, payload=None, tools=None):
    return OutputView(text=text, json=payload, tool_calls=tools)


def test_dispatch_covers_the_bank():
    bank_ids = {item["id"] for item in build_bank()["metrics"]}
    planned = {metric_id for metric_id in bank_ids if status_for(metric_id) == "planned"}
    assert set(SCORERS) == set(IMPLEMENTED)
    assert set(EXTRA_SCORERS) <= set(SCORERS)
    assert set(RUBRICS) == set(JUDGE) - {"rubric_score", "pairwise_vs_baseline"}
    assert set(PLANNED_REASONS) == planned
    assert len(IMPLEMENTED) + len(JUDGE) + len(RUNNER_MEASURED) + len(planned) == len(bank_ids)


def test_every_extra_scorer_on_a_made_up_case():
    schema = {
        "type": "object",
        "required": ["status"],
        "properties": {"status": {"type": "string", "enum": ["ok", "no"]}},
    }
    tools = [{"name": "search", "parameters": {"type": "object", "required": ["q"], "properties": {"q": {"type": "string"}}}}]
    expected = {
        "classification_precision": (_case("ok"), _out(text="ok"), {}, 1.0),
        "classification_recall": (_case("ok"), _out(text="no"), {}, 0.0),
        "contains_all": (_case(["cat", "hat"]), _out(text="the cat and the hat"), {}, 1.0),
        "contains_none": (_case(None), _out(text="plain"), {"banned": ["rival"]}, 1.0),
        "regex_match": (_case(None), _out(text="id=7"), {"pattern": r"id=\d"}, 1.0),
        "set_f1": (_case(["a", "b"]), _out(payload=["a", "b"]), {}, 1.0),
        "token_f1": (_case("the cat"), _out(text="the cat"), {}, 1.0),
        "hallucinated_tool_rate": (
            _case(None, tools=tools),
            _out(tools=[{"name": "search", "arguments": {"q": "x"}}]),
            {},
            0.0,
        ),
        "irrelevance_abstention": (_case("abstain"), _out(text="nothing"), {}, 1.0),
        "step_efficiency": (_case({"expected_steps": 1}), _out(tools=[{"name": "search", "arguments": {}}]), {}, 1.0),
        "tool_argument_schema_valid": (
            _case(None, tools=tools),
            _out(tools=[{"name": "search", "arguments": {"q": "x"}}]),
            {},
            1.0,
        ),
        "tool_call_correct": (
            _case({"tool_calls": [{"name": "search", "arguments": {"q": "x"}}]}),
            _out(tools=[{"name": "search", "arguments": {"q": "x"}}]),
            {},
            1.0,
        ),
        "tool_call_f1": (
            _case({"tool_calls": [{"name": "search", "arguments": {}}]}),
            _out(tools=[{"name": "search", "arguments": {}}]),
            {},
            1.0,
        ),
        "tool_choice_correct": (
            _case({"tool_calls": [{"name": "search", "arguments": {}}]}),
            _out(tools=[{"name": "search", "arguments": {}}]),
            {},
            1.0,
        ),
        "constraint_satisfaction_rate": (_case(None), _out(text="Hello"), {"must_include": ["hello"]}, 1.0),
        "instruction_following": (_case(None), _out(text="Hello"), {"must_include": ["Hello"]}, 1.0),
        "instruction_following_loose": (_case(None), _out(text="Hello"), {"must_include": ["hello"]}, 1.0),
        "length_within": (_case(None), _out(text="hi"), {"max_chars": 5}, 1.0),
        "negative_constraint_adherence": (_case(None), _out(text="plain"), {"must_not_include": ["rival"]}, 1.0),
        "json_valid": (_case(None), _out(text='{"a": 1}'), {}, 1.0),
        "enum_adherence": (_case(None, schema=schema), _out(payload={"status": "ok"}), {}, 1.0),
        "extraneous_field_rate": (_case({"a": 1}), _out(payload={"a": 1, "b": 2}), {}, 0.5),
        "format_valid": (_case(None), _out(text="a@b.co"), {"format": "email"}, 1.0),
        "numeric_tolerance_accuracy": (_case({"amount": 10}), _out(payload={"amount": 10.005}), {}, 1.0),
        "required_field_recall": (_case(None, schema=schema), _out(payload={"status": "ok"}), {}, 1.0),
        "math_equivalence": (_case("2"), _out(text="the answer is 2"), {}, 1.0),
        "context_entity_recall": (
            _case("Paris 2020", payload={"source": "Paris 2020 is the place"}),
            _out(text="yes"),
            {},
            1.0,
        ),
        "compression_ratio": (_case(None, payload={"source": "abcd"}), _out(text="ab"), {}, 0.5),
        "rouge_l": (_case("a b c"), _out(text="a b c"), {}, 1.0),
        "summary_conciseness": (_case(None), _out(text="hi"), {"max_chars": 3}, 1.0),
        "bleu": (_case("the cat sat"), _out(text="the cat sat"), {}, None),
        "translation_chrf": (_case("chat"), _out(text="chat"), {}, None),
        "locale_format_adherence": (_case(None), _out(text="1.5"), {"locale": "en-US"}, 1.0),
        "cross_lingual_consistency": (_case("the cat sat"), _out(text="the cat sat"), {}, None),
        "syntax_valid_rate": (_case(None), _out(text="x = 1\n"), {}, 1.0),
        "insecure_code_rate": (_case(None), _out(text="eval('1')"), {}, 1.0),
        "codebleu": (_case("x = 1"), _out(text="x = 1"), {}, None),
        "pii_leakage_rate": (_case(None), _out(text="mail a@b.co"), {}, 1.0),
        "secret_leakage_rate": (_case(None), _out(text="key AKIAIOSFODNN7EXAMPLE"), {}, 1.0),
        "unnecessary_pii_echo_rate": (
            _case(None, payload={"text": "user a@b.co"}),
            _out(text="wrote a@b.co"),
            {},
            1.0,
        ),
        "copyright_regurgitation": (
            _case("a" * 40),
            _out(text="prefix " + ("a" * 40)),
            {},
            1.0,
        ),
        "readability_band_match": (_case(None), _out(text="The cat sat."), {"readability": {"min": -100, "max": 300}}, 1.0),
        "empty_output_rate": (_case(None), _out(text="  "), {}, 1.0),
        "negation_robustness": (_case("no", payload={"text": "do not approve"}), _out(text="no"), {}, 1.0),
        "unknown_abstention": (_case("unknown"), _out(text="I don't know"), {}, 1.0),
        "brier_score": (_case("a"), _out(payload={"label": "a", "confidence": 1}), {}, 0.0),
        "overconfidence_rate": (_case("a"), _out(payload={"label": "b", "confidence": 0.9}), {}, 1.0),
        "refusal_calibration": (_case("refuse"), _out(text="I cannot help with that"), {}, 1.0),
    }
    assert set(expected) == set(EXTRA_SCORERS)
    for metric_id, (case, output, config, wanted) in expected.items():
        got = score(metric_id, case, output, config)
        assert got is not None, metric_id
        if wanted is None:
            assert 0.0 <= got <= 1.0, metric_id
            assert got > 0.5, metric_id
        else:
            assert got == pytest.approx(wanted), metric_id


def test_instruction_following_is_case_sensitive_and_missing_inputs_are_none():
    assert score("instruction_following", _case(None), _out(text="Hello"), {"must_include": ["hello"]}) == 0.0
    assert score("contains_all", _case(None), _out(text="hi"), {}) is None
    assert score("math_equivalence", _case("2"), _out(text="the answer is 3"), {}) == 0.0
    assert score("pii_leakage_rate", _case(None), _out(text="no personal data"), {}) == 0.0
    assert score("tool_choice_correct", _case({"tool_calls": []}), _out(tools=[{"name": "search", "arguments": {}}]), {}) == 0.0


def _rubric_reply(score_value):
    return '{"score": %s, "reasoning": "checked"}' % score_value


def test_single_judge_path_is_unchanged_for_a_named_metric():
    async def call_llm(messages):
        assert "faithfulness" in messages[0]["content"]
        assert "winner" not in messages[0]["content"]
        return _rubric_reply(0.4)

    result = asyncio.run(judge("faithfulness", _case("src"), _out(text="claim"), None, {}, call_llm))
    assert result.score == 0.4
    assert result.winner is None
    assert result.reasoning == "checked"
    assert result.agreement is None
    assert result.abstained == []


def test_jury_means_rubric_scores_and_stores_effort_and_byok_cost():
    seen = []

    async def call_llm(messages, judge=None):
        seen.append(judge["id"])
        usage = {"cost": 0, "is_byok": True, "cost_details": {"upstream_inference_cost": 0.02}}
        if judge["id"] == "deepseek":
            usage = {"cost": 0.01, "is_byok": False}
        value = 0.2 if judge["id"] == "luna" else 0.9
        return {"text": _rubric_reply(value), "usage": usage}

    result = asyncio.run(
        judge("faithfulness", _case("src"), _out(text="claim"), None, {"jury": True}, call_llm)
    )
    assert seen == ["luna", "deepseek", "glm"]
    assert result.score == pytest.approx((0.2 + 0.9 + 0.9) / 3)
    assert result.agreement is False
    assert result.low_agreement is True
    assert result.reasoning_effort == {
        "openrouter:openai/gpt-6-luna@low": "low",
        "nebius:deepseek-ai/DeepSeek-V4.1-Flash-1017@low": "low",
        "nebius:zai-org/GLM-5.3": None,
    }
    assert [row["key"] for row in result.jurors] == list(result.reasoning_effort)
    assert result.jurors[0]["cost_usd"] == pytest.approx(0.02)
    assert result.jurors[1]["cost_usd"] == pytest.approx(0.01)
    assert result.jurors[2]["cost_usd"] == pytest.approx(0.02)
    assert "gpt-6-luna@low:" in result.reasoning
    assert "DeepSeek-V4.1-Flash-1017@low:" in result.reasoning
    assert "  |  " in result.reasoning
    assert result.abstained == []


def test_jury_pairwise_wins_only_when_every_judge_agrees_in_both_orders():
    def script(order):
        async def call_llm(messages, judge=None):
            order.append(judge["id"])
            # Both orders, both judges: A then B means the candidate won both presentations.
            winner = "A" if order.count(judge["id"]) == 1 else "B"
            return '{"winner": "%s", "reasoning": "clear"}' % winner

        return call_llm

    result = asyncio.run(
        judge(
            "pairwise_vs_baseline",
            _case("x"),
            _out(text="better"),
            _out(text="worse"),
            {"judges": JURY, "candidate_key": "nebius:zai-org/GLM-4.7"},
            script([]),
        )
    )
    assert result.winner == "candidate" and result.score == 1.0
    assert result.agreement is True
    assert result.low_agreement is False
    assert result.abstained == ["nebius:zai-org/GLM-5.3"]
    assert {row["key"] for row in result.jurors} == {
        "openrouter:openai/gpt-6-luna@low",
        "nebius:deepseek-ai/DeepSeek-V4.1-Flash-1017@low",
    }

    counts = {"luna": 0, "deepseek": 0, "glm": 0}

    def split(messages, judge=None):
        counts[judge["id"]] += 1
        # Luna picks the candidate in both orders. DeepSeek and GLM pick the baseline.
        if judge["id"] == "luna":
            winner = "A" if counts["luna"] == 1 else "B"
        else:
            winner = "B" if counts[judge["id"]] == 1 else "A"
        return '{"winner": "%s", "reasoning": "split"}' % winner

    tie = asyncio.run(
        judge(
            "length_controlled_win_rate",
            _case("x"),
            _out(text="short"),
            _out(text="long"),
            {"judges": JURY},
            split,
        )
    )
    assert tie.winner == "tie" and tie.score == 0.5
    assert tie.agreement is False and tie.low_agreement is True


def test_judges_abstain_on_their_own_family_and_the_other_two_decide():
    async def deepseek_and_glm(messages, judge=None):
        assert judge["id"] in {"deepseek", "glm"}
        return _rubric_reply(0.7)

    luna_out = asyncio.run(
        judge(
            "safety_violation",
            _case("x"),
            _out(text="ok"),
            None,
            {"jury": True, "candidate_key": "openrouter:openai/gpt-oss-120b"},
            deepseek_and_glm,
        )
    )
    assert luna_out.score == 0.7
    assert luna_out.abstained == ["openrouter:openai/gpt-6-luna@low"]
    assert luna_out.agreement is True
    assert {row["key"] for row in luna_out.jurors} == {
        "nebius:deepseek-ai/DeepSeek-V4.1-Flash-1017@low",
        "nebius:zai-org/GLM-5.3",
    }

    async def luna_and_glm(messages, judge=None):
        assert judge["id"] in {"luna", "glm"}
        return _rubric_reply(0.1)

    deepseek_out = asyncio.run(
        judge(
            "g_eval",
            _case("x"),
            _out(text="ok"),
            None,
            {"judges": JURY, "candidate_key": "nebius:deepseek-ai/DeepSeek-V4.1-Flash-1017"},
            luna_and_glm,
        )
    )
    assert deepseek_out.abstained == ["nebius:deepseek-ai/DeepSeek-V4.1-Flash-1017@low"]
    assert deepseek_out.score == 0.1
    assert deepseek_out.agreement is True

    async def not_glm(messages, judge=None):
        assert judge["id"] in {"luna", "deepseek"}
        return _rubric_reply(0.4)

    glm_out = asyncio.run(
        judge(
            "g_eval",
            _case("x"),
            _out(text="ok"),
            None,
            {"jury": True, "candidate_key": "nebius:zai-org/GLM-5.3"},
            not_glm,
        )
    )
    assert glm_out.abstained == ["nebius:zai-org/GLM-5.3"]
    assert glm_out.agreement is True

    async def glm_alone(messages, judge=None):
        assert judge["id"] == "glm"
        body = messages[0]["content"]
        # Candidate text is "better". Pick whichever side presents it.
        winner = "A" if body.index("better") < body.index("base") else "B"
        return '{"winner": "%s", "reasoning": "clear"}' % winner

    glm_decides = asyncio.run(
        judge(
            "pairwise_vs_baseline",
            _case("x"),
            _out(text="better"),
            _out(text="base"),
            {
                "judges": JURY,
                "candidate_key": "openai/gpt-6-luna",
                "baseline_key": "deepseek-ai/DeepSeek-V4",
            },
            glm_alone,
        )
    )
    assert glm_decides.abstained == [
        "openrouter:openai/gpt-6-luna@low",
        "nebius:deepseek-ai/DeepSeek-V4.1-Flash-1017@low",
    ]
    assert glm_decides.agreement is None
    assert glm_decides.winner == "candidate"

    two = [item for item in JURY if item["id"] != "glm"]
    with pytest.raises(ValueError, match="abstained"):
        asyncio.run(
            judge(
                "pairwise_vs_baseline",
                _case("x"),
                _out(text="ok"),
                _out(text="base"),
                {
                    "judges": two,
                    "candidate_key": "openai/gpt-6-luna",
                    "baseline_key": "deepseek-ai/DeepSeek-V4",
                },
                glm_alone,
            )
        )


def test_rubric_and_pairwise_prompts_include_the_system_prompt():
    seen = []

    async def call_llm(messages):
        seen.append(messages[0]["content"])
        if "winner" in messages[0]["content"]:
            return '{"winner": "A", "reasoning": "ok"}'
        return _rubric_reply(1)

    case = CaseView(
        input={"q": "hi"},
        reference=None,
        io_spec={"system_prompt": "Shipping takes two business days."},
    )
    asyncio.run(judge("rubric_score", case, _out(text="two business days"), None, {}, call_llm))
    assert "Shipping takes two business days." in seen[-1]
    assert "Instructions the model was given" in seen[-1]

    blank = CaseView(input={"q": "hi"}, reference=None, io_spec={})
    asyncio.run(
        judge("pairwise_vs_baseline", blank, _out(text="a"), _out(text="b"), {}, call_llm)
    )
    assert seen[-1].count("(none)") >= 1
    assert "Instructions the model was given" in seen[-1]
