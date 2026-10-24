"""Streaming chat client for Nebius, OpenRouter and OpenAI, with timing and cost per call.

Every provider is OpenAI-compatible, so one client covers all of them. Each call streams,
so TTFT is the real time to the first content (or reasoning) token, not a guess.
"""

from __future__ import annotations

import asyncio
import json
import os
import re
import time
from dataclasses import dataclass, field
from typing import Any

import httpx

from ..config import settings
from . import catalog

PROVIDERS = {
    "nebius": {"base_url": "https://api.tokenfactory.nebius.com/v1", "key_env": "NEBIUS_API_KEY"},
    "openrouter": {"base_url": "https://openrouter.ai/api/v1", "key_env": "OPENROUTER_API_KEY"},
    "openai": {"base_url": "https://api.openai.com/v1", "key_env": "OPENAI_API_KEY"},
}

DEFAULT_MAX_TOKENS = 4096  # reasoning models spend tokens before answering
TIMEOUT = httpx.Timeout(180.0, connect=15.0)
RETRY_STATUS = {408, 429, 500, 502, 503, 504, 529}  # 529: Nebius "System is overloaded"
MAX_ATTEMPTS = 4


def _verify() -> Any:
    """Use the OS trust store when `truststore` is installed (machines whose antivirus or
    proxy re-signs HTTPS); otherwise httpx's bundled certifi, which is fine in Docker."""
    try:
        import ssl

        import truststore
    except ImportError:
        return True
    return truststore.SSLContext(ssl.PROTOCOL_TLS_CLIENT)


class MissingKey(RuntimeError):
    pass


@dataclass
class CallResult:
    provider: str
    model: str
    text: str = ""
    reasoning: str = ""
    tool_calls: list[dict] | None = None
    usage: dict[str, Any] = field(default_factory=dict)
    ttft_ms: float | None = None
    e2e_ms: float | None = None
    tokens_per_s: float | None = None
    cost_usd: float | None = None
    served_by: str | None = None  # OpenRouter upstream that answered
    finish_reason: str | None = None
    error: str | None = None

    @property
    def ok(self) -> bool:
        return self.error is None

    @property
    def reasoning_tokens(self) -> int | None:
        return (self.usage.get("completion_tokens_details") or {}).get("reasoning_tokens")

    @property
    def json(self) -> Any | None:
        return parse_json(self.text)

    def output(self) -> dict[str, Any]:
        """ResultOut.output / OutputView shape, plus finish_reason (truncation_rate)."""
        return {"text": self.text, "json": self.json, "tool_calls": self.tool_calls,
                "finish_reason": self.finish_reason}

    def timing(self) -> dict[str, float | None]:
        """ResultOut.timing shape."""
        return {"ttft_ms": self.ttft_ms, "e2e_ms": self.e2e_ms, "tokens_per_s": self.tokens_per_s}


def strip_think(text: str) -> str:
    return re.sub(r"<think>.*?</think>", "", text or "", flags=re.S).strip()


def parse_json(text: str) -> Any | None:
    """JSON from a model answer, tolerating <think> blocks and ``` fences. None if not JSON."""
    t = strip_think(text)
    t = re.sub(r"^```(?:json)?\s*|\s*```$", "", t.strip()).strip()
    if not t or t[0] not in "{[":
        return None
    try:
        return json.loads(t)
    except json.JSONDecodeError:
        return None


