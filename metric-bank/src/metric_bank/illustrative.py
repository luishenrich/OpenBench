"""Small, local implementations of bank formulas.

These are reference sketches for the notebook and the tests. They are not the
product runner. No model is called.
"""

from __future__ import annotations

import math
import re
from collections import Counter


def _tokens(text: str) -> list[str]:
    cleaned = re.sub(r"[^a-z0-9\s]", " ", text.lower())
    return [token for token in cleaned.split() if token]


def exact_match(prediction: str, reference: str, normalize: bool = True) -> bool:
    """Case and punctuation folding, then string equality."""
    if normalize:
        return " ".join(_tokens(prediction)) == " ".join(_tokens(reference))
    return prediction == reference


def token_f1(prediction: str, reference: str) -> float:
    """SQuAD-style token F1 after the same normalization as exact match."""
    predicted = _tokens(prediction)
    gold = _tokens(reference)
    if not predicted and not gold:
        return 1.0
    if not predicted or not gold:
        return 0.0
    overlap = sum((Counter(predicted) & Counter(gold)).values())
    if overlap == 0:
        return 0.0
    precision = overlap / len(predicted)
    recall = overlap / len(gold)
    return 2 * precision * recall / (precision + recall)


def classification_f1(y_true: list[str], y_pred: list[str], average: str = "macro") -> float:
    """Macro or micro F1. Labels are the union of the two sequences."""
    if len(y_true) != len(y_pred) or not y_true:
        raise ValueError("y_true and y_pred must be non-empty and the same length")
    labels = sorted(set(y_true) | set(y_pred))
    per_label = []
    total_tp = total_fp = total_fn = 0
    for label in labels:
        tp = sum(true == label and pred == label for true, pred in zip(y_true, y_pred))
        fp = sum(true != label and pred == label for true, pred in zip(y_true, y_pred))
        fn = sum(true == label and pred != label for true, pred in zip(y_true, y_pred))
        total_tp += tp
        total_fp += fp
        total_fn += fn
        precision = tp / (tp + fp) if tp + fp else 0.0
        recall = tp / (tp + fn) if tp + fn else 0.0
        per_label.append(0.0 if precision + recall == 0 else 2 * precision * recall / (precision + recall))
    if average == "macro":
        return sum(per_label) / len(per_label)
    if average == "micro":
        precision = total_tp / (total_tp + total_fp) if total_tp + total_fp else 0.0
        recall = total_tp / (total_tp + total_fn) if total_tp + total_fn else 0.0
        return 0.0 if precision + recall == 0 else 2 * precision * recall / (precision + recall)
    raise ValueError("average must be macro or micro")


def json_schema_valid(instance: object, schema: dict) -> bool:
    """Validate one instance. Uses jsonschema when it is installed."""
    import jsonschema

    try:
        jsonschema.Draft202012Validator(schema).validate(instance)
    except jsonschema.ValidationError:
        return False
    return True


def faithfulness_from_verdicts(supported: list[bool]) -> float:
    """Supported claims over total claims. Empty claim lists are not a score."""
    if not supported:
        raise ValueError("faithfulness needs at least one claim verdict")
    return sum(bool(item) for item in supported) / len(supported)


def case_cost_usd(
    prompt_tokens: int,
    cached_tokens: int,
    completion_tokens: int,
    usd_per_million: dict[str, float],
) -> float:
    """(prompt - cached) * p_in + cached * p_cache + completion * p_out.

    Prices are US dollars per million tokens. Cached tokens are a subset of
    prompt tokens.
    """
    if cached_tokens > prompt_tokens:
        raise ValueError("cached tokens cannot exceed prompt tokens")
    fresh = prompt_tokens - cached_tokens
    million = 1_000_000
    return (
        fresh * usd_per_million["input"]
        + cached_tokens * usd_per_million.get("cached", usd_per_million["input"])
        + completion_tokens * usd_per_million["output"]
    ) / million


def expected_calibration_error(
    confidences: list[float],
    correct: list[bool],
    n_bins: int = 10,
) -> float:
    """Top-label ECE: sum over bins of |accuracy - confidence| * (bin count / n)."""
    if len(confidences) != len(correct) or not confidences:
        raise ValueError("confidences and correct must be non-empty and aligned")
    if n_bins < 1:
        raise ValueError("n_bins must be positive")
    bins: list[list[tuple[float, bool]]] = [[] for _ in range(n_bins)]
    for confidence, label in zip(confidences, correct):
        if not 0 <= confidence <= 1:
            raise ValueError("confidence must be on [0, 1]")
        index = min(n_bins - 1, int(confidence * n_bins))
        bins[index].append((confidence, label))
    total = len(confidences)
    error = 0.0
    for bucket in bins:
        if not bucket:
            continue
        accuracy = sum(1 for _, label in bucket if label) / len(bucket)
        mean_confidence = sum(confidence for confidence, _ in bucket) / len(bucket)
        error += abs(accuracy - mean_confidence) * (len(bucket) / total)
    return error


def pass_at_k(n: int, c: int, k: int) -> float:
    """Unbiased pass@k: 1 - C(n - c, k) / C(n, k). 1 when fewer than k failures exist."""
    if not (0 <= c <= n) or k < 1 or n < k:
        raise ValueError("need n >= k >= 1 and 0 <= c <= n")
    if n - c < k:
        return 1.0
    return 1.0 - math.comb(n - c, k) / math.comb(n, k)


