"""
Aetheris OS — Research Endpoint (v5 — Sprint 4: Real Token Streaming)

UPGRADES:
  - research_stream() now uses deep_research_stream() for true LLM token streaming
  - No more fake asyncio.sleep word-chunking
  - Supabase-backed session persistence (Sprint 1)
  - Rich telemetry events preserved
"""
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse, JSONResponse
from pydantic import BaseModel
from typing import Optional, List, Dict
import json
import asyncio
import time
import uuid
import logging as _logging

from agents.deep_research_agent import deep_research, deep_research_stream

router = APIRouter()

# ─── Session persistence (Supabase-backed, in-memory fallback) ────────────────

_log = _logging.getLogger("aetheris.research")
_sessions_fallback: Dict[str, Dict] = {}


def _get_supabase_safe():
    try:
        from rag.vector_store import get_supabase
        return get_supabase()
    except Exception:
        return None


async def _load_session(session_id: str) -> Optional[Dict]:
    sb = _get_supabase_safe()
    if sb:
        try:
            result = sb.table("research_sessions").select("*").eq("id", session_id).execute()
            rows = result.data or []
            if rows:
                r = rows[0]
                return {
                    "id":              r["id"],
                    "query":           r["query"],
                    "report":          r.get("report", ""),
                    "sources":         r.get("sources") or [],
                    "sub_queries":     r.get("sub_queries") or [],
                    "confidence":      r.get("confidence", 0.0),
                    "total_sources":   r.get("total_sources", 0),
                    "depth":           r.get("depth", 3),
                    "duration_ms":     r.get("duration_ms", 0),
                    "status":          r.get("status", "complete"),
                    "related_queries": r.get("related_queries") or [],
                    "created_at":      r.get("created_at", ""),
                }
        except Exception as exc:
            _log.warning("[Research] Supabase load failed: %s", exc)
    return _sessions_fallback.get(session_id)


async def _list_sessions_db() -> list:
    sb = _get_supabase_safe()
    if sb:
        try:
            result = sb.table("research_sessions") \
                .select("id, query, confidence, total_sources, depth, duration_ms, created_at, status") \
                .order("created_at", desc=True) \
                .execute()
            return result.data or []
        except Exception as exc:
            _log.warning("[Research] Supabase list failed: %s", exc)
    return sorted(_sessions_fallback.values(), key=lambda s: s.get("created_at", ""), reverse=True)


async def _upsert_session(data: Dict) -> None:
    _sessions_fallback[data["id"]] = data
    sb = _get_supabase_safe()
    if not sb:
        return
    try:
        row = {
            "id":              data["id"],
            "query":           data["query"],
            "report":          data.get("report", ""),
            "sources":         data.get("sources", []),
            "sub_queries":     data.get("sub_queries", []),
            "confidence":      data.get("confidence", 0.0),
            "total_sources":   data.get("total_sources", 0),
            "depth":           data.get("depth", 3),
            "duration_ms":     data.get("duration_ms", 0),
            "status":          data.get("status", "complete"),
            "related_queries": data.get("related_queries", []),
        }
        sb.table("research_sessions").upsert(row).execute()
    except Exception as exc:
        _log.warning("[Research] Supabase upsert failed (kept in-memory): %s", exc)


async def _delete_session_db(session_id: str) -> None:
    _sessions_fallback.pop(session_id, None)
    sb = _get_supabase_safe()
    if sb:
        try:
            sb.table("research_sessions").delete().eq("id", session_id).execute()
        except Exception as exc:
            _log.warning("[Research] Supabase delete failed: %s", exc)


async def _clear_all_sessions_db() -> None:
    _sessions_fallback.clear()
    sb = _get_supabase_safe()
    if sb:
        try:
            sb.table("research_sessions").delete().neq("id", "").execute()
        except Exception as exc:
            _log.warning("[Research] Supabase clear-all failed: %s", exc)


# ─── Request models ───────────────────────────────────────────────────────────

class ResearchRequest(BaseModel):
    query: str
    depth: Optional[int] = 3
    sources_limit: Optional[int] = 10
    session_id: Optional[str] = None


# ─── SSE helpers ──────────────────────────────────────────────────────────────

def _ev(payload: dict) -> str:
    return f"data: {json.dumps(payload)}\n\n"

def _status(message: str, phase: str = "running") -> str:
    return _ev({"type": "status", "message": message, "phase": phase})

