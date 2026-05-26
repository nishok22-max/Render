"""
ThinkSync OS — Documents Endpoint
Lists and manages uploaded documents, including chunk cleanup on delete.
"""
import os
from fastapi import APIRouter
from rag.vector_store import get_supabase, delete_document as _delete_chunks

router = APIRouter()


@router.get("/documents")
async def list_documents():
    """Fetch all documents from Supabase."""
    try:
        supabase = get_supabase()
        result = supabase.table("documents").select("*").order("created_at", desc=True).execute()
        return {"documents": result.data or []}
    except Exception as e:
        print(f"[Documents] Error fetching: {e}")
        return {"documents": [], "error": str(e)}


@router.delete("/documents/{document_id}")
async def delete_document(document_id: str):
    """
    Delete a document from:
      1. The Supabase 'documents' table
      2. The vector store 'chunks' table
      3. Disk (storage_path from the DB record)
    """
    try:
        supabase = get_supabase()

        # Get storage path before deleting
        rec = supabase.table("documents").select("storage_path").eq("id", document_id).execute()
        storage_path = (rec.data or [{}])[0].get("storage_path", "")

        # Delete DB record
        supabase.table("documents").delete().eq("id", document_id).execute()

        # Delete vectors
        await _delete_chunks(document_id)

        # Delete file from disk
        if storage_path and os.path.exists(storage_path):
            os.remove(storage_path)
            print(f"[Documents] Deleted file: {storage_path}")

        return {"status": "deleted", "document_id": document_id}
    except Exception as e:
        return {"status": "error", "message": str(e)}


@router.post("/documents/{document_id}/retry")
async def retry_document(document_id: str):
    """Re-trigger the ingestion pipeline for a document that failed."""
    from fastapi import BackgroundTasks
    try:
        supabase = get_supabase()
        rec = supabase.table("documents").select("storage_path, file_type").eq("id", document_id).execute()
        if not rec.data:
            return {"status": "error", "message": "Document not found"}

        doc = rec.data[0]
        storage_path = doc.get("storage_path", "")
        ext = doc.get("file_type", "")

        if not os.path.exists(storage_path):
            return {"status": "error", "message": "File not found on disk"}

        from routes.upload import _ingest_document
        import asyncio
        asyncio.create_task(_ingest_document(document_id, storage_path, ext))

        return {"status": "processing", "document_id": document_id}
    except Exception as e:
        return {"status": "error", "message": str(e)}


@router.get("/analytics/dashboard")
async def dashboard_stats():
    """Fetch real stats from the database."""
    try:
        supabase = get_supabase()
        docs   = supabase.table("documents").select("status", count="exact").execute()
        chunks = supabase.table("chunks").select("id", count="exact").execute()
        sessions = supabase.table("sessions").select("id", count="exact").execute()

        return {
            "total_documents": docs.count or 0,
            "parsed_documents": sum(1 for d in (docs.data or []) if d.get("status") == "parsed"),
            "total_vectors": chunks.count or 0,
            "total_sessions": sessions.count or 0,
        }
    except Exception as e:
        print(f"[Analytics] Error: {e}")
        return {"total_documents": 0, "parsed_documents": 0, "total_vectors": 0, "total_sessions": 0}
