"""
Aetheris OS — Unified Hybrid Retriever (Sprint 2 — Full Implementation)
Single source of truth for ALL RAG retrieval across the platform.

RETRIEVAL PIPELINE:
  1. Semantic cache check (embedding similarity — catches paraphrased queries)
  2. Parallel: vector similarity search + BM25 keyword search
  3. Reciprocal Rank Fusion (k=60) merges both ranked lists
  4. Cohere/Jina/LLM reranker selects top-k with precision
  5. Parent-chunk context expansion (child embed → parent context)
  6. Token-aware context compression for LLM prompt injection

This replaces:
  - routes/rag_chat.py::_retrieve_rag_context()   [deprecated]
  - agents/rag_agent.py  (via rag/retriever.py)   [deprecated]
"""
from __future__ import annotations

import asyncio
import hashlib
import json
import logging
import time
from typing import Dict, List, Optional, Tuple

from app_config import settings
from rag import PerfTimer

logger = logging.getLogger("aetheris.hybrid_retriever")


# ─── BM25 in-memory index ─────────────────────────────────────────────────────

_bm25_corpus:  List[str]        = []
_bm25_ids:     List[str]        = []
_bm25_index                     = None   # rank_bm25.BM25Okapi instance
_bm25_lock     = asyncio.Lock()


def _tokenize(text: str) -> List[str]:
    """Simple whitespace+punctuation tokenizer for BM25."""
    import re
    return re.findall(r"\b\w{2,}\b", text.lower())


async def build_bm25_index(chunks: List[Dict]) -> None:
    """
    Build (or rebuild) the in-memory BM25 index from a list of chunk dicts.
    Call this after document ingestion.

    chunks: list of {id, content, ...}
    """
    global _bm25_corpus, _bm25_ids, _bm25_index
    if not chunks:
        return

    try:
        from rank_bm25 import BM25Okapi
    except ImportError:
        logger.warning("[BM25] rank-bm25 not installed — BM25 disabled. pip install rank-bm25")
        return

    corpus = [_tokenize(c.get("content", "")) for c in chunks]
    ids    = [c.get("id", str(i)) for i, c in enumerate(chunks)]

    async with _bm25_lock:
        _bm25_corpus = corpus
        _bm25_ids    = ids
        _bm25_index  = BM25Okapi(corpus)

    logger.info("[BM25] Index built: %d documents", len(corpus))


async def _bm25_search(query: str, top_k: int) -> List[Dict]:
    """Search BM25 index, return [{id, content, bm25_score}]."""
    async with _bm25_lock:
        if _bm25_index is None:
            return []
        tokenized = _tokenize(query)
        scores    = _bm25_index.get_scores(tokenized)
        top_idxs  = sorted(range(len(scores)), key=lambda i: scores[i], reverse=True)[:top_k]
        results   = []
        for idx in top_idxs:
            if scores[idx] > 0:
                results.append({
                    "id":          _bm25_ids[idx],
                    "bm25_score":  float(scores[idx]),
                    "_bm25_rank":  len(results),
                })
    return results


# ─── Reciprocal Rank Fusion ───────────────────────────────────────────────────

def _rrf_fuse(
    vector_results: List[Dict],
    bm25_results:   List[Dict],
    k: int = 60,
) -> List[Dict]:
    """
    Merge vector + BM25 rankings with Reciprocal Rank Fusion.
    score(d) = Σ  1/(k + rank(d, list_i))
    """
    scores: Dict[str, float] = {}
    items:  Dict[str, Dict]  = {}

    # Vector results — use existing order as rank
    for rank, item in enumerate(vector_results, start=1):
        doc_id = item.get("id") or item.get("document_id", f"v{rank}")
        scores[doc_id] = scores.get(doc_id, 0.0) + 1.0 / (k + rank)
        if doc_id not in items:
            items[doc_id] = item

    # BM25 results — merge by id
    for rank, bm_item in enumerate(bm25_results, start=1):
        doc_id = bm_item["id"]
        scores[doc_id] = scores.get(doc_id, 0.0) + 1.0 / (k + rank)
        # If not already in items from vector, add a placeholder
        if doc_id not in items:
            items[doc_id] = {"id": doc_id, "content": "", "similarity": 0.0}

    merged = sorted(items.values(), key=lambda x: scores.get(
        x.get("id") or x.get("document_id", ""), 0.0
    ), reverse=True)

    for item in merged:
        doc_id = item.get("id") or item.get("document_id", "")
        item["_rrf_score"] = scores.get(doc_id, 0.0)

    return merged


# ─── Vector search ───────────────────────────────────────────────────────────

