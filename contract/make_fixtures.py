"""Regenerate contract/fixtures/*.json. Every fixture is built through contract.schemas, so it validates.

Run from the repo root: python3 -m contract.make_fixtures
Example data only (made-up invoices, tickets, receipts). Not taken from any real repo.
"""

import json
from datetime import datetime, timedelta, timezone
from pathlib import Path
from uuid import UUID

from contract import schemas as s
from contract.metric_bank_mapping import list_metrics, scorecard

OUT = Path(__file__).parent / "fixtures"
T0 = datetime(2026, 10, 24, 12, 0, tzinfo=timezone.utc)
WS = UUID("00000000-0000-0000-0000-0000000000a1")
UC_EXTRACT = UUID("00000000-0000-0000-0000-0000000000b1")
UC_CLASSIFY = UUID("00000000-0000-0000-0000-0000000000b2")
UC_RECEIPT = UUID("00000000-0000-0000-0000-0000000000b3")
RUN = UUID("00000000-0000-0000-0000-0000000000c1")
RUN_LIVE = UUID("00000000-0000-0000-0000-0000000000c2")


def uid(n: int) -> UUID:
    return UUID(f"00000000-0000-0000-0000-{n:012d}")


def dump(name: str, obj) -> None:
    if isinstance(obj, list):
        data = [o.model_dump(mode="json") for o in obj]
    else:
        data = obj.model_dump(mode="json")
    (OUT / f"{name}.json").write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n")


workspace = s.Workspace(id=WS, name="Demo workspace", default_profile=s.Profile(), default_judge=s.JudgeConfig())
me = s.Me(user_id=uid(1), email="demo@biy.dev", workspace=workspace, mcp_key_last4="9f3a")

invoice_schema = {
    "type": "object",
    "properties": {
        "vendor": {"type": "string"}, "invoice_number": {"type": "string"},
        "date": {"type": "string"}, "total": {"type": "number"}, "currency": {"type": "string"},
    },
    "required": ["vendor", "invoice_number", "date", "total", "currency"],
    "additionalProperties": False,
}

extract = s.UseCase(
    id=UC_EXTRACT, workspace_id=WS, name="Extract invoice fields", kind="extraction",
    description="Pulls vendor, number, date and total out of invoice text for bookkeeping.",
    source_refs=[s.SourceRef(repo="example/app", path="src/billing/extract.ts", line=42, symbol="extractInvoice")],
    current_model=s.ModelRef(provider="openrouter", model="openai/gpt-4.1-mini"),
    profile=s.Profile(weights={"quality": 60, "speed": 25, "cost": 15},
                      targets={"e2e_ms_p95": 2000, "e2e_ms_p95_max": 8000, "cost_per_call_usd": 0.0005, "cost_per_call_usd_max": 0.005}),
    gates=[s.Gate(metric_id="json_schema_valid", op=">=", value=0.99), s.Gate(metric_id="error_rate", op="<=", value=0.02)],
    metrics=[s.MetricSpec(metric_id="json_schema_valid", weight=1), s.MetricSpec(metric_id="field_accuracy", weight=3)],
    judge=None,
    io_spec=s.IOSpec(system_prompt="Extract the invoice fields. Answer with JSON only.",
                     user_template="Invoice:\n{{text}}", response_schema=invoice_schema, params={"temperature": 0}),
    case_count=50,
    latest_run=s.RunBrief(id=RUN, status="done", finished_at=T0 + timedelta(minutes=9),
                          recommendation_headline="Switch to GLM-5.3-Flash: 98% of today's quality at 1/5 of the cost",
                          est_monthly_savings_usd=412.0),
    created_by="mcp", created_at=T0 - timedelta(hours=1),
)
classify = s.UseCase(
    id=UC_CLASSIFY, workspace_id=WS, name="Route support tickets", kind="classification",
    description="Labels each incoming ticket as billing, bug, how_to or account.",
    source_refs=[s.SourceRef(repo="example/app", path="src/support/route.py", line=17, symbol="route_ticket")],
    current_model=s.ModelRef(provider="openrouter", model="openai/gpt-4.1-mini"),
    profile=s.Profile(weights={"quality": 50, "speed": 30, "cost": 20}),
    gates=[s.Gate(metric_id="error_rate", op="<=", value=0.02)],
    metrics=[s.MetricSpec(metric_id="classification_accuracy", weight=1)],
    io_spec=s.IOSpec(system_prompt="Answer with one label: billing, bug, how_to, account.", user_template="{{ticket}}"),
    case_count=50, latest_run=s.RunBrief(id=RUN_LIVE, status="running"),
    created_by="mcp", created_at=T0 - timedelta(hours=1),
)
receipt = s.UseCase(
    id=UC_RECEIPT, workspace_id=WS, name="Read receipt photos", kind="extraction",
    description="Reads merchant and total from a photo of a receipt (image input).",
    source_refs=[s.SourceRef(repo="example/app", path="src/expenses/receipt.ts", line=8)],
    current_model=s.ModelRef(provider="openrouter", model="google/gemini-2.5-flash"),
    metrics=[s.MetricSpec(metric_id="json_schema_valid"), s.MetricSpec(metric_id="field_accuracy", weight=3)],
    io_spec=s.IOSpec(user_template="Read merchant and total from this receipt.",
                     response_schema={"type": "object", "properties": {"merchant": {"type": "string"}, "total": {"type": "number"}},
                                      "required": ["merchant", "total"], "additionalProperties": False}),
    case_count=0, latest_run=None, created_by="dashboard", created_at=T0 - timedelta(minutes=20),
)

