"""Synthetic cases for a use case. Raphaël's generate_cases should call generate_case_inputs.

This module does not touch the database. It returns CaseIn-shaped dicts
(input, reference, tags, source="synthetic"). The service persists them with add_cases.
"""

from __future__ import annotations

import inspect
import json
import re
from pathlib import Path
from typing import Any

import jsonschema

STRATEGIES = ("auto", "schema_first", "persona_grid")
_ARRAY = re.compile(r"\[.*\]", re.DOTALL)
_PLACEHOLDER = re.compile(r"\{\{\s*([a-zA-Z_][\w]*)\s*\}\}")

_NOTES = {
    "schema_first": (
        "Vary the structured fields. Cover the required keys, and change the values "
        "so the cases are not paraphrases of one another."
    ),
    "persona_grid": (
        "Vary who is asking: role, tone, and locale. The reference is the reply or label "
        "the product should produce for that person. Keep the task the same."
    ),
}


def _prompt_dirs() -> list[Path]:
    packaged = Path(__file__).resolve().parent / "prompt_templates"
    repo = Path(__file__).resolve().parents[3] / "prompts" / "cases"
    return [repo, packaged]


def load_case_prompt() -> str:
    for directory in _prompt_dirs():
        path = directory / "generate.md"
        if path.is_file():
            return path.read_text(encoding="utf-8")
    raise FileNotFoundError("missing case-generation prompt")


def resolve_strategy(strategy: str, io_spec: dict, use_case: dict) -> str:
    """auto uses schema_first when a response schema exists, otherwise persona_grid for chat-like kinds."""
    if strategy not in STRATEGIES:
        raise ValueError(f"strategy must be one of {STRATEGIES}, got {strategy!r}")
    if strategy != "auto":
        return strategy
    if _schema(io_spec):
        return "schema_first"
    if use_case.get("kind") in {"chat", "rag", "generation", "summarization"}:
        return "persona_grid"
    return "schema_first"


def _schema(io_spec: dict | None) -> dict | None:
    if not isinstance(io_spec, dict):
        return None
    schema = io_spec.get("response_schema")
    if not isinstance(schema, dict):
        return None
    wrapped = schema.get("json_schema")
    if isinstance(wrapped, dict) and isinstance(wrapped.get("schema"), dict):
        return wrapped["schema"]
    return schema


def _canon(value: Any) -> str:
    return json.dumps(value, sort_keys=True, ensure_ascii=False, default=str)


def _dump(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, indent=2, default=str)


def _fill(template: str, values: dict[str, str]) -> str:
    text = template
    for key, value in values.items():
        text = text.replace("{{" + key + "}}", value)
    return text


async def _call(call_llm, messages: list[dict]) -> str:
    result = call_llm(messages)
    if inspect.isawaitable(result):
        result = await result
    if not isinstance(result, str):
        raise TypeError("call_llm must return a string")
    return result


def _parse_array(text: str) -> list:
    body = text.strip()
    if body.startswith("```"):
        body = re.sub(r"^```(?:json)?\s*|\s*```$", "", body, flags=re.IGNORECASE).strip()
    try:
        parsed = json.loads(body)
    except json.JSONDecodeError:
        match = _ARRAY.search(body)
        if not match:
            raise ValueError("case generator did not return a JSON array")
        parsed = json.loads(match.group(0))
    if isinstance(parsed, dict) and isinstance(parsed.get("cases"), list):
        parsed = parsed["cases"]
    if not isinstance(parsed, list):
        raise ValueError("case generator JSON was not an array")
    return parsed


def _normalize_input(raw: Any, template: str | None) -> dict | None:
    if not isinstance(raw, dict):
        return None
    if any(key in raw for key in ("vars", "messages", "images")):
        if raw.get("images"):
            return None
        return raw
    names = _PLACEHOLDER.findall(template or "")
    if names and all(name in raw for name in names):
        return {"vars": {name: raw[name] for name in names}}
    if names:
        return None
    return {"vars": raw}


