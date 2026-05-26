"""
ThinkSync OS — /api/upload (Optimized)
Document upload endpoint with full RAG ingestion pipeline.

OPTIMIZATIONS:
  - Async file I/O (aiofiles)
  - Full profiling of ingestion pipeline stages
  - Background task with proper error recovery
  - Cache invalidation after ingestion
"""
import os
import uuid
import time
import logging

from fastapi import APIRouter, BackgroundTasks, UploadFile, File, HTTPException

from app_config import settings
from rag.vector_store import get_supabase
from rag import PerfTimer, retrieval_cache

logger = logging.getLogger("thinksync.upload")
router = APIRouter()

ALLOWED_EXTENSIONS = {
    # Legacy formats
    "pdf", "docx", "txt", "md", "csv", "xlsx", "json",
    "py", "java", "js", "ts", "c", "cpp", "html", "css", "sql",
    "png", "jpg", "jpeg", "webp", "zip",
    # V2 extended formats — Tabular
    "tsv", "psv", "dat",
    # V2 — Spreadsheets
    "xls", "xlsm", "xlsb",
    # V2 — Structured
    "jsonl", "ndjson", "xml", "yaml", "yml",
    # V2 — Database
    "sqlite", "db",
    # V2 — Columnar / Analytics
    "parquet", "orc", "avro", "feather", "arrow",
    # V2 — Scientific / ML
    "hdf5", "h5", "mat", "pkl", "pickle", "joblib", "npy", "npz",
    # V2 — Images
    "bmp", "tiff", "tif", "gif",
}


# ─── Background ingestion pipeline ────────────────────────────────────────────

async def _ingest_document(doc_id: str, save_path: str, ext: str) -> None:
    """
    Full RAG ingestion pipeline with profiling:
      1. Parse text from the file
      2. Embed all chunks (parallel batch)
      3. Upsert chunk vectors into Supabase
      4. Update document status
    """
    from agents.file_processor import process_file
    from rag.embeddings import embed_batch
    from rag.vector_store import upsert_chunks

    supabase = get_supabase()
    pipeline_start = time.perf_counter()

    try:
        logger.info("[Ingest] Starting pipeline for doc_id=%s", doc_id)

        # Step 1: Parse
        with PerfTimer("ingest_parse") as pt:
            processed = await process_file(save_path, doc_id)
        chunks: list[str] = processed.get("chunks", [])
        logger.info("[Ingest] PARSE: %d chars → %d chunks in %.1fms",
                    processed["text_length"], len(chunks), pt.elapsed_ms)

        if not chunks:
            supabase.table("documents").update({"status": "empty"}).eq("id", doc_id).execute()
            return

        # Step 2: Embed (parallel batches)
        with PerfTimer("ingest_embed") as et:
            embeddings = await embed_batch(chunks)
        valid = [(c, e) for c, e in zip(chunks, embeddings) if e]
        if not valid:
            raise RuntimeError("All embeddings failed — check Gemini API key")
        logger.info("[Ingest] EMBED: %d/%d valid in %.1fms",
                    len(valid), len(chunks), et.elapsed_ms)

        valid_chunks, valid_embeddings = zip(*valid)

        # Step 3: Upsert into vector store
        with PerfTimer("ingest_upsert") as ut:
            stored = await upsert_chunks(doc_id, list(valid_chunks), list(valid_embeddings))
        logger.info("[Ingest] UPSERT: %d vectors in %.1fms", stored, ut.elapsed_ms)

        # Step 4: Mark document as parsed
        supabase.table("documents").update({
            "status": "parsed",
            "chunk_count": stored,
        }).eq("id", doc_id).execute()

        # Invalidate retrieval cache
        retrieval_cache.invalidate()

        total_ms = (time.perf_counter() - pipeline_start) * 1000
        logger.info("[PERF] INGESTION COMPLETE doc_id=%s: parse=%.1fms, embed=%.1fms, upsert=%.1fms, TOTAL=%.1fms",
                    doc_id, pt.elapsed_ms, et.elapsed_ms, ut.elapsed_ms, total_ms)

    except Exception as exc:
        logger.error("[Ingest] ERROR for %s: %s", doc_id, exc)
        try:
            supabase.table("documents").update({"status": "error"}).eq("id", doc_id).execute()
        except Exception:
            pass


# ─── Upload endpoint ──────────────────────────────────────────────────────────

@router.post("/upload")
async def upload_document(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
):
    """
    Upload a document for RAG processing.
    Returns immediately; ingestion runs in background.
    """
    upload_start = time.perf_counter()

    # Extension check
    ext = (file.filename or "").rsplit(".", 1)[-1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"Unsupported file type: .{ext}")

    # Read file
    with PerfTimer("upload_read"):
        content = await file.read()

    if len(content) > settings.MAX_FILE_SIZE:
        raise HTTPException(
            status_code=413,
            detail=f"File too large ({len(content) // 1024 // 1024} MB). Max: 50 MB",
        )

    doc_id = str(uuid.uuid4())
    save_path = os.path.join(settings.UPLOAD_DIR, f"{doc_id}.{ext}")
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)

    # Write file (async if possible)
    with PerfTimer("upload_write"):
        try:
            import aiofiles
            async with aiofiles.open(save_path, "wb") as f:
                await f.write(content)
        except ImportError:
            with open(save_path, "wb") as f:
                f.write(content)

    upload_ms = (time.perf_counter() - upload_start) * 1000
    logger.info("[PERF] UPLOAD: %s → %s (%d KB) in %.1fms",
                file.filename, doc_id, len(content) // 1024, upload_ms)

    # Insert metadata into Supabase
    try:
        supabase = get_supabase()
        supabase.table("documents").insert({
            "id": doc_id,
            "filename": file.filename,
            "file_type": ext,
            "file_size": len(content),
            "storage_path": save_path,
            "status": "processing",
        }).execute()
    except Exception as e:
        logger.warning("[Upload] Metadata insert failed: %s", e)

    # Schedule background ingestion
    background_tasks.add_task(_ingest_document, doc_id, save_path, ext)

    return {
        "document_id": doc_id,
        "filename": file.filename,
        "size": len(content),
        "file_type": ext,
        "status": "processing",
        "upload_ms": round(upload_ms, 1),
        "message": f"File '{file.filename}' uploaded. Ingestion running in background.",
    }
