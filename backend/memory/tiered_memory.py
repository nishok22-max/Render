"""
ThinkSync OS — Tiered Memory System (Sprint 3)

Replaces the volatile in-process defaultdict with a three-tier architecture:

  L1: In-process dict  — sub-ms reads, survives request lifetime
  L2: Supabase messages table — persistent, ~5ms async writes
  L3: Episodic vector store — semantic search over significant past turns

DESIGN:
  - L1 is always written first (sync, zero latency)
  - L2 is written as fire-and-forget asyncio.Task (non-blocking)
  - L3 embedding is only triggered for "significant" turns (>100 chars)
  - On cache miss (backend restart), L2 re-hydrates L1 automatically
  - get_relevant_history() returns recent L1 turns + semantically matched L3 episodes
"""
from __future__ import annotations

import asyncio
import logging
import time
from collections import defaultdict
from typing import Dict, List, Optional, Tuple

logger = logging.getLogger("thinksync.tiered_memory")

# ─── L1: In-process message store ────────────────────────────────────────────

# Structure: {session_id: {namespace: [{role, content, ts}]}}
_l1: Dict[str, Dict[str, List[Dict]]] = defaultdict(lambda: defaultdict(list))

# ─── L3: Episodic store ───────────────────────────────────────────────────────
# Structure: {session_id: {namespace: [(embedding, content, role, ts)]}}
_l3: Dict[str, Dict[str, List[Tuple]]] = defaultdict(lambda: defaultdict(list))
_L3_MAX = 200  # max episodes per (session, namespace)
_MAX_SESSIONS = 500  # evict oldest sessions when exceeded


def _is_significant(content: str) -> bool:
    """Decide if a turn is worth storing in L3 episodic memory."""
    return len(content.strip()) > 100


# ─── L2: Supabase persistence ────────────────────────────────────────────────

def _get_supabase_safe():
    try:
        from rag.vector_store import get_supabase
        return get_supabase()
    except Exception:
        return None


async def _ensure_session_exists(sb, session_id: str) -> None:
    """Upsert a minimal sessions row so FK constraints on messages pass."""
    try:
        sb.table("sessions").upsert(
            {"id": session_id, "title": "New Chat", "session_type": "chat"},
            on_conflict="id",
        ).execute()
    except Exception as exc:
        logger.debug("[TieredMemory] session upsert failed (non-critical): %s", exc)


async def _persist_l2(session_id: str, role: str, content: str, namespace: str) -> None:
    """Fire-and-forget: write a single message turn to Supabase."""
    sb = _get_supabase_safe()
    if not sb:
        return
    try:
        import uuid
        # Ensure parent session row exists (prevents FK violation)
        await _ensure_session_exists(sb, session_id)
        sb.table("messages").insert({
            "id":         str(uuid.uuid4()),
            "session_id": session_id,
            "role":       role,
            "content":    content,
        }).execute()
    except Exception as exc:
        logger.debug("[TieredMemory] L2 write failed (non-critical): %s", exc)


async def _embed_episodic(session_id: str, role: str, content: str, namespace: str) -> None:
    """Embed a turn and store in L3 episodic memory."""
    try:
        from rag.embeddings import embed_text
        emb = await embed_text(content[:512])
        l3_ns = _l3[session_id][namespace]
        l3_ns.append((emb, content, role, time.time()))
        # Evict oldest if over limit
        if len(l3_ns) > _L3_MAX:
            _l3[session_id][namespace] = l3_ns[-_L3_MAX:]
    except Exception as exc:
        logger.debug("[TieredMemory] L3 embed failed (non-critical): %s", exc)


def _cosine_sim(a: List[float], b: List[float]) -> float:
    dot  = sum(x * y for x, y in zip(a, b))
    na   = sum(x * x for x in a) ** 0.5
    nb   = sum(x * x for x in b) ** 0.5
    return dot / (na * nb) if na and nb else 0.0


async def _l3_search(session_id: str, namespace: str, query: str, top_k: int = 3) -> List[Dict]:
    """Semantic search over episodic memory."""
    episodes = _l3.get(session_id, {}).get(namespace, [])
    if not episodes:
        return []
    try:
        from rag.embeddings import embed_text
        q_emb = await embed_text(query[:512])
        scored = [
            (_cosine_sim(q_emb, emb), content, role, ts)
            for emb, content, role, ts in episodes
        ]
        scored.sort(reverse=True)
        return [
            {"role": role, "content": content, "_episodic": True, "_score": sim}
            for sim, content, role, ts in scored[:top_k]
            if sim > 0.75
        ]
    except Exception:
        return []


