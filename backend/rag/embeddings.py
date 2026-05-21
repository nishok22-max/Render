"""
Aetheris OS — RAG Embeddings (Optimized)
Generates text embeddings using Gemini embedding models.

OPTIMIZATIONS:
  - Singleton httpx.AsyncClient with connection pooling (no per-request client)
  - Batch size raised to 100 (Gemini max) for fewer round-trips
  - Parallel batch processing with asyncio.gather
  - Pre-truncation of texts to reduce payload size
  - Profiling instrumentation for embedding latency
  - Increased concurrency semaphore (5 → 10)
"""
import asyncio
import logging
from typing import List, Optional

import httpx
from app_config import settings
from rag import PerfTimer

logger = logging.getLogger("aetheris.embeddings")

# ── Current Gemini Embedding Models (v1beta) ────────────────────────────────
# Ordered fallback: fastest first, then more capable
EMBED_MODELS = [
    ("https://generativelanguage.googleapis.com/v1beta/models", "gemini-embedding-001"),
    ("https://generativelanguage.googleapis.com/v1beta/models", "gemini-embedding-2"),
]

# Increased concurrent embedding requests for throughput
_EMBED_SEMAPHORE = asyncio.Semaphore(10)

# Target dimension must match DB schema: vector(768)
EMBED_DIM = 768

# Max text length to send (Gemini limit is ~2048 tokens, ~8KB chars)
_MAX_TEXT_LEN = 2048

# Batch size — Gemini supports up to 100 per batchEmbedContents call
_BATCH_SIZE = 100

# ── Singleton HTTP Client with Connection Pooling ─────────────────────────────

_http_client: Optional[httpx.AsyncClient] = None


def _get_client() -> httpx.AsyncClient:
    """Return (or lazily create) a persistent httpx client with connection pooling."""
    global _http_client
    if _http_client is None or _http_client.is_closed:
        _http_client = httpx.AsyncClient(
            timeout=httpx.Timeout(60.0, connect=10.0),
            limits=httpx.Limits(
                max_connections=20,
                max_keepalive_connections=10,
                keepalive_expiry=120.0,
            ),
            http2=True,  # HTTP/2 for multiplexed requests
        )
    return _http_client


async def embed_text(text: str) -> List[float]:
    """Generate an embedding vector for a single text. Tries models in order."""
    api_key = settings.GEMINI_API_KEY
    if not api_key:
        raise ValueError("GEMINI_API_KEY is not set — cannot generate embeddings.")

    truncated = text[:_MAX_TEXT_LEN]
    client = _get_client()

    last_error = "No embedding models available."
    async with _EMBED_SEMAPHORE:
        for base, model in EMBED_MODELS:
            url = f"{base}/{model}:embedContent?key={api_key}"
            payload = {
                "model": f"models/{model}",
                "content": {"parts": [{"text": truncated}]},
                "outputDimensionality": EMBED_DIM,
            }
            try:
                resp = await client.post(url, json=payload)
                if resp.is_success:
                    data = resp.json()
                    values = data["embedding"]["values"]
                    return values
                last_error = f"Embedding error {resp.status_code} ({model}): {resp.text[:200]}"
                logger.warning("[Embeddings] %s", last_error)
            except Exception as exc:
                last_error = f"Embedding request failed ({model}): {exc}"
                logger.warning("[Embeddings] %s", last_error)

    logger.error("[Embeddings] ALL MODELS FAILED for embed_text: %s", last_error)
    raise RuntimeError(last_error)


