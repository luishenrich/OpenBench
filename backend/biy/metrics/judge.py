"""Rubric and pairwise judges.

One configured judge keeps the old path: call_llm(messages) -> str, rubric once,
pairwise in both orders. A jury (config['judges'], or config['jury'] is True) calls
call_llm(messages, judge=spec) once per juror. The worker on main also calls judge()
once per juror and aggregates itself; this function does the same aggregation when
the jury is passed in, and the stored names match ResultOut.judge.

Rubric score is the mean of the non-abstaining jurors. A pairwise win counts only
when every non-abstaining juror agrees in both orders; otherwise the result is a
tie at 0.5. A juror abstains when the output is from its own family (pairwise: also
when the reference is). Agreement is true when at least two voted and rubric scores
are within 0.25, or pairwise winners match. That is the worker's AGREE_WITHIN.

The jury is Luna, DeepSeek-V4.1-Flash, and GLM-5.3. GLM keeps the provider's
reasoning default (pinning an effort nearly stops it). Luna and DeepSeek pin "low".
Luna's cost is usage.cost_details.upstream_inference_cost when is_byok is true.
"""

from __future__ import annotations

import inspect
import json
import re
from pathlib import Path

from .judge_rubrics import RUBRICS
from .types import CaseView, JudgeResult, OutputView

_FENCE = re.compile(r"\{.*\}", re.DOTALL)
# Same cutoff as backend/biy/worker.py AGREE_WITHIN. Rubric jurors agree inside this band.
RUBRIC_AGREEMENT_TOLERANCE = 0.25
PAIRWISE_METRICS = {"pairwise_vs_baseline", "length_controlled_win_rate"}

# Three families, so every output still has two votes after one abstains.
# Fallback if GLM misbehaves as a juror: nebius:moonshotai/Kimi-K3 (do not add it here).
# Used when config['jury'] is true. The contract default on main is still Luna + DeepSeek;
# Raphaël adds GLM to JudgeConfig._default_jury.
DEFAULT_JURY = (
    {
        "id": "luna",
        "key": "openrouter:openai/gpt-6-luna@low",
        "provider": "openrouter",
        "model": "openai/gpt-6-luna",
        "family": "openai",
        "reasoning_effort": "low",
    },
    {
        "id": "deepseek",
        "key": "nebius:deepseek-ai/DeepSeek-V4.1-Flash-1017@low",
        "provider": "nebius",
        "model": "deepseek-ai/DeepSeek-V4.1-Flash-1017",
        "family": "deepseek",
        "reasoning_effort": "low",
    },
    {
        "id": "glm",
        "key": "nebius:zai-org/GLM-5.3",
        "provider": "nebius",
        "model": "zai-org/GLM-5.3",
        "family": "glm",
        "reasoning_effort": None,
    },
)


def _prompt_dirs() -> list[Path]:
    packaged = Path(__file__).resolve().parent / "prompt_templates"
    repo = Path(__file__).resolve().parents[3] / "prompts" / "judge"
    return [repo, packaged]


def load_prompt(name: str) -> str:
    for directory in _prompt_dirs():
        path = directory / name
        if path.is_file():
            return path.read_text(encoding="utf-8")
    raise FileNotFoundError(f"missing judge prompt {name}")


def _fill(template: str, values: dict[str, str]) -> str:
    text = template
    for key, value in values.items():
        text = text.replace("{{" + key + "}}", value)
    return text


def _dump(value: object) -> str:
    if isinstance(value, str):
        return value
    return json.dumps(value, ensure_ascii=False, indent=2, default=str)


def _parse_object(text: str) -> dict:
    match = _FENCE.search(text.strip())
    if not match:
        raise ValueError("judge response did not contain a JSON object")
    parsed = json.loads(match.group(0))
    if not isinstance(parsed, dict):
        raise ValueError("judge response JSON was not an object")
    return parsed


