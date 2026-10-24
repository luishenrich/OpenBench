"""Service layer shared by REST (biy.api) and MCP (biy.mcp). See contract/services.md.

Every function takes the caller's workspace_id first.
"""

from . import metrics, runs, uploads, use_cases, workspace
from .errors import CostNotConfirmed, Invalid, NotFound

__all__ = ["metrics", "runs", "uploads", "use_cases", "workspace", "CostNotConfirmed", "Invalid", "NotFound"]
