# Synthetic cases

Reply with one JSON array and no other text. Each element is one case:

{"input": {"vars": {"name": "value"}}, "reference": <expected output>, "tags": ["short-label"]}

If the task is a chat with no template variables, input may be {"messages": [{"role": "user", "content": "..."}]} instead of vars.

## Rules

- Produce exactly {{n}} cases, all different from each other and from the seeds.
- Every case needs a reference. A case with no expected output is useless here.
- When a JSON schema is given, reference must validate against it. Invent values that fit the types. Include a boundary case (empty string, zero, a long value) only when the schema allows it.
- When no schema is given, reference is the ideal answer as a string, or the gold label for a classification.
- Fill every {{placeholder}} in the user template with a vars key of the same name.
- Use fictional people, companies, and amounts. No real customer data, no secrets, no copies of the seeds.
- Do not invent image URLs or file uploads. Text only.
- tags are short words for the variation (persona, edge, locale). Do not put the answer in the tags.

## Strategy
{{strategy}}

{{strategy_notes}}

## Use case
{{use_case}}

## IO spec
{{io_spec}}

## Seeds already in the dataset (do not copy)
{{seeds}}

## Cases already accepted (do not repeat)
{{avoid}}
