"""Catalogue from catalog/models.json (built by scripts/build_catalog.py). No DB."""

import json
from functools import lru_cache

from contract.schemas import CatalogModel

from .config import settings


@lru_cache
def _all() -> list[CatalogModel]:
    rows = json.loads(settings.catalog_path.read_text())["models"]
    return [
        CatalogModel(
            id=m["id"], provider=m["provider"], name=m.get("name") or m["id"], type=m["type"],
            input_modalities=m["input_modalities"], verified=m["verified"], context_length=m.get("context_length"),
            pricing_usd_per_1m=m["pricing"]["usd_per_1m"], shortlist=m.get("shortlist", False), role=m.get("role"),
            aa_index=m.get("aa_index"), license=m.get("license"), legacy=m.get("legacy", False),
        )
        for m in rows if m.get("available")
    ]


def list_models(shortlist: bool | None = None, type: str | None = None, provider: str | None = None) -> list[CatalogModel]:
    return [
        m for m in _all()
        if (shortlist is None or m.shortlist == shortlist)
        and (type is None or m.type == type)
        and (provider is None or m.provider == provider)
    ]
