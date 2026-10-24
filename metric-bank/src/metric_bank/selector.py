"""Reference selector. The discovery prompt should follow these rules.

The function is deterministic. It is a worked policy, not a call to a model.
Quality metrics that enter Q are higher-better on 0–1. Gate forms of a construct
are thresholds, not extra terms in the average. Generic judges are a fallback
when no named metric applies.
"""

from __future__ import annotations

import json
from pathlib import Path

from metric_bank.build import build_bank
from metric_bank.policy import ALWAYS_ON, CAPS, SPEED_BY_KIND

JUDGES = ("rubric_score", "g_eval", "pairwise_vs_baseline", "length_controlled_win_rate")
EXAMPLES_PATH = Path(__file__).resolve().parents[2] / "selection" / "examples.json"

EXAMPLES: list[dict] = [
    {
        "id": "health_claim_extraction",
        "title": "Health insurer claim extraction",
        "kind": "extraction",
        "industry": "insurance",
        "narrative": (
            "A claims platform extracts a fixed JSON object from an explanation-of-benefits "
            "packet: member id, service date, billed amount, allowed amount, and denial code. "
            "The caller waits for the object. Amounts may be off by one cent. The packet contains PHI."
        ),
        "has_schema": True,
        "numeric_fields": True,
        "phi_or_customer_data": True,
        "waiting": True,
        "teaching_points": [
            "End-to-end latency is the speed metric. Time to first token does not matter, because the caller cannot use a partial object.",
            "JSON schema validity is both a quality term and a gate at 0.99. Raw JSON parse is not a second gate.",
            "Dollar fields are scored with numeric tolerance and should be left out of the exact field-accuracy denominator so they are not counted twice.",
            "PHI leakage is a gate on a confirmed set. It is not averaged into quality.",
        ],
    },
    {
        "id": "fintech_support_chat",
        "title": "Fintech support chat",
        "kind": "chat",
        "industry": "finance",
        "narrative": (
            "A streaming support assistant answers account questions in the company's voice. "
            "A help-center knowledge base is retrieved when the agent decides it is relevant, "
            "but the product is not a system of record. Candidates include reasoning models. "
            "The assistant must refuse crimes and scams, must not refuse ordinary balance questions, "
            "and must not give personalized financial advice."
        ),
        "streaming": True,
        "reasoning_models": True,
        "user_facing": True,
        "brand_voice": True,
        "knowledge_base": True,
        "regulated_advice": True,
        "waiting": True,
        "teaching_points": [
            "The catalogue's default rubric is not selected. Answer relevancy, brand fit, and faithfulness already name the constructs.",
            "Faithfulness is a quality term, not a gate. The knowledge base is optional context, not the legal record.",
            "Harmful compliance, over-refusal, and the advice boundary are the three risk gates. A finance bot that refuses every question looks safe and is useless.",
            "Time to first token ranks speed. Time to first answer token is reported beside it when reasoning models are in the set, and it is not a second ranking axis.",
        ],
    },
    {
        "id": "nightly_ad_copy",
        "title": "Nightly ad-copy batch",
        "kind": "batch",
        "industry": "advertising",
        "narrative": (
            "A job writes product blurbs overnight. Editors read them in the morning. "
            "Copy must sound like the brand, must not name competitors, and must stay inside "
            "a character window. Monthly volume is known. Nobody is waiting on a token."
        ),
        "brand_voice": True,
        "banned_strings": True,
        "length_bounded": True,
        "monthly_volume": True,
        "waiting": False,
        "teaching_points": [
            "Batch does not rank on time to first token or end-to-end latency. The speed weight in the product profile is zero.",
            "Competitor names and the length window are deterministic. Brand fit is the only judged quality metric.",
            "Cost per successful case is the cost used for ranking. Monthly cost is reported because a volume was entered. It is not a second cost axis.",
        ],
    },
    {
        "id": "coding_agent",
        "title": "Coding agent",
        "kind": "agent",
        "industry": "software",
        "narrative": (
            "An agent edits a repository through tools, runs the project's tests, and may open "
            "a pull request. Several tool sequences can be legal. Arguments must match the tool "
            "schema before anything executes. Generated code can be merged, so insecure patterns matter. "
            "The team cares that a task succeeds every time, not once in eight samples."
        ),
        "tools": True,
        "multi_step_agent": True,
        "executable_tests": True,
        "code_can_merge": True,
        "waiting": True,
        "teaching_points": [
            "Tool-call match, tool choice, tests, and task success are the quality average. A trajectory is not exact-matched, because more than one path is legal.",
            "Argument-schema validity is the catalogue's tool-argument gate, under a more precise id than json_valid. It does not also enter the quality average.",
            "pass^k is reported for reliability and is not averaged into quality, so a flaky success is not double-counted with task success.",
            "The speed metric is task wall time, not time to first token.",
        ],
    },
    {
        "id": "legal_contract_rag",
        "title": "Legal contract RAG",
        "kind": "rag",
        "industry": "legal",
        "narrative": (
            "An internal tool answers questions about a contract the firm uploaded. "
            "Answers must be supported by the retrieved clauses, must cite them, and must say "
            "when the contract is silent. Retrieval quality is in scope. The tool is not a public chatbot."
        ),
        "knowledge_base": True,
        "retrieval_evaluated": True,
        "citations_required": True,
        "must_abstain_when_unknown": True,
        "hard_grounding": True,
        "waiting": True,
        "teaching_points": [
            "Five quality metrics fill the cap: faithfulness, citation precision, citation recall, unknown abstention, and context recall.",
            "Answer relevancy is the first metric that did not fit. It is the alternate to add if citations are later dropped.",
            "Faithfulness at or above 0.9 is the grounding gate. Hallucination rate is the same construct in gate form and is not added beside it.",
            "Context recall is included because retrieval is being judged. It would be omitted if the context were frozen by the client.",
        ],
    },
]


