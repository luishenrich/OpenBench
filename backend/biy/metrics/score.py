"""Deterministic scores. Values use the bank's own direction. Nothing is flipped."""

from __future__ import annotations

import json
from typing import Any


class UnimplementedMetricError(ValueError):
    """score() was asked for a bank id it does not compute.

    None means the metric does not apply (for example, no reference or no schema).
    An id outside SCORERS is a caller error, including planned rows, judges, and
    metrics the runner measures itself.
    """

    def __init__(self, metric_id: str, runtime_status: str):
        self.metric_id = metric_id
        self.runtime_status = runtime_status
        hint = {
            "planned": "It is on the roadmap. The selector omits it unless include_planned is set.",
            "judge": "Call judge(). A single configured judge is one call; a judges list is the jury.",
            "runner_measured": "The runner records this from stream timing, usage, or cost.",
            "implemented": "The bank marks it implemented, but score() has no function for it.",
        }.get(runtime_status, "It is not a deterministic score().")
        super().__init__(
            f"score() cannot compute {metric_id!r} (runtime_status={runtime_status}). {hint}"
        )

import jsonschema

from metric_bank.illustrative import (
    bbox_iou,
    character_accuracy,
    character_error_rate,
    exact_match,
    word_accuracy,
    word_error_rate,
)

from .deterministic import EXTRA_SCORERS, normalize_label
from .types import CaseView, OutputView


def _schema(case: CaseView, config: dict) -> dict | None:
    if isinstance(config.get("schema"), dict):
        return config["schema"]
    io_spec = case.io_spec
    schema = getattr(io_spec, "response_schema", None)
    if schema is None and isinstance(io_spec, dict):
        schema = io_spec.get("response_schema")
    return schema if isinstance(schema, dict) else None


def _object(output: OutputView) -> Any | None:
    if output.json is not None:
        return output.json
    if not output.text:
        return None
    text = output.text.strip()
    if not text.startswith(("{", "[")):
        return None
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        return None


def _reference_object(reference: Any) -> Any | None:
    if isinstance(reference, str):
        text = reference.strip()
        if text.startswith(("{", "[")):
            try:
                return json.loads(text)
            except json.JSONDecodeError:
                return None
        return None
    return reference


def score_json_schema_valid(case: CaseView, output: OutputView, config: dict) -> float | None:
    schema = _schema(case, config)
    if schema is None:
        return None
    instance = _object(output)
    if instance is None:
        return 0.0
    try:
        jsonschema.Draft202012Validator(schema).validate(instance)
    except jsonschema.ValidationError:
        return 0.0
    return 1.0


def _flatten(value: Any, prefix: str = "") -> dict[str, Any] | None:
    if isinstance(value, dict):
        flat: dict[str, Any] = {}
        for key, item in value.items():
            path = f"{prefix}.{key}" if prefix else str(key)
            if isinstance(item, dict):
                nested = _flatten(item, path)
                if nested is None:
                    return None
                flat.update(nested)
            else:
                flat[path] = item
        return flat
    if prefix == "" and value is None:
        return None
    return {prefix or "value": value}


def _matchers(config: dict) -> dict:
    matchers = config.get("matchers") or {}
    return matchers if isinstance(matchers, dict) else {}


def _values_match(predicted: Any, gold: Any, spec: dict | None) -> bool:
    kind = (spec or {}).get("type", "auto")
    if kind == "numeric" or (kind == "auto" and isinstance(gold, (int, float)) and not isinstance(gold, bool)):
        tolerance = float((spec or {}).get("tolerance", 0))
        try:
            return abs(float(predicted) - float(gold)) <= tolerance
        except (TypeError, ValueError):
            return False
    if kind in {"casefold", "auto"} and isinstance(gold, str):
        return predicted is not None and str(predicted).casefold() == gold.casefold()
    return predicted == gold


def _field_counts(case: CaseView, output: OutputView, config: dict) -> tuple[dict, dict] | None:
    if case.reference is None:
        return None
    gold = _flatten(_reference_object(case.reference) if not isinstance(case.reference, dict) else case.reference)
    predicted_obj = _object(output)
    predicted = _flatten(predicted_obj) if predicted_obj is not None else {}
    if gold is None:
        return None
    return predicted or {}, gold


def score_field_accuracy(case: CaseView, output: OutputView, config: dict) -> float | None:
    counted = _field_counts(case, output, config)
    if counted is None:
        return None
    predicted, gold = counted
    if not gold:
        return 1.0 if not predicted else 0.0
    matchers = _matchers(config)
    matched = sum(1 for key, value in gold.items() if _values_match(predicted.get(key), value, matchers.get(key)))
    return matched / len(gold)


def score_field_f1(case: CaseView, output: OutputView, config: dict) -> float | None:
    counted = _field_counts(case, output, config)
    if counted is None:
        return None
    predicted, gold = counted
    if not predicted and not gold:
        return 1.0
    matchers = _matchers(config)
    true_positive = false_positive = false_negative = 0
    for key in set(predicted) | set(gold):
        in_prediction = key in predicted
        in_gold = key in gold
        matched = in_prediction and in_gold and _values_match(predicted[key], gold[key], matchers.get(key))
        if matched:
            true_positive += 1
            continue
        if in_prediction:
            false_positive += 1
        if in_gold:
            false_negative += 1
    precision = true_positive / (true_positive + false_positive) if true_positive + false_positive else 0.0
    recall = true_positive / (true_positive + false_negative) if true_positive + false_negative else 0.0
    if precision + recall == 0:
        return 0.0
    return 2 * precision * recall / (precision + recall)