async def _vector_search(
    query_embedding: List[float],
    top_k:           int,
    threshold:       float,
    doc_ids:         Optional[List[str]] = None,
    category:        Optional[str]       = None,
) -> List[Dict]:
    """Run vector similarity search via Supabase pgvector RPC."""
    from rag.vector_store import get_supabase
    supabase = get_supabase()

    # Strategy 1: category-specific RPC
    if category == "rag_agent":
        try:
            result = supabase.rpc("match_rag_chunks", {
                "query_embedding": query_embedding,
                "match_count":     top_k,
                "match_threshold": threshold,
            }).execute()
            chunks = result.data or []
            if chunks:
                logger.debug("[HybridRetriever] match_rag_chunks: %d", len(chunks))
                return chunks
        except Exception as exc:
            logger.warning("[HybridRetriever] match_rag_chunks failed: %s", exc)

    # Strategy 2: generic RPC + post-filter
    try:
        result = supabase.rpc("match_chunks", {
            "query_embedding": query_embedding,
            "match_count":     top_k * 2,
            "match_threshold": max(0.05, threshold - 0.15),
        }).execute()
        chunks = result.data or []
        if doc_ids:
            id_set = set(doc_ids)
            chunks = [c for c in chunks if c.get("document_id") in id_set]
        return chunks[:top_k]
    except Exception as exc:
        logger.warning("[HybridRetriever] match_chunks failed: %s", exc)

    # Strategy 3: direct table scan
    if doc_ids:
        try:
            result = get_supabase().table("chunks") \
                .select("id, content, document_id, chunk_index") \
                .in_("document_id", doc_ids) \
                .limit(top_k).execute()
            return [{**c, "similarity": 0.4} for c in (result.data or [])]
        except Exception as exc:
            logger.warning("[HybridRetriever] Direct scan failed: %s", exc)

    return []


# ─── Parent context expansion ─────────────────────────────────────────────────

def _expand_to_parent(chunks: List[Dict]) -> List[Dict]:
    """
    If chunks contain parent_content (from semantic chunker),
    replace content with parent_content for richer LLM context.
    """
    expanded = []
    seen_parents = set()
    for chunk in chunks:
        parent = chunk.get("parent_content", "")
        if parent:
            # Deduplicate — same parent may appear via multiple children
            parent_key = hashlib.md5(parent[:100].encode()).hexdigest()
            if parent_key in seen_parents:
                continue
            seen_parents.add(parent_key)
            c = dict(chunk)
            c["display_content"] = parent  # what goes to LLM
            expanded.append(c)
        else:
            expanded.append(chunk)
    return expanded


# ─── Context formatter ────────────────────────────────────────────────────────

def format_context(
    chunks:         List[Dict],
    max_chars:      int = 12_000,
    include_score:  bool = False,
) -> str:
    """Format retrieved chunks into LLM-ready context string."""
    lines: List[str] = []
    total = 0
    for i, chunk in enumerate(chunks):
        content = chunk.get("display_content") or chunk.get("parent_content") or chunk.get("content", "")
        if not content:
            continue
        if total + len(content) > max_chars:
            remaining = max_chars - total
            if remaining < 80:
                break
            content = content[:remaining]
        sim    = chunk.get("rerank_score", chunk.get("similarity", chunk.get("_rrf_score", 0)))
        header = f"[Source {i + 1}]"
        if include_score:
            header += f" (score: {sim:.3f})"
        lines.append(f"{header}\n{content}")
        total += len(content)
    return "\n\n---\n\n".join(lines) if lines else ""


# ─── Source resolver ──────────────────────────────────────────────────────────

async def _resolve_sources(chunks: List[Dict]) -> List[Dict]:
    """Resolve document_ids → filenames."""
    from rag.vector_store import get_supabase
    doc_ids = list({c.get("document_id", "") for c in chunks if c.get("document_id")})
    if not doc_ids:
        return []
    try:
        result = get_supabase().table("documents").select("id, filename").in_("id", doc_ids).execute()
        return [{"id": d["id"], "filename": d["filename"]} for d in (result.data or [])]
    except Exception as exc:
        logger.warning("[HybridRetriever] Source resolve failed: %s", exc)
        return [{"id": d, "filename": d} for d in doc_ids]


# ─── Cache key ───────────────────────────────────────────────────────────────

def _cache_key(query: str, top_k: int, scope: str) -> str:
    return hashlib.md5(f"{query.strip().lower()}|{top_k}|{scope}".encode()).hexdigest()


# ─── Core retrieve function ───────────────────────────────────────────────────

