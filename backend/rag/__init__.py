"""
ThinkSync OS — RAG Package
Production-grade RAG pipeline with performance profiling and caching.
"""
import time
import logging
import functools
from collections import OrderedDict
from typing import Any, Optional

logger = logging.getLogger("thinksync.rag")


# ── Performance Profiling ─────────────────────────────────────────────────────

class PerfTimer:
    """Context manager for precise timing of pipeline stages."""
    __slots__ = ("label", "start", "elapsed_ms", "_logger")

    def __init__(self, label: str, log: logging.Logger = logger):
        self.label = label
        self.start = 0.0
        self.elapsed_ms = 0.0
        self._logger = log

    def __enter__(self):
        self.start = time.perf_counter()
        return self

    def __exit__(self, *_):
        self.elapsed_ms = (time.perf_counter() - self.start) * 1000
        self._logger.info("[PERF] %s: %.1fms", self.label, self.elapsed_ms)


# ── LRU Retrieval Cache ──────────────────────────────────────────────────────

class RetrievalCache:
    """
    In-process LRU cache for retrieval results.
    Avoids re-embedding and re-searching for repeated/similar queries.
    Thread-safe via dict ordering (Python 3.7+).
    """
    def __init__(self, maxsize: int = 256, ttl_seconds: float = 300.0):
        self._cache: OrderedDict[str, tuple[float, Any]] = OrderedDict()
        self._maxsize = maxsize
        self._ttl = ttl_seconds
        self._hits = 0
        self._misses = 0

    def get(self, key: str) -> Optional[Any]:
        entry = self._cache.get(key)
        if entry is None:
            self._misses += 1
            return None
        ts, value = entry
        if (time.time() - ts) > self._ttl:
            del self._cache[key]
            self._misses += 1
            return None
        # Move to end (LRU)
        self._cache.move_to_end(key)
        self._hits += 1
        return value

    def put(self, key: str, value: Any):
        if len(self._cache) >= self._maxsize:
            # Evict oldest
            oldest = next(iter(self._cache))
            del self._cache[oldest]
        self._cache[key] = (time.time(), value)

    def invalidate(self, key_prefix: str = ""):
        """Remove entries matching a prefix, or clear all if empty."""
        if not key_prefix:
            self._cache.clear()
        else:
            to_remove = [k for k in self._cache if k.startswith(key_prefix)]
            for k in to_remove:
                del self._cache[k]

    @property
    def stats(self) -> dict:
        return {
            "hits": self._hits,
            "misses": self._misses,
            "size": len(self._cache),
            "hit_rate": f"{self._hits / max(1, self._hits + self._misses) * 100:.1f}%",
        }


# Module-level cache singleton
retrieval_cache = RetrievalCache(maxsize=512, ttl_seconds=300.0)
