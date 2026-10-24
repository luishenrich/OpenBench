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
    winner: Literal["candidate", "baseline", "tie"] | None