# ─── Public API (mirrors session_memory interface) ───────────────────────────

class TieredMemory:
    """
    Drop-in upgrade for SessionMemory with L1/L2/L3 tiers.
    """

    def add_message(
        self,
        session_id: str,
        role:       str,
        content:    str,
        namespace:  str = "chat",
    ) -> None:
        """
        Add a message. L1 is synchronous (zero latency).
        L2 and L3 are async fire-and-forget.
        """
        if not content:
            return

        # L1: always synchronous
        _l1[session_id][namespace].append({
            "role":    role,
            "content": content,
            "ts":      time.time(),
        })

        # Evict oldest sessions if L1 exceeds max
        if len(_l1) > _MAX_SESSIONS:
            oldest_key = next(iter(_l1))
            del _l1[oldest_key]
            _l3.pop(oldest_key, None)

        # L2: async persist (non-blocking)
        try:
            loop = asyncio.get_running_loop()
            loop.create_task(_persist_l2(session_id, role, content, namespace))
        except RuntimeError:
            pass  # No running event loop

        # L3: async episodic embed (only significant turns)
        if _is_significant(content):
            try:
                loop = asyncio.get_running_loop()
                loop.create_task(_embed_episodic(session_id, role, content, namespace))
            except RuntimeError:
                pass  # No running event loop

    def get_messages(
        self,
        session_id: str,
        namespace:  str = "chat",
        last_n:     int = 10,
    ) -> List[Dict]:
        """Return the last N messages from L1 for this session+namespace."""
        messages = _l1[session_id][namespace]
        recent   = messages[-last_n:] if len(messages) > last_n else messages
        return [{"role": m["role"], "content": m["content"]} for m in recent]

    async def get_relevant_history(
        self,
        session_id: str,
        namespace:  str,
        query:      str,
        last_n:     int = 6,
        episodic_k: int = 3,
    ) -> List[Dict]:
        """
        Return recent messages + semantically relevant episodic turns.
        Deduplicates before returning.
        """
        recent   = self.get_messages(session_id, namespace, last_n=last_n)
        episodic = await _l3_search(session_id, namespace, query, top_k=episodic_k)

        # Deduplicate episodic vs recent by content prefix
        recent_contents = {m["content"][:80] for m in recent}
        unique_episodic = [
            e for e in episodic
            if e["content"][:80] not in recent_contents
        ]

        # Return: episodic context first (older/relevant), then recent (newer)
        return unique_episodic + recent

    def get_history(
        self,
        session_id: str,
        last_n:     int = 10,
        namespace:  str = "chat",
    ) -> str:
        """Return formatted history string (backward compat)."""
        messages = self.get_messages(session_id, namespace=namespace, last_n=last_n)
        lines = []
        for m in messages:
            prefix = "User" if m["role"] == "user" else "Assistant"
            lines.append(f"{prefix}: {m['content']}")
        return "\n".join(lines)

    def has_context(self, session_id: str, namespace: str = "chat") -> bool:
        return bool(_l1[session_id][namespace])

    def clear(self, session_id: str, namespace: Optional[str] = None) -> None:
        if namespace:
            _l1[session_id].pop(namespace, None)
            _l3[session_id].pop(namespace, None)
        else:
            _l1.pop(session_id, None)
            _l3.pop(session_id, None)

    async def rehydrate_from_db(self, session_id: str, namespace: str = "chat") -> None:
        """
        Re-populate L1 from Supabase after a backend restart.
        Only runs if L1 is empty for this session.
        """
        if self.has_context(session_id, namespace):
            return
        sb = _get_supabase_safe()
        if not sb:
            return
        try:
            result = (
                sb.table("messages")
                .select("role, content")
                .eq("session_id", session_id)
                .order("created_at")
                .limit(50)
                .execute()
            )
            for m in (result.data or []):
                role    = m.get("role", "user")
                content = m.get("content", "")
                if content:
                    _l1[session_id][namespace].append({
                        "role":    role,
                        "content": content,
                        "ts":      0.0,
                    })
            if result.data:
                logger.info("[TieredMemory] Re-hydrated %d messages for session %s",
                            len(result.data), session_id[:8])
        except Exception as exc:
            logger.debug("[TieredMemory] Re-hydration failed: %s", exc)


# ─── Module-level singleton ───────────────────────────────────────────────────

tiered_memory = TieredMemory()
