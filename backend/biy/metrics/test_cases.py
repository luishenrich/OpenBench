"""Synthetic cases from a fake call_llm. No network and no database."""

import asyncio
import json
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "backend"))
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "metric-bank" / "src"))

from biy.metrics.cases import generate_case_inputs, resolve_strategy  # noqa: E402

SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "required": ["vendor", "total"],
    "properties": {"vendor": {"type": "string"}, "total": {"type": "number"}},
}

USE_CASE = {"name": "Invoice extract", "kind": "extraction", "description": "Pull vendor and total from a short invoice."}
IO = {"system_prompt": "Reply with JSON.", "user_template": "Invoice:\n{{text}}", "response_schema": SCHEMA}
SEED = {"input": {"vars": {"text": "Seed Co owes 1"}}, "reference": {"vendor": "Seed Co", "total": 1}, "tags": ["repo"]}


def _llm(payloads: list[str]):
    calls = {"n": 0, "messages": []}

    async def call_llm(messages):
        calls["messages"].append(messages)
        text = payloads[min(calls["n"], len(payloads) - 1)]
        calls["n"] += 1
        return text

    return call_llm, calls


def test_prompt_copies_match():
    repo = ROOT / "prompts" / "cases" / "generate.md"
    packaged = Path(__file__).resolve().parent / "prompt_templates" / "generate.md"
    assert repo.read_text(encoding="utf-8") == packaged.read_text(encoding="utf-8")


def test_auto_strategy_follows_schema_or_kind():
    assert resolve_strategy("auto", IO, USE_CASE) == "schema_first"
    assert resolve_strategy("auto", {}, {"kind": "chat"}) == "persona_grid"
    assert resolve_strategy("persona_grid", IO, USE_CASE) == "persona_grid"
    with pytest.raises(ValueError):
        resolve_strategy("expand", IO, USE_CASE)


def test_schema_cases_are_validated_and_deduped():
    good = {"input": {"vars": {"text": "Acme billed 12"}}, "reference": {"vendor": "Acme", "total": 12}, "tags": ["edge"]}
    other = {"input": {"text": "Gamma billed 4"}, "reference": {"vendor": "Gamma", "total": 4}, "tags": []}
    missing = {"input": {"vars": {"text": "no total"}}, "reference": {"vendor": "Nope"}, "tags": []}
    copied = {"input": SEED["input"], "reference": {"vendor": "Seed Co", "total": 9}, "tags": []}
    extra = {"input": {"text": "Beta billed 0"}, "reference": {"vendor": "Beta", "total": 0, "note": "x"}, "tags": []}
    image = {"input": {"vars": {"text": "scan"}, "images": ["https://example.test/a.png"]}, "reference": {"vendor": "Scan", "total": 3}}
    call_llm, calls = _llm([json.dumps([missing, copied, extra, image, good, good, other])])

    cases = asyncio.run(generate_case_inputs(USE_CASE, IO, [SEED], n=2, call_llm=call_llm, strategy="auto"))

    assert calls["n"] == 1
    assert [item["reference"] for item in cases] == [
        {"vendor": "Acme", "total": 12},
        {"vendor": "Gamma", "total": 4},
    ]
    assert cases[0]["source"] == "synthetic"
    assert cases[0]["tags"][:2] == ["synthetic", "schema_first"]
    assert "edge" in cases[0]["tags"]
    assert cases[0]["input"] == {"vars": {"text": "Acme billed 12"}}
    assert cases[1]["input"] == {"vars": {"text": "Gamma billed 4"}}
    assert "schema_first" in calls["messages"][0][0]["content"]


def test_second_call_fills_the_quota():
    first = json.dumps([{"input": {"vars": {"text": "one"}}, "reference": {"vendor": "One", "total": 1}}])
    second = json.dumps([
        {"input": {"vars": {"text": "one"}}, "reference": {"vendor": "One", "total": 1}},
        {"input": {"vars": {"text": "two"}}, "reference": {"vendor": "Two", "total": 2}},
    ])
    call_llm, calls = _llm([first, second])
    cases = asyncio.run(generate_case_inputs(USE_CASE, IO, [], n=2, call_llm=call_llm, strategy="schema_first"))
    assert calls["n"] == 2
    assert [item["reference"]["vendor"] for item in cases] == ["One", "Two"]
    assert "one" in calls["messages"][1][0]["content"]


def test_persona_grid_keeps_string_references():
    chat = {"name": "Help", "kind": "chat", "description": "Answer account questions in a short paragraph."}
    io = {"system_prompt": "Be brief.", "user_template": None, "response_schema": None}
    payload = json.dumps([
        {
            "input": {"messages": [{"role": "user", "content": "How do I reset a fictional password?"}]},
            "reference": "Send the reset link to the address on the fictional account.",
            "tags": ["persona"],
        }
    ])
    call_llm, _calls = _llm([payload])
    cases = asyncio.run(generate_case_inputs(chat, io, [], n=1, call_llm=call_llm))
    assert cases[0]["tags"][:2] == ["synthetic", "persona_grid"]
    assert cases[0]["reference"].startswith("Send the reset")
    assert cases[0]["source"] == "synthetic"


def test_garbage_and_empty_quota():
    call_llm, calls = _llm(["not json"])
    with pytest.raises(ValueError):
        asyncio.run(generate_case_inputs(USE_CASE, IO, [], n=1, call_llm=call_llm))
    assert calls["n"] == 1

    call_llm, calls = _llm(["[]", "[]"])
    with pytest.raises(ValueError, match="no cases"):
        asyncio.run(generate_case_inputs(USE_CASE, IO, [], n=1, call_llm=call_llm))
    assert calls["n"] == 2

    call_llm, calls = _llm(["[]"])
    assert asyncio.run(generate_case_inputs(USE_CASE, IO, [], n=0, call_llm=call_llm)) == []
    assert calls["n"] == 0
