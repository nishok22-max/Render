"""
Aetheris OS — Session Memory
Manages conversation context for each session.
"""
from typing import List, Dict, Optional
from collections import defaultdict


class SessionMemory:
    """In-memory conversation history per session."""

    def __init__(self, max_messages: int = 50):
        self.sessions: Dict[str, List[Dict]] = defaultdict(list)
        self.max_messages = max_messages

    def add_message(self, session_id: str, role: str, content: str, metadata: dict = None):
        """Add a message to session history."""
        self.sessions[session_id].append({
            "role": role,
            "content": content,
            "metadata": metadata or {},
        })
        # Trim old messages
        if len(self.sessions[session_id]) > self.max_messages:
            self.sessions[session_id] = self.sessions[session_id][-self.max_messages:]

    def get_history(self, session_id: str, last_n: int = 10) -> str:
        """Get formatted conversation history."""
        messages = self.sessions.get(session_id, [])[-last_n:]
        if not messages:
            return ""
        parts = []
        for msg in messages:
            role = "User" if msg["role"] == "user" else "Assistant"
            parts.append(f"{role}: {msg['content'][:500]}")
        return "\n".join(parts)

    def clear(self, session_id: str):
        """Clear session history."""
        self.sessions.pop(session_id, None)


# Global session memory instance
session_memory = SessionMemory()
