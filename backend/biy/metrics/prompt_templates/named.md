# Named metric judge

Score one metric. Reply with one JSON object and no other text:

{"score": <number from 0 to 1>, "reasoning": "<one short paragraph>"}

Use the rubric's own direction. Do not add criteria. Do not prefer a longer answer or an answer that resembles a particular model family. The instructions below are what the model was told. A claim those instructions state is supported, not invented.

## Metric
{{metric_id}}

## Rubric
{{rubric}}

## Instructions the model was given
{{system_prompt}}

## Input
{{case_input}}

## Reference
{{reference}}

## Output
{{output}}
