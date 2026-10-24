"""Merge the per-provider probe files into one catalogue: catalog/models.json.

Inputs (all written by probe_models.py or the research step):
  catalog/nebius.json                 Nebius Token Factory, all models
  catalog/openrouter/*.json           OpenRouter, models Nebius does not have
  catalog/openrouter/*.licenses.json  license per OpenRouter model
  catalog/reference_prices.json       official first-party prices from the model makers

Pricing fields per model:
  pricing            what the endpoint we call bills; benchmarks score with this
  reference_price    the maker's own API price, for comparison only (may be null)

Usage: python3 scripts/build_catalog.py
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

import httpx

from probe_models import derive_capabilities, vision_ok

ROOT = Path(__file__).resolve().parent.parent
CAT = ROOT / "catalog"


def rejudge(m: dict) -> dict:
    """Re-apply the current pass/fail rules to the stored raw probe results."""
    results = m["probe"]["results"]
    vision = results.get("vision") or {}
    if vision.get("status") in ("pass", "wrong_answer") and "answer" in vision:
        vision["status"] = "pass" if vision_ok(vision["answer"]) else "wrong_answer"
    is_embedding = m["type"] == "embedding"
    m["verified"], m["input_modalities"], m["output_modalities"] = derive_capabilities(results, is_embedding)
    if not is_embedding:
        m["type"] = "vision" if "image" in m["input_modalities"] else "text"
    m["available"] = m["verified"].get("text", False) or m["verified"].get("embedding", False)
    return m


def load(path: Path):
    return json.loads(path.read_text()) if path.exists() else None


def norm(s: str | None) -> str | None:
    return s.lower() if s else None


# Nebius ids whose HF repo can't be matched by name against OpenRouter's list.
NEBIUS_HF_ALIASES = {
    "reflection/beam": "reflection/Beam-1.0-501B-A23B",
    "meta-models/muse-spark-open": "meta-models/Muse-Spark-Open-816B-A42B",
    "nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B": "nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B-BF16",
    "nvidia/nemotron-3-super-120b-a12b": "nvidia/NVIDIA-Nemotron-3-Super-120B-A12B-FP8",
    "nvidia/Nemotron-3-Ultra-550b-a55b": "nvidia/NVIDIA-Nemotron-3-Ultra-550B-A55B-BF16",
    "nvidia/Nemotron-3_5-Lightning": "nvidia/NVIDIA-Nemotron-3.5-Lightning-30B-A3B-BF16",
    "nvidia/Nemotron-3.5-Super-VL": "nvidia/NVIDIA-Nemotron-3.5-Super-VL",
}

# Models released before this are kept but marked legacy (older generations).
LEGACY_BEFORE = datetime(2026, 1, 1, tzinfo=timezone.utc)


def openrouter_index() -> tuple[dict[str, str], dict[str, int]]:
    """Nebius /models has no HF repo field; borrow it from OpenRouter's public list.
    Also returns the earliest OpenRouter listing date per HF repo (≈ release date)."""
    resp = httpx.get("https://openrouter.ai/api/v1/models", timeout=60)
    resp.raise_for_status()
    idx, created = {}, {}
    for m in resp.json()["data"]:
        hf = m.get("hugging_face_id")
        if hf:
            idx[norm(hf)] = hf
            idx[norm(hf.split("/")[-1])] = hf
            if m.get("created"):
                created[norm(hf)] = min(created.get(norm(hf), m["created"]), m["created"])
    return idx, created


def main() -> None:
    hf_index, created = openrouter_index()
    models: list[dict] = []

    nebius = load(CAT / "nebius.json")
    for m in nebius["models"]:
        m["base_url"] = nebius["base_url"]
        m["key_env"] = nebius["key_env"]
        m["hf_repo"] = (m.get("hf_repo") or NEBIUS_HF_ALIASES.get(m["id"])
                        or hf_index.get(norm(m["id"])) or hf_index.get(norm(m["id"].split("/")[-1]))
                        or m["id"])  # Nebius ids are HF repo ids by convention
        models.append(m)

    licenses: dict[str, dict] = {}
    for f in sorted((CAT / "openrouter").glob("*.licenses.json")):
        for row in load(f) or []:
            licenses[row["id"]] = row

    nebius_repos = {norm(m["hf_repo"]) for m in models if m.get("hf_repo")}
    for f in sorted((CAT / "openrouter").glob("*.json")):
        if f.name.endswith(".licenses.json"):
            continue
        data = load(f)
        for m in data["models"]:
            if norm(m.get("hf_repo")) in nebius_repos:
                continue  # Nebius serves the same weights; keep one offering for now
            lic = licenses.get(m["id"])
            if lic and lic.get("open_weight") is False:
                continue
            m["base_url"] = data["base_url"]
            m["key_env"] = data["key_env"]
            m["license"] = lic.get("license") if lic else None
            m["group"] = f.stem
            models.append(m)

    ref = load(CAT / "reference_prices.json") or {"makers": []}
    ref_by_repo = {}
    for maker in ref["makers"]:
        for rm in maker.get("models", []):
            if rm.get("matches_hf_repo"):
                ref_by_repo[norm(rm["matches_hf_repo"])] = {
                    "maker": maker["maker"],
                    "maker_model_id": rm.get("maker_model_id"),
                    "usd_per_1m": rm.get("usd_per_1m"),
                    "tiers": rm.get("tiers"),
                    "source": maker.get("pricing_url"),
                    "fetched_at": maker.get("fetched_at"),
                }
    for m in models:
        m["reference_price"] = ref_by_repo.get(norm(m.get("hf_repo")))
        ts = created.get(norm(m.get("hf_repo")))
        released = datetime.fromtimestamp(ts, timezone.utc) if ts else None
        m["released_at"] = released.date().isoformat() if released else None
        m["legacy"] = bool(released and released < LEGACY_BEFORE)
        m["free_tier"] = m["id"].endswith(":free")

    # de-duplicate by (provider, id): a re-probe (*.retry.json) repeats a model; newest wins
    latest: dict[tuple, dict] = {}
    for m in map(rejudge, models):
        key = (m["provider"], m["id"])
        if key not in latest or m["probe"]["checked_at"] > latest[key]["probe"]["checked_at"]:
            latest[key] = m
    unique = list(latest.values())

    unique.sort(key=lambda m: (m["provider"] != "nebius", m["type"], m["id"].lower()))
    out = CAT / "models.json"
    out.write_text(json.dumps({
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "models": unique,
    }, indent=2, ensure_ascii=False) + "\n")

    by = {}
    for m in unique:
        by.setdefault((m["provider"], m["type"]), 0)
        by[(m["provider"], m["type"])] += 1
    print(f"wrote {out}: {len(unique)} models", {f"{p}/{t}": n for (p, t), n in sorted(by.items())})


if __name__ == "__main__":
    main()
