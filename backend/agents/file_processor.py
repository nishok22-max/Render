"""
Aetheris OS — File Processor Agent (Sprint 2 — Semantic Chunking)
Handles parsing and chunking of uploaded documents for RAG ingestion.

UPGRADES:
  - Semantic parent-child chunking (replaces fixed-size character chunks)
  - BM25 index rebuild trigger after ingestion
  - Semantic cache invalidation after ingestion
  - Performance profiling preserved
"""
import os
import asyncio
import logging
from typing import Dict, List
from concurrent.futures import ThreadPoolExecutor

from app_config import settings
from rag import PerfTimer

logger = logging.getLogger("aetheris.file_processor")

_parse_executor = ThreadPoolExecutor(max_workers=2, thread_name_prefix="parser")


# ─── File parsers ─────────────────────────────────────────────────────────────

def _parse_pdf_sync(file_path: str) -> str:
    try:
        import pypdf
        reader = pypdf.PdfReader(file_path)
        pages  = []
        for page in reader.pages:
            text = page.extract_text()
            if text:
                pages.append(text)
        return "\n\n".join(pages)
    except ImportError:
        return "[PDF parsing requires pypdf: pip install pypdf]"


def _parse_docx_sync(file_path: str) -> str:
    try:
        import docx
        doc = docx.Document(file_path)
        return "\n\n".join(p.text for p in doc.paragraphs if p.text.strip())
    except ImportError:
        return "[DOCX parsing requires python-docx: pip install python-docx]"


# ─── Main processor ───────────────────────────────────────────────────────────

async def process_file(file_path: str, doc_id: str) -> Dict:
    """
    Parse a file and return its text content + chunks (semantic parent-child).

    Returns:
        {
            doc_id, file_path, file_type, text_length,
            chunk_count, chunks,          ← child chunk strings (what gets embedded)
            parent_chunks,                ← parent chunk dicts {content, parent_content, metadata}
            status, agent, perf
        }
    """
    ext  = file_path.rsplit(".", 1)[-1].lower() if "." in file_path else ""
    text = ""
    loop = asyncio.get_running_loop()

    with PerfTimer("file_parse") as parse_timer:
        try:
            if ext in {"txt", "md", "py", "js", "ts", "css", "html", "sql", "java", "c", "cpp"}:
                try:
                    import aiofiles
                    async with aiofiles.open(file_path, "r", encoding="utf-8", errors="replace") as f:
                        text = await f.read()
                except ImportError:
                    text = await loop.run_in_executor(
                        None,
                        lambda: open(file_path, "r", encoding="utf-8", errors="replace").read()
                    )

            elif ext == "json":
                import json
                raw  = await loop.run_in_executor(
                    None, lambda: open(file_path, "r", encoding="utf-8").read()
                )
                data = json.loads(raw)
                text = json.dumps(data, indent=2)

            elif ext == "csv":
                try:
                    import aiofiles
                    async with aiofiles.open(file_path, "r", encoding="utf-8", errors="replace") as f:
                        text = await f.read()
                except ImportError:
                    text = await loop.run_in_executor(
                        None,
                        lambda: open(file_path, "r", encoding="utf-8", errors="replace").read()
                    )

            elif ext == "pdf":
                text = await loop.run_in_executor(_parse_executor, _parse_pdf_sync, file_path)

            elif ext == "docx":
                text = await loop.run_in_executor(_parse_executor, _parse_docx_sync, file_path)

            else:
                # V2 modular parser system for new formats
                try:
                    from utils.parsers_v2 import get_v2_parser
                    v2_parser = get_v2_parser(ext)
                    if v2_parser:
                        docs = list(v2_parser.parse(file_path))
                        text = "\n\n".join(doc.content for doc in docs if doc.content)
                    else:
                        text = f"[Unsupported file type: .{ext}]"
                except Exception as v2_err:
                    logger.warning("[FileProcessor] V2 parser error for .%s: %s", ext, v2_err)
                    text = f"[Unsupported file type: .{ext}]"

        except Exception as exc:
            text = f"[Error reading file: {exc}]"

    logger.info("[PERF] File parse (%s): %d chars in %.1fms", ext, len(text), parse_timer.elapsed_ms)

    # ─── Semantic chunking ───────────────────────────────────────────────────
    with PerfTimer("chunking") as chunk_timer:
        flat_chunks:   List[str]  = []
        parent_chunks: List[Dict] = []

        if text and not text.startswith("["):
            try:
                from rag.semantic_chunker import chunk_document
                filename = os.path.basename(file_path)
                parents, children = chunk_document(
                    text      = text,
                    doc_id    = doc_id,
                    filename  = filename,
                    file_type = ext,
                )
                parent_chunks = children   # each child carries parent_content
                flat_chunks   = [c["content"] for c in children]
            except Exception as exc:
                logger.warning("[FileProcessor] Semantic chunker failed (%s), using flat fallback", exc)
                from rag.semantic_chunker import chunk_text_flat
                flat_chunks   = chunk_text_flat(text, chunk_size=settings.CHUNK_SIZE, overlap=settings.CHUNK_OVERLAP)
                parent_chunks = [{"content": c, "parent_content": c, "metadata": {}} for c in flat_chunks]
        else:
            # Error or empty text
            flat_chunks   = [text] if text else []
            parent_chunks = [{"content": text, "parent_content": text, "metadata": {}}] if text else []

    logger.info("[PERF] Chunking: %d child chunks in %.1fms", len(flat_chunks), chunk_timer.elapsed_ms)

    return {
        "doc_id":        doc_id,
        "file_path":     file_path,
        "file_type":     ext,
        "text_length":   len(text),
        "chunk_count":   len(flat_chunks),
        "chunks":        flat_chunks,       # plain strings — for embedding
        "parent_chunks": parent_chunks,     # dicts with metadata — for storage
        "status":        "parsed",
        "agent":         "file_processor",
        "perf": {
            "parse_ms": round(parse_timer.elapsed_ms, 1),
            "chunk_ms": round(chunk_timer.elapsed_ms, 1),
        },
    }