cases = [
    s.Case(id=uid(100 + i), use_case_id=UC_EXTRACT, source="repo" if i < 2 else "synthetic", tags=tags,
           input={"vars": {"text": text}}, reference=ref)
    for i, (text, ref, tags) in enumerate([
        ("ACME GmbH — Invoice INV-2041 — 2026-09-30 — Total: 1,204.50 EUR",
         {"vendor": "ACME GmbH", "invoice_number": "INV-2041", "date": "2026-09-30", "total": 1204.5, "currency": "EUR"}, ["easy"]),
        ("Rechnung Nr. 88-17 von Müller & Söhne, 03.10.2026, Gesamtbetrag 89,00 €",
         {"vendor": "Müller & Söhne", "invoice_number": "88-17", "date": "2026-10-03", "total": 89.0, "currency": "EUR"}, ["german", "date-format"]),
        ("Northwind Ltd | #NW-5 | Oct 1 2026 | Amount due $12,000.00 (incl. VAT)",
         {"vendor": "Northwind Ltd", "invoice_number": "NW-5", "date": "2026-10-01", "total": 12000.0, "currency": "USD"}, ["synthetic"]),
    ])
] + [
    s.Case(id=uid(200), use_case_id=UC_RECEIPT, source="upload",
           input={"vars": {}, "images": ["https://example.supabase.co/storage/v1/object/public/cases/receipt-001.png"]},
           reference={"merchant": "Corner Café", "total": 7.4}),
]

shortlist_models = [
    s.CatalogModel(id="zai-org/GLM-5.3-Flash", provider="nebius", name="GLM-5.3-Flash", type="vision",
                   input_modalities=["text", "image"], verified={"text": True, "vision": True, "tools": True, "json_schema": True, "reasoning": True},
                   context_length=1024000, pricing_usd_per_1m={"input": 0.15, "output": 0.5, "cached_input": None},
                   shortlist=True, role="frontier", aa_index=42, license=None),
    s.CatalogModel(id="deepseek-ai/DeepSeek-V4.1-Flash-1017", provider="nebius", name="DeepSeek-V4.1-Flash-1017", type="vision",
                   input_modalities=["text", "image"], verified={"text": True, "vision": True, "tools": True, "json_schema": True, "reasoning": True},
                   context_length=1048576, pricing_usd_per_1m={"input": 0.3, "output": 1.2, "cached_input": None},
                   shortlist=True, role="frontier", aa_index=45),
    s.CatalogModel(id="openai/gpt-oss-120b", provider="nebius", name="gpt-oss-120b", type="text",
                   input_modalities=["text"], verified={"text": True, "vision": False, "tools": True, "json_schema": True, "reasoning": True},
                   context_length=131072, pricing_usd_per_1m={"input": 0.15, "output": 0.6, "cached_input": None},
                   shortlist=True, role="baseline", aa_index=12, legacy=True),
    s.CatalogModel(id="xiaomi/mimo-v2.6-pro", provider="openrouter", name="Xiaomi: MiMo-V2.6-Pro", type="vision",
                   input_modalities=["text", "image"], verified={"text": True, "vision": True, "tools": True, "json_schema": True, "reasoning": True},
                   context_length=1050000, pricing_usd_per_1m={"input": 0.435, "output": 0.87, "cached_input": None},
                   shortlist=True, role="frontier", aa_index=46, license="mit"),
]

