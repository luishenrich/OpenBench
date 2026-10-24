"""Probe every model on an OpenAI-compatible provider and write a verified catalogue.

For each model we call the real API and check:
  text        streaming chat, records TTFT / E2E / usage
  vision      an image (left half blue, right half yellow) the model must describe
  tools       one function call
  json_schema structured output via response_format=json_schema
  embedding   only for embedding models

Usage:
  python3 scripts/probe_models.py nebius
  python3 scripts/probe_models.py openrouter --models catalog/openrouter_candidates.txt

Keys are read from the environment or from .env (never printed).
"""

from __future__ import annotations

import argparse
import asyncio
import base64
import io
import json
import os
import re
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import httpx
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent

PROVIDERS = {
    "nebius": {
        "base_url": "https://api.tokenfactory.nebius.com/v1",
        "key_env": "NEBIUS_API_KEY",
        "models_url": "https://api.tokenfactory.nebius.com/v1/models?verbose=true",
    },
    "openrouter": {
        "base_url": "https://openrouter.ai/api/v1",
        "key_env": "OPENROUTER_API_KEY",
        "models_url": "https://openrouter.ai/api/v1/models",
    },
}

MAX_TOKENS = 4096  # reasoning models spend tokens before answering
TIMEOUT = httpx.Timeout(180.0, connect=15.0)


def load_dotenv() -> None:
    env = ROOT / ".env"
    if not env.exists():
        return
    for line in env.read_text().splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))


def test_image_data_url() -> str:
    img = Image.new("RGB", (256, 128), (30, 80, 220))
    img.paste((245, 210, 20), (128, 0, 256, 128))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()


IMAGE_URL = test_image_data_url()

WEATHER_TOOL = {
    "type": "function",
    "function": {
        "name": "get_weather",
        "description": "Get the current weather for a city.",
        "parameters": {
            "type": "object",
            "properties": {"city": {"type": "string"}},
            "required": ["city"],
        },
    },
}

ANSWER_SCHEMA = {
    "type": "json_schema",
    "json_schema": {
        "name": "answer",
        "strict": True,
        "schema": {
            "type": "object",
            "properties": {"answer": {"type": "integer"}},
            "required": ["answer"],
            "additionalProperties": False,
        },
    },
}


def strip_think(text: str) -> str:
    return re.sub(r"<think>.*?</think>", "", text or "", flags=re.S).strip()


def err_info(resp: httpx.Response) -> str:
    try:
        body = resp.json()
        msg = body.get("error", body)
        if isinstance(msg, dict):
            msg = msg.get("message", msg)
        return f"HTTP {resp.status_code}: {str(msg)[:300]}"
    except Exception:
        return f"HTTP {resp.status_code}: {resp.text[:300]}"


def vision_ok(answer: str) -> bool:
    """Left half blue, right half yellow (gold/amber count as yellow)."""
    answer = answer.lower()
    right = min((answer.find(w) for w in ("yellow", "gold", "amber") if w in answer), default=-1)
    return "blue" in answer and right >= 0 and answer.find("blue") < right


async def safe(coro) -> dict:
    try:
        return await coro
    except Exception as e:  # one broken response must not abort the whole run
        return {"status": "fail", "error": f"{type(e).__name__}: {e}"}


