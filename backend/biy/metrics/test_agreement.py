"""Human-agreement kit on fake results. No network."""

import json
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "backend"))

from biy.metrics.agreement import (  # noqa: E402
    cohens_kappa,
    main,
    prepare_records,
    score_rows,
    sheet_rows,
    spearman,
    verdict_bucket,
    write_sheet,
)

FIXTURE = ROOT / "contract" / "fixtures" / "results.json"


def _judge(mode, score, winner, reasoning="because"):
    return {"mode": mode, "score": score, "reasoning": reasoning, "winner": winner}


def _row(case, candidate, judge, output, *, use_case="invoices", repeat=0, baseline=False):
    return {
        "candidate_key": candidate,
        "case_id": case,
        "repeat_idx": repeat,
        "output": {"text": output},
        "is_baseline": baseline,
        "use_case": use_case,
        "judge": judge,
    }


def _pool():
    rows = []
    number = 0
    for use_case in ("invoices", "support"):
        for candidate in ("nebius:glm", "nebius:minimax"):
            for bucket, judge in (
                ("win", _judge("pairwise_vs_baseline", 1.0, "candidate")),
                ("loss", _judge("pairwise_vs_baseline", 0.0, "baseline")),
                ("high", _judge("rubric_score", 0.9, None)),
            ):
                for copy in range(2):
                    number += 1
                    rows.append(
                        _row(
                            f"case-{bucket}-{copy}",
                            candidate,
                            judge,
                            f"{use_case}-{candidate}-{bucket}-{copy}",
                            use_case=use_case,
                        )
                    )
    rows.append(_row("case-win-0", "openai:gpt", None, "baseline text", baseline=True))
    rows.append(_row("case-null", "nebius:glm", None, "unjudged"))
    rows.append(_row("case-skip", "nebius:glm", {"mode": "skipped"}, "skipped"))
    return rows


def test_verdict_buckets_cover_pairwise_and_rubric():
    assert verdict_bucket(_judge("pairwise_vs_baseline", 1, "candidate")) == "win"
    assert verdict_bucket(_judge("pairwise_vs_baseline", 0, "baseline")) == "loss"
    assert verdict_bucket(_judge("pairwise", 0.5, "tie")) == "tie"
    assert verdict_bucket(_judge("pairwise", 1, None)) == "win"
    assert verdict_bucket(_judge("rubric_score", 0.49, None)) == "low"
    assert verdict_bucket(_judge("rubric_score", 0.5, None)) == "high"


def test_sample_is_stratified_and_skips_baseline_and_nulls():
    first = sheet_rows(_pool(), n=10, seed=0)
    second = sheet_rows(_pool(), n=10, seed=0)
    assert [row["candidate_output"] for row in first] == [row["candidate_output"] for row in second]
    assert len(first) == 10
    assert len({row["use_case"] for row in first}) == 2
    assert len({row["candidate_key"] for row in first}) == 2
    assert "openai:gpt" not in {row["candidate_key"] for row in first}
    assert any(row["judge_mode"] == "rubric_score" for row in first)
    assert any(row["judge_winner"] == "candidate" for row in first)
    assert any(row["judge_winner"] == "baseline" for row in first)
    assert all(row["human_agree"] == "" and row["human_note"] == "" for row in first)


def test_fewer_than_ten_returns_every_judged_row():
    rows = [
        _row("c1", "nebius:glm", _judge("rubric_score", 0.2, None), "low"),
        _row("c2", "nebius:glm", _judge("pairwise_vs_baseline", 0.5, "tie"), "mid"),
        _row("c3", "nebius:minimax", None, "nope"),
    ]
    sampled = sheet_rows(rows, n=10, seed=1)
    assert len(sampled) == 2
    assert {row["judge_winner"] for row in sampled} == {"", "tie"}


def test_sheet_joins_cases_and_baseline_output_without_is_baseline_flag():
    payload = {
        "use_case": "support",
        "baseline_key": "openai:gpt",
        "items": [
            {
                "candidate_key": "openai:gpt",
                "case_id": "c1",
                "repeat_idx": 0,
                "output": {"text": "base answer"},
                "judge": None,
            },
            {
                "candidate_key": "nebius:glm",
                "case_id": "c1",
                "repeat_idx": 0,
                "output": {"text": "candidate answer"},
                "judge": _judge("pairwise_vs_baseline", 1, "candidate", "shorter"),
            },
        ],
        "next_cursor": "more",
    }
    cases = [{"id": "c1", "input": {"text": "Reset it"}, "reference": "done"}]
    records, warnings = prepare_records(payload, cases)
    assert warnings
    built = sheet_rows(records, n=10, seed=0)
    assert len(built) == 1
    assert built[0]["input"] == '{"text": "Reset it"}'
    assert built[0]["reference"] == "done"
    assert built[0]["candidate_output"] == "candidate answer"
    assert built[0]["baseline_output"] == "base answer"
    assert built[0]["use_case"] == "support"
    assert built[0]["judge_reasoning"] == "shorter"