cands = [
    ("nebius", "zai-org/GLM-5.3-Flash", False, 0.962, 0.031, 410, 1650, 0.00009, 1, True),
    ("nebius", "deepseek-ai/DeepSeek-V4.1-Flash-1017", False, 0.971, 0.027, 260, 1420, 0.00021, 2, True),
    ("openrouter", "xiaomi/mimo-v2.6-pro", False, 0.975, 0.024, 2600, 5100, 0.00031, 3, True),
    ("nebius", "openai/gpt-oss-120b", False, 0.918, 0.048, 290, 980, 0.00010, 4, False),
    ("nebius", "MiniMaxAI/MiniMax-M3.1-Flash", False, 0.884, 0.061, 330, 1900, 0.00011, None, False),
    ("openrouter", "openai/gpt-4.1-mini", True, 0.981, 0.022, 520, 1750, 0.00046, None, False),
]


def cand_result(provider, model, base, q, std, ttft, e2e, cost, rank, pareto, n=150):
    key = f"{provider}:{model}"
    disq = rank is None and not base
    return s.CandidateResult(
        candidate_key=key, provider=provider, model=model, is_baseline=base, n=n,
        quality=s.Stat(mean=q, std=std, ci_low=round(q - 1.96 * std / n ** 0.5 * 2, 3), ci_high=round(min(1, q + 1.96 * std / n ** 0.5 * 2), 3), n=n),
        metrics={
            "json_schema_valid": s.Stat(mean=0.97 if disq else 1.0, std=0.17 if disq else 0.0, ci_low=0.94 if disq else 1.0, ci_high=0.99 if disq else 1.0, n=n),
            "field_accuracy": s.Stat(mean=q, std=std, ci_low=round(q - 0.02, 3), ci_high=round(min(1, q + 0.02), 3), n=n),
        },
        ttft_ms=s.Pct(p50=ttft, p95=round(ttft * 1.8)), e2e_ms=s.Pct(p50=e2e, p95=round(e2e * 1.7)), tokens_per_s=round(180000 / e2e, 1),
        cost_per_call_usd=cost, cost_per_success_usd=round(cost / q, 6), error_rate=0.0 if not disq else 0.013,
        scores=s.Scores(quality=q, speed=round(min(1, 2000 / (e2e * 1.7)), 3), cost=round(min(1, 0.0005 / cost), 3),
                        utility=round(q ** 0.6 * min(1, 2000 / (e2e * 1.7)) ** 0.25 * min(1, 0.0005 / cost) ** 0.15, 3)),
        passed_gates=not disq, failed_gates=["json_schema_valid >= 0.99"] if disq else [],
        pareto=pareto, rank=rank,
    )


board = [cand_result(*c) for c in cands]
pareto = [s.ParetoPoint(candidate_key=b.candidate_key, label=b.model.split("/")[-1], quality=b.quality.mean,
                        cost_per_success_usd=b.cost_per_success_usd, latency_ms=b.e2e_ms.p95, is_baseline=b.is_baseline, pareto=b.pareto)
          for b in board]
rec = s.Recommendation(
    candidate_key="nebius:zai-org/GLM-5.3-Flash", provider="nebius", model="zai-org/GLM-5.3-Flash",
    headline="Switch to GLM-5.3-Flash: 98% of today's quality at 1/5 of the cost",
    reasons=["Passes every gate (schema valid 100%, no errors)",
             "Field accuracy 0.962 vs 0.981 for gpt-4.1-mini; CIs overlap with DeepSeek-V4.1-Flash, so the cheaper one wins",
             "p95 latency 2.8 s vs 3.0 s today"],
    quality_vs_baseline_pct=98.1, cost_multiple_vs_baseline=0.2, latency_delta_ms=-170,
    statistical_tie_with=["nebius:deepseek-ai/DeepSeek-V4.1-Flash-1017"], est_monthly_savings_usd=412.0,
)
candidates = [s.ModelRef(provider=c[0], model=c[1]) for c in cands if not c[2]]
run_done = s.Run(id=RUN, use_case_id=UC_EXTRACT, status="done",
                 progress=s.Progress(done=900, total=900, errors=2, judged=0, judge_total=0),
                 candidates=candidates, repeats=3, est_cost_usd=0.41, actual_cost_usd=0.37,
                 created_at=T0, started_at=T0 + timedelta(seconds=3), finished_at=T0 + timedelta(minutes=9),
                 leaderboard=board, pareto_points=pareto, recommendation=rec)
