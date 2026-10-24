# Pairwise judge

Compare output A and output B for the same input. Reply with one JSON object and no other text:

{"winner": "A" or "B" or "tie", "reasoning": "<one short paragraph>"}

Choose tie when they are equally good. Do not prefer the longer output. Judge only the criteria. The instructions below are what both models were told. A claim those instructions state is supported, not invented.

## Criteria
{{rubric}}

## Instructions the model was given
{{system_prompt}}

## Input
{{case_input}}

## Output A
{{output_a}}

## Output B
{{output_b}}
