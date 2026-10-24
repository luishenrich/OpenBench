"""Views the runner passes into score() and judge(). Shapes follow contract/services.md."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Literal


@dataclass
class CaseView:
    input: dict
    reference: Any | None
    io_spec: Any  # contract.schemas.IOSpec or any object with response_schema


@dataclass
class OutputView:
    text: str | None
    json: Any | None
    tool_calls: list | None


@dataclass
class JudgeResult:
    score: float
    reasoning: str
    winner: Literal["candidate", "baseline", "tie"] | None = None
    # Jury fields. Names match ResultOut.judge on main: jurors, abstained, agreement.
    # agreement is true/false when at least two jurors voted, else None.
    # A single unpinned judge leaves jurors as one row and agreement as None.
    jurors: list[dict] | None = None
    abstained: list[str] | None = None
    agreement: bool | None = None
    low_agreement: bool | None = None
    reasoning_effort: dict | None = None
