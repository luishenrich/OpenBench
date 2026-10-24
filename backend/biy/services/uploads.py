"""One-time upload URLs, so large prompts, schemas, case sets and images never pass through a
coding agent's tool-call arguments (it would have to write every character, and tends to truncate).

The agent asks for a URL (biy_upload_url), then runs `curl -fsS --retry 3 --data-binary @file <url>` from its
shell. The token is the credential: single use, ~15 min, scoped to one workspace + use case + field.
Tokens live in Redis, so there is no table to migrate.
"""

from __future__ import annotations

import json
import secrets
import uuid
from typing import Any
from uuid import UUID

import httpx
from redis.asyncio import from_url

from contract.schemas import CaseIn, IOSpec, UseCasePatch

from ..config import settings
from .errors import Invalid, NotFound
from .use_cases import add_cases, get_use_case, update_use_case

FIELDS = {"system_prompt", "user_template", "response_schema", "tools", "cases_jsonl", "image"}
TTL_S = 15 * 60
MAX_TEXT = 2_000_000   # 2 MB: far above any real prompt or case set
MAX_IMAGE = 10_000_000  # the bucket's own limit
IMAGE_TYPES = {b"\x89PNG": ("png", "image/png"), b"\xff\xd8\xff": ("jpg", "image/jpeg"),
               b"RIFF": ("webp", "image/webp"), b"%PDF": ("pdf", "application/pdf")}
_KEY = "biy:upload:{}"


def _redis():
    if not settings.redis_url:
        raise RuntimeError("REDIS_URL is not set")
    return from_url(settings.redis_url)


async def create_upload_url(workspace_id: UUID, use_case_id: UUID, field: str) -> dict[str, Any]:
    if field not in FIELDS:
        raise Invalid(f"field must be one of {sorted(FIELDS)}")
    if field == "image" and not settings.supabase_service_role_key:
        raise Invalid("image uploads are not enabled on this server yet (SUPABASE_SERVICE_ROLE_KEY missing)")
    await get_use_case(workspace_id, use_case_id)  # 404 if not ours
    token = secrets.token_urlsafe(24)
    r = _redis()
    try:
        await r.set(_KEY.format(token), json.dumps({"workspace_id": str(workspace_id),
                                                    "use_case_id": str(use_case_id), "field": field}), ex=TTL_S)
    finally:
        await r.aclose()
    url = f"{settings.public_base_url.rstrip('/')}/api/uploads/{token}"
    return {"url": url, "field": field, "expires_in_s": TTL_S,
            "curl": f"curl -fsS --retry 3 --data-binary @<path> {url}"}


async def receive(token: str, body: bytes) -> dict[str, Any]:
    """Apply one upload. The token is consumed even if the body is rejected: ask for a new URL."""
    r = _redis()
    try:
        raw = await r.getdel(_KEY.format(token))
    finally:
        await r.aclose()
    if not raw:
        raise NotFound("upload URL unknown, used or expired; ask for a new one with biy_upload_url")
    t = json.loads(raw)
    ws, uc_id, field = UUID(t["workspace_id"]), UUID(t["use_case_id"]), t["field"]
    if not body:
        raise Invalid("empty body: send the file with curl --data-binary @<path>")

    if field == "image":
        return await _store_image(ws, uc_id, body)
    if len(body) > MAX_TEXT:
        raise Invalid(f"{len(body)} bytes is over the {MAX_TEXT}-byte limit")
    try:
        text = body.decode("utf-8")
    except UnicodeDecodeError as e:
        raise Invalid("text fields must be UTF-8") from e

    if field == "cases_jsonl":
        items = []
        for n, line in enumerate(text.splitlines(), start=1):
            if line.strip():
                try:
                    items.append(CaseIn(**json.loads(line)))
                except Exception as e:
                    raise Invalid(f"line {n}: not a case ({e}); each line is a CaseIn JSON object") from e
        added = await add_cases(ws, uc_id, items)
        return {"ok": True, "field": field, "cases_added": len(added)}

    uc = await get_use_case(ws, uc_id)
    io = uc.io_spec.model_dump()
    if field in ("response_schema", "tools"):
        try:
            io[field] = json.loads(text)
        except json.JSONDecodeError as e:
            raise Invalid(f"{field} must be JSON ({e})") from e
    else:
        io[field] = text
    await update_use_case(ws, uc_id, UseCasePatch(io_spec=IOSpec(**io)))
    return {"ok": True, "field": field, "chars": len(text)}


async def _store_image(ws: UUID, uc_id: UUID, body: bytes) -> dict[str, Any]:
    if len(body) > MAX_IMAGE:
        raise Invalid(f"{len(body)} bytes is over the {MAX_IMAGE}-byte limit")
    kind = next((v for magic, v in IMAGE_TYPES.items() if body.startswith(magic)), None)
    if not kind:
        raise Invalid("not a PNG, JPEG, WebP or PDF file")
    ext, ctype = kind
    path = f"{ws}/{uc_id}/{uuid.uuid4()}.{ext}"
    base = settings.supabase_url.rstrip("/")
    async with httpx.AsyncClient(timeout=60) as c:
        resp = await c.post(f"{base}/storage/v1/object/cases/{path}", content=body, headers={
            "Authorization": f"Bearer {settings.supabase_service_role_key}", "Content-Type": ctype})
    if resp.status_code >= 300:
        raise Invalid(f"storage upload failed: HTTP {resp.status_code} {resp.text[:200]}")
    public = f"{base}/storage/v1/object/public/cases/{path}"
    return {"ok": True, "field": "image", "url": public,
            "next": "add a case with biy_cases_add: input.images = [url], reference = the expected output"}
