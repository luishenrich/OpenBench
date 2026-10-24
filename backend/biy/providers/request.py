"""Turn a case + the use case's io_spec into chat-completion request parts."""

from __future__ import annotations

import re
from typing import Any

_VAR = re.compile(r"\{\{\s*(\w+)\s*\}\}|\{(\w+)\}")


def render_template(template: str, variables: dict[str, Any]) -> str:
    """Fill {{name}} or {name} placeholders. Unknown placeholders are left as they are."""
    def sub(m: re.Match) -> str:
        name = m.group(1) or m.group(2)
        return str(variables[name]) if name in variables else m.group(0)
    return _VAR.sub(sub, template)


def build_messages(io_spec: dict, case_input: dict) -> list[dict]:
    """Messages for one case.

    case_input is either {"messages": [...]} (OpenAI chat format, used as is) or
    {"vars": {...}} filling io_spec.user_template. "images" (URLs) become image_url parts
    on the last user message.
    """
    if case_input.get("messages"):
        messages = [dict(m) for m in case_input["messages"]]
        if io_spec.get("system_prompt") and messages[0].get("role") != "system":
            messages.insert(0, {"role": "system", "content": io_spec["system_prompt"]})
    else:
        variables = case_input.get("vars") or {}
        template = io_spec.get("user_template") or "\n".join(f"{k}: {v}" for k, v in variables.items())
        messages = []
        if io_spec.get("system_prompt"):
            messages.append({"role": "system", "content": render_template(io_spec["system_prompt"], variables)})
        messages.append({"role": "user", "content": render_template(template, variables)})

    images = case_input.get("images") or []
    if images:
        last_user = next(m for m in reversed(messages) if m["role"] == "user")
        content = last_user["content"]
        parts = content if isinstance(content, list) else [{"type": "text", "text": content}]
        last_user["content"] = parts + [{"type": "image_url", "image_url": {"url": u}} for u in images]
    return messages


def response_format(schema: dict | None) -> dict | None:
    """io_spec.response_schema → response_format.

    Accepts a bare JSON schema or an already wrapped {"type": "json_schema", ...}. Strict mode
    only when the schema allows it (closed objects), otherwise providers reject the request.
    """
    if not schema:
        return None
    if schema.get("type") == "json_schema" and "json_schema" in schema:
        return schema
    return {
        "type": "json_schema",
        "json_schema": {
            "name": "response",
            "strict": schema.get("additionalProperties") is False,
            "schema": schema,
        },
    }
