"""
ThinkSync OS — Semantic Similarity Cache (Sprint 2)

Replaces exact-match MD5 cache with embedding-similarity based lookup.
Catches paraphrased queries that the old cache missed entirely.

DESIGN:
  - In-process cache (no Redis required) — fast, zero infra
  - Similarity threshold: 0.92 (tuned for precision over recall)
  - LRU eviction at max_size entries
  - Thread-safe via asyncio.Lock
  - Cache key = query embedding; value = retrieval result dict

FUTURE: swap in_process index for FAISS or Redis when scaling.
"""
from __future__ import annotations

import asyncio
import hashlib
import logging
import time
from collections import OrderedDict
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger("thinksync.semantic_cache")


def _cosine_similarity(a: List[float], b: List[float]) -> float:
    """Fast cosine similarity between two embedding vectors."""
    dot = sum(x * y for x, y in zip(a, b))
    norm_a = sum(x * x for x in a) ** 0.5
    norm_b = sum(x * x for x in b) ** 0.5
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot / (norm_a * norm_b)


class SemanticCache:
    """
    Embedding-similarity query cache.

    Usage:
        cache = SemanticCache(max_size=500, threshold=0.92)
        result = await cache.get(query)
        if result is None:
            result = await expensive_retrieval(query)
            await cache.put(query, result)
    """

    def __init__(self, max_size: int = 500, threshold: float = 0.92):
        self.max_size  = max_size
        self.threshold = threshold
        self._lock     = asyncio.Lock()
        # OrderedDict for LRU: key=md5_str, value=(embedding, result, timestamp)
        self._store: OrderedDict[str, Tuple[List[float], Any, float]] = OrderedDict()
        self._hits   = 0
        self._misses = 0

    async def get(self, query: str) -> Optional[Any]:
        """
        Return cached result if a semantically similar query was cached.
        Returns None on miss.
        """
        try:
            from rag.embeddings import embed_text
            query_emb = await embed_text(query)
        except Exception as exc:
            logger.debug("[SemanticCache] Embed failed on lookup: %s", exc)
            self._misses += 1
            return None

        async with self._lock:
            best_sim = 0.0
            best_key = None

            for key, (emb, _, _) in self._store.items():
                sim = _cosine_similarity(query_emb, emb)
                if sim > best_sim:
                    best_sim = sim
                    best_key = key

            if best_key and best_sim >= self.threshold:
                # LRU: move to end
                self._store.move_to_end(best_key)
                _, result, _ = self._store[best_key]
                self._hits += 1
                logger.info(
                    "[SemanticCache] HIT  sim=%.3f query=%r",
                    best_sim, query[:60],
                )
                return result

        self._misses += 1
        logger.debug("[SemanticCache] MISS query=%r", query[:60])
        return None

    async def put(self, query: str, result: Any) -> None:
        """Store a result keyed by query embedding."""
        try:
            from rag.embeddings import embed_text
            query_emb = await embed_text(query)
        except Exception as exc:
            logger.debug("[SemanticCache] Embed failed on store: %s", exc)
            return

        key = hashlib.md5(query.strip().lower().encode()).hexdigest()

        async with self._lock:
            # Evict oldest if at capacity
            while len(self._store) >= self.max_size:
                self._store.popitem(last=False)

            self._store[key] = (query_emb, result, time.time())
            self._store.move_to_end(key)

    def invalidate(self) -> None:
        """Clear the entire cache (call when documents are updated)."""
        self._store.clear()
        logger.info("[SemanticCache] Invalidated (full clear)")

    @property
    def stats(self) -> Dict[str, Any]:
        total = self._hits + self._misses
        return {
            "size":      len(self._store),
            "max_size":  self.max_size,
            "hits":      self._hits,
            "misses":    self._misses,
            "hit_rate":  round(self._hits / total, 3) if total else 0.0,
            "threshold": self.threshold,
        }


# ─── Module-level singleton ───────────────────────────────────────────────────

_rag_cache = SemanticCache(max_size=500, threshold=0.92)


def get_rag_cache() -> SemanticCache:
    """Return the shared RAG semantic cache."""
    return _rag_cache
