"""Service errors. The REST layer maps them to HTTP codes; MCP tools turn them into messages."""

from contract.schemas import Estimate


class NotFound(Exception):
    """404: missing, or belongs to another workspace."""


class Invalid(Exception):
    """422: a request the contract allows in shape but not in content (e.g. unknown model)."""


class CostNotConfirmed(Exception):
    """409: POST /api/runs without confirm_cost_usd ≥ estimate.total_usd."""

    def __init__(self, estimate: Estimate):
        super().__init__(f"confirm_cost_usd must be ≥ {estimate.total_usd:.4f} (the estimate)")
        self.estimate = estimate