async def _batch_embed_single_call(
    texts: List[str], base: str, model: str, api_key: str
) -> List[List[float]]:
    """
    Use Gemini batchEmbedContents endpoint to embed up to 100 texts in ONE API call.
    Returns list of embedding vectors (empty list on failure).
    """
    url = f"{base}/{model}:batchEmbedContents?key={api_key}"
    requests = [
        {
            "model": f"models/{model}",
            "content": {"parts": [{"text": t[:_MAX_TEXT_LEN]}]},
            "outputDimensionality": EMBED_DIM,
        }
        for t in texts
    ]
    payload = {"requests": requests}
    client = _get_client()

    try:
        resp = await client.post(url, json=payload)
        if resp.is_success:
            data = resp.json()
            embeddings = [e["values"] for e in data.get("embeddings", [])]
            return embeddings
        else:
            logger.warning("Batch embed error %d (%s): %s", resp.status_code, model, resp.text[:200])
            return []
    except Exception as exc:
        logger.warning("Batch embed request failed (%s): %s", model, exc)
        return []


async def embed_batch(texts: List[str]) -> List[List[float]]:
    """
    Embed multiple texts using batch API for speed.
    
    OPTIMIZATIONS:
      - Batch size raised to 100 (from 50)
      - Parallel batch processing with asyncio.gather
      - Connection pooling via singleton client
      - Falls back to single-text embedding if batch fails
    """
    if not texts:
        return []

    api_key = settings.GEMINI_API_KEY
    if not api_key:
        raise ValueError("GEMINI_API_KEY is not set.")

    with PerfTimer("embed_batch_total") as timer:
        all_embeddings: List[List[float]] = [[] for _ in texts]

        # Try batch embedding with each model
        for base, model in EMBED_MODELS:
            # Find which texts still need embedding
            missing_indices = [i for i, e in enumerate(all_embeddings) if not e]
            if not missing_indices:
                break

            missing_texts = [texts[i] for i in missing_indices]

            # Build all batch tasks and run them in parallel
            batch_tasks = []
            batch_index_groups = []

            for batch_start in range(0, len(missing_texts), _BATCH_SIZE):
                batch = missing_texts[batch_start:batch_start + _BATCH_SIZE]
                batch_indices = missing_indices[batch_start:batch_start + _BATCH_SIZE]

                async def _do_batch(b=batch, base=base, model=model, api_key=api_key):
                    async with _EMBED_SEMAPHORE:
                        return await _batch_embed_single_call(b, base, model, api_key)

                batch_tasks.append(_do_batch())
                batch_index_groups.append((batch_indices, len(batch)))

            # Run all batches concurrently
            if batch_tasks:
                results_list = await asyncio.gather(*batch_tasks, return_exceptions=True)

                for (batch_indices, batch_len), results in zip(batch_index_groups, results_list):
                    if isinstance(results, Exception):
                        logger.warning("Batch embed exception: %s", results)
                        continue
                    if results and len(results) == batch_len:
                        for idx, emb in zip(batch_indices, results):
                            all_embeddings[idx] = emb
                        logger.info("Batch embedded %d/%d texts with %s", batch_len, len(texts), model)
                    else:
                        logger.warning("Batch embed returned %d results for %d texts (%s)",
                                       len(results) if results else 0, batch_len, model)

        # Fallback: individually embed anything still missing
        missing = [(i, texts[i]) for i, e in enumerate(all_embeddings) if not e]
        if missing:
            logger.info("Falling back to single embed for %d remaining chunks", len(missing))
            # Run individual embeds concurrently too
            async def _single_embed(idx, text):
                try:
                    return idx, await embed_text(text)
                except Exception as exc:
                    logger.warning("Single embed fallback failed for chunk %d: %s", idx, exc)
                    return idx, []

            fallback_results = await asyncio.gather(
                *[_single_embed(i, t) for i, t in missing],
                return_exceptions=False
            )
            for idx, emb in fallback_results:
                if emb:
                    all_embeddings[idx] = emb

    success = sum(1 for e in all_embeddings if e)
    logger.info("[PERF] Embedding complete: %d/%d successful in %.1fms",
                success, len(texts), timer.elapsed_ms)

    return all_embeddings


async def close_client():
    """Gracefully close the shared HTTP client (call on shutdown)."""
    global _http_client
    if _http_client and not _http_client.is_closed:
        await _http_client.aclose()
        _http_client = None
