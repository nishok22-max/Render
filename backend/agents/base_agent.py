"""
Aetheris OS — BaseAgent (Sprint 3)

Abstract base class enforcing namespace isolation across all agents.
Every agent inherits this — memory, toolset, and session scope are
automatically scoped to the agent's declared namespace.

ISOLATION CONTRACT:
  - Each agent declares a unique `namespace` class attribute.
  - Memory reads/writes are strictly scoped to that namespace.
  - Agents CANNOT access each other's memory — only shared is the user query.
"""
from __future__ import annotations

import logging
from abc import ABC, abstractmethod
from typing import Any, AsyncGenerator, Dict, List, Optional

logger = logging.getLogger("aetheris.base_agent")


class AgentContext:
    """Shared context passed between agents in a planning chain."""

    def __init__(
        self,
        session_id: str,
        message:    str,
        attachments: Optional[List[Dict]] = None,
        prior_results: Optional[Dict[str, Any]] = None,
    ):
        self.session_id    = session_id
        self.message       = message
        self.attachments   = attachments or []
        self.prior_results = prior_results or {}

    def with_prior(self, results: Dict[str, Any]) -> "AgentContext":
        """Return a new context enriched with results from prior steps."""
        return AgentContext(
            session_id    = self.session_id,
            message       = self.message,
            attachments   = self.attachments,
            prior_results = {**self.prior_results, **results},
        )


class AgentResult:
    """Structured result from any agent."""

    def __init__(
        self,
        agent:    str,
        answer:   str,
        sources:  Optional[List[Dict]] = None,
        metadata: Optional[Dict]       = None,
        error:    Optional[str]        = None,
    ):
        self.agent    = agent
        self.answer   = answer
        self.sources  = sources or []
        self.metadata = metadata or {}
        self.error    = error
        self.ok       = error is None

    def to_dict(self) -> Dict:
        return {
            "agent":    self.agent,
            "answer":   self.answer,
            "sources":  self.sources,
            "metadata": self.metadata,
            "error":    self.error,
        }


class BaseAgent(ABC):
    """
    Abstract base for all Aetheris agents.

    Subclasses MUST declare:
        agent_id  = "unique_agent_name"
        namespace = "memory_namespace"   # never shared across agents

    Subclasses MUST implement:
        async def run(context: AgentContext) -> AsyncGenerator[Dict, None]
    """

    agent_id:  str = "base"
    namespace: str = "base"

    def __init__(self, session_id: str):
        self.session_id = session_id
        self._log       = logging.getLogger(f"aetheris.agent.{self.agent_id}")

    # ─── Memory (isolated to namespace) ──────────────────────────────────────

    def get_history(self, last_n: int = 10) -> List[Dict]:
        """Retrieve agent-scoped message history."""
        try:
            from memory.session_memory import session_memory
            return session_memory.get_messages(self.session_id, namespace=self.namespace, last_n=last_n)
        except Exception as exc:
            self._log.warning("get_history failed: %s", exc)
            return []

    def save_turn(self, user_msg: str, assistant_msg: str) -> None:
        """Persist a user+assistant turn to agent-scoped memory."""
        try:
            from memory.session_memory import session_memory
            session_memory.add_message(self.session_id, "user",      user_msg,      namespace=self.namespace)
            session_memory.add_message(self.session_id, "assistant", assistant_msg, namespace=self.namespace)
        except Exception as exc:
            self._log.warning("save_turn failed: %s", exc)

    def clear_memory(self) -> None:
        """Clear this agent's memory for this session."""
        try:
            from memory.session_memory import session_memory
            session_memory.clear(self.session_id, namespace=self.namespace)
        except Exception:
            pass

    # ─── Abstract interface ───────────────────────────────────────────────────

    @abstractmethod
    async def run(
        self,
        context: AgentContext,
    ) -> AsyncGenerator[Dict, None]:
        """
        Execute the agent and yield event dicts.
        Events follow the same shape as orchestrator events:
          {"event": "stream_token",  "token": str}
          {"event": "agent_result",  "agent": str, "answer": str, ...}
          {"event": "agent_error",   "agent": str, "error": str}
          {"event": "done"}
        """
        ...

    # ─── Utilities ───────────────────────────────────────────────────────────

    def _result_event(self, answer: str, sources: Optional[List] = None, **extra) -> Dict:
        return {
            "event":   "agent_result",
            "agent":   self.agent_id,
            "answer":  answer,
            "sources": sources or [],
            **extra,
        }

    def _error_event(self, error: str) -> Dict:
        return {"event": "agent_error", "agent": self.agent_id, "error": error}

    def _token_event(self, token: str) -> Dict:
        return {"event": "stream_token", "token": token}

    def _done_event(self) -> Dict:
        return {"event": "done"}
