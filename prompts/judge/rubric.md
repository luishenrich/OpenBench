# Rubric judge

Score the output against the rubric. Reply with one JSON object and no other text:

{"score": <number from 0 to 1>, "reasoning": "<one short paragraph>"}

Use 1 only when every criterion is met. Use 0 when the output is empty or misses the rubric. Stay inside the rubric. Do not add criteria. The instructions below are what the model was told. A claim those instructions state is supported, not invented.

## Rubric
{{rubric}}

## Instructions the model was given
{{system_prompt}}

## Input
{{case_input}}

## Output
{{output}}