def test_write_sheet_csv_and_html_have_empty_human_columns(tmp_path):
    rows = sheet_rows(_pool(), n=10, seed=0)
    csv_path, html_path = write_sheet(rows, tmp_path / "review")
    text = csv_path.read_text(encoding="utf-8")
    page = html_path.read_text(encoding="utf-8")
    assert "human_agree,human_score,human_winner,human_note" in text.splitlines()[0]
    assert "<link" not in page
    assert "src=" not in page
    assert "http://" not in page and "https://" not in page
    assert 'class="blank"' in page
    assert rows[0]["judge_reasoning"] in page
    assert rows[0]["candidate_output"] in page


def test_kappa_and_spearman_on_a_known_sheet():
    assert cohens_kappa(["candidate"] * 3, ["candidate"] * 3) == 1.0
    left = ["candidate", "candidate", "baseline", "tie"]
    right = ["candidate", "baseline", "baseline", "tie"]
    assert cohens_kappa(left, right) == pytest.approx(0.6363636363)
    assert spearman([0.1, 0.4, 0.9], [0.1, 0.4, 0.9]) == pytest.approx(1.0)
    assert spearman([0.1, 0.4, 0.9], [0.9, 0.4, 0.1]) == pytest.approx(-1.0)
    assert spearman([0.2, 0.2], [0.1, 0.9]) is None

    rows = [
        {"judge_mode": "pairwise_vs_baseline", "judge_winner": "candidate", "judge_score": "1", "human_agree": "yes", "human_winner": "", "human_score": ""},
        {"judge_mode": "pairwise_vs_baseline", "judge_winner": "baseline", "judge_score": "0", "human_agree": "no", "human_winner": "candidate", "human_score": ""},
        {"judge_mode": "pairwise_vs_baseline", "judge_winner": "tie", "judge_score": "0.5", "human_agree": "", "human_winner": "tie", "human_score": ""},
        {"judge_mode": "rubric_score", "judge_winner": "", "judge_score": "0.2", "human_agree": "", "human_winner": "", "human_score": "0.25"},
        {"judge_mode": "rubric_score", "judge_winner": "", "judge_score": "0.8", "human_agree": "", "human_winner": "", "human_score": "0.9"},
        {"judge_mode": "pairwise_vs_baseline", "judge_winner": "candidate", "judge_score": "1", "human_agree": "", "human_winner": "", "human_score": "", "human_note": "later"},
    ]
    stats = score_rows(rows)
    assert stats["reviewed"] == 5
    assert stats["agreements"] == 4
    assert stats["agreement"] == pytest.approx(0.8)
    assert stats["pairwise_n"] == 3
    assert stats["kappa"] == pytest.approx(0.5)
    assert stats["rubric_n"] == 2
    assert stats["spearman"] == pytest.approx(1.0)


def test_explicit_disagree_overrides_a_matching_label():
    rows = [
        {
            "judge_mode": "pairwise_vs_baseline",
            "judge_winner": "candidate",
            "judge_score": "1",
            "human_agree": "no",
            "human_winner": "candidate",
            "human_score": "",
        }
    ]
    stats = score_rows(rows)
    assert stats["agreement"] == 0
    assert stats["kappa"] == 1.0


def test_cli_writes_sheet_and_summary(tmp_path):
    results = {
        "runs": [
            {
                "use_case": "invoices",
                "baseline_key": "openai:gpt",
                "items": [
                    {"candidate_key": "openai:gpt", "case_id": "c1", "repeat_idx": 0, "output": {"text": "base"}, "judge": None},
                    {"candidate_key": "nebius:glm", "case_id": "c1", "repeat_idx": 0, "output": {"text": "new"}, "judge": _judge("rubric_score", 0.2, None)},
                ],
                "cases": [{"id": "c1", "input": {"text": "hi"}, "reference": "ok"}],
            }
        ]
    }
    results_path = tmp_path / "results.json"
    results_path.write_text(json.dumps(results), encoding="utf-8")
    out = tmp_path / "review"
    assert main(["sheet", "--results", str(results_path), "--n", "10", "--out", str(out)]) == 0
    csv_path = tmp_path / "review.csv"
    lines = csv_path.read_text(encoding="utf-8").splitlines()
    assert lines[0].startswith("use_case")
    assert lines[1].endswith(",,,,")
    lines[1] = lines[1][:-4] + ",no,0.9,,"
    csv_path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    summary_path = tmp_path / "summary.md"
    assert main(["score", "--sheet", str(csv_path), "--out", str(summary_path)]) == 0
    summary = summary_path.read_text(encoding="utf-8")
    assert "Agreement: 0/1 (0%)" in summary
    assert "Rubric Spearman: n/a" in summary
    assert "Cohen's kappa" in summary


def test_contract_fixture_has_a_single_example_judge_not_a_demo_run():
    records, _warnings = prepare_records(json.loads(FIXTURE.read_text(encoding="utf-8")))
    rows = sheet_rows(records, n=10, seed=0)
    assert len(rows) == 1
    assert rows[0]["judge_winner"] == "candidate"
    assert rows[0]["input"] == ""