class Prober:
    def __init__(self, provider: str, key: str, concurrency: int, extra_body: dict):
        self.cfg = PROVIDERS[provider]
        self.provider = provider
        self.extra_body = extra_body
        self.client = httpx.AsyncClient(
            base_url=self.cfg["base_url"],
            headers={"Authorization": f"Bearer {key}"},
            timeout=TIMEOUT,
        )
        self.sem = asyncio.Semaphore(concurrency)

    async def post(self, path: str, body: dict) -> httpx.Response:
        body = {**body, **self.extra_body}
        for attempt in range(4):
            resp = await self.client.post(path, json=body)
            if resp.status_code in (429, 500, 502, 503, 504) and attempt < 3:
                await asyncio.sleep(2 ** attempt * 3)
                continue
            return resp
        return resp

    async def chat(self, model: str, messages: list, **kw) -> dict:
        t0 = time.perf_counter()
        resp = await self.post(
            "/chat/completions",
            {"model": model, "messages": messages, "max_tokens": MAX_TOKENS, **kw},
        )
        e2e = (time.perf_counter() - t0) * 1000
        if resp.status_code != 200:
            return {"ok": False, "error": err_info(resp), "e2e_ms": round(e2e)}
        data = resp.json()
        if "choices" not in data or not data["choices"]:
            return {"ok": False, "error": f"no choices: {str(data)[:300]}", "e2e_ms": round(e2e)}
        return {"ok": True, "data": data, "e2e_ms": round(e2e)}

    async def test_text(self, model: str) -> dict:
        body = {
            "model": model,
            "messages": [{"role": "user", "content": "Reply with exactly one word: pong"}],
            "max_tokens": MAX_TOKENS,
            "stream": True,
            "stream_options": {"include_usage": True},
            **self.extra_body,
        }
        for attempt in range(4):
            t0 = time.perf_counter()
            t_first = None
            content, reasoning, usage, served_by = "", "", None, None
            try:
                async with self.client.stream("POST", "/chat/completions", json=body) as resp:
                    if resp.status_code != 200:
                        await resp.aread()
                        if resp.status_code in (429, 500, 502, 503, 504) and attempt < 3:
                            await asyncio.sleep(2 ** attempt * 3)
                            continue
                        return {"status": "fail", "error": err_info(resp)}
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
                        if chunk.get("usage"):
                            usage = chunk["usage"]
                        served_by = chunk.get("provider") or served_by
                        for ch in chunk.get("choices") or []:
                            d = ch.get("delta") or {}
                            c = d.get("content") or ""
                            r = d.get("reasoning_content") or d.get("reasoning") or ""
                            if (c or r) and t_first is None:
                                t_first = time.perf_counter()
                            content += c
                            reasoning += r
            except httpx.HTTPError as e:
                return {"status": "fail", "error": f"{type(e).__name__}: {e}"}
            t_last = time.perf_counter()
            break
        answer = strip_think(content)
        reasoning_tokens = ((usage or {}).get("completion_tokens_details") or {}).get("reasoning_tokens")
        return {
            "status": "pass" if "pong" in answer.lower() else "wrong_answer",
            "answer": answer[:200],
            "ttft_ms": round((t_first - t0) * 1000) if t_first else None,
            "e2e_ms": round((t_last - t0) * 1000),
            "usage": usage,
            "served_by": served_by,
            "reasoning_seen": bool(reasoning) or "<think>" in content or bool(reasoning_tokens),
        }

    async def test_vision(self, model: str) -> dict:
        r = await self.chat(
            model,
            [{
                "role": "user",
                "content": [
                    {"type": "text", "text": "This image has two colored halves. Name the color of the left half and the right half, in that order, as two words."},
                    {"type": "image_url", "image_url": {"url": IMAGE_URL}},
                ],
            }],
        )
        if not r["ok"]:
            return {"status": "rejected", "error": r["error"]}
        answer = strip_think(r["data"]["choices"][0]["message"].get("content") or "").lower()
        return {"status": "pass" if vision_ok(answer) else "wrong_answer", "answer": answer[:200]}

    async def test_tools(self, model: str) -> dict:
        messages = [{"role": "user", "content": "What is the weather in Berlin right now? Use the tool."}]
        r = await self.chat(model, messages, tools=[WEATHER_TOOL], tool_choice="auto")
        forced = False
        if not r["ok"] and "tool_choice" in r["error"]:
            # some servers only support a named tool_choice, not "auto"
            forced = True
            r = await self.chat(model, messages, tools=[WEATHER_TOOL],
                                tool_choice={"type": "function", "function": {"name": "get_weather"}})
        if not r["ok"]:
            return {"status": "rejected", "error": r["error"]}
        result = await self._check_tool_call(r)
        if forced and result["status"] == "pass":
            result["status"] = "pass_forced_only"
        return result

    async def _check_tool_call(self, r: dict) -> dict:
        msg = r["data"]["choices"][0]["message"]
        calls = msg.get("tool_calls") or []
        for c in calls:
            fn = c.get("function") or {}
            if fn.get("name") == "get_weather":
                raw = fn.get("arguments") or "{}"
                try:
                    args = json.loads(raw) if isinstance(raw, str) else raw
                    if isinstance(args, str):  # some servers double-encode
                        return {"status": "wrong_answer", "error": "tool args double-encoded", "raw": raw[:200]}
                except json.JSONDecodeError:
                    return {"status": "wrong_answer", "error": "tool args not valid JSON", "raw": str(raw)[:200]}
                ok = isinstance(args, dict) and "berlin" in str(args.get("city", "")).lower()
                return {"status": "pass" if ok else "wrong_answer", "args": args}
        return {"status": "wrong_answer", "answer": strip_think(msg.get("content") or "")[:200]}

    async def test_json_schema(self, model: str) -> dict:
        r = await self.chat(
            model,
            [{"role": "user", "content": "What is 17 + 25? Respond as JSON."}],
            response_format=ANSWER_SCHEMA,
        )
        if not r["ok"]:
            return {"status": "rejected", "error": r["error"]}
        text = strip_think(r["data"]["choices"][0]["message"].get("content") or "")
        text = re.sub(r"^```(?:json)?|```$", "", text.strip(), flags=re.M).strip()
        try:
            obj = json.loads(text)
        except json.JSONDecodeError:
            return {"status": "wrong_answer", "error": "not valid JSON", "answer": text[:200]}
        ok = isinstance(obj, dict) and obj.get("answer") == 42 and set(obj) == {"answer"}
        return {"status": "pass" if ok else "wrong_answer", "answer": obj}

    async def test_embedding(self, model: str) -> dict:
        resp = await self.post("/embeddings", {"model": model, "input": ["hello world"]})
        if resp.status_code != 200:
            return {"status": "fail", "error": err_info(resp)}
        vec = resp.json()["data"][0]["embedding"]
        return {"status": "pass", "dimensions": len(vec)}

    async def probe(self, model: str, is_embedding: bool) -> dict:
        async with self.sem:
            print(f"  … {model}", file=sys.stderr, flush=True)
            if is_embedding:
                return {"embedding": await self.test_embedding(model)}
            text, vision, tools, js = await asyncio.gather(
                safe(self.test_text(model)),
                safe(self.test_vision(model)),
                safe(self.test_tools(model)),
                safe(self.test_json_schema(model)),
            )
            print(f"  ✓ {model}: text={text['status']} vision={vision['status']} "
                  f"tools={tools['status']} json={js['status']}", file=sys.stderr, flush=True)
            return {"text": text, "vision": vision, "tools": tools, "json_schema": js}