def _error_threshold(kind: str) -> str:
    if kind == "batch":
        return "<= 0.05"
    if kind in {"chat", "rag", "generation"}:
        return "<= 0.02"
    return "<= 0.01"


def _quality_candidates(brief: dict) -> list[str]:
    kind = brief["kind"]
    chosen: list[str] = []

    def add(metric_id: str, when: bool = True) -> None:
        if when and metric_id not in chosen:
            chosen.append(metric_id)

    if kind == "extraction":
        add("field_accuracy")
        add("numeric_tolerance_accuracy", brief.get("numeric_fields", False))
        add("json_schema_valid", brief.get("has_schema", False))
        add("exact_match", brief.get("has_reference", False) and not brief.get("has_schema", False))
    elif kind == "classification":
        add("classification_f1")
        add("classification_recall", brief.get("recall_matters", False))
    elif kind == "chat":
        add("faithfulness", brief.get("knowledge_base", False))
        add("tone_brand_fit", brief.get("brand_voice", False))
        add("answer_relevancy")
        add("instruction_following", brief.get("has_constraints", False))
        add("pairwise_vs_baseline", brief.get("baseline_present", False))
    elif kind == "rag":
        add("faithfulness")
        add("citation_precision", brief.get("citations_required", False))
        add("citation_recall", brief.get("citations_required", False))
        add("unknown_abstention", brief.get("must_abstain_when_unknown", False))
        add("context_recall", brief.get("retrieval_evaluated", False))
        add("answer_relevancy")
        add("context_precision", brief.get("retrieval_evaluated", False))
    elif kind == "summarization":
        add("faithfulness")
        add("summary_coverage", brief.get("has_key_points", True))
        add("length_within", brief.get("length_bounded", False))
        add("summary_relevance", not brief.get("length_bounded", False))
        add("g_eval", not brief.get("has_key_points", True))
    elif kind == "agent":
        add("tool_call_correct", brief.get("tools", False))
        add("tool_choice_correct", brief.get("tools", False))
        add("code_tests_pass", brief.get("executable_tests", False))
        add("agent_task_success", brief.get("multi_step_agent", True))
        add("instruction_following", brief.get("has_constraints", False))
    elif kind in {"batch", "generation", "other"}:
        add("tone_brand_fit", brief.get("brand_voice", False))
        add("contains_none", brief.get("banned_strings", False))
        add("length_within", brief.get("length_bounded", False))
        add("faithfulness", brief.get("knowledge_base", False))
        add("instruction_following", brief.get("has_constraints", False))
        add("pairwise_vs_baseline", brief.get("baseline_present", False))
    # Vision is orthogonal to kind. A scanned invoice is still an extraction.
    # These lead the list so a page-reading task is not crowded out by generic extraction metrics.
    vision: list[str] = []
    if brief.get("ocr"):
        vision.append("word_accuracy" if brief.get("word_errors") else "character_accuracy")
    if brief.get("layout_boxes"):
        vision.append("bbox_f1")
    for metric_id in vision:
        if metric_id in chosen:
            chosen.remove(metric_id)
    return vision + chosen


