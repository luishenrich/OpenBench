"""Smoke test: one streamed call per check, printed as a table.

    cd backend && python -m biy.providers nebius deepseek-ai/DeepSeek-V4-Flash-0731
    cd backend && python -m biy.providers openrouter inclusionai/ling-3.1-flash --checks text json

Costs a fraction of a cent per model. Keys come from the repo's .env (via biy.config).
"""

from __future__ import annotations

import argparse
import asyncio
import sys

from . import ProviderClient, build_messages, response_format

WEATHER_TOOL = {
    "type": "function",
    "function": {
        "name": "get_weather",
        "description": "Get the current weather for a city.",
        "parameters": {"type": "object", "properties": {"city": {"type": "string"}}, "required": ["city"]},
    },
}
INVOICE_SCHEMA = {
    "type": "object",
    "properties": {"vendor": {"type": "string"}, "total": {"type": "number"}},
    "required": ["vendor", "total"],
    "additionalProperties": False,
}


async def run(provider: str, model: str, checks: list[str]) -> int:
    calls = {
        "text": dict(messages=build_messages({}, {"messages": [
            {"role": "user", "content": "Reply with exactly one word: pong"}]})),
        "json": dict(
            messages=build_messages(
                {"system_prompt": "Extract the invoice fields.", "user_template": "Invoice:\n{{doc}}"},
                {"vars": {"doc": "ACME Corp, 3 widgets, total due 41.50 EUR"}}),
            response_format=response_format(INVOICE_SCHEMA)),
        "tools": dict(messages=[{"role": "user", "content": "What's the weather in Berlin? Use the tool."}],
                      tools=[WEATHER_TOOL]),
    }
    failed = 0
    async with ProviderClient(provider) as client:
        results = await asyncio.gather(*(client.chat(model, **calls[c]) for c in checks))
    for check, r in zip(checks, results):
        if not r.ok:
            failed += 1
        answer = r.error or (r.tool_calls and str(r.tool_calls[0]["function"])) or r.json or r.text.strip()
        print(f"{check:6} ok={r.ok!s:5} ttft={r.ttft_ms}ms e2e={r.e2e_ms}ms tok/s={r.tokens_per_s} "
              f"tokens={r.usage.get('prompt_tokens')}/{r.usage.get('completion_tokens')} "
              f"cost=${r.cost_usd} served_by={r.served_by}\n       → {str(answer)[:160]}")
    return failed


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("provider")
    ap.add_argument("model")
    ap.add_argument("--checks", nargs="*", default=["text", "json", "tools"])
    args = ap.parse_args()
    sys.exit(1 if asyncio.run(run(args.provider, args.model, args.checks)) else 0)


if __name__ == "__main__":
    main()