def _tags(raw: Any, strategy: str) -> list[str]:
    tags = ["synthetic", strategy]
    if isinstance(raw, list):
        for item in raw:
            if isinstance(item, str) and item.strip() and item not in tags and len(item) <= 40:
                tags.append(item.strip())
    return tags


def _reference(raw: Any, schema: dict | None) -> Any | None:
    if raw is None:
        return None
    if schema and isinstance(raw, str):
        text = raw.strip()
        if text.startswith(("{", "[")):
            try:
                raw = json.loads(text)
            except json.JSONDecodeError:
                return None
    if schema is not None:
        try:
            jsonschema.Draft202012Validator(schema).validate(raw)
        except jsonschema.ValidationError:
            return None
    return raw


def _accept(item: Any, schema: dict | None, template: str | None, seen: set[str], strategy: str) -> dict | None:
    if not isinstance(item, dict):
        return None
    incoming = _normalize_input(item.get("input"), template)
    if incoming is None:
        return None
    reference = _reference(item.get("reference"), schema)
    if reference is None:
        return None
    key = _canon(incoming)
    if key in seen:
        return None
    seen.add(key)
    return {
        "input": incoming,
        "reference": reference,
        "tags": _tags(item.get("tags"), strategy),
        "source": "synthetic",
    }


def _messages(use_case: dict, io_spec: dict, seeds: list[dict], n: int, strategy: str, avoid: list[dict]) -> list[dict]:
    body = _fill(
        load_case_prompt(),
        {
            "n": str(n),
            "strategy": strategy,
            "strategy_notes": _NOTES.get(strategy, _NOTES["schema_first"]),
            "use_case": _dump({key: use_case.get(key) for key in ("name", "kind", "description")}),
            "io_spec": _dump(
                {
                    "system_prompt": io_spec.get("system_prompt"),
                    "user_template": io_spec.get("user_template"),
                    "response_schema": _schema(io_spec),
                    "tools": io_spec.get("tools"),
                }
            ),
            "seeds": _dump(seeds[:8]),
            "avoid": _dump(avoid),
        },
    )
    return [{"role": "user", "content": body}]


async def generate_case_inputs(
    use_case: dict,
    io_spec: dict,
    seeds: list[dict],
    n: int,
    call_llm,
    strategy: str = "auto",
) -> list[dict]:
    """Return up to n CaseIn dicts. Fewer if the model cannot fill the quota with valid unique cases.

    call_llm(messages) -> str may be sync or async, same as judge(). Seeds are existing cases
    ({input, reference, tags}). References are required. When io_spec has a response_schema,
    a reference that does not validate is dropped. Duplicate inputs, including seeds, are dropped.
    """
    if not isinstance(n, int) or isinstance(n, bool) or n < 0:
        raise ValueError("n must be a non-negative int")
    if n == 0:
        return []
    if not isinstance(use_case, dict) or not isinstance(io_spec, dict):
        raise TypeError("use_case and io_spec must be dicts")
    resolved = resolve_strategy(strategy, io_spec, use_case)
    schema = _schema(io_spec)
    template = io_spec.get("user_template") if isinstance(io_spec.get("user_template"), str) else None
    seed_rows = [item for item in seeds or [] if isinstance(item, dict)]
    seen = {_canon(item["input"]) for item in seed_rows if isinstance(item.get("input"), dict)}
    accepted: list[dict] = []
    avoid: list[dict] = []
    for _ in range(2):
        need = n - len(accepted)
        if need <= 0:
            break
        text = await _call(call_llm, _messages(use_case, io_spec, seed_rows, need, resolved, avoid))
        for item in _parse_array(text):
            case = _accept(item, schema, template, seen, resolved)
            if case is None:
                continue
            accepted.append(case)
            avoid.append({"input": case["input"], "reference": case["reference"]})
            if len(accepted) >= n:
                break
    if not accepted:
        raise ValueError("generate_case_inputs produced no cases with a valid reference")
    return accepted[:n]
