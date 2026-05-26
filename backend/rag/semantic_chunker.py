"""
ThinkSync OS — Semantic Parent-Child Chunker (Sprint 2)

Replaces fixed-size character chunking with semantic boundary awareness.

STRATEGY:
  Parent chunks: ~2400 chars, split at paragraph/heading boundaries
  Child chunks:  ~400 chars, split at sentence boundaries within parents
  Each child carries reference to its parent content for context expansion.

On retrieval: embed child (precise matching), return parent (full context).
This eliminates the context fragmentation of fixed-size chunking.
"""
from __future__ import annotations

import re
import logging
from typing import List, Tuple, Dict, Optional

logger = logging.getLogger("thinksync.semantic_chunker")


# ─── Heading pattern ─────────────────────────────────────────────────────────

_HEADING_RE = re.compile(
    r"^(#{1,4}\s+.+|[A-Z][A-Z\s]{4,50}:?\s*$)",
    re.MULTILINE,
)

_SENTENCE_END = re.compile(r"(?<=[.!?])\s+(?=[A-Z\"])")


def _split_paragraphs(text: str, max_chars: int = 2400) -> List[Dict]:
    """
    Split text into parent chunks respecting semantic boundaries.
    Tries to cut at: headings > blank lines > sentence ends > hard limit.
    """
    # Normalise line endings
    text = text.replace("\r\n", "\n").strip()

    # Split on double newlines (paragraph breaks)
    raw_paragraphs = re.split(r"\n{2,}", text)

    parents: List[Dict] = []
    current_buf: List[str] = []
    current_len = 0
    current_heading = ""

    def _flush():
        nonlocal current_buf, current_len, current_heading
        if current_buf:
            content = "\n\n".join(current_buf).strip()
            if content:
                parents.append({"content": content, "section_header": current_heading})
            current_buf = []
            current_len = 0

    for para in raw_paragraphs:
        para = para.strip()
        if not para:
            continue

        # Detect heading
        if _HEADING_RE.match(para) and len(para) < 120:
            if current_len > max_chars * 0.4:
                _flush()
            current_heading = para.strip("#").strip()

        # If adding this paragraph would overflow, flush first
        if current_len + len(para) > max_chars and current_buf:
            _flush()

        current_buf.append(para)
        current_len += len(para) + 2  # +2 for \n\n

    _flush()

    # Hard-split any parent that is still too large
    final: List[Dict] = []
    for p in parents:
        if len(p["content"]) <= max_chars:
            final.append(p)
        else:
            # Force-split at sentence boundary
            parts = _force_split(p["content"], max_chars)
            for part in parts:
                final.append({"content": part, "section_header": p["section_header"]})

    return final


def _force_split(text: str, max_chars: int) -> List[str]:
    """Hard split preserving sentence boundaries where possible."""
    parts = []
    while len(text) > max_chars:
        # Find last sentence end before limit
        cut = max_chars
        for m in _SENTENCE_END.finditer(text[:max_chars + 100]):
            if m.start() <= max_chars:
                cut = m.start() + 1
        parts.append(text[:cut].strip())
        text = text[cut:].strip()
    if text:
        parts.append(text)
    return parts


def _split_sentences(text: str, max_chars: int = 400) -> List[str]:
    """Split text into sentence-grouped children of ~max_chars each."""
    # Split at sentence boundaries
    sentences = _SENTENCE_END.split(text)
    children: List[str] = []
    buf = ""

    for sent in sentences:
        sent = sent.strip()
        if not sent:
            continue
        if len(buf) + len(sent) > max_chars and buf:
            children.append(buf.strip())
            buf = sent
        else:
            buf = (buf + " " + sent).strip() if buf else sent

    if buf:
        children.append(buf.strip())

    # If no sentence splits found, hard-split by chars
    if not children:
        children = _force_split(text, max_chars)

    return [c for c in children if len(c) > 20]  # filter noise


# ─── Main API ─────────────────────────────────────────────────────────────────

def chunk_document(
    text: str,
    doc_id: str,
    filename: str = "",
    file_type: str = "text",
    parent_max_chars: int = 2400,
    child_max_chars: int = 400,
) -> Tuple[List[Dict], List[Dict]]:
    """
    Chunk a document into parent-child pairs.

    Args:
        text:             Raw document text.
        doc_id:           Document UUID (for linking child → parent).
        filename:         Original filename (for metadata).
        file_type:        File extension (for metadata).
        parent_max_chars: Max size of parent context chunks.
        child_max_chars:  Max size of child embedding chunks.

    Returns:
        (parents, children)
        - parents: List[{content, section_header}]  — not stored separately, carried in child metadata
        - children: List[{content, parent_content, metadata}]  — what gets embedded + stored
    """
    if not text or not text.strip():
        return [], []

    parent_chunks = _split_paragraphs(text, max_chars=parent_max_chars)
    child_chunks: List[Dict] = []

    for p_idx, parent in enumerate(parent_chunks):
        parent_content = parent["content"]
        section_header = parent.get("section_header", "")

        children = _split_sentences(parent_content, max_chars=child_max_chars)

        for c_idx, child_content in enumerate(children):
            child_chunks.append({
                # What gets embedded (small, precise)
                "content": child_content,

                # What gets sent to LLM (full context)
                "parent_content": parent_content,

                # Metadata for filtering and display
                "metadata": {
                    "doc_id":         doc_id,
                    "filename":       filename,
                    "file_type":      file_type,
                    "parent_index":   p_idx,
                    "child_index":    c_idx,
                    "total_children": len(children),
                    "section_header": section_header,
                    "chunk_type":     _classify_chunk_type(child_content),
                    "char_count":     len(child_content),
                    "parent_chars":   len(parent_content),
                },
            })

    logger.info(
        "[SemanticChunker] doc=%s: %d parents → %d children (%.0f avg child chars)",
        doc_id[:8],
        len(parent_chunks),
        len(child_chunks),
        sum(len(c["content"]) for c in child_chunks) / max(1, len(child_chunks)),
    )

    return parent_chunks, child_chunks


def _classify_chunk_type(text: str) -> str:
    """Heuristically classify chunk content type."""
    stripped = text.strip()
    if stripped.startswith("```") or re.search(r"\bdef \w+\(|function \w+\(|class \w+[:\(]", stripped):
        return "code"
    if re.match(r"^#{1,4}\s", stripped):
        return "heading"
    if re.match(r"^(\|\s*[-:]+\s*\|)+", stripped, re.MULTILINE):
        return "table"
    if re.match(r"^[-*•]\s", stripped) or re.match(r"^\d+\.\s", stripped):
        return "list"
    return "text"


# ─── Flat chunking fallback (for backward compat) ────────────────────────────

def chunk_text_flat(
    text: str,
    chunk_size: int = 1200,
    overlap: int = 100,
) -> List[str]:
    """Original fixed-size chunker — kept as fallback."""
    if not text or not text.strip():
        return []
    if len(text) <= chunk_size:
        return [text.strip()]
    chunks = []
    start = 0
    while start < len(text):
        end = min(start + chunk_size, len(text))
        chunk = text[start:end].strip()
        if chunk:
            chunks.append(chunk)
        start += chunk_size - overlap
    return chunks
