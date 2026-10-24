"""BIY metric bank: a selectable catalogue of LLM evaluation metrics.

The discovery agent and the dashboard pick from this bank. Public benchmarks
(MMLU, HELM, BIG-bench, and the rest) are priors, not rows, unless their
scoring function can be run on a client's own cases.
"""

__all__ = ["build_bank", "load_bank"]


def __getattr__(name: str):
    if name in __all__:
        from .build import build_bank, load_bank

        return {"build_bank": build_bank, "load_bank": load_bank}[name]
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