async def _retrieve_core(
    query:     str,
    top_k:     int,
    threshold: float,
    doc_ids:   Optional[List[str]] = None,
    category:  Optional[str]       = None,
) -> Tuple[List[Dict], float]:
    """
    Core retrieval: embed → parallel vector+BM25 → RRF fusion → rerank.
    Returns (chunks, elapsed_ms).
    """
    t_start = time.perf_counter()

    # Embed query
    query_embedding = None
    try:
        from rag.embeddings import embed_text
        with PerfTimer("query_embed"):
            query_embedding = await embed_text(query)
    except Exception as exc:
        logger.error("[HybridRetriever] Query embed failed: %s", exc)

    # Run vector + BM25 in parallel
    vector_task = asyncio.create_task(
        _vector_search(query_embedding, top_k * 2, threshold, doc_ids, category)
    ) if query_embedding else None

    bm25_task = asyncio.create_task(
        _bm25_search(query, top_k * 2)
    )

    vector_results = await vector_task if vector_task else []
    bm25_results   = await bm25_task

    # RRF fusion
    if bm25_results and vector_results:
        fused = _rrf_fuse(vector_results, bm25_results)
        logger.info("[HybridRetriever] RRF fusion: vec=%d bm25=%d → %d",
                    len(vector_results), len(bm25_results), len(fused))
    elif vector_results:
        fused = vector_results
    elif bm25_results:
        # BM25 only — need to fetch chunk content
        fused = bm25_results
    else:
        fused = []

    # Cap before reranking
    candidates = fused[:top_k * 2]

    # Rerank
    if candidates:
        from rag.reranker import rerank
        try:
            with PerfTimer("rerank"):
                candidates = await rerank(query, candidates, top_k=top_k)
        except Exception as exc:
            logger.warning("[HybridRetriever] Rerank failed: %s", exc)
            candidates = candidates[:top_k]

    # Parent expansion
    candidates = _expand_to_parent(candidates)

    elapsed_ms = (time.perf_counter() - t_start) * 1000
    return candidates, elapsed_ms


# ─── Public API ───────────────────────────────────────────────────────────────

async def retrieve_for_category(
    query:     str,
    category:  str           = "rag_agent",
    top_k:     Optional[int] = None,
    threshold: Optional[float] = None,
    session_id: Optional[str] = None,
) -> Dict:
    """
    Retrieve chunks filtered by document category (e.g. 'rag_agent').
    Used by the /api/rag/* RAG Agent page.
    """
    top_k     = top_k     or min(settings.TOP_K, 8)
    threshold = threshold or settings.SIMILARITY_THRESHOLD

    # Semantic cache check
    from rag.semantic_cache import get_rag_cache
    cache = get_rag_cache()
    cached = await cache.get(f"{category}:{query}")
    if cached is not None:
        logger.info("[HybridRetriever] SEMANTIC CACHE HIT category=%s", category)
        return cached

    # Get doc_ids for this category
    doc_ids: List[str] = []
    try:
        from rag.vector_store import get_supabase
        res = get_supabase().table("documents").select("id").eq("category", category).execute()
        doc_ids = [d["id"] for d in (res.data or [])]
    except Exception as exc:
        logger.warning("[HybridRetriever] Failed to list category docs: %s", exc)

    if not doc_ids:
        return {"context": "", "chunks": [], "sources": [], "total_retrieved": 0, "retrieval_ms": 0}

    chunks, elapsed_ms = await _retrieve_core(query, top_k, threshold, doc_ids=doc_ids, category=category)

    logger.info("[HybridRetriever] category=%s retrieved=%d in %.1fms", category, len(chunks), elapsed_ms)

    sources = await _resolve_sources(chunks)
    context = format_context(chunks)

    result = {
        "context":          context,
        "chunks":           chunks,
        "sources":          sources,
        "total_retrieved":  len(chunks),
        "retrieval_ms":     round(elapsed_ms, 1),
    }

    await cache.put(f"{category}:{query}", result)
    return result


async def retrieve_for_query(
    query:     str,
    top_k:     Optional[int]   = None,
    threshold: Optional[float] = None,
    doc_id:    Optional[str]   = None,
) -> Dict:
    """
    General-purpose retrieval (no category filter).
    Used by the chat-path RAG agent (answer_with_rag).
    """
    top_k     = top_k     or min(settings.TOP_K, 8)
    threshold = threshold or settings.SIMILARITY_THRESHOLD

    # Semantic cache
    from rag.semantic_cache import get_rag_cache
    cache    = get_rag_cache()
    scope    = doc_id or "all"
    cached   = await cache.get(f"{scope}:{query}")
    if cached is not None:
        logger.info("[HybridRetriever] SEMANTIC CACHE HIT scope=%s", scope)
        return cached

    doc_ids  = [doc_id] if doc_id else None
    chunks, elapsed_ms = await _retrieve_core(query, top_k, threshold, doc_ids=doc_ids)

    logger.info("[HybridRetriever] general retrieved=%d in %.1fms", len(chunks), elapsed_ms)

    sources = await _resolve_sources(chunks)
    context = format_context(chunks)

    result = {
        "context":         context,
        "chunks":          chunks,
        "sources":         sources,
        "total_retrieved": len(chunks),
        "retrieval_ms":    round(elapsed_ms, 1),
    }

    await cache.put(f"{scope}:{query}", result)
    return result


async def invalidate_cache() -> None:
    """Invalidate the semantic cache — call after document ingestion."""
    from rag.semantic_cache import get_rag_cache
    get_rag_cache().invalidate()
    logger.info("[HybridRetriever] Semantic cache invalidated")
