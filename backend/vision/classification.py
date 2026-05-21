"""
Simple image‑type classifier based on OCR content.
It is deliberately lightweight – a rule‑based approach works well for
most screenshots and avoids pulling in heavy ML dependencies.
"""
from typing import List

# Keywords for each category – can be extended later.
KEYWORDS = {
    "error_screenshot": ["exception", "traceback", "error", "stack", "failed", "cannot", "undefined"],
    "chart": ["axis", "x‑axis", "y‑axis", "legend", "series", "data", "point", "plot", "chart", "graph", "trend"],
    "ui": ["button", "navbar", "login", "signup", "menu", "dropdown", "header", "footer", "sidebar", "modal"],
    "code": ["def ", "function", "class ", "import ", "return ", "var ", "let ", "const ", "{", "}", ";"],
    "diagram": ["entity", "relationship", "uml", "diagram", "flowchart", "arrow"],
    "meme": ["\uD83D\uDE00", "lol", "haha", "meme", "funny"],
}

def _matches(text: str, tokens: List[str]) -> bool:
    lower = text.lower()
    return any(tok.lower() in lower for tok in tokens)

def detect_type(ocr_text: str) -> str:
    """Return a string identifying the image category.

    Order matters – the first matching category is returned.
    If nothing matches, "generic" is returned.
    """
    if not ocr_text:
        return "generic"
    for category, words in KEYWORDS.items():
        if _matches(ocr_text, words):
            return category
    return "generic"
