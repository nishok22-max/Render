"""
Aetheris OS — Planner Agent (Sprint 3)

Multi-step goal decomposition and plan execution engine.
Breaks complex user intents into ordered steps, executes each,
and synthesises a final coherent response.

Used for:
  - Multi-document analysis (read doc A + B, compare them)
  - Research + RAG hybrid queries ("search the web AND check my files")
  - Complex data workflows
"""
from __future__ import annotations

import asyncio
import logging
from typing import AsyncGenerator, Dict, List, Optional

from agents.base_agent import BaseAgent, AgentContext, AgentResult

logger = logging.getLogger("aetheris.planner")


# ─── Plan step types ──────────────────────────────────────────────────────────

STEP_TYPES = {
    "web_search":    "Search the web for current information",
    "rag_lookup":    "Search uploaded documents in the knowledge base",
    "code_generate": "Write or analyse code",
    "summarise":     "Summarise or synthesise gathered information",
    "compare":       "Compare two or more pieces of information",
    "reason":        "Apply logical reasoning or calculation",
}


# ─── Plan extraction ──────────────────────────────────────────────────────────

async def _build_plan(goal: str, max_steps: int = 4) -> List[Dict]:
    """
    Use LLM to decompose a complex goal into concrete steps.
    Returns a list of {step, type, instruction} dicts.
    """
    try:
        from services.llm_service import generate
        prompt = (
            f"You are a task planner. Break this goal into at most {max_steps} concrete, ordered steps.\n\n"
            f"Goal: {goal}\n\n"
            "Available step types: web_search, rag_lookup, code_generate, summarise, compare, reason\n\n"
            "Return a JSON array of steps. Example:\n"
            '[{"step": 1, "type": "web_search", "instruction": "Search for recent AI regulation news"},\n'
            ' {"step": 2, "type": "rag_lookup", "instruction": "Find relevant sections in the uploaded policy document"},\n'
            ' {"step": 3, "type": "summarise", "instruction": "Compare the web findings with the document"}]\n\n'
            "Return ONLY the JSON array, no markdown fences."
        )
        raw = await asyncio.wait_for(
            generate(prompt, system_instruction="You are a precise task planner. Return only valid JSON.", temperature=0.1, max_tokens=512),
            timeout=10.0,
        )
        import json, re
        match = re.search(r"\[.*\]", raw, re.DOTALL)
        if match:
            steps = json.loads(match.group())
            return steps[:max_steps]
    except Exception as exc:
        logger.warning("[PlannerAgent] Plan build failed: %s", exc)

    # Fallback: single-step plan
    return [{"step": 1, "type": "reason", "instruction": goal}]


# ─── Step executor ────────────────────────────────────────────────────────────

async def _execute_step(
    step:       Dict,
    context:    AgentContext,
    prior_text: str,
) -> str:
    """Execute a single plan step and return its result as text."""
    stype   = step.get("type", "reason")
    instr   = step.get("instruction", context.message)

    if stype == "web_search":
        try:
            from agents.web_research_agent import web_search
            sr      = await asyncio.wait_for(web_search(instr, max_results=5), timeout=12.0)
            answer  = sr.get("answer", "")
            snippets = "\n".join(
                f"[{r.get('title')}] {r.get('content', '')[:300]}"
                for r in sr.get("results", [])[:3]
            )
            return f"WEB SEARCH RESULT for '{instr}':\n{answer}\n\nSources:\n{snippets}"
        except Exception as exc:
            return f"[Web search failed: {exc}]"

    elif stype == "rag_lookup":
        try:
            from rag.hybrid_retriever import retrieve_for_query
            result = await retrieve_for_query(instr, top_k=5)
            return f"DOCUMENT LOOKUP for '{instr}':\n{result.get('context', 'No relevant content found.')}"
        except Exception as exc:
            return f"[RAG lookup failed: {exc}]"

    elif stype in ("summarise", "compare", "reason", "code_generate"):
        try:
            from services.llm_service import generate
            sysprompt = {
                "summarise":     "Summarise and synthesise the provided information clearly.",
                "compare":       "Compare the provided information and identify key differences and similarities.",
                "reason":        "Apply careful logical reasoning to answer the question.",
                "code_generate": "Write clean, well-commented code to solve the given task.",
            }.get(stype, "Think step by step and provide a clear answer.")

            prompt = (
                f"Task: {instr}\n\n"
                + (f"Context from previous steps:\n{prior_text[:2000]}\n\n" if prior_text else "")
                + "Provide a clear, complete response."
            )
            return await generate(prompt, system_instruction=sysprompt, temperature=0.3, max_tokens=1024)
        except Exception as exc:
            return f"[Reasoning step failed: {exc}]"

    return f"[Unknown step type: {stype}]"


# ─── Planner Agent ────────────────────────────────────────────────────────────

class PlannerAgent(BaseAgent):
    """
    Multi-step planner that decomposes complex goals and executes sequentially.
    """
    agent_id  = "planner"
    namespace = "planner"

    async def run(self, context: AgentContext) -> AsyncGenerator[Dict, None]:
        yield self._token_event("🔍 Planning approach...\n\n")

        # Build plan
        plan = await _build_plan(context.message)
        yield self._token_event(f"**Plan:** {len(plan)} steps\n\n")

        step_results: List[str] = []
        prior_text = ""

        for step in plan:
            step_num  = step.get("step", "?")
            step_type = step.get("type", "reason")
            instr     = step.get("instruction", "")

            yield self._token_event(f"**Step {step_num}** ({step_type}): {instr}\n")

            result = await _execute_step(step, context, prior_text)
            step_results.append(f"Step {step_num} ({step_type}):\n{result}")
            prior_text += f"\n\n{result}"

            yield self._token_event(f"✓ Done\n\n")

        # Final synthesis
        yield self._token_event("**Synthesising results...**\n\n")
        try:
            from services.llm_service import generate
            synthesis_prompt = (
                f"Original goal: {context.message}\n\n"
                f"Results from {len(plan)} research steps:\n\n"
                + "\n\n---\n\n".join(step_results)
                + "\n\n---\n\nSynthesize all findings into a single, coherent, and complete answer to the original goal."
            )
            final = await generate(
                synthesis_prompt,
                system_instruction="You are an expert synthesiser. Combine all research findings into a clear, structured, definitive answer.",
                temperature=0.4,
                max_tokens=2000,
            )
            from utils.response_refiner import refine
            yield self._token_event(refine(final))
        except Exception as exc:
            yield self._error_event(f"Final synthesis failed: {exc}")
            return

        yield self._done_event()
