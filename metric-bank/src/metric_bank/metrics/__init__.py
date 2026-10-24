"""Metric records, one module per category. Importing the package builds them."""

from .accuracy import METRICS as ACCURACY
from .agents import METRICS as AGENTS
from .bias_privacy import METRICS as BIAS_PRIVACY
from .business import METRICS as BUSINESS
from .calibration_robustness import METRICS as CALIBRATION_ROBUSTNESS
from .code_conversation import METRICS as CODE_CONVERSATION
from .instruction_structured import METRICS as INSTRUCTION_STRUCTURED
from .judging import METRICS as JUDGING
from .knowledge_reasoning import METRICS as KNOWLEDGE_REASONING
from .ops import METRICS as OPS
from .rag_summary import METRICS as RAG_SUMMARY
from .safety_multilingual import METRICS as SAFETY_MULTILINGUAL
from .vision import METRICS as VISION

METRICS = [
    *ACCURACY,
    *KNOWLEDGE_REASONING,
    *RAG_SUMMARY,
    *CODE_CONVERSATION,
    *INSTRUCTION_STRUCTURED,
    *VISION,
    *AGENTS,
    *SAFETY_MULTILINGUAL,
    *BIAS_PRIVACY,
    *CALIBRATION_ROBUSTNESS,
    *OPS,
    *BUSINESS,
    *JUDGING,
]