def per_million(v) -> float | None:
    try:
        return round(float(v) * 1e6, 4)
    except (TypeError, ValueError):
        return None


def call_cost(usage: dict | None, pricing: dict) -> float | None:
    """Cost of one call from its usage. Prefers the provider-reported cost (OpenRouter)."""
    if not usage:
        return None
    if usage.get("cost") is not None:
        return float(usage["cost"])
    try:
        cached = ((usage.get("prompt_tokens_details") or {}).get("cached_tokens")) or 0
        cache_price = float(pricing.get("input_cache_read") or pricing.get("prompt") or 0)
        cost = ((usage.get("prompt_tokens", 0) - cached) * float(pricing.get("prompt") or 0)
                + cached * cache_price
                + usage.get("completion_tokens", 0) * float(pricing.get("completion") or 0))
        return round(cost, 8)
    except (TypeError, ValueError):
        return None


def derive_capabilities(probe: dict, is_embedding: bool) -> tuple[dict, list, list]:
    """Turn raw probe results into verified capabilities. build_catalog.py reuses this,
    so older probe files are always judged by the current rules."""

    def passed(k):
        return (probe.get(k) or {}).get("status") == "pass"

    if is_embedding:
        return {"embedding": passed("embedding")}, ["text"], ["embedding"]
    text = probe.get("text") or {}
    verified = {
        # reachable and answered; a wrong word ("ping") still means the model works,
        # an empty answer does not
        "text": text.get("status") == "pass"
                or (text.get("status") == "wrong_answer" and bool(text.get("answer"))),
        "vision": passed("vision"),
        "tools": (probe.get("tools") or {}).get("status") in ("pass", "pass_forced_only"),
        "tools_auto": passed("tools"),
        "json_schema": passed("json_schema"),
        "reasoning": bool(text.get("reasoning_seen")),
    }
    inputs = ["text"] + (["image"] if verified["vision"] else [])
    return verified, inputs, ["text"]


def build_entry(provider: str, meta: dict, probe: dict, checked_at: str) -> dict:
    arch = meta.get("architecture") or {}
    modality = arch.get("modality") or ""
    pricing = meta.get("pricing") or {}
    is_embedding = "embedding" in modality
    verified, inputs, outputs = derive_capabilities(probe, is_embedding)

    return {
        "id": meta["id"],
        "provider": provider,
        "name": meta.get("name") or meta["id"],
        "family": meta["id"].split("/")[0],
        "description": meta.get("description"),
        "type": "embedding" if is_embedding else ("vision" if "image" in inputs else "text"),
        "input_modalities": inputs,
        "output_modalities": outputs,
        "claimed": {
            "modality": modality,
            "features": meta.get("supported_features") or meta.get("supported_parameters"),
        },
        "verified": verified,
        "context_length": meta.get("context_length"),
        "quantization": meta.get("quantization"),
        # What this endpoint bills, as the provider's own API reports it. This is the
        # price benchmarks score against (speed and price both belong to the endpoint).
        "pricing": {
            "usd_per_1m": {
                "input": per_million(pricing.get("prompt")),
                "output": per_million(pricing.get("completion")),
                "cached_input": per_million(pricing.get("input_cache_read")),
            },
            "source": f"{provider} /models API",
            "fetched_at": checked_at,
        },
        "rate_limits": meta.get("per_request_limits"),
        "regions": [r.get("name") for r in meta.get("regions") or []],
        "hf_repo": meta.get("hugging_face_id"),
        # OpenRouter only: one entry per upstream provider. The model-level price above is
        # the cheapest provider's, so benchmarks must pin a provider and use its price.
        "endpoints": meta.get("_endpoints"),
        "served_by": (probe.get("text") or {}).get("served_by"),
        "probe": {
            "checked_at": checked_at,
            "ttft_ms": (probe.get("text") or {}).get("ttft_ms"),
            "e2e_ms": (probe.get("text") or {}).get("e2e_ms"),
            "text_call_cost_usd": call_cost((probe.get("text") or {}).get("usage"), pricing),
            "results": probe,
        },
        "available": verified.get("text", False) or verified.get("embedding", False),
    }


