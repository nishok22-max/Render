"""
Aetheris OS — RAG Retriever (Optimized)
Retrieves relevant document chunks with caching and profiling.

OPTIMIZATIONS:
  - LRU retrieval cache (avoids re-embedding identical queries)
  - Reduced default top_k from 10 to 5
  - Context compression (token-aware truncation)
  - Performance profiling
"""
import hashlib
import logging
from typing import List, Dict, Optional

from rag.embeddings import embed_text
from rag.vector_store import similarity_search
from rag import PerfTimer, retrieval_cache
from app_config import settings

logger = logging.getLogger("aetheris.retriever")


def _cache_key(query: str, top_k: int, doc_id: Optional[str]) -> str:
    """Generate a compact cache key from query parameters."""
    raw = f"{query.strip().lower()}|{top_k}|{doc_id or ''}"
    return hashlib.md5(raw.encode()).hexdigest()


async def retrieve(
    query: str,
    top_k: Optional[int] = None,
    threshold: Optional[float] = None,
    doc_id: Optional[str] = None,
) -> List[Dict]:
    """
    Retrieve top-K relevant document chunks for a query.
    
    OPTIMIZED:
      - Cache hit returns in <1ms (no embedding or DB call)
      - Reduced default top_k to 5 for faster retrieval
      - Profiling instrumentation
    """
    top_k = top_k or min(settings.TOP_K, 5)  # Cap at 5 for speed
    threshold = threshold or settings.SIMILARITY_THRESHOLD

    # Check cache first
    key = _cache_key(query, top_k, doc_id)
    cached = retrieval_cache.get(key)
    if cached is not None:
        logger.info("[Retriever] CACHE HIT for query=%r (%d chunks)", query[:60], len(cached))
        return cached

    with PerfTimer("retrieval_total") as timer:
        try:
            # Embed the query
            with PerfTimer("query_embedding"):
                query_embedding = await embed_text(query)

            # Search vector store
            with PerfTimer("vector_search"):
                results = await similarity_search(
                    query_embedding=query_embedding,
                    top_k=top_k,
                    threshold=threshold,
                    doc_id=doc_id,
                )

            logger.info("[PERF] Retrieval: %d chunks in %.1fms", len(results), timer.elapsed_ms)

            # Cache the results
            retrieval_cache.put(key, results)
            return results

        except Exception as exc:
            logger.warning("[Retriever] Retrieval failed: %s", exc)
            return []


def format_context(chunks: List[Dict], max_tokens: int = 3000) -> str:
    """
    Format retrieved chunks into a context string for the LLM prompt.
    
    OPTIMIZED:
      - Reduced max_tokens from 4000 to 3000 (context compression)
      - Faster char-based counting (skip tiktoken import overhead)
    """
    # Fast char-based counting (~4 chars per token)
    def _count(text: str) -> int:
        return len(text) // 4

    lines = []
    total_tokens = 0
    for i, chunk in enumerate(chunks):
        content = chunk.get("content", "")
        chunk_tokens = _count(content)
        if total_tokens + chunk_tokens > max_tokens:
            break
        lines.append(f"[Chunk {i + 1}]\n{content}")
        total_tokens += chunk_tokens

    return "\n\n---\n\n".join(lines) if lines else "No relevant context found."


async def build_context(query: str, top_k: int = 5) -> dict:
    """
    High-level helper: retrieve chunks and format context.
    Never raises — returns empty context on any failure.
    """
    try:
        chunks = await retrieve(query, top_k=top_k)
    except Exception as exc:
        logger.warning("[Retriever] build_context failed: %s", exc)
        chunks = []

    context = format_context(chunks)
    sources = list({c.get("document_id", "") for c in chunks if c.get("document_id")})
    return {
        "context": context,
        "chunks": chunks,
        "sources": sources,
        "total_retrieved": len(chunks),
    }
