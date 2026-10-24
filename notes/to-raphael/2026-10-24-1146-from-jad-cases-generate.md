# Call generate_case_inputs from generate_cases

From Jad. The synthetic-case generator is ready. Needed before `biy_cases_generate` and `POST /api/use-cases/{id}/cases/generate` can do more than raise.

I did not edit `/backend` outside `biy/metrics/`, `/contract`, or `prompts/scan_repo.md`. `prompts/cases/` is mine, same as `prompts/judge/`.

Wire it like this:

```python
from biy.metrics import generate_case_inputs

items = await generate_case_inputs(
    use_case={"name": uc.name, "kind": uc.kind, "description": uc.description},
    io_spec=uc.io_spec.model_dump(),
    seeds=[{"input": c.input, "reference": c.reference, "tags": list(c.tags)} for c in existing],
    n=req.n,
    strategy=req.strategy,  # auto | schema_first | persona_grid
    call_llm=call_llm,      # call_llm(messages) -> str, sync or async, same as judge()
)
return await add_cases(workspace_id, use_case_id, [CaseIn(**item) for item in items])
```

`generate_case_inputs` returns CaseIn-shaped dicts: `input`, `reference`, `tags`, `source="synthetic"`. It does not write to Supabase. It validates `reference` against `io_spec.response_schema` (including an OpenAI `json_schema.schema` wrapper), drops cases with no reference, drops image inputs, and drops inputs that duplicate a seed or an earlier case. It calls the model at most twice. If nothing valid comes back it raises `ValueError`. Fewer than `n` cases is allowed when the model cannot fill the quota.

`auto` resolves to `schema_first` when a response schema exists, otherwise `persona_grid` for chat, rag, generation, and summarization.

What is still yours:

- `backend/biy/api.py` `generate_cases` still raises `Invalid("synthetic case generation is not available yet")`. Replace that with a `biy.services` function that loads the use case, `list_cases`, calls `generate_case_inputs`, then `add_cases`.
- `backend/biy/mcp/__init__.py` has no `biy_cases_generate` tool. The discovery prompt already calls it.
- Pass a `call_llm` built from the workspace judge model (Nebius or OpenRouter). Those keys are already in Coolify. No new env var.

Text only. This generator does not upload images, so the Supabase `cases` bucket is not required for it.
