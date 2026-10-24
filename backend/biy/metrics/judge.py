"""Rubric and pairwise judges. Pairwise counts a win only when both orders agree."""

from __future__ import annotations

import inspect
import json
import re
from pathlib import Path

from .types import CaseView, JudgeResult, OutputView

_FENCE = re.compile(r"\{.*\}", re.DOTALL)


def _prompt_dirs() -> list[Path]:
    packaged = Path(__file__).resolve().parent / "prompt_templates"
    repo = Path(__file__).resolve().parents[3] / "prompts" / "judge"
    return [repo, packaged]


def load_prompt(name: str) -> str:
    for directory in _prompt_dirs():
        path = directory / name
        if path.is_file():
            return path.read_text(encoding="utf-8")
    raise FileNotFoundError(f"missing judge prompt {name}")


def _fill(template: str, values: dict[str, str]) -> str:
    text = template
    for key, value in values.items():
        text = text.replace("{{" + key + "}}", value)
    return text


def _dump(value: object) -> str:
    if isinstance(value, str):
        return value
    return json.dumps(value, ensure_ascii=False, indent=2, default=str)


def _parse_object(text: str) -> dict:
    match = _FENCE.search(text.strip())
    if not match:
        raise ValueError("judge response did not contain a JSON object")
    parsed = json.loads(match.group(0))
    if not isinstance(parsed, dict):
        raise ValueError("judge response JSON was not an object")
    return parsed


async def _call(call_llm, messages: list[dict]) -> str:
    result = call_llm(messages)
    if inspect.isawaitable(result):
        result = await result
    if not isinstance(result, str):
        raise TypeError("call_llm must return a string")
    return result


def _rubric_messages(case: CaseView, output: OutputView, config: dict) -> list[dict]:
    body = _fill(
        load_prompt("rubric.md"),
        {
            "rubric": str(config.get("rubric") or "Follow the task. Be correct, complete, and on topic."),
            "case_input": _dump(case.input),
            "output": _dump(output.json if output.json is not None else output.text),
        },
    )
    return [{"role": "user", "content": body}]


def _pairwise_messages(case: CaseView, first: OutputView, second: OutputView, config: dict) -> list[dict]:
    body = _fill(
        load_prompt("pairwise.md"),
        {
            "rubric": str(config.get("rubric") or "Prefer the output that answers the input more correctly and completely. Do not prefer length."),
            "case_input": _dump(case.input),
            "output_a": _dump(first.json if first.json is not None else first.text),
            "output_b": _dump(second.json if second.json is not None else second.text),
        },
    )
    return [{"role": "user", "content": body}]


def _absolute_winner(label: str, a_is_candidate: bool) -> str:
    cleaned = label.strip().lower()
    if cleaned == "tie":
        return "tie"
    if cleaned == "a":
        return "candidate" if a_is_candidate else "baseline"
    if cleaned == "b":
        return "baseline" if a_is_candidate else "candidate"
    raise ValueError(f"pairwise winner must be A, B, or tie, got {label!r}")


async def judge(metric_id: str, case: CaseView, output: OutputView, baseline: OutputView | None, config: dict, call_llm) -> JudgeResult:
    if metric_id == "rubric_score":
        parsed = _parse_object(await _call(call_llm, _rubric_messages(case, output, config)))
        score = float(parsed["score"])
        if not 0 <= score <= 1:
            raise ValueError("rubric score must be on [0, 1]")
        return JudgeResult(score=score, reasoning=str(parsed.get("reasoning") or ""), winner=None)
    if metric_id != "pairwise_vs_baseline":
        raise KeyError(f"judge() does not implement {metric_id!r}")
    if baseline is None:
        raise ValueError("pairwise_vs_baseline requires a baseline output")
    first = _parse_object(await _call(call_llm, _pairwise_messages(case, output, baseline, config)))
    second = _parse_object(await _call(call_llm, _pairwise_messages(case, baseline, output, config)))
    left = _absolute_winner(str(first["winner"]), a_is_candidate=True)
    right = _absolute_winner(str(second["winner"]), a_is_candidate=False)
    reasoning = "Order candidate-then-baseline: " + str(first.get("reasoning") or "") + " Order baseline-then-candidate: " + str(second.get("reasoning") or "")
    if left == right and left in {"candidate", "baseline"}:
        return JudgeResult(score=1.0 if left == "candidate" else 0.0, reasoning=reasoning, winner=left)  # type: ignore[arg-type]
    return JudgeResult(score=0.5, reasoning=reasoning, winner="tie")
