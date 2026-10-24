"""Closed reference models: comparison only, never candidates (catalog/models.json is open-weight only).

Prices are the makers' list prices in USD per 1M tokens, for the estimate. Real runs are billed
from OpenRouter's usage (BYOK: cost_details.upstream_inference_cost), see client.call_cost.
"""

from __future__ import annotations

REFERENCES: dict[str, dict] = {
    "openai/gpt-6.1-sol": {"label": "GPT-6.1 Sol", "family": "openai",
                           "usd_per_1m": {"input": 2.0, "output": 10.0, "cached_input": None}},
    "openai/gpt-6-luna": {"label": "GPT-6 Luna", "family": "openai",
                          "usd_per_1m": {"input": 0.10, "output": 0.50, "cached_input": None}},
}


def label(model: str) -> str:
    return (REFERENCES.get(model) or {}).get("label") or model.split("/")[-1]


def price_per_1m(model: str) -> dict | None:
    return (REFERENCES.get(model) or {}).get("usd_per_1m")


def family(model: str) -> str:
    """Model family, for judges abstaining on their own family: "openai/gpt-6-luna" → openai,
    "deepseek-ai/DeepSeek-V4.1-Flash-1017" → deepseek, "zai-org/GLM-5.3" → glm, …"""
    m = model.lower()
    known = {"deepseek": "deepseek", "gpt-": "openai", "openai/": "openai", "qwen": "qwen", "glm": "glm",
             "z-ai/": "glm", "zai-org/": "glm", "kimi": "kimi", "moonshot": "kimi", "minimax": "minimax",
             "nemotron": "nvidia", "nvidia/": "nvidia", "gemma": "google", "gemini": "google", "llama": "meta",
             "muse": "meta", "mistral": "mistral", "claude": "anthropic", "anthropic/": "anthropic"}
    for needle, fam in known.items():
        if needle in m:
            return fam
    return m.split("/")[0]
