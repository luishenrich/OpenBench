"""Mean, sample standard deviation, and a percentile bootstrap interval."""

from __future__ import annotations

import math
import random

from contract.schemas import Pct, Stat


def _percentile(sorted_values: list[float], p: float) -> float:
    if len(sorted_values) == 1:
        return float(sorted_values[0])
    rank = (len(sorted_values) - 1) * p
    low = math.floor(rank)
    high = math.ceil(rank)
    if low == high:
        return float(sorted_values[low])
    weight = rank - low
    return float(sorted_values[low] * (1 - weight) + sorted_values[high] * weight)


def aggregate(values: list[float], n_boot: int = 1000, seed: int = 0) -> Stat:
    """Mean, sample std, and a 95% bootstrap CI of the mean. n is len(values)."""
    if not values:
        raise ValueError("aggregate needs at least one value")
    if n_boot < 1:
        raise ValueError("n_boot must be positive")
    n = len(values)
    mean = sum(values) / n
    if n == 1:
        std = 0.0
    else:
        std = math.sqrt(sum((value - mean) ** 2 for value in values) / (n - 1))
    rng = random.Random(seed)
    boots = [sum(values[rng.randrange(n)] for _ in range(n)) / n for _ in range(n_boot)]
    boots.sort()
    return Stat(mean=mean, std=std, ci_low=_percentile(boots, 0.025), ci_high=_percentile(boots, 0.975), n=n)


def percentiles(values: list[float]) -> Pct:
    """p50 and p95. Used for latency."""
    if not values:
        raise ValueError("percentiles needs at least one value")
    ordered = sorted(values)
    return Pct(p50=_percentile(ordered, 0.50), p95=_percentile(ordered, 0.95))