def call_cost(usage: dict, price: dict | None) -> float | None:
    """USD for one call. OpenRouter reports the real charge; otherwise tokens × list price.

    With BYOK (a provider key stored in OpenRouter), `cost` is only OpenRouter's fee and the
    provider bills `cost_details.upstream_inference_cost` separately: count both.
    """
    if usage.get("cost") is not None:
        upstream = (usage.get("cost_details") or {}).get("upstream_inference_cost") if usage.get("is_byok") else None
        return round(float(usage["cost"]) + float(upstream or 0), 10)
    if not price or not usage:
        return None
    cached = (usage.get("prompt_tokens_details") or {}).get("cached_tokens") or 0
    p_in = price.get("input") or 0.0
    p_cached = price.get("cached_input") if price.get("cached_input") is not None else p_in
    cost = ((usage.get("prompt_tokens", 0) - cached) * p_in
            + cached * p_cached
            + usage.get("completion_tokens", 0) * (price.get("output") or 0.0)) / 1e6
    return round(cost, 8)


def _error(resp: httpx.Response) -> str:
    try:
        body = resp.json()
        err = body.get("error", body)
        msg = err.get("message", err) if isinstance(err, dict) else err
        # OpenRouter wraps the upstream's own error in metadata.raw ("Provider returned error")
        raw = (err.get("metadata") or {}).get("raw") if isinstance(err, dict) else None
        if raw:
            try:
                inner = json.loads(raw).get("error", {})
                raw = inner.get("message", inner) if isinstance(inner, dict) else inner
            except (json.JSONDecodeError, AttributeError):
                pass
            msg = f"{msg}: {raw}"
        return f"HTTP {resp.status_code}: {str(msg)[:400]}"
    except Exception:
        return f"HTTP {resp.status_code}: {resp.text[:300]}"


