"""
Aetheris OS — Response Refiner (Sprint 4)

Post-processing layer that strips robotic LLM openers and enforces
the Aetheris voice across all agent outputs.

Applied as a thin pass after any LLM response — no latency cost.
"""
from __future__ import annotations

import re
from typing import Optional

# ─── Banned opener patterns ───────────────────────────────────────────────────

_BANNED_OPENERS = [
    "Certainly!", "Certainly,",
    "Of course!", "Of course,",
    "Absolutely!", "Absolutely,",
    "Sure!", "Sure,",
    "Great question!", "Great question,",
    "That's a great question",
    "That is a great question",
    "Excellent question",
    "Good question",
    "I'd be happy to",
    "I would be happy to",
    "I'm delighted to",
    "I am delighted to",
    "As an AI",
    "As an artificial intelligence",
    "As a language model",
    "As your AI",
    "Hello! I",
    "Hi! I",
    "Hi there! I",
    "Hello there! I",
]

_BANNED_OPENER_RE = re.compile(
    r"^(" + "|".join(re.escape(o) for o in _BANNED_OPENERS) + r")[,\s]*",
    re.IGNORECASE,
)

# ─── Banned inline phrases ────────────────────────────────────────────────────

_BANNED_PHRASES = [
    r"\bIt is important to note that\b",
    r"\bIt's important to note that\b",
    r"\bIt is worth noting that\b",
    r"\bIt's worth noting that\b",
    r"\bIn conclusion,?\b",
    r"\bTo summarize,?\b",
    r"\bTo sum up,?\b",
    r"\bIn summary,?\b",
    r"\bLastly,? I hope this helps\b",
    r"\bI hope this (helps|answers|clarifies)\b",
    r"\bFeel free to ask\b",
    r"\bDon't hesitate to reach out\b",
    r"\bPlease let me know if\b",
    r"\bLet me know if you have any (other|more|further) questions?\b",
    r"\bIs there anything else I can (help|assist)\b",
]

_BANNED_PHRASE_RES = [re.compile(p, re.IGNORECASE) for p in _BANNED_PHRASES]


# ─── Refiner ─────────────────────────────────────────────────────────────────

def refine(text: str, agent: str = "chat") -> str:
    """
    Strip robotic openers and hollow phrases from LLM output.
    Returns the refined text with proper capitalisation.

    This is a pure function — no I/O, no latency.
    """
    if not text:
        return text

    text = text.strip()

    # Remove banned openers (iterative — some stack: "Certainly! Of course, ...")
    for _ in range(3):
        new_text = _BANNED_OPENER_RE.sub("", text).strip()
        if new_text == text:
            break
        text = new_text

    # Capitalise first letter if stripped
    if text and text[0].islower():
        text = text[0].upper() + text[1:]

    # Remove trailing hollow phrases
    for pat in _BANNED_PHRASE_RES:
        text = pat.sub("", text).strip()

    # Remove trailing punctuation artifacts from stripping
    text = re.sub(r"^[,;.]\s*", "", text)

    return text.strip()


def refine_stream_chunk(chunk: str) -> str:
    """
    Lightweight version for streaming — only strips at start of stream.
    The caller tracks whether we're still in the opener region.
    """
    return chunk  # streaming refinement happens at the route layer
