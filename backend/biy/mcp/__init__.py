"""MCP server (owner: Raphaël). Tools wrap biy.services; see contract/api.md#mcp-mcp."""

from fastmcp import FastMCP

from .. import catalog

mcp = FastMCP("biy", instructions="BIY: benchmark open-weight models on your own use cases.")


@mcp.tool
def biy_models_list(shortlist: bool = True, type: str | None = None) -> list[dict]:
    """List benchmarkable models (verified capabilities, prices). type: text | vision | embedding."""
    return [m.model_dump() for m in catalog.list_models(shortlist=shortlist, type=type)]