class ProviderClient:
    """One connection (provider + key). Use one per provider and share it across calls.

    `concurrency` bounds in-flight calls on this connection (the per-connection limit the
    worker needs to stay under rate limits).
    """

    def __init__(self, provider: str, api_key: str | None = None, concurrency: int = 8,
                 base_url: str | None = None):
        if provider not in PROVIDERS:
            raise ValueError(f"unknown provider {provider!r}; expected one of {sorted(PROVIDERS)}")
        cfg = PROVIDERS[provider]
        key = (api_key or os.environ.get(cfg["key_env"])
               or getattr(settings, cfg["key_env"].lower(), None))  # settings also reads .env
        if not key:
            raise MissingKey(f"{cfg['key_env']} is not set")
        self.provider = provider
        self.sem = asyncio.Semaphore(concurrency)
        self.http = httpx.AsyncClient(
            base_url=base_url or cfg["base_url"],
            headers={"Authorization": f"Bearer {key}"},
            timeout=TIMEOUT,
            verify=_verify(),
        )

    async def __aenter__(self) -> ProviderClient:
        return self

    async def __aexit__(self, *exc) -> None:
        await self.aclose()

    async def aclose(self) -> None:
        await self.http.aclose()

    async def chat(
        self,
        model: str,
        messages: list[dict],
        *,
        params: dict[str, Any] | None = None,
        tools: list[dict] | None = None,
        response_format: dict | None = None,
        openrouter_provider: str | None = None,
    ) -> CallResult:
        """Stream one chat completion. Never raises for provider errors: see CallResult.error.

        params: temperature, max_tokens, reasoning_effort, … (passed through).
        openrouter_provider: upstream to pin (e.g. "DeepInfra"). Defaults to one picked from
        the catalogue; calls always run with fallbacks off, so the price and speed we measure
        belong to a single endpoint.
        """
        params = dict(params or {})
        # reasoning_effort: OpenRouter takes {"reasoning": {"effort"}}, Nebius / OpenAI take it as is.
        # "default" (or unset) sends nothing: the provider's own default.
        effort = params.pop("reasoning_effort", None)
        if effort and effort != "default":
            if self.provider == "openrouter":
                params["reasoning"] = {**(params.get("reasoning") or {}), "effort": effort}
            else:
                params["reasoning_effort"] = effort
        body: dict[str, Any] = {
            "model": model,
            "messages": messages,
            "max_tokens": params.pop("max_tokens", DEFAULT_MAX_TOKENS),
            "stream": True,
            "stream_options": {"include_usage": True},
            **params,
        }
        if tools:
            body["tools"] = tools
        if response_format:
            body["response_format"] = response_format

        endpoint = None
        if self.provider == "openrouter":
            needs = {"max_tokens"} | ({"tools"} if tools else set()) | (
                {"response_format"} if response_format else set()) | ({"reasoning"} if "reasoning" in body else set())
            endpoint = openrouter_provider or catalog.pick_openrouter_endpoint(model, needs)
            routing: dict[str, Any] = {"allow_fallbacks": False, "require_parameters": True}
            if endpoint:
                routing["only"] = [endpoint]
            body["provider"] = routing
            body["usage"] = {"include": True}  # real billed cost in the last chunk

        async with self.sem:
            result = await self._stream(model, body)
        if result.ok:
            result.cost_usd = call_cost(result.usage, catalog.price_per_1m(self.provider, model, endpoint))
        return result

    async def _stream(self, model: str, body: dict) -> CallResult:
        for attempt in range(MAX_ATTEMPTS):
            res = CallResult(provider=self.provider, model=model)
            t0 = time.perf_counter()
            t_first = None
            tool_parts: dict[int, dict] = {}
            try:
                async with self.http.stream("POST", "/chat/completions", json=body) as resp:
                    if resp.status_code != 200:
                        await resp.aread()
                        if resp.status_code in RETRY_STATUS and attempt < MAX_ATTEMPTS - 1:
                            await asyncio.sleep(3 * 2 ** attempt)
                            continue
                        res.error = _error(resp)
                        res.e2e_ms = round((time.perf_counter() - t0) * 1000, 1)
                        return res
                    async for line in resp.aiter_lines():
                        if not line.startswith("data:"):
                            continue
                        payload = line[5:].strip()
                        if payload == "[DONE]":
                            break
                        try:
                            chunk = json.loads(payload)
                        except json.JSONDecodeError:
                            continue
                        if chunk.get("error"):  # mid-stream error (OpenRouter sends these)
                            res.error = f"stream error: {str(chunk['error'])[:300]}"
                            break
                        if chunk.get("usage"):
                            res.usage = chunk["usage"]
                        res.served_by = chunk.get("provider") or res.served_by
                        for ch in chunk.get("choices") or []:
                            d = ch.get("delta") or {}
                            c = d.get("content") or ""
                            r = d.get("reasoning_content") or d.get("reasoning") or ""
                            if (c or r or d.get("tool_calls")) and t_first is None:
                                t_first = time.perf_counter()
                            res.text += c
                            res.reasoning += r
                            for tc in d.get("tool_calls") or []:
                                part = tool_parts.setdefault(tc.get("index", 0), {
                                    "id": None, "type": "function", "function": {"name": "", "arguments": ""}})
                                part["id"] = tc.get("id") or part["id"]
                                fn = tc.get("function") or {}
                                part["function"]["name"] += fn.get("name") or ""
                                part["function"]["arguments"] += fn.get("arguments") or ""
                            res.finish_reason = ch.get("finish_reason") or res.finish_reason
            except httpx.HTTPError as e:
                if attempt < MAX_ATTEMPTS - 1 and t_first is None:
                    await asyncio.sleep(3 * 2 ** attempt)
                    continue
                res.error = f"{type(e).__name__}: {e}"
            t_last = time.perf_counter()
            break

        res.e2e_ms = round((t_last - t0) * 1000, 1)
        res.ttft_ms = round((t_first - t0) * 1000, 1) if t_first else None
        if tool_parts:
            res.tool_calls = [tool_parts[i] for i in sorted(tool_parts)]
        out_tokens = res.usage.get("completion_tokens")
        if out_tokens and t_first and t_last > t_first:
            res.tokens_per_s = round(out_tokens / (t_last - t_first), 1)
        if res.ok and not (res.text or res.tool_calls):
            res.error = f"empty answer (finish_reason={res.finish_reason})"
        return res
