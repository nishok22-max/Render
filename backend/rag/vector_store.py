"""
Aetheris OS — RAG Vector Store (Optimized)
Supabase pgvector integration with batch upserts and profiling.
"""
from typing import List, Dict, Optional
import logging

from supabase import create_client, Client
from app_config import settings
from rag import PerfTimer

logger = logging.getLogger("aetheris.vector_store")

_client: Optional[Client] = None
_UPSERT_BATCH_SIZE = 500


def get_supabase() -> Client:
    """Return (or lazily create) the module-level Supabase client singleton."""
    global _client
    if _client is None:
        if not settings.SUPABASE_URL or not settings.SUPABASE_KEY:
            raise RuntimeError("SUPABASE_URL and SUPABASE_KEY must be set")
        _client = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)
        logger.info("[VectorStore] Supabase client initialized: %s", settings.SUPABASE_URL[:40])
    return _client


async def upsert_chunks(doc_id: str, chunks: List[str], embeddings: List[List[float]]) -> int:
    """Store document chunks with batched upserts and profiling."""
    with PerfTimer("vector_upsert") as timer:
        client = get_supabase()
        rows = [
            {"document_id": doc_id, "chunk_index": i, "content": chunk, "embedding": emb}
            for i, (chunk, emb) in enumerate(zip(chunks, embeddings))
            if emb
        ]
        if not rows:
            logger.warning("[VectorStore] UPSERT SKIPPED: 0 valid rows for doc %s", doc_id)
            return 0

        logger.info("[VectorStore] UPSERTING %d chunks for doc %s (dim=%d)",
                    len(rows), doc_id, len(rows[0]["embedding"]))

        total_stored = 0
        batches = [rows[i:i + _UPSERT_BATCH_SIZE] for i in range(0, len(rows), _UPSERT_BATCH_SIZE)]

        for batch_idx, batch in enumerate(batches):
            try:
                result = client.table("chunks").upsert(batch).execute()
                stored = len(result.data) if result.data else len(batch)
                total_stored += stored
            except Exception as exc:
                logger.error("[VectorStore] UPSERT FAILED batch %d for doc %s: %s",
                             batch_idx + 1, doc_id, exc, exc_info=True)
                raise

    logger.info("[PERF] UPSERT: %d rows in %.1fms", total_stored, timer.elapsed_ms)
    return total_stored


async def similarity_search(
    query_embedding: List[float],
    top_k: int = 5,
    threshold: float = 0.3,
    doc_id: Optional[str] = None,
) -> List[Dict]:
    """Find similar chunks with profiling."""
    with PerfTimer("similarity_search") as timer:
        client = get_supabase()
        params = {
            "query_embedding": query_embedding,
            "match_count": top_k,
            "match_threshold": threshold,
        }
        if doc_id:
            params["filter_doc_id"] = doc_id

        try:
            result = client.rpc("match_chunks", params).execute()
            results = result.data or []
            logger.info("[PERF] SEARCH: %d chunks in %.1fms", len(results), timer.elapsed_ms)
            return results
        except Exception as exc:
            logger.error("[VectorStore] SEARCH FAILED: %s", exc, exc_info=True)
            return []


async def delete_document(doc_id: str) -> int:
    """Remove all chunks for a document."""
    client = get_supabase()
    result = client.table("chunks").delete().eq("document_id", doc_id).execute()
    deleted = len(result.data or [])
    logger.info("[VectorStore] DELETED %d chunks for doc %s", deleted, doc_id)
    return deleted