run_running = s.Run(id=RUN_LIVE, use_case_id=UC_CLASSIFY, status="running",
                    progress=s.Progress(done=312, total=900, errors=1),
                    candidates=candidates, repeats=3, est_cost_usd=0.22, actual_cost_usd=0.08,
                    created_at=T0 + timedelta(minutes=10), started_at=T0 + timedelta(minutes=10, seconds=2), finished_at=None,
                    leaderboard=[], pareto_points=[], recommendation=None)

estimate = s.Estimate(calls=900, est_input_tokens=540000, est_output_tokens=180000, est_cost_usd=0.41, judge_cost_usd=0.0,
                      total_usd=0.41, per_candidate=[s.EstimateLine(provider=c[0], model=c[1], calls=150, est_cost_usd=round(c[7] * 150, 4)) for c in cands])
results = s.ResultsPage(items=[
    s.ResultOut(id=uid(300), candidate_key="nebius:zai-org/GLM-5.3-Flash", case_id=uid(101), repeat_idx=0,
                output={"text": '{"vendor":"Müller & Söhne","invoice_number":"88-17","date":"2026-10-03","total":89.0,"currency":"EUR"}',
                        "json": {"vendor": "Müller & Söhne", "invoice_number": "88-17", "date": "2026-10-03", "total": 89.0, "currency": "EUR"}},
                timing={"ttft_ms": 402, "e2e_ms": 1611, "tokens_per_s": 96.0},
                usage={"prompt_tokens": 212, "completion_tokens": 61, "reasoning_tokens": 0}, cost_usd=0.000062, error=None,
                scores={"json_schema_valid": 1.0, "field_accuracy": 1.0}, judge=None),
    s.ResultOut(id=uid(301), candidate_key="nebius:MiniMaxAI/MiniMax-M3.1-Flash", case_id=uid(101), repeat_idx=0,
                output={"text": "Here are the fields: vendor Müller & Söhne, …", "json": None},
                timing={"ttft_ms": 340, "e2e_ms": 2050, "tokens_per_s": 71.0},
                usage={"prompt_tokens": 212, "completion_tokens": 88}, cost_usd=0.000085, error=None,
                scores={"json_schema_valid": 0.0, "field_accuracy": 0.0}, judge=None),
    s.ResultOut(id=uid(302), candidate_key="nebius:openai/gpt-oss-120b", case_id=uid(102), repeat_idx=1,
                output={}, timing={"ttft_ms": None, "e2e_ms": 30000, "tokens_per_s": None}, usage={}, cost_usd=None,
                error="timeout after 30 s", scores={}, judge=None),
    s.ResultOut(id=uid(303), candidate_key="nebius:zai-org/GLM-5.3-Flash", case_id=uid(150), repeat_idx=0,
                output={"text": "Thanks for flagging this! I've reset your password link; it is valid for 24 hours."},
                timing={"ttft_ms": 380, "e2e_ms": 1200, "tokens_per_s": 88.0}, usage={"prompt_tokens": 180, "completion_tokens": 40},
                cost_usd=0.00005, error=None, scores={"pairwise_vs_baseline": 1.0},
                judge={"mode": "pairwise", "winner": "candidate", "score": 1.0,
                       "reasoning": "Both answers solve the issue; the candidate is shorter and states the 24 h limit. Same verdict in both orders."}),
], next_cursor="eyJvZmZzZXQiOjR9")

OUT.mkdir(exist_ok=True)
dump("me", me)
dump("use_cases", [extract, classify, receipt])
dump("use_case", extract)
dump("cases", cases)
dump("models", shortlist_models)
dump("estimate", estimate)
dump("run_running", run_running)
dump("run_done", run_done)
dump("results", results)

DEMO_METRICS = ["json_schema_valid", "field_accuracy", "classification_accuracy", "character_accuracy", "cer",
                "bbox_iou", "rubric_score", "pairwise_vs_baseline", "error_rate", "e2e_ms", "cost_per_success_usd"]
by_id = {m.id: m for m in list_metrics()}
dump("metrics", [by_id[i] for i in DEMO_METRICS])
dump("scorecard", scorecard(s.ScorecardBrief(kind="extraction", has_schema=True, has_reference=True, numeric_fields=True,
                                              narrative="Extracts invoice fields into a JSON schema; the caller waits.")))
print("wrote", sorted(p.name for p in OUT.glob("*.json")))
