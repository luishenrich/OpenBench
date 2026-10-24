"""Judge methods. These are instruments. Prefer a named metric when one exists.
Do not stack two generic judges on the same outputs.
"""

from metric_bank.spec import metric

METRICS = [
    metric(
        id="rubric_score",
        name="Rubric score",
        category="judging",
        description=(
            "A judge scores the output against a rubric written for this use case, and "
            "the score is normalized to 0–1. This is the catalogue metric rubric_score "
            "and the default for open-ended work that has no tighter metric. The discovery "
            "agent drafts the rubric from the system prompt, with three to six criteria."
        ),
        measures="The use case's own criteria, as a weighted rubric, not a generic notion of quality.",
        use_cases=["open-ended chat", "generation with a written definition of good", "anything without a reference or a schema"],
        industries=["general", "customer_support", "media", "legal"],
        signals=[
            "No deterministic checker covers the quality you care about",
            "The prompt implies criteria you can write down",
            "The kind is chat, generation, or batch prose",
        ],
        when_not_to_use=[
            "A named metric already covers the criterion: faithfulness, field accuracy, tests, or classification F1. A rubric that repeats it double-counts and costs more.",
            "You also selected g_eval on the same criteria. Pick one instrument.",
        ],
        inputs=["model_output", "prompt_or_input", "llm_judge"],
        input_notes="A reference may be shown to the judge when one exists, but the metric does not require one. The rubric text is required in config. Catalogue id rubric_score. The judge model is pinned and should not be a candidate in the run.",
        method="llm_judge",
        formula="score = sum(weight_c * score_c) / sum(weight_c), with each criterion on 0–1. If the judge returns 1–5, map with (s - 1) / 4.",
        procedure=[
            "Write 3–6 criteria with anchors, from the prompt and the product owner.",
            "Score each criterion. Store the judge's reason.",
            "Combine with the published weights. Do not change weights after seeing the leaderboard.",
        ],
        implementations=["BIY catalogue rubric_score", "A structured judge prompt"],
        score_min=0,
        score_max=1,
        unit="ratio",
        direction="higher_better",
        interpretation=[
            {"at": "1", "meaning": "Every criterion hit the top anchor."},
            {"at": "0.7", "meaning": "A middling rubric score. Read the criteria. The average hides which one failed."},
            {"at": "0", "meaning": "Every criterion hit the bottom anchor."},
        ],
        aggregation="Mean over cases of the weighted rubric.",
        suggested_gate=None,
        cost_level="medium",
        cost_driver="One judge call per case.",
        cost_note="The default open-ended cost. Calibrate on about twenty human labels before you trust gaps smaller than the judge's own noise.",
        limitations=[
            "Judges prefer longer answers, their own family's style, and the first position in a pair. Rubrics reduce this. They do not remove it.",
            "An unanchored rubric measures the judge's taste. Anchors are mandatory.",
        ],
        related_metrics=["g_eval", "pairwise_vs_baseline", "tone_brand_fit", "faithfulness"],
        tags=["judge", "rubric", "open-ended", "catalogue", "geval-cousin"],
        provenance=["BIY metrics catalogue", "LLM-as-a-judge practice", "HELM's warning that win rates depend on the comparison set"],
        granularity="case",
        layer="method",
        selector_priority="core",
        gate_suitable=False,
        always_on=False,
        default_for_kinds=["chat", "generation", "batch"],
        utility_axis="quality",
        quality_transform="identity",
        construct_group="generic_judge",
        group_role="method",
        aliases=["rubric"],
    ),
    metric(
        id="pairwise_vs_baseline",
        name="Pairwise win rate versus baseline",
        category="judging",
        description=(
            "The rate at which a judge prefers the candidate's output to the baseline "
            "model's output on the same input, with the two orders averaged so a position "
            "bias becomes a tie. This is the catalogue metric pairwise_vs_baseline. "
            "Use it for open-ended quality when the question is 'is this as good as what "
            "we run today', not when an absolute rubric exists."
        ),
        measures="Preference against the current production model on identical inputs.",
        use_cases=["chat", "generation", "a migration off the incumbent model"],
        industries=["general", "customer_support", "media"],
        signals=[
            "A baseline model can be run on the same cases",
            "The output is open-ended",
            "Stakeholders ask whether the new model is better than the current one",
        ],
        when_not_to_use=[
            "There is no baseline. A pairwise among only the candidates makes the score depend on who else showed up. HELM dropped that style of win rate for this reason. Use a rubric.",
            "The task has a deterministic checker. Preference is a weaker instrument than tests, schemas, or exact fields.",
        ],
        inputs=["model_output", "prompt_or_input", "llm_judge"],
        input_notes="The baseline output is another model's completion on the same input, stored with the case. Both orders are required. Catalogue id pairwise_vs_baseline.",
        method="llm_judge",
        formula="For each case, swap order. A disagreement is a tie. win_rate = (wins + 0.5 * ties) / cases. Range 0–1, with 0.5 meaning parity with the baseline.",
        procedure=[
            "Generate the baseline once and freeze it.",
            "Judge both orders with a pinned judge from a different family than the candidates when possible.",
            "Average. Report ties separately. Do not drop them.",
        ],
        implementations=["BIY catalogue pairwise_vs_baseline", "LMSYS pairwise judging with order swap", "Chatbot Arena style preferences, offline"],
        score_min=0,
        score_max=1,
        unit="ratio",
        direction="higher_better",
        interpretation=[
            {"at": "0.5", "meaning": "Parity with the baseline, including ties as half."},
            {"at": "0.6", "meaning": "A modest preference for the candidate. Check that it survives order swapping and a length control."},
            {"at": "0.4", "meaning": "The baseline is preferred. The candidate is behind the incumbent on this set."},
        ],
        aggregation="Mean over cases. This number is comparable across candidates because the baseline is fixed.",
        suggested_gate=None,
        cost_level="high",
        cost_driver="A baseline generation plus two judge calls per case.",
        cost_note="The most expensive generic judge. Use it when the decision is a migration and a rubric feels untrustworthy.",
        limitations=[
            "Judges prefer longer, more formatted answers. See length_controlled_win_rate if lengths differ a lot.",
            "A judge from the candidate's family tends to prefer that family. The architecture says to avoid that.",
        ],
        related_metrics=["length_controlled_win_rate", "rubric_score", "option_order_sensitivity"],
        tags=["judge", "pairwise", "baseline", "arena", "win-rate", "catalogue"],
        provenance=["LMSYS Chatbot Arena", "BIY metrics catalogue", "HELM on comparison-set-dependent win rates"],
        granularity="case",
        layer="method",
        selector_priority="core",
        gate_suitable=False,
        always_on=False,
        default_for_kinds=["chat", "generation"],
        utility_axis="quality",
        quality_transform="identity",
        construct_group="generic_judge",
        group_role="method",
        aliases=["pairwise_win_rate", "baseline_win_rate"],
    ),
    metric(
        id="g_eval",
        name="G-Eval",
        category="judging",
        description=(
            "A judge turns a natural-language criterion into evaluation steps, scores the "
            "output, and the score is the probability-weighted sum of the score tokens "
            "rather than the single sampled integer. This is the catalogue metric g_eval. "
            "It is the right instrument for a nuanced criterion such as summary coherence "
            "when a coarse rubric flickers between two adjacent scores."
        ),
        measures="A criterion, scored with chain-of-thought steps and token probabilities.",
        use_cases=["summarization criteria", "open-ended quality where 1–5 scores are unstable", "a single named criterion"],
        industries=["general", "media", "customer_support"],
        signals=[
            "The criterion is nuanced and a single integer score flaps",
            "The judge API returns token logprobs",
            "You would otherwise have written a rubric with one vague criterion",
        ],
        when_not_to_use=[
            "Logprobs are unavailable. Fall back to rubric_score. Do not pretend a sampled integer is G-Eval.",
            "You already have rubric_score on the same criteria. One instrument is enough.",
        ],
        inputs=["model_output", "prompt_or_input", "llm_judge", "token_logprobs"],
        input_notes="Pass the source document when the criterion is faithfulness-like or a summary. Config is the criterion text. Catalogue id g_eval. Without token logprobs this metric is not available. Use rubric_score.",
        method="llm_judge",
        formula="p(s) = probability of the score token, renormalized over the allowed scores. raw = sum_s p(s) * s. stored = (raw - s_min) / (s_max - s_min).",
        procedure=[
            "Generate evaluation steps from the criterion once and freeze them.",
            "Ask the judge to follow the steps and emit a score token.",
            "Compute the probability-weighted score and normalize to 0–1.",
        ],
        implementations=["G-Eval (Liu et al., 2023)", "DeepEval GEval", "BIY catalogue g_eval"],
        score_min=0,
        score_max=1,
        unit="ratio",
        direction="higher_better",
        interpretation=[
            {"at": "1", "meaning": "All score-token mass sat on the top score."},
            {"at": "0.5", "meaning": "The probability mass is in the middle of the scale."},
            {"at": "0", "meaning": "All mass sat on the bottom score."},
        ],
        aggregation="Mean of normalized scores.",
        suggested_gate=None,
        cost_level="medium",
        cost_driver="One judge call with logprobs per case, plus a one-time step generation.",
        cost_note="Similar price to a rubric, with a more stable number when logprobs exist.",
        limitations=[
            "Only the top token's probability is a crude approximation if the API does not return the alternatives. Require the full distribution over score tokens.",
            "The method inherits judge biases. Steps help. They are not a human panel.",
        ],
        related_metrics=["rubric_score", "summary_coherence", "summary_relevance"],
        tags=["judge", "g-eval", "logprobs", "summarization", "catalogue"],
        provenance=["Liu et al., 2023, G-Eval", "DeepEval", "BIY metrics catalogue"],
        granularity="case",
        layer="method",
        selector_priority="core",
        gate_suitable=False,
        always_on=False,
        default_for_kinds=["summarization", "chat", "generation"],
        utility_axis="quality",
        quality_transform="identity",
        construct_group="generic_judge",
        group_role="method",
        aliases=["geval"],
    ),
    metric(
        id="length_controlled_win_rate",
        name="Length-controlled win rate",
        category="judging",
        description=(
            "A pairwise win rate with the length difference regressed out, in the spirit "
            "of AlpacaEval's length-controlled win rate and LMSYS style control. Use it "
            "when candidates differ a lot in length and the uncorrected pairwise score "
            "tracks verbosity. It is a diagnostic correction, not a second quality construct."
        ),
        measures="Preference against the baseline after accounting for length.",
        use_cases=["open-ended generation where one model writes much more", "checking that a pairwise win is not a length artifact"],
        industries=["general", "customer_support", "media"],
        signals=[
            "pairwise_vs_baseline is selected",
            "Output lengths differ substantially across candidates",
            "You suspect verbosity bias",
        ],
        when_not_to_use=[
            "Lengths are similar. The correction adds noise. Report the plain pairwise rate.",
            "As the only metric. It is still a judge preference. It does not become ground truth by controlling length.",
        ],
        inputs=["model_output", "llm_judge"],
        input_notes="Built from the same pairwise judgments as pairwise_vs_baseline plus token lengths. A logistic regression with length difference as a covariate, following AlpacaEval LC. No extra judge call and no logprobs.",
        method="statistical",
        formula="Fit a logistic model P(win) = sigmoid(a + b * length_gap) on the pairwise outcomes and report the predicted win rate at length_gap = 0. Range 0–1.",
        procedure=[
            "Reuse the both-order pairwise labels.",
            "Record token lengths of both outputs.",
            "Predict the win probability at zero length gap. Publish the uncorrected rate beside it.",
        ],
        implementations=["AlpacaEval 2 length-controlled win rate", "LMSYS style control, of which length is one factor"],
        score_min=0,
        score_max=1,
        unit="ratio",
        direction="higher_better",
        interpretation=[
            {"at": "0.5", "meaning": "Parity with the baseline at equal length."},
            {"at": "far from the raw win rate", "meaning": "The raw preference was largely a length effect. Trust this number more than the raw one."},
        ],
        aggregation="One regression per candidate against the frozen baseline.",
        suggested_gate=None,
        cost_level="low",
        cost_driver="A regression on judgments you already paid for.",
        cost_note="Do not pay for a second judge. If pairwise judgments do not exist, do not select this.",
        limitations=[
            "Length is only one style factor. Markdown and lists also bias judges. LMSYS style control is broader. This metric only removes length.",
            "The regression is unstable on small case counts. Prefer it above a few hundred pairs.",
        ],
        related_metrics=["pairwise_vs_baseline", "tokens_out_per_case"],
        tags=["judge", "length-control", "alpaca-eval", "verbosity", "pairwise"],
        provenance=["AlpacaEval 2 length-controlled win rate", "LMSYS style control"],
        granularity="run",
        layer="method",
        selector_priority="diagnostic",
        gate_suitable=False,
        always_on=False,
        default_for_kinds=["chat", "generation"],
        utility_axis="none",
        quality_transform="not_a_quality_input",
        construct_group="generic_judge",
        group_role="diagnostic",
        aliases=["lc_win_rate"],
    ),
]