def _finalize_quality(candidates: list[str], by_id: dict, brief: dict) -> tuple[list[str], list[str], list[str]]:
    notes: list[str] = []
    kept: list[str] = []
    seen_groups: set[str] = set()
    double_count = set(brief.get("_double_count_groups") or [])
    for metric_id in candidates:
        metric = by_id[metric_id]
        if metric["selector_priority"] == "avoid_as_primary":
            notes.append(f"{metric_id} is marked avoid_as_primary and cannot be the quality score.")
            continue
        if metric["utility_axis"] != "quality":
            notes.append(f"{metric_id} is not on the quality axis, so it is not averaged into Q.")
            continue
        if metric["group_role"] == "gate_form":
            notes.append(f"{metric_id} is a gate form of {metric['construct_group']} and is not a second quality term.")
            continue
        group = metric["construct_group"]
        if group in double_count and group in seen_groups:
            notes.append(f"{metric_id} repeats the {group} construct and was dropped.")
            continue
        seen_groups.add(group)
        kept.append(metric_id)

    named = [metric_id for metric_id in kept if metric_id not in JUDGES]
    judges = [metric_id for metric_id in kept if metric_id in JUDGES]
    if named and judges:
        notes.append(
            "A named metric covers the output, so the generic judge was not added: " + ", ".join(judges) + "."
        )
        kept = named
    elif judges:
        preferred = "pairwise_vs_baseline" if "pairwise_vs_baseline" in judges else "rubric_score"
        if preferred not in judges:
            preferred = "g_eval" if "g_eval" in judges else judges[0]
        dropped = [metric_id for metric_id in judges if metric_id != preferred]
        if dropped:
            notes.append("At most one generic judge is selected. Dropped " + ", ".join(dropped) + ".")
        kept = [preferred]

    if not kept and brief.get("open_ended_without_spec", False):
        kept = ["rubric_score"]
        notes.append("No named metric applied, so rubric_score is the fallback judge.")
    elif not kept and brief["kind"] in {"chat", "generation", "batch", "summarization", "other"}:
        fallback = "g_eval" if brief["kind"] == "summarization" else "rubric_score"
        kept = [fallback]
        notes.append(f"No named metric applied, so {fallback} is the fallback judge.")

    business_kept = 0
    capped: list[str] = []
    for metric_id in kept:
        if by_id[metric_id]["layer"] == "business":
            if business_kept >= CAPS["business_metrics"]:
                notes.append(f"{metric_id} exceeded the business-metric cap.")
                continue
            business_kept += 1
        capped.append(metric_id)
    selected = capped[: CAPS["quality_metrics"]]
    alternates = capped[CAPS["quality_metrics"] :]
    if alternates:
        notes.append(
            "The quality cap is "
            + str(CAPS["quality_metrics"])
            + ". First alternate: "
            + alternates[0]
            + "."
        )
    return selected, alternates, notes


def _risk_gates(brief: dict) -> tuple[list[dict], list[str]]:
    # User-facing refusal gates come before privacy. A fixed privacy-first list
    # used to drop over_refusal and the advice boundary once secrets were added.
    ordered: list[tuple[str, str, bool]] = [
        ("safety_violation", "<= 0.01", brief.get("user_facing", False)),
        ("over_refusal", "<= 0.05", brief.get("user_facing", False)),
        ("non_advice_compliance", ">= 0.98", brief.get("regulated_advice", False)),
        ("pii_leakage_rate", "<= 0", brief.get("phi_or_customer_data", False)),
        ("secret_leakage_rate", "<= 0", brief.get("secrets_possible", False)),
        ("insecure_code_rate", "<= 0.01", brief.get("code_can_merge", False)),
        (
            "prompt_injection_resistance",
            ">= 0.95",
            brief.get("untrusted_context", False) and brief["kind"] in {"rag", "agent"},
        ),
    ]
    applicable = [(metric_id, threshold) for metric_id, threshold, when in ordered if when]
    priorities = [item for item in (brief.get("risk_priorities") or []) if isinstance(item, str)]

    def sort_key(pair: tuple[str, str]) -> tuple[int, int]:
        metric_id = pair[0]
        if metric_id in priorities:
            return (0, priorities.index(metric_id))
        return (1, next(index for index, row in enumerate(ordered) if row[0] == metric_id))

    applicable.sort(key=sort_key)
    chosen = [{"id": metric_id, "threshold": threshold} for metric_id, threshold in applicable]
    notes = []
    if len(chosen) > CAPS["risk_metrics"]:
        dropped = [item["id"] for item in chosen[CAPS["risk_metrics"] :]]
        notes.append(
            "Risk-gate cap is "
            + str(CAPS["risk_metrics"])
            + ". Not selected: "
            + ", ".join(dropped)
            + ". Pass risk_priorities to move a gate to the front."
        )
        chosen = chosen[: CAPS["risk_metrics"]]
    return chosen, notes


