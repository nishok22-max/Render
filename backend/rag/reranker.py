"""
ThinkSync OS — Advanced Reranker (Sprint 2)

Replaces the slow LLM batch scorer with a tiered cross-encoder strategy:
  Tier 1: Cohere Rerank v3.5   (~100-150ms, best quality)
  Tier 2: Jina Reranker v2     (~120-180ms, good quality, free tier)
  Tier 3: LLM relevance scorer (original, ~500-1500ms, always available)
  Tier 4: Similarity score passthrough (no-op fallback)

Set COHERE_API_KEY or JINA_API_KEY in .env to activate Tier 1 or 2.
"""
from __future__ import annotations

import asyncio
import logging
from typing import List, Dict, Optional

from app_config import settings

logger = logging.getLogger("thinksync.reranker")


# ─── Tier 1: Cohere Reranker ──────────────────────────────────────────────────

async def _rerank_cohere(
    query: str,
    chunks: List[Dict],
    top_k: int,
) -> Optional[List[Dict]]:
    """Rerank using Cohere Rerank v3.5. Returns None if unavailable."""
    api_key = getattr(settings, "COHERE_API_KEY", "") or ""
    if not api_key:
        return None

    try:
        import httpx
        docs = [c.get("content", "") or c.get("parent_content", "") for c in chunks]
        payload = {
            "model":     "rerank-v3.5",
            "query":     query,
            "documents": docs,
            "top_n":     min(top_k, len(docs)),
        }
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(
                "https://api.cohere.com/v2/rerank",
                json=payload,
                headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            )
        if not resp.is_success:
            logger.warning("[Reranker/Cohere] %s: %s", resp.status_code, resp.text[:200])
            return None

        data = resp.json()
        results = data.get("results", [])
        reranked = []
        for r in results:
            idx   = r["index"]
            score = r.get("relevance_score", 0.0)
            chunk = dict(chunks[idx])
            chunk["rerank_score"]  = score
            chunk["rerank_method"] = "cohere"
            reranked.append(chunk)

        logger.info("[Reranker/Cohere] %d → %d chunks, top_score=%.3f",
                    len(chunks), len(reranked), reranked[0]["rerank_score"] if reranked else 0)
        return reranked

    except Exception as exc:
        logger.warning("[Reranker/Cohere] Failed: %s", exc)
        return None


# ─── Tier 2: Jina Reranker ───────────────────────────────────────────────────

async def _rerank_jina(
    query: str,
    chunks: List[Dict],
    top_k: int,
) -> Optional[List[Dict]]:
    """Rerank using Jina AI Reranker v2. Returns None if unavailable."""
    api_key = getattr(settings, "JINA_API_KEY", "") or ""
    if not api_key:
        return None

    try:
        import httpx
        docs = [{"text": c.get("content", "") or c.get("parent_content", "")} for c in chunks]
        payload = {
            "model":     "jina-reranker-v2-base-multilingual",
            "query":     query,
            "documents": docs,
            "top_n":     min(top_k, len(docs)),
        }
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(
                "https://api.jina.ai/v1/rerank",
                json=payload,
                headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            )
        if not resp.is_success:
            logger.warning("[Reranker/Jina] %s: %s", resp.status_code, resp.text[:200])
            return None

        data    = resp.json()
        results = data.get("results", [])
        reranked = []
        for r in results:
            idx   = r["index"]
            score = r.get("relevance_score", 0.0)
            chunk = dict(chunks[idx])
            chunk["rerank_score"]  = score
            chunk["rerank_method"] = "jina"
            reranked.append(chunk)

        logger.info("[Reranker/Jina] %d → %d chunks", len(chunks), len(reranked))
        return reranked

    except Exception as exc:
        logger.warning("[Reranker/Jina] Failed: %s", exc)
        return None


# ─── Tier 3: LLM Relevance Scorer (original fallback) ───────────────────────

async def _rerank_llm(
    query: str,
    chunks: List[Dict],
    top_k: int,
) -> List[Dict]:
    """
    LLM-based relevance scoring — original approach, always available.
    Slower (~500-1500ms) but requires no external API key.
    """
    if not chunks:
        return []

    try:
        from services.llm_service import generate

        # Build scoring prompt
        chunk_texts = []
        for i, c in enumerate(chunks):
            content = c.get("content", "")[:500]
            chunk_texts.append(f"[{i}] {content}")

        prompt = (
            f"Query: {query}\n\n"
            f"Rate each chunk 0.0-1.0 for relevance to the query.\n"
            f"Return ONLY a JSON array of scores in order, e.g.: [0.9, 0.3, 0.7]\n\n"
            + "\n".join(chunk_texts)
        )
        raw = await generate(
            prompt,
            system_instruction="You are a relevance scorer. Return only a JSON float array.",
            temperature=0.0,
            max_tokens=200,
        )
        import json, re
        match = re.search(r"\[[\d.,\s]+\]", raw)
        if not match:
            return chunks[:top_k]

        scores = json.loads(match.group())
        scored = []
        for i, chunk in enumerate(chunks):
            score = scores[i] if i < len(scores) else 0.0
            c = dict(chunk)
            c["rerank_score"]  = float(score)
            c["rerank_method"] = "llm"
            scored.append(c)

        scored.sort(key=lambda x: x["rerank_score"], reverse=True)
        return scored[:top_k]

    except Exception as exc:
        logger.warning("[Reranker/LLM] Failed: %s", exc)
        return chunks[:top_k]


# ─── Tier 4: Score Passthrough ───────────────────────────────────────────────

def _passthrough(chunks: List[Dict], top_k: int) -> List[Dict]:
    """No reranking — sort by existing similarity score and take top_k."""
    sorted_chunks = sorted(
        chunks,
        key=lambda c: c.get("similarity", c.get("_rrf_score", 0.0)),
        reverse=True,
    )
    return sorted_chunks[:top_k]


# ─── Main API ─────────────────────────────────────────────────────────────────

async def rerank(
    query: str,
    chunks: List[Dict],
    top_k: int = 6,
    use_llm_fallback: bool = True,
) -> List[Dict]:
    """
    Rerank chunks using the best available strategy.

    Tier order: Cohere → Jina → LLM scorer → passthrough

    Args:
        query:            The user's query.
        chunks:           Retrieved chunks from vector/hybrid search.
        top_k:            Number of top results to return.
        use_llm_fallback: If False, skip LLM scorer (use passthrough instead).

    Returns:
        List of top_k chunks sorted by relevance, with rerank_score added.
    """
    if not chunks:
        return []

    if len(chunks) <= 2:
        # Not worth reranking tiny sets
        return chunks[:top_k]

    # Tier 1: Cohere
    result = await _rerank_cohere(query, chunks, top_k)
    if result is not None:
        return result

    # Tier 2: Jina
    result = await _rerank_jina(query, chunks, top_k)
    if result is not None:
        return result

    # Tier 3: LLM scorer
    if use_llm_fallback:
        return await _rerank_llm(query, chunks, top_k)

    # Tier 4: Passthrough
    return _passthrough(chunks, top_k)
