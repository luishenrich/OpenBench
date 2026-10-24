"""Read-only access to catalog/models.json (prices, endpoints, verified capabilities)."""

from __future__ import annotations

import json
import os
from functools import lru_cache
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]
CATALOG_PATH = Path(os.environ.get("BIY_CATALOG", REPO_ROOT / "catalog" / "models.json"))


@lru_cache(maxsize=1)
def _index() -> dict[tuple[str, str], dict]:
    data = json.loads(CATALOG_PATH.read_text(encoding="utf-8"))
    return {(m["provider"], m["id"]): m for m in data["models"]}


def all_models() -> list[dict]:
    return list(_index().values())


def get_model(provider: str, model: str) -> dict | None:
    """Catalogue row, or None (e.g. a closed baseline model served through OpenRouter)."""
    return _index().get((provider, model))


def price_per_1m(provider: str, model: str, endpoint: str | None = None) -> dict | None:
    """{"input", "output", "cached_input"} in USD per 1M tokens, for the endpoint we call.

    On OpenRouter, `endpoint` is the pinned upstream provider name (e.g. "DeepInfra"):
    each upstream bills its own price, and the model-level price is only the cheapest one.
    """
    m = get_model(provider, model)
    if not m:
        return None
    if endpoint:
        for e in m.get("endpoints") or []:
            if e.get("provider") == endpoint:
                return e.get("usd_per_1m")
    return (m.get("pricing") or {}).get("usd_per_1m")


def pick_openrouter_endpoint(model: str, needs: set[str]) -> str | None:
    """Upstream provider to pin on OpenRouter for this model.

    Keeps endpoints that support every parameter in `needs` (e.g. {"tools", "response_format"}),
    prefers the one that answered our probe, then the cheapest.
    """
    m = get_model("openrouter", model)
    if not m or not m.get("endpoints"):
        return None
    ok = [e for e in m["endpoints"] if needs <= set(e.get("supported_parameters") or [])]
    if not ok:
        return None
    for e in ok:
        if e.get("provider") == m.get("served_by"):
            return e["provider"]
    price = lambda e: (e.get("usd_per_1m") or {}).get("input") or 0.0  # noqa: E731
    return min(ok, key=price)["provider"]