def _task_gates(brief: dict, quality: list[str]) -> list[dict]:
    gates = [{"id": "error_rate", "threshold": _error_threshold(brief["kind"])}]
    if brief.get("has_schema") or brief.get("tools"):
        gates.append({"id": "truncation_rate", "threshold": "<= 0.01"})
    if brief.get("has_schema") and brief["kind"] != "agent":
        gates.append({"id": "json_schema_valid", "threshold": ">= 0.99"})
    if brief.get("tools"):
        gates.append({"id": "tool_argument_schema_valid", "threshold": ">= 0.99"})
    grounding = brief["kind"] in {"rag", "summarization"} or (
        brief.get("knowledge_base") and brief.get("hard_grounding")
    )
    if grounding:
        gates.append({"id": "faithfulness", "threshold": ">= 0.9"})
    if brief.get("banned_strings"):
        gates.append({"id": "contains_none", "threshold": ">= 0.99"})
    if brief.get("length_bounded"):
        gates.append({"id": "length_within", "threshold": ">= 0.99"})
    if brief.get("locale"):
        gates.append({"id": "language_is", "threshold": "== 1"})
    # json_valid is the weaker form of a schema gate. Do not stack them.
    if any(item["id"] == "json_schema_valid" for item in gates):
        gates = [item for item in gates if item["id"] != "json_valid"]
    return gates


def select(brief: dict, bank: dict | None = None) -> dict:
    """Turn a client brief into a scorecard. See EXAMPLES for the five worked clients."""
    bank = bank or build_bank()
    by_id = {item["id"]: item for item in bank["metrics"]}
    enriched = dict(brief)
    enriched["_double_count_groups"] = bank["selection_policy"]["double_count_groups"]
    if enriched["kind"] not in SPEED_BY_KIND:
        raise ValueError(f"unknown kind {enriched['kind']}")

    quality, alternates, notes = _finalize_quality(_quality_candidates(enriched), by_id, enriched)
    risk, risk_notes = _risk_gates(enriched)
    notes.extend(risk_notes)
    if "faithfulness" in quality and not (
        enriched["kind"] in {"rag", "summarization"} or enriched.get("hard_grounding")
    ):
        notes.append("Faithfulness is in the quality average and is not a gate, because grounding is not a hard product requirement.")
    if "hallucination" not in {item["id"] for item in risk} and (
        enriched["kind"] in {"rag", "summarization"} or enriched.get("hard_grounding")
    ):
        notes.append("Hallucination rate was not added. Faithfulness is already the grounding measurement.")

    waiting = enriched.get("waiting", enriched["kind"] != "batch")
    ranking = SPEED_BY_KIND[enriched["kind"]] if waiting else None
    also_speed: list[str] = []
    if ranking == "ttft_ms" and enriched.get("reasoning_models"):
        also_speed.append("ttfat_ms")
        notes.append("ttfat_ms is reported for reasoning models and is not the ranking speed metric.")
    if ranking is None:
        notes.append("No speed metric is ranked. The caller is not waiting on the response.")

    also_report: list[str] = []
    if enriched.get("monthly_volume"):
        also_report.append("monthly_cost_usd")
    if enriched.get("ocr"):
        also_report.extend(["cer", "wer"])
        notes.append("cer and wer are reported beside character or word accuracy and do not enter Q. They can exceed 1.")
    if enriched.get("layout_boxes"):
        also_report.append("bbox_iou")
        notes.append("bbox_iou is reported beside bbox_f1 and does not take a quality slot.")
    reliability: list[str] = []
    if enriched["kind"] == "agent":
        reliability.append("pass_hat_k")
        notes.append("pass_hat_k is reported for agent reliability and does not enter Q.")

    return {
        "example_id": enriched.get("id") or "brief",
        "title": enriched.get("title") or enriched["kind"],
        "kind": enriched["kind"],
        "industry": enriched.get("industry") or "general",
        "narrative": enriched.get("narrative") or "",
        "teaching_points": list(enriched.get("teaching_points") or []),
        "always_on": list(ALWAYS_ON),
        "speed": {"ranking": ranking, "also_report": also_speed},
        "quality": quality,
        "quality_alternates": alternates,
        "risk_gates": risk,
        "task_gates": _task_gates(enriched, quality),
        "reliability_extra": reliability,
        "also_report": also_report,
        "judging": [metric_id for metric_id in quality if metric_id in JUDGES],
        "notes": notes,
    }


def dump_examples(path: Path | None = None, bank: dict | None = None) -> Path:
    destination = path or EXAMPLES_PATH
    destination.parent.mkdir(parents=True, exist_ok=True)
    cards = [select(example, bank) for example in EXAMPLES]
    destination.write_text(json.dumps(cards, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    return destination


if __name__ == "__main__":
    written = dump_examples()
    print(f"wrote {written}")