def _reference_family():
    """Raphaël's family() without importing biy.providers (that package imports httpx)."""
    import importlib.util

    path = Path(__file__).resolve().parents[1] / "providers" / "references.py"
    spec = importlib.util.spec_from_file_location("_biy_reference_families", path)
    if spec is None or spec.loader is None:
        raise ImportError(f"cannot load {path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module.family


_FAMILY = _reference_family()


def _family_of(text: str) -> str:
    """Same families as biy.providers.references.family. Empty text has no family."""
    if not (text or "").strip():
        return ""
    return _FAMILY(text)


def _family_of_judge(spec: dict) -> str:
    family = str(spec.get("family") or "").strip().lower()
    if family:
        return family
    return _family_of(str(spec.get("model") or ""))


def _juror_key(spec: dict) -> str:
    """Contract key: provider:model, plus @effort when a reasoning effort is pinned."""
    if spec.get("key"):
        return str(spec["key"])
    provider = str(spec.get("provider") or "")
    model = str(spec.get("model") or spec.get("id") or "judge")
    effort = spec.get("reasoning_effort")
    base = f"{provider}:{model}" if provider else model
    if effort and effort != "default":
        return f"{base}@{effort}"
    return base


def _system_prompt(case: CaseView) -> str:
    spec = case.io_spec
    text = spec.get("system_prompt") if isinstance(spec, dict) else getattr(spec, "system_prompt", None)
    if isinstance(text, str) and text.strip():
        return text
    return "(none)"


def _abstains(spec: dict | None, config: dict, *, pairwise: bool) -> bool:
    if spec is None:
        return False
    family = _family_of_judge(spec)
    if not family:
        return False
    keys = [str(config.get("candidate_key") or "")]
    if pairwise:
        keys.append(str(config.get("baseline_key") or ""))
    return any(_family_of(key) == family for key in keys)


def _panel(config: dict) -> list[dict | None]:
    raw = config.get("judges")
    if raw is None and config.get("jury") is True:
        raw = DEFAULT_JURY
    if not raw:
        return [None]
    panel = []
    for item in raw:
        if not isinstance(item, dict):
            raise ValueError("config['judges'] entries must be objects")
        spec = dict(item)
        params = spec.get("params") if isinstance(spec.get("params"), dict) else {}
        if "reasoning_effort" not in spec:
            if "reasoning_effort" in params:
                spec["reasoning_effort"] = params["reasoning_effort"]
            elif _family_of(str(spec.get("model") or "")) == "glm":
                spec["reasoning_effort"] = None
            else:
                spec["reasoning_effort"] = "low"
        spec.setdefault("id", spec.get("model") or "judge")
        spec["key"] = _juror_key(spec)
        panel.append(spec)
    if not panel:
        return [None]
    return panel


def _accepts_judge(call_llm) -> bool:
    try:
        signature = inspect.signature(call_llm)
    except (TypeError, ValueError):
        return False
    for parameter in signature.parameters.values():
        if parameter.kind == inspect.Parameter.VAR_KEYWORD or parameter.name == "judge":
            return True
    return False


def _cost_usd(usage: dict | None) -> float | None:
    """Luna's BYOK bill is upstream_inference_cost. OpenRouter's own cost is 0."""
    if not isinstance(usage, dict):
        return None
    details = usage.get("cost_details") if isinstance(usage.get("cost_details"), dict) else {}
    upstream = details.get("upstream_inference_cost")
    if usage.get("is_byok") and upstream is not None:
        return float(upstream)
    if usage.get("cost") is not None:
        return float(usage["cost"])
    return None


async def _call(call_llm, messages: list[dict], judge_spec: dict | None) -> tuple[str, dict | None]:
    if judge_spec is None:
        result = call_llm(messages)
    elif _accepts_judge(call_llm):
        result = call_llm(messages, judge=judge_spec)
    else:
        raise TypeError("a jury needs call_llm(messages, judge=spec) so each judge can be pinned")
    if inspect.isawaitable(result):
        result = await result
    if isinstance(result, str):
        return result, None
    if isinstance(result, dict) and isinstance(result.get("text"), str):
        usage = result.get("usage") if isinstance(result.get("usage"), dict) else None
        return result["text"], usage
    raise TypeError("call_llm must return a string or {'text', 'usage'}")


def _score_value(parsed: dict) -> float:
    score = float(parsed["score"])
    if not 0 <= score <= 1:
        raise ValueError("judge score must be on [0, 1]")
    return score


def _absolute_winner(label: str, a_is_candidate: bool) -> str:
    cleaned = label.strip().lower()
    if cleaned == "tie":
        return "tie"
    if cleaned == "a":
        return "candidate" if a_is_candidate else "baseline"
    if cleaned == "b":
        return "baseline" if a_is_candidate else "candidate"
    raise ValueError(f"pairwise winner must be A, B, or tie, got {label!r}")


def _rubric_messages(case: CaseView, output: OutputView, config: dict, metric_id: str) -> list[dict]:
    if metric_id == "rubric_score":
        body = _fill(
            load_prompt("rubric.md"),
            {
                "rubric": str(config.get("rubric") or "Follow the task. Be correct, complete, and on topic."),
                "system_prompt": _system_prompt(case),
                "case_input": _dump(case.input),
                "output": _dump(output.json if output.json is not None else output.text),
            },
        )
        return [{"role": "user", "content": body}]
    rubric, _lower = RUBRICS[metric_id]
    body = _fill(
        load_prompt("named.md"),
        {
            "metric_id": metric_id,
            "rubric": str(config.get("rubric") or rubric),
            "system_prompt": _system_prompt(case),
            "case_input": _dump(case.input),
            "reference": _dump(case.reference),
            "output": _dump(output.json if output.json is not None else output.text),
        },
    )
    return [{"role": "user", "content": body}]


def _pairwise_messages(case: CaseView, first: OutputView, second: OutputView, config: dict, metric_id: str) -> list[dict]:
    if metric_id == "length_controlled_win_rate":
        rubric = str(config.get("rubric") or RUBRICS[metric_id][0])
    else:
        rubric = str(config.get("rubric") or "Prefer the output that answers the input more correctly and completely. Do not prefer length.")
    body = _fill(
        load_prompt("pairwise.md"),
        {
            "rubric": rubric,
            "system_prompt": _system_prompt(case),
            "case_input": _dump(case.input),
            "output_a": _dump(first.json if first.json is not None else first.text),
            "output_b": _dump(second.json if second.json is not None else second.text),
        },
    )
    return [{"role": "user", "content": body}]


def _blank_row(spec: dict | None, *, abstained: bool) -> dict:
    if spec is None:
        return {
            "id": "judge",
            "key": "judge",
            "provider": None,
            "model": None,
            "score": None,
            "reasoning": "",
            "winner": None,
            "abstained": abstained,
            "reasoning_effort": None,
            "cost_usd": None,
        }
    return {
        "id": spec.get("id"),
        "key": spec.get("key") or _juror_key(spec),
        "provider": spec.get("provider"),
        "model": spec.get("model"),
        "score": None,
        "reasoning": "",
        "winner": None,
        "abstained": abstained,
        "reasoning_effort": spec.get("reasoning_effort"),
        "cost_usd": None,
    }


def _public_jurors(rows: list[dict]) -> list[dict]:
    """Shape stored on result.judge.jurors. cost_usd and orders are extra and optional."""
    published = []
    for row in rows:
        if row["abstained"]:
            continue
        item = {
            "key": row.get("key"),
            "reasoning_effort": row.get("reasoning_effort"),
            "score": row.get("score"),
            "reasoning": row.get("reasoning") or "",
            "winner": row.get("winner"),
        }
        if row.get("cost_usd") is not None:
            item["cost_usd"] = row["cost_usd"]
        if row.get("orders") is not None:
            item["orders"] = row["orders"]
        published.append(item)
    return published


def _joined_reasoning(rows: list[dict]) -> str:
    parts = []
    for row in rows:
        if row["abstained"]:
            continue
        label = str(row.get("key") or row.get("id") or "judge").split(":", 1)[-1]
        parts.append(f"{label}: {row.get('reasoning') or ''}")
    return "  |  ".join(parts)


def _agreement(voted: list[dict], *, pairwise: bool) -> bool | None:
    if len(voted) < 2:
        return None
    if pairwise:
        return len({row["winner"] for row in voted}) == 1
    spread = max(float(row["score"]) for row in voted) - min(float(row["score"]) for row in voted)
    return spread <= RUBRIC_AGREEMENT_TOLERANCE


def _finish_rubric(rows: list[dict], *, single: bool) -> JudgeResult:
    voted = [row for row in rows if not row["abstained"]]
    if not voted:
        raise ValueError("every judge abstained")
    score = sum(float(row["score"]) for row in voted) / len(voted)
    abstained = [str(row["key"]) for row in rows if row["abstained"]]
    agreement = _agreement(voted, pairwise=False)
    if single:
        reasoning = str(voted[0]["reasoning"] or "")
    else:
        reasoning = _joined_reasoning(rows)
    return JudgeResult(
        score=score,
        reasoning=reasoning,
        winner=None,
        jurors=_public_jurors(rows),
        abstained=abstained,
        agreement=agreement,
        low_agreement=None if agreement is None else not agreement,
        reasoning_effort={str(row["key"]): row.get("reasoning_effort") for row in rows},
    )


def _finish_pairwise(rows: list[dict], *, single: bool) -> JudgeResult:
    voted = [row for row in rows if not row["abstained"]]
    if not voted:
        raise ValueError("every judge abstained")
    winners = [row["winner"] for row in voted]
    if all(label == winners[0] for label in winners) and winners[0] in {"candidate", "baseline"}:
        winner = winners[0]
        score = 1.0 if winner == "candidate" else 0.0
    else:
        winner = "tie"
        score = 0.5
    abstained = [str(row["key"]) for row in rows if row["abstained"]]
    agreement = _agreement(voted, pairwise=True)
    if single:
        reasoning = str(voted[0]["reasoning"] or "")
    else:
        reasoning = _joined_reasoning(rows)
    return JudgeResult(
        score=score,
        reasoning=reasoning,
        winner=winner,  # type: ignore[arg-type]
        jurors=_public_jurors(rows),
        abstained=abstained,
        agreement=agreement,
        low_agreement=None if agreement is None else not agreement,
        reasoning_effort={str(row["key"]): row.get("reasoning_effort") for row in rows},
    )


async def _one_rubric(call_llm, messages, spec: dict | None) -> dict:
    text, usage = await _call(call_llm, messages, spec if spec is not None else None)
    parsed = _parse_object(text)
    row = _blank_row(spec, abstained=False)
    row["score"] = _score_value(parsed)
    row["reasoning"] = str(parsed.get("reasoning") or "")
    row["cost_usd"] = _cost_usd(usage)
    return row


async def _one_pairwise(call_llm, case, output, baseline, config, metric_id, spec: dict | None) -> dict:
    first_text, first_usage = await _call(
        call_llm, _pairwise_messages(case, output, baseline, config, metric_id), spec
    )
    second_text, second_usage = await _call(
        call_llm, _pairwise_messages(case, baseline, output, config, metric_id), spec
    )
    first = _parse_object(first_text)
    second = _parse_object(second_text)
    left = _absolute_winner(str(first["winner"]), a_is_candidate=True)
    right = _absolute_winner(str(second["winner"]), a_is_candidate=False)
    reasoning = (
        "Order candidate-then-baseline: "
        + str(first.get("reasoning") or "")
        + " Order baseline-then-candidate: "
        + str(second.get("reasoning") or "")
    )
    winner = left if left == right and left in {"candidate", "baseline"} else "tie"
    row = _blank_row(spec, abstained=False)
    row["winner"] = winner
    row["score"] = 1.0 if winner == "candidate" else 0.0 if winner == "baseline" else 0.5
    row["reasoning"] = reasoning
    costs = [c for c in (_cost_usd(first_usage), _cost_usd(second_usage)) if c is not None]
    row["cost_usd"] = sum(costs) if costs else None
    row["orders"] = [left, right]
    return row


async def judge(metric_id: str, case: CaseView, output: OutputView, baseline: OutputView | None, config: dict, call_llm) -> JudgeResult:
    """Score one judge metric. A single call_llm with no judges list is the old path."""
    config = config or {}
    panel = _panel(config)
    single = panel == [None] or (len(panel) == 1 and panel[0] is None)
    # A list of one judge is still a single voter, but it is pinned.
    jury = len([item for item in panel if item is not None]) >= 2
    if not single and len(panel) == 1 and not _accepts_judge(call_llm):
        # One pinned judge and an old call_llm(messages): call it without judge=.
        pass

    named_rubric = metric_id in RUBRICS and metric_id not in PAIRWISE_METRICS
    if metric_id == "rubric_score" or named_rubric:
        messages = _rubric_messages(case, output, config, metric_id if metric_id != "rubric_score" else "rubric_score")
        rows = []
        for spec in panel:
            if _abstains(spec, config, pairwise=False):
                rows.append(_blank_row(spec, abstained=True))
                continue
            # Single unpinned judge must be called as call_llm(messages) with judge_spec None
            # so the old tests and the current runner keep working.
            call_spec = None if spec is None or (not jury and not _accepts_judge(call_llm)) else spec
            rows.append(await _one_rubric(call_llm, messages, call_spec if spec is not None else None))
            if spec is not None and rows[-1]["key"] == "judge":
                rows[-1]["id"] = spec.get("id")
                rows[-1]["key"] = spec.get("key") or _juror_key(spec)
                rows[-1]["reasoning_effort"] = spec.get("reasoning_effort")
                rows[-1]["provider"] = spec.get("provider")
                rows[-1]["model"] = spec.get("model")
        return _finish_rubric(rows, single=not jury)

    if metric_id not in PAIRWISE_METRICS:
        raise KeyError(f"judge() does not implement {metric_id!r}")
    if baseline is None:
        raise ValueError(f"{metric_id} requires a baseline output")
    rows = []
    for spec in panel:
        if _abstains(spec, config, pairwise=True):
            rows.append(_blank_row(spec, abstained=True))
            continue
        call_spec = None if spec is None or (not jury and not _accepts_judge(call_llm)) else spec
        row = await _one_pairwise(call_llm, case, output, baseline, config, metric_id, call_spec if spec is not None else None)
        if spec is not None:
            row["id"] = spec.get("id")
            row["provider"] = spec.get("provider")
            row["model"] = spec.get("model")
            row["reasoning_effort"] = spec.get("reasoning_effort")
        rows.append(row)
    return _finish_pairwise(rows, single=not jury)