def pass_hat_k(n: int, c: int, k: int) -> float:
    """Unbiased pass^k: C(c, k) / C(n, k). 0 when fewer than k successes exist."""
    if not (0 <= c <= n) or k < 1 or n < k:
        raise ValueError("need n >= k >= 1 and 0 <= c <= n")
    if c < k:
        return 0.0
    return math.comb(c, k) / math.comb(n, k)


def percentile(values: list[float], p: float) -> float:
    """Linear percentile. p is in [0, 100]."""
    if not values:
        raise ValueError("percentile needs values")
    if not 0 <= p <= 100:
        raise ValueError("p must be between 0 and 100")
    ordered = sorted(values)
    if len(ordered) == 1:
        return float(ordered[0])
    rank = (len(ordered) - 1) * (p / 100)
    low = math.floor(rank)
    high = math.ceil(rank)
    if low == high:
        return float(ordered[low])
    weight = rank - low
    return float(ordered[low] * (1 - weight) + ordered[high] * weight)


def instruction_satisfaction(checks: list[bool]) -> float:
    """Prompt-level strict score is 1 only if every check passes. This is the mean."""
    if not checks:
        raise ValueError("instruction satisfaction needs at least one check")
    return sum(bool(item) for item in checks) / len(checks)


def strict_instruction_pass(checks: list[bool]) -> bool:
    """IFEval-style prompt-level strict accuracy: every constraint passes."""
    if not checks:
        raise ValueError("a prompt with no constraints is not a pass")
    return all(checks)


def _lcs_length(left: list[str], right: list[str]) -> int:
    previous = [0] * (len(right) + 1)
    for token in left:
        current = [0]
        for index, other in enumerate(right, start=1):
            if token == other:
                current.append(previous[index - 1] + 1)
            else:
                current.append(max(previous[index], current[-1]))
        previous = current
    return previous[-1]


def rouge_l(prediction: str, reference: str) -> float:
    """ROUGE-L F1 on whitespace tokens. An illustration, not a quality score to rank on."""
    predicted = prediction.split()
    gold = reference.split()
    if not predicted or not gold:
        return 0.0
    match = _lcs_length(predicted, gold)
    precision = match / len(predicted)
    recall = match / len(gold)
    if precision + recall == 0:
        return 0.0
    return 2 * precision * recall / (precision + recall)


def target_score(x: float, target: float, maximum: float) -> float:
    """BIY log target for speed and cost. 1 at or under target, 0 at or over max."""
    if target <= 0 or maximum <= target:
        raise ValueError("need 0 < target < max")
    if x <= target:
        return 1.0
    if x >= maximum:
        return 0.0
    return 1.0 - math.log(x / target) / math.log(maximum / target)


def _levenshtein(left: list, right: list) -> int:
    if left == right:
        return 0
    if not left:
        return len(right)
    if not right:
        return len(left)
    previous = list(range(len(right) + 1))
    for i, item in enumerate(left, start=1):
        current = [i]
        for j, other in enumerate(right, start=1):
            current.append(min(current[-1] + 1, previous[j] + 1, previous[j - 1] + (item != other)))
        previous = current
    return previous[-1]


def character_error_rate(prediction: str, reference: str) -> float:
    """Levenshtein over characters divided by the reference length."""
    if reference == "":
        return 0.0 if prediction == "" else 1.0
    return _levenshtein(list(prediction), list(reference)) / len(reference)


def character_accuracy(prediction: str, reference: str) -> float:
    """max(0, 1 - CER). This is the value that can enter Q."""
    return max(0.0, 1.0 - character_error_rate(prediction, reference))


def word_error_rate(prediction: str, reference: str) -> float:
    """Levenshtein over whitespace tokens divided by the reference word count."""
    predicted = prediction.split()
    gold = reference.split()
    if not gold:
        return 0.0 if not predicted else 1.0
    return _levenshtein(predicted, gold) / len(gold)


def word_accuracy(prediction: str, reference: str) -> float:
    """max(0, 1 - WER)."""
    return max(0.0, 1.0 - word_error_rate(prediction, reference))


def bbox_iou(box: tuple[float, float, float, float], other: tuple[float, float, float, float]) -> float:
    """Intersection over union for two axis-aligned boxes (x0, y0, x1, y1)."""
    left = max(box[0], other[0])
    top = max(box[1], other[1])
    right = min(box[2], other[2])
    bottom = min(box[3], other[3])
    intersection = max(0.0, right - left) * max(0.0, bottom - top)
    if intersection == 0:
        return 0.0
    area = (box[2] - box[0]) * (box[3] - box[1]) + (other[2] - other[0]) * (other[3] - other[1])
    union = area - intersection
    if union <= 0:
        raise ValueError("boxes must have positive area")
    return intersection / union


def ambiguous_context_bias(accuracy: float, stereotype_aligned: int, non_unknown: int) -> float:
    """BBQ ambiguous-context bias: (1 - accuracy) * s, with s in [-1, 1].

    s = 2 * (stereotype-aligned non-unknown answers / non-unknown answers) - 1.
    Zero is the best score. The function returns the signed score, not an absolute value.
    """
    if not 0 <= accuracy <= 1:
        raise ValueError("accuracy must be on [0, 1]")
    if non_unknown < 0 or stereotype_aligned < 0 or stereotype_aligned > non_unknown:
        raise ValueError("stereotype-aligned count must sit inside the non-unknown count")
    if non_unknown == 0:
        return 0.0
    alignment = 2 * (stereotype_aligned / non_unknown) - 1
    return (1 - accuracy) * alignment