async def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("provider", choices=PROVIDERS)
    ap.add_argument("--models", help="file with one model id per line (default: all from /models)")
    ap.add_argument("--only", nargs="*", help="probe just these ids")
    ap.add_argument("--concurrency", type=int, default=6)
    ap.add_argument("--out", help="output path (default: catalog/<provider>.json)")
    args = ap.parse_args()

    load_dotenv()
    cfg = PROVIDERS[args.provider]
    key = os.environ.get(cfg["key_env"])
    if not key:
        sys.exit(f"{cfg['key_env']} is not set (put it in .env)")

    async with httpx.AsyncClient(timeout=TIMEOUT) as c:
        resp = await c.get(cfg["models_url"], headers={"Authorization": f"Bearer {key}"})
        resp.raise_for_status()
        listing = {m["id"]: m for m in resp.json()["data"]}

    ids = list(listing)
    if args.models:
        ids = [l.strip() for l in Path(args.models).read_text().splitlines()
               if l.strip() and not l.startswith("#")]
    if args.only:
        ids = args.only
    missing = [i for i in ids if i not in listing]
    if missing:
        print(f"not in {args.provider} /models, skipped: {missing}", file=sys.stderr)
    ids = [i for i in ids if i in listing]

    if args.provider == "openrouter":
        async with httpx.AsyncClient(timeout=TIMEOUT) as c:
            for i in ids:
                r = await c.get(f"https://openrouter.ai/api/v1/models/{i.split(':')[0]}/endpoints")
                if r.status_code == 200:
                    listing[i]["_endpoints"] = [{
                        "provider": e.get("provider_name"),
                        "tag": e.get("tag"),
                        "quantization": e.get("quantization"),
                        "context_length": e.get("context_length"),
                        "max_completion_tokens": e.get("max_completion_tokens"),
                        "usd_per_1m": {
                            "input": per_million((e.get("pricing") or {}).get("prompt")),
                            "output": per_million((e.get("pricing") or {}).get("completion")),
                            "cached_input": per_million((e.get("pricing") or {}).get("input_cache_read")),
                        },
                        "supported_parameters": e.get("supported_parameters"),
                        "uptime_30m": e.get("uptime_last_30m"),
                    } for e in (r.json().get("data") or {}).get("endpoints") or []]

    # OpenRouter: never silently drop params (tools, response_format), and report real cost.
    extra = ({"provider": {"require_parameters": True}, "usage": {"include": True}}
             if args.provider == "openrouter" else {})
    prober = Prober(args.provider, key, args.concurrency, extra)
    checked_at = datetime.now(timezone.utc).isoformat(timespec="seconds")
    print(f"probing {len(ids)} models on {args.provider}", file=sys.stderr)

    def is_emb(i):
        return "embedding" in ((listing[i].get("architecture") or {}).get("modality") or "")

    probes = await asyncio.gather(*(prober.probe(i, is_emb(i)) for i in ids))
    await prober.client.aclose()

    entries = [build_entry(args.provider, listing[i], p, checked_at) for i, p in zip(ids, probes)]
    entries.sort(key=lambda e: (e["type"], e["id"].lower()))
    out = Path(args.out) if args.out else ROOT / "catalog" / f"{args.provider}.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps({
        "provider": args.provider,
        "base_url": cfg["base_url"],
        "key_env": cfg["key_env"],
        "generated_at": checked_at,
        "models": entries,
    }, indent=2, ensure_ascii=False) + "\n")
    print(f"wrote {out} ({len(entries)} models)", file=sys.stderr)


if __name__ == "__main__":
    asyncio.run(main())