def _agent(agent: str, action: str, detail: str = "", progress: float = 0.0) -> str:
    return _ev({"type": "agent", "agent": agent, "action": action, "detail": detail, "progress": progress})

def _thought(content: str) -> str:
    return _ev({"type": "thought", "content": content})

def _subquery(index: int, query: str, status: str = "pending") -> str:
    return _ev({"type": "subquery", "index": index, "query": query, "status": status})

def _source_found(source: dict, subquery_index: int) -> str:
    return _ev({"type": "source_found", "source": source, "subquery_index": subquery_index})

def _token(content: str) -> str:
    return _ev({"type": "token", "content": content})

def _metadata(data: dict) -> str:
    return _ev({"type": "metadata", **data})

def _error(message: str) -> str:
    return _ev({"type": "error", "message": message})


# ─── Related query generation ─────────────────────────────────────────────────

async def _generate_related_queries(query: str, report: str) -> List[str]:
    try:
        from services.llm_service import generate
        prompt = (
            f'Based on this completed research report about "{query}", '
            f"generate exactly 4 compelling follow-up research questions.\n\n"
            f"Report excerpt:\n{report[:1200]}\n\n"
            "Return ONLY 4 questions, one per line, no numbering or bullets."
        )
        raw = await generate(
            prompt,
            system_instruction="You are a research strategist. Generate exactly 4 concise follow-up research questions. No preamble, no numbering.",
            temperature=0.6,
            max_tokens=256,
        )
        return [q.strip() for q in raw.strip().splitlines() if q.strip()][:4]
    except Exception:
        return []


# ─── Core streaming generator (Sprint 4: REAL token streaming) ───────────────

async def research_stream(query: str, depth: int, sources_limit: int, session_id: str):
    """
    Stream research with true LLM token streaming for synthesis.
    No more fake word-chunking — real tokens from the LLM are forwarded as they arrive.
    """
    start_time = time.time()

    yield _ev({"type": "session_id", "session_id": session_id})
    await asyncio.sleep(0.05)

    yield _status("Initializing autonomous research pipeline...", "initializing")
    yield _agent("orchestrator", "Analyzing query",
                 f'Query: "{query[:80]}..."' if len(query) > 80 else f'Query: "{query}"', 0.05)

    yield _thought(f"Breaking down research topic into {depth} parallel sub-queries.")
    yield _agent("decomposer", "Decomposing query", f"Generating {depth} focused research angles", 0.10)

    report_text  = ""
    sources      = []
    sub_queries  = [query]
    confidence   = 0.75
    total_sources = 0

    try:
        async for event in deep_research_stream(query, depth=depth, sources_limit=sources_limit):
            etype = event.get("type")

            if etype == "sub_queries":
                sub_queries = event["sub_queries"]
                for i, sq in enumerate(sub_queries):
                    yield _subquery(i, sq, "running")
                    await asyncio.sleep(0.04)
                yield _status("Executing parallel web searches...", "searching")
                yield _agent("web_research", "Searching the web",
                             f"Running {len(sub_queries)} parallel threads with 15s timeout", 0.30)

            elif etype == "sources":
                sources       = event.get("sources", [])
                total_sources = event.get("total", len(sources))
                per_sq        = max(1, len(sources) // max(1, len(sub_queries)))
                for i, sq in enumerate(sub_queries):
                    sq_sources = sources[i * per_sq: (i + 1) * per_sq]
                    for s in sq_sources:
                        yield _source_found(s, i)
                        await asyncio.sleep(0.03)
                    yield _subquery(i, sq, "done")
                    await asyncio.sleep(0.04)
                for s in sources[len(sub_queries) * per_sq:]:
                    yield _source_found(s, len(sub_queries) - 1)
                yield _agent("web_research", "Web search complete",
                             f"Retrieved {total_sources} sources", 0.55)

            elif etype == "synthesis_start":
                yield _status("Synthesizing findings with AI...", "synthesizing")
                yield _agent("reasoning", "Synthesizing", "Cross-referencing sources", 0.65)
                yield _thought("Analysing source credibility and assembling a coherent narrative.")
                yield _agent("writer", "Generating report", "Streaming synthesis tokens in real-time", 0.75)
                yield _ev({"type": "report_start"})

            elif etype == "token":
                # ← REAL LLM tokens, forwarded directly — no fake delay
                tok = event.get("content", "")
                report_text += tok
                yield _token(tok)

            elif etype == "done":
                confidence    = event.get("confidence", confidence)
                total_sources = event.get("total_sources", total_sources)
                sources       = event.get("sources", sources)
                sub_queries   = event.get("sub_queries", sub_queries)

        # Related queries
        yield _agent("reasoning", "Generating follow-up questions",
                     "Identifying adjacent research angles", 0.92)
        related = await _generate_related_queries(query, report_text)

        duration_ms = int((time.time() - start_time) * 1000)
        yield _metadata({
            "sources":         sources,
            "sub_queries":     sub_queries,
            "confidence":      confidence,
            "total_sources":   total_sources,
            "duration_ms":     duration_ms,
            "query":           query,
            "depth":           depth,
            "related_queries": related,
        })

        # Persist to Supabase
        await _upsert_session({
            "id":              session_id,
            "query":           query,
            "report":          report_text,
            "sources":         sources,
            "sub_queries":     sub_queries,
            "confidence":      confidence,
            "total_sources":   total_sources,
            "depth":           depth,
            "duration_ms":     duration_ms,
            "status":          "complete",
            "related_queries": related,
        })

        yield _agent("orchestrator", "Research complete",
                     f"Generated in {duration_ms // 1000}s with {total_sources} sources", 1.0)
        yield _status("Research complete", "done")

    except Exception as e:
        _log.error("[Research] Stream error: %s", e)
        yield _error(str(e))

    yield "data: [DONE]\n\n"


# ─── Endpoints ────────────────────────────────────────────────────────────────

@router.post("/research")
async def start_research(request: ResearchRequest):
    """Stream a full deep-research run with real LLM synthesis streaming."""
    session_id    = request.session_id or str(uuid.uuid4())
    depth         = max(1, min(request.depth or 3, 5))
    sources_limit = max(1, min(request.sources_limit or 10, 20))
    return StreamingResponse(
        research_stream(request.query, depth, sources_limit, session_id),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "Connection": "keep-alive", "X-Accel-Buffering": "no"},
    )