def score_exact_match(case: CaseView, output: OutputView, config: dict) -> float | None:
    if case.reference is None or output.text is None and output.json is None:
        return None
    normalize = bool(config.get("normalize", True))
    if isinstance(case.reference, str) and output.text is not None and output.json is None:
        return 1.0 if exact_match(output.text, case.reference, normalize=normalize) else 0.0
    predicted = output.json if output.json is not None else output.text
    if isinstance(case.reference, str):
        if predicted is None:
            return None
        return 1.0 if exact_match(str(predicted), case.reference, normalize=normalize) else 0.0
    if isinstance(predicted, (dict, list)) and isinstance(case.reference, (dict, list)):
        left = json.dumps(predicted, sort_keys=True, ensure_ascii=False)
        right = json.dumps(case.reference, sort_keys=True, ensure_ascii=False)
        return 1.0 if left == right else 0.0
    return None


def _label(value: Any, field: str) -> Any:
    if isinstance(value, dict):
        return value.get(field)
    return value


def score_classification_accuracy(case: CaseView, output: OutputView, config: dict) -> float | None:
    if case.reference is None:
        return None
    field = str(config.get("label_field", "label"))
    gold = _label(case.reference, field)
    predicted = _label(output.json if output.json is not None else output.text, field)
    if gold is None or predicted is None:
        return None
    return 1.0 if normalize_label(predicted) == normalize_label(gold) else 0.0


def _transcript(value: Any) -> str | None:
    if isinstance(value, str):
        return value
    if isinstance(value, dict):
        for key in ("text", "transcription", "transcript"):
            item = value.get(key)
            if isinstance(item, str):
                return item
    return None


def _transcription_pair(case: CaseView, output: OutputView) -> tuple[str, str] | None:
    if case.reference is None:
        return None
    gold = _transcript(case.reference)
    predicted = _transcript(output.json if output.json is not None else output.text)
    if gold is None or predicted is None:
        return None
    return predicted, gold


def score_cer(case: CaseView, output: OutputView, config: dict) -> float | None:
    pair = _transcription_pair(case, output)
    if pair is None:
        return None
    return character_error_rate(*pair)


def score_wer(case: CaseView, output: OutputView, config: dict) -> float | None:
    pair = _transcription_pair(case, output)
    if pair is None:
        return None
    return word_error_rate(*pair)


def score_character_accuracy(case: CaseView, output: OutputView, config: dict) -> float | None:
    pair = _transcription_pair(case, output)
    if pair is None:
        return None
    return character_accuracy(*pair)


def score_word_accuracy(case: CaseView, output: OutputView, config: dict) -> float | None:
    pair = _transcription_pair(case, output)
    if pair is None:
        return None
    return word_accuracy(*pair)


def _box(value: Any) -> tuple[float, float, float, float] | None:
    if isinstance(value, dict) and all(key in value for key in ("x0", "y0", "x1", "y1")):
        coords = (value["x0"], value["y0"], value["x1"], value["y1"])
    elif isinstance(value, (list, tuple)) and len(value) == 4:
        coords = tuple(value)
    else:
        return None
    try:
        box = tuple(float(item) for item in coords)
    except (TypeError, ValueError):
        return None
    return box  # type: ignore[return-value]


def _boxes(value: Any) -> list[tuple[float, float, float, float]] | None:
    raw = value
    if isinstance(value, dict):
        raw = value.get("boxes", value.get("regions"))
    if not isinstance(raw, list):
        return None
    boxes = []
    for item in raw:
        box = _box(item)
        if box is None:
            return None
        boxes.append(box)
    return boxes


def _matched_ious(case: CaseView, output: OutputView) -> tuple[list[float], int, int] | None:
    if case.reference is None:
        return None
    gold = _boxes(case.reference)
    predicted = _boxes(output.json if output.json is not None else output.text)
    if gold is None:
        return None
    if predicted is None:
        predicted = []
    pairs: list[tuple[float, int, int]] = []
    for i, box in enumerate(predicted):
        for j, other in enumerate(gold):
            pairs.append((bbox_iou(box, other), i, j))
    pairs.sort(reverse=True)
    used_pred: set[int] = set()
    used_gold: set[int] = set()
    matched: list[float] = []
    for iou, i, j in pairs:
        if iou <= 0 or i in used_pred or j in used_gold:
            continue
        used_pred.add(i)
        used_gold.add(j)
        matched.append(iou)
    return matched, len(predicted), len(gold)


def score_bbox_iou(case: CaseView, output: OutputView, config: dict) -> float | None:
    matched = _matched_ious(case, output)
    if matched is None:
        return None
    ious, predicted_count, gold_count = matched
    if gold_count == 0:
        return 1.0 if predicted_count == 0 else 0.0
    if not ious:
        return 0.0
    return sum(ious) / len(ious)


def score_bbox_f1(case: CaseView, output: OutputView, config: dict) -> float | None:
    matched = _matched_ious(case, output)
    if matched is None:
        return None
    ious, predicted_count, gold_count = matched
    if predicted_count == 0 and gold_count == 0:
        return 1.0
    threshold = float(config.get("iou_threshold", 0.5))
    true_positive = sum(1 for iou in ious if iou >= threshold)
    precision = true_positive / predicted_count if predicted_count else 0.0
    recall = true_positive / gold_count if gold_count else 0.0
    if precision + recall == 0:
        return 0.0
    return 2 * precision * recall / (precision + recall)


SCORERS = {
    "json_schema_valid": score_json_schema_valid,
    "field_accuracy": score_field_accuracy,
    "field_f1": score_field_f1,
    "exact_match": score_exact_match,
    "classification_accuracy": score_classification_accuracy,
    "character_accuracy": score_character_accuracy,
    "word_accuracy": score_word_accuracy,
    "cer": score_cer,
    "wer": score_wer,
    "bbox_iou": score_bbox_iou,
    "bbox_f1": score_bbox_f1,
    **EXTRA_SCORERS,
}
