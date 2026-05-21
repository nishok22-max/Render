"""
Aetheris OS — Sessions Route
Full conversation persistence: create, list, title generation, message storage.
"""
from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional, List
import uuid
import logging

from rag.vector_store import get_supabase
from memory.tiered_memory import tiered_memory as session_memory

logger = logging.getLogger("aetheris.sessions")
router = APIRouter()


# ─── Models ───────────────────────────────────────────────────────────────────

class SessionCreate(BaseModel):
    title: str = "New Chat"
    type: Optional[str] = "chat"

class SessionUpdate(BaseModel):
    title: Optional[str] = None

class MessageSave(BaseModel):
    role: str                # "user" | "assistant"
    content: str
    attachments: Optional[List[dict]] = None

class TitleRequest(BaseModel):
    message: str             # The user's first message


# ─── List sessions ────────────────────────────────────────────────────────────

@router.get("/sessions")
async def list_sessions(type: Optional[str] = None):
    """Return all sessions, newest first."""
    try:
        supabase = get_supabase()
        query = supabase.table("sessions").select("*").order("updated_at", desc=True)
        if type:
            query = query.eq("session_type", type)
        result = query.execute()
        return {"sessions": result.data or []}
    except Exception as e:
        logger.warning(f"[Sessions] DB list failed, falling back to memory: {e}")
        return {"sessions": [], "fallback": True}


# ─── Create session ──────────────────────────────────────────────────────────

@router.post("/sessions")
async def create_session(session: SessionCreate):
    """Create a new session and persist it."""
    session_id = str(uuid.uuid4())
    try:
        supabase = get_supabase()
        row = {
            "id":           session_id,
            "title":        session.title,
            "session_type": session.type,
        }
        supabase.table("sessions").insert(row).execute()
    except Exception as e:
        logger.warning(f"[Sessions] DB insert failed: {e}")
    return {"id": session_id, "title": session.title, "type": session.type}


# ─── Update session (rename) ─────────────────────────────────────────────────

@router.patch("/sessions/{session_id}")
async def update_session(session_id: str, update: SessionUpdate):
    """Update session title (auto-title or manual rename)."""
    try:
        supabase = get_supabase()
        data = {}
        if update.title is not None:
            data["title"] = update.title
        if data:
            supabase.table("sessions").update(data).eq("id", session_id).execute()
    except Exception as e:
        logger.warning(f"[Sessions] DB update failed: {e}")
    return {"ok": True, "title": update.title}


# ─── Delete session ──────────────────────────────────────────────────────────

@router.delete("/sessions/{session_id}")
async def delete_session(session_id: str):
    """Delete a session and its messages."""
    try:
        supabase = get_supabase()
        supabase.table("messages").delete().eq("session_id", session_id).execute()
        supabase.table("sessions").delete().eq("id", session_id).execute()
    except Exception as e:
        logger.warning(f"[Sessions] DB delete failed: {e}")
    session_memory.clear(session_id)
    return {"ok": True}


# ─── Get messages for a session ───────────────────────────────────────────────

@router.get("/sessions/{session_id}/messages")
async def get_session_messages(session_id: str):
    """Fetch messages for a session."""
    try:
        supabase = get_supabase()
        result = (
            supabase.table("messages")
            .select("*")
            .eq("session_id", session_id)
            .order("created_at")
            .execute()
        )
        return {"messages": result.data or []}
    except Exception as e:
        logger.warning(f"[Sessions] DB message fetch failed: {e}")
        # Fallback: return in-memory history
        return {"messages": session_memory.get_messages(session_id, namespace="chat"), "fallback": True}


# ─── Save a message ──────────────────────────────────────────────────────────

@router.post("/sessions/{session_id}/messages")
async def save_message(session_id: str, msg: MessageSave):
    """Persist a single message to the database."""
    msg_id = str(uuid.uuid4())
    try:
        supabase = get_supabase()
        row = {
            "id":         msg_id,
            "session_id": session_id,
            "role":       msg.role,
            "content":    msg.content,
        }
        supabase.table("messages").insert(row).execute()
    except Exception as e:
        logger.warning(f"[Sessions] DB message save failed: {e}")
    return {"id": msg_id}


# ─── Auto-generate title ─────────────────────────────────────────────────────

@router.post("/sessions/{session_id}/generate-title")
async def generate_title(session_id: str, req: TitleRequest):
    """
    Generate a short, smart chat title from the user's first message.
    Uses the LLM to produce a 3–6 word title.
    """
    try:
        from services.llm_service import generate

        prompt = f"""Generate a short, smart title for a chat conversation that starts with this message:

"{req.message}"

Rules:
- 3 to 6 words maximum
- No quotes, no punctuation at end
- No generic titles like "New Chat" or "Conversation"
- Make it specific to the topic
- Title case
- Sound intelligent and premium

Return ONLY the title, nothing else."""

        title = await generate(
            prompt=prompt,
            system_instruction="You are a title generator. Return only a short title, nothing else.",
            temperature=0.3,
            max_tokens=30,
        )
        # Clean the title
        title = title.strip().strip('"').strip("'").strip()
        # Fallback if empty or too long
        if not title or len(title) > 60:
            title = req.message[:40].strip()

        # Persist to DB
        try:
            supabase = get_supabase()
            supabase.table("sessions").update({"title": title}).eq("id", session_id).execute()
        except Exception:
            pass

        return {"title": title}
    except Exception as e:
        logger.warning(f"[Sessions] Title generation failed: {e}")
        # Fallback: truncate the message
        fallback = req.message[:40].strip()
        if len(req.message) > 40:
            fallback += "..."
        return {"title": fallback}
