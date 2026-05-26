"""
ThinkSync OS — /api/chat
Multimodal chat endpoint with SSE streaming.

All requests now flow through the Orchestrator, which detects intent and
routes to the correct agent pipeline. Each orchestrator event is translated
into an SSE frame for the frontend.

SSE event types emitted:
  session      → { session_id }
  agent_status → { agent, pipeline, input_type }        ← new: routing metadata
  token        → { content }
  citations    → { citations, sources }                  ← new: from research/RAG
  agent_info   → { agent, confidence, sub_queries }      ← new: deep research metadata
  error        → { message }
  [DONE]
"""
import asyncio
import json
import logging
from typing import AsyncGenerator, List, Optional

from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from agents.orchestrator import route_request
from memory.tiered_memory import tiered_memory as session_memory

logger = logging.getLogger("thinksync.chat")
router = APIRouter()

# ─── Request models ───────────────────────────────────────────────────────────

class ChatAttachment(BaseModel):
    filename: str
    file_type: str
    content: str       # data-URL or raw base64 string
    mime_type: str     # e.g. "image/png"

class ChatRequest(BaseModel):
    message: str
    session_id: Optional[str] = None
    attachments: Optional[List[ChatAttachment]] = None

# ─── SSE helpers ──────────────────────────────────────────────────────────────

def _sse(event_type: str, payload: dict) -> str:
    return f"data: {json.dumps({'type': event_type, **payload})}\n\n"

def _sse_done() -> str:
    return "data: [DONE]\n\n"

# ─── Endpoint ─────────────────────────────────────────────────────────────────

@router.post("/chat")
async def chat_endpoint(request: ChatRequest):
    """
    POST /api/chat
    Accepts message + optional image attachments.
    Streams the response via SSE (text/event-stream).
    All routing is handled by the Orchestrator agent.
    """
    from app_config import settings
    logger.info(
        "[Chat] Request → prompt_len=%d, has_attachments=%s, count=%d, "
        "bedrock_ready=%s, gemini_ready=%s",
        len(request.message),
        bool(request.attachments),
        len(request.attachments or []),
        settings.bedrock_ready,
        settings.gemini_ready,
    )
    if request.attachments:
        for att in request.attachments:
            logger.info(
                "  Attachment: %s | %s | ~%dKB",
                att.filename, att.mime_type, len(att.content) // 1024,
            )

    return StreamingResponse(
        _stream_response(request),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


# ─── Core streaming generator ─────────────────────────────────────────────────

async def _stream_response(request: ChatRequest) -> AsyncGenerator[str, None]:
    """
    Drives the orchestrator and translates its events into SSE frames.

    Orchestrator event → SSE event mapping:
      agent_start   → agent_status  (routing metadata visible in UI)
      stream_token  → token         (direct LLM streaming for chat/code)
      agent_result  → token (chunked) + citations
      agent_error   → error
      done          → [DONE]
    """
    session_id = request.session_id or _new_session_id()
    yield _sse("session", {"session_id": session_id})

    # Get structured message history from session memory (chat namespace only)
    # Passes [{role, content}] directly — no string format round-trip
    history_messages = session_memory.get_messages(session_id, namespace="chat", last_n=10)

    # Convert Pydantic attachments to plain dicts for the orchestrator
    attachments = None
    if request.attachments:
        attachments = [
            {
                "filename":  att.filename,
                "file_type": att.file_type,
                "content":   att.content,
                "mime_type": att.mime_type,
            }
            for att in request.attachments
        ]

    # ── Save the user's message to session memory ─────────────────────────────
    session_memory.add_message(session_id, "user", request.message, namespace="chat")

    full_answer = ""   # accumulate so we can persist the assistant turn

    try:
        async for event in route_request(
            message=request.message,
            attachments=attachments,
            history_messages=history_messages,
            session_id=session_id,
        ):
            etype = event.get("event")

            # ── Routing metadata → tell the UI which agent is active ──────────
            if etype == "agent_start":
                yield _sse("agent_status", {
                    "agent":      event["agent"],
                    "pipeline":   event.get("pipeline", []),
                    "input_type": event.get("input_type", ""),
                })
                await asyncio.sleep(0)

            # ── Direct streaming token (general chat / code path) ─────────────
            elif etype == "stream_token":
                token = event.get("token", "")
                full_answer += token
                yield _sse("token", {"content": token})

            # ── Agent produced a complete result (research / RAG / vision) ────
            elif etype == "agent_result":
                answer    = event.get("answer", "")
                # Defensive: ensure answer is always a string
                if not isinstance(answer, str):
                    answer = str(answer) if answer is not None else ""
                citations = event.get("citations", [])
                sources   = event.get("sources", [])
                full_answer += answer

                # Stream the answer in small chunks for consistent UX
                chunk_size = 12
                for i in range(0, len(answer), chunk_size):
                    yield _sse("token", {"content": answer[i: i + chunk_size]})
                    await asyncio.sleep(0)

                # Emit citations / sources if present
                if citations or sources:
                    yield _sse("citations", {
                        "citations": citations,
                        "sources":   sources,
                    })

                # Emit deep research metadata if present
                extras = {}
                if "confidence" in event:
                    extras["confidence"] = event["confidence"]
                if "sub_queries" in event:
                    extras["sub_queries"] = event["sub_queries"]
                if extras:
                    yield _sse("agent_info", {"agent": event.get("agent"), **extras})

            # ── Agent error → surface to frontend ─────────────────────────────
            elif etype == "agent_error":
                agent = event.get("agent", "unknown")
                err   = event.get("error", "Unknown error")
                logger.warning("[Chat] agent_error agent=%s err=%s", agent, err)
                # Don't yield error SSE for non-fatal intermediate failures
                # (orchestrator already falls back internally); only surface
                # if we have no answer yet.
                if not full_answer:
                    yield _sse("error", {"message": _friendly_error(err)})

            # ── Done sentinel ─────────────────────────────────────────────────
            elif etype == "done":
                break

        # Persist assistant reply to session memory
        if full_answer:
            session_memory.add_message(session_id, "assistant", full_answer, namespace="chat")

        yield _sse_done()

    except Exception as exc:
        err_str = str(exc)
        logger.error("[Chat] Unhandled exception: %s", err_str)
        yield _sse("error", {"message": _friendly_error(err_str)})
        yield _sse_done()


# ─── Error message humaniser ─────────────────────────────────────────────────

def _friendly_error(err: str) -> str:
    """Convert technical errors into user-friendly messages."""
    if "AWS" in err or "bedrock" in err.lower() or "credential" in err.lower():
        return "I'm having trouble connecting to my AI service right now. Please try again in a moment."
    if "GEMINI_API_KEY" in err or "not set" in err:
        return "My AI services are temporarily unavailable. Please try again shortly."
    if "403" in err or "API_KEY_INVALID" in err:
        return "I'm experiencing an authentication issue. The team has been notified."
    if "429" in err or "quota" in err.lower():
        return "I'm a bit busy right now. Please try again in a few seconds."
    if "CORS" in err:
        return "I'm having trouble connecting. Please make sure the system is running properly."
    if "Network" in err or "connect" in err.lower():
        return "I can't reach my services right now. Please check your connection and try again."
    return "Something went wrong. Please try again."


# ─── Utilities ────────────────────────────────────────────────────────────────

def _new_session_id() -> str:
    import uuid
    return str(uuid.uuid4())