@router.get("/research/sessions")
async def list_sessions():
    sessions = await _list_sessions_db()
    return JSONResponse({"sessions": sessions, "total": len(sessions)})


@router.get("/research/sessions/{session_id}")
async def get_session(session_id: str):
    session = await _load_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return JSONResponse(session)


@router.delete("/research/sessions/{session_id}")
async def delete_session(session_id: str):
    session = await _load_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    await _delete_session_db(session_id)
    return JSONResponse({"deleted": True, "session_id": session_id})


@router.delete("/research/sessions")
async def clear_all_sessions():
    await _clear_all_sessions_db()
    return JSONResponse({"deleted": True})


@router.get("/research/sessions/{session_id}/export")
async def export_session(session_id: str, fmt: str = "markdown"):
    s = await _load_session(session_id)
    if not s:
        raise HTTPException(status_code=404, detail="Session not found")

    if fmt == "json":
        content    = json.dumps(s, indent=2)
        media_type = "application/json"
        filename   = f"research_{session_id[:8]}.json"
    else:
        lines = [
            f"# {s['query']}", "",
            f"> **Depth:** {s.get('depth', 3)} • "
            f"**Sources:** {s.get('total_sources', 0)} • "
            f"**Confidence:** {round(s.get('confidence', 0) * 100)}%",
            "", "---", "", s.get("report", ""), "", "---", "", "## Sources", "",
        ]
        for i, src in enumerate(s.get("sources", []), 1):
            lines.append(f"{i}. [{src.get('title', 'Untitled')}]({src.get('url', '')})")
        content    = "\n".join(lines)
        media_type = "text/markdown"
        filename   = f"research_{session_id[:8]}.md"

    return StreamingResponse(
        iter([content]),
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post("/research/quick")
async def quick_research(request: ResearchRequest):
    result = await deep_research(
        request.query,
        depth=min(request.depth or 2, 2),
        sources_limit=min(request.sources_limit or 5, 5),
    )
    return result


@router.get("/research/stats")
async def research_stats():
    sessions = await _list_sessions_db()
    total    = len(sessions)
    if not total:
        return JSONResponse({"total_sessions": 0, "total_sources": 0, "avg_confidence": 0, "avg_duration_ms": 0})
    return JSONResponse({
        "total_sessions":  total,
        "total_sources":   sum(s.get("total_sources", 0) for s in sessions),
        "avg_confidence":  round(sum(s.get("confidence", 0) for s in sessions) / total, 3),
        "avg_duration_ms": round(sum(s.get("duration_ms", 0) for s in sessions) / total),
    })
