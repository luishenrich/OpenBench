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
    # Jury fields. Empty when a single unpinned judge ran. The runner stores these
    # on result.judge once the contract grows; the names match the note to Raphaël.
    judges: list[dict] | None = None
    abstained: list[str] | None = None
    agreement: float | None = None
    low_agreement: bool | None = None
    reasoning_effort: dict | None = None
