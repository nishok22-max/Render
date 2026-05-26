"""
ThinkSync OS — Deep Research Agent (Sprint 4 — Real Streaming)

UPGRADES:
  - asyncio.wait(timeout=15s) for parallel searches — slow searches no longer block synthesis
  - deep_research_stream() yields synthesis tokens in real-time (true streaming)
  - deep_research() preserved for non-streaming callers
"""
from __future__ import annotations

import asyncio
import logging
from typing import AsyncGenerator, Dict, List

from agents.web_research_agent import web_search
from services.llm_service import generate, generate_chat_stream

logger = logging.getLogger("thinksync.deep_research")


# ─── System prompts ───────────────────────────────────────────────────────────

_DECOMPOSE_SYSTEM = """You are a senior research strategist. Deconstruct a complex topic into precise, \
non-overlapping research angles that together build a complete intellectual picture.

Each sub-question should:
- Target a distinct facet of the topic (technical, economic, societal, future-facing, etc.)
- Be specific enough to yield focused search results
- Together form a coherent research arc

Return ONLY a numbered list of sub-questions. No commentary, no preamble."""


_SYNTHESIS_SYSTEM = """You are a senior editorial research analyst writing for a premium technology publication — \
think MIT Technology Review, The Economist's technology desk, or a flagship AI research journal.

## VOICE & TONE
Write with the authority of an expert and the clarity of a great journalist. Your prose should feel:
- Intelligent but never arrogant
- Technically grounded but never impenetrable
- Forward-looking but never speculative without evidence
- Analytical but always readable

Avoid corporate jargon, AI clichés, and hollow superlatives. Every sentence should earn its place.

## STRUCTURE
Open with a compelling framing paragraph that contextualises WHY this topic matters right now.
Use **bold markdown headings** to organise sections. Each section should advance understanding.
Close with a forward-looking synthesis identifying key tensions or implications.

## WRITING RULES
1. Flowing, varied prose. No bullet-point dumping.
2. Vary sentence length — mix short punchy sentences with longer analytical ones.
3. Concrete examples over abstract generalisations.
4. Cite sources inline as [1], [2], etc. — naturally woven in.
5. When sources conflict, say so and analyse the tension.
6. Avoid: "It is worth noting", "In conclusion", "To summarise", "Certainly", "Leveraging".
7. Never begin with the research topic restated as the first sentence.
8. NEVER mention search results, pipelines, embeddings, or internal system details.
9. Target 700–1200 words of substantive analysis.

## FORMATTING
- Use ## for major section headings (2–4 sections max)
- Use **bold** for key terms or pivotal claims (sparingly)
- Use > blockquote for a particularly sharp insight
- Paragraphs: 3–6 sentences."""


# ─── Sub-query decomposition ──────────────────────────────────────────────────

async def _decompose(query: str, depth: int) -> List[str]:
    """Break query into focused research sub-queries."""
    if depth <= 1:
        return [query]
    try:
        prompt = (
            f"Deconstruct this research topic into exactly {depth} specific, non-overlapping "
            f"sub-questions that together provide comprehensive coverage.\n\n"
            f"Topic: {query}\n\n"
            f"Return ONLY a numbered list of sub-questions, one per line."
        )
        raw = await generate(
            prompt,
            system_instruction=_DECOMPOSE_SYSTEM,
            temperature=0.25,
            max_tokens=512,
        )
        sub_queries = []
        for line in raw.strip().splitlines():
            line = line.strip().lstrip("0123456789.)- ").strip()
            if line:
                sub_queries.append(line)
        return sub_queries[:depth] if sub_queries else [query]
    except Exception:
        return [query]


# ─── Parallel web search with timeout ────────────────────────────────────────

async def _parallel_search(
    sub_queries:   List[str],
    sources_limit: int,
) -> tuple[List[str], List[Dict]]:
    """
    Run parallel web searches with a 15s timeout.
    Slow searches are cancelled — synthesis proceeds with what's available.
    Returns (snippets, citations).
    """
    results_per_sq = max(3, sources_limit // len(sub_queries))
    tasks = [asyncio.create_task(web_search(sq, max_results=results_per_sq)) for sq in sub_queries]

    # Wait with timeout — don't let one slow search block everything
    done, pending = await asyncio.wait(tasks, timeout=15.0)
    for t in pending:
        t.cancel()
        logger.warning("[DeepResearch] Search task timed out and was cancelled")

    all_snippets:  List[str]  = []
    all_citations: List[Dict] = []
    web_answers:   List[str]  = []

    for sq, task in zip(sub_queries, tasks):
        if task not in done or task.cancelled():
            continue
        try:
            sr = task.result()
        except Exception:
            continue

        answer = sr.get("answer", "")
        if answer:
            web_answers.append(f"[Re: {sq}] {answer}")

        cap = max(2, sources_limit // max(1, len(sub_queries)))
        for r in sr.get("results", [])[:cap]:
            title   = r.get("title", "Untitled")
            url     = r.get("url", "")
            content = r.get("content", "")[:600]
            idx     = len(all_snippets) + 1
            all_snippets.append(f"[{idx}] {title}\nURL: {url}\n{content}")
            all_citations.append({"title": title, "url": url})

    return all_snippets, all_citations, web_answers


# ─── Build synthesis prompt ───────────────────────────────────────────────────

def _build_synthesis_prompt(
    query:        str,
    sub_queries:  List[str],
    snippets:     List[str],
    web_answers:  List[str],
) -> str:
    context     = "\n\n---\n\n".join(snippets) if snippets else "No web results available."
    web_summary = "\n".join(web_answers) if web_answers else "(none)"

    return f"""Research topic: {query}

Research angles explored:
{chr(10).join(f"- {sq}" for sq in sub_queries)}

Direct web answers gathered:
{web_summary}

Source material:
{context}

---

Write a premium, editorial-quality research report on: "{query}"

Draw on the source material above to write an intelligent, analytically deep, and beautifully \
structured article. Synthesise — do not summarise sources one by one. \
Cite sources inline as [1], [2], etc. Aim for 700–1100 words.

Begin immediately with your opening paragraph — no title, no preamble."""


# ─── Streaming API (new — Sprint 4) ──────────────────────────────────────────

async def deep_research_stream(
    query:         str,
    depth:         int = 3,
    sources_limit: int = 8,
) -> AsyncGenerator[Dict, None]:
    """
    Full research pipeline that yields real-time token events.
    Use this from routes/research.py for true streaming.

    Yields dicts:
        {"type": "sub_queries",   "sub_queries": [...]}
        {"type": "sources",       "sources": [...], "total": int}
        {"type": "synthesis_start"}
        {"type": "token",         "content": str}         ← real LLM tokens
        {"type": "done",          "confidence": float, "total_sources": int}
    """
    # Step 1: Decompose
    sub_queries = await _decompose(query, depth)
    yield {"type": "sub_queries", "sub_queries": sub_queries}

    # Step 2: Parallel search with timeout
    snippets, citations, web_answers = await _parallel_search(sub_queries, sources_limit)
    sources = [{"title": c["title"], "url": c["url"], "snippet": ""} for c in citations]
    confidence = round(min(0.95, 0.5 + (len(citations) / max(1, sources_limit)) * 0.45), 2)

    yield {"type": "sources", "sources": sources, "total": len(citations)}

    # Step 3: Real-time synthesis streaming
    yield {"type": "synthesis_start"}

    prompt = _build_synthesis_prompt(query, sub_queries, snippets, web_answers)
    full_report = ""

    try:
        async for token in generate_chat_stream(
            messages=[{"role": "user", "content": prompt}],
            system_instruction=_SYNTHESIS_SYSTEM,
            temperature=0.55,
            max_tokens=3500,
        ):
            full_report += token
            yield {"type": "token", "content": token}
    except Exception as exc:
        logger.error("[DeepResearch/stream] Synthesis failed: %s", exc)
        # Fallback to batch
        try:
            full_report = await generate(prompt, system_instruction=_SYNTHESIS_SYSTEM, temperature=0.55, max_tokens=3500)
            yield {"type": "token", "content": full_report}
        except Exception as exc2:
            logger.error("[DeepResearch/stream] Fallback also failed: %s", exc2)
            full_report = "Research synthesis failed. Please try again."
            yield {"type": "token", "content": full_report}

    yield {
        "type":          "done",
        "report":        full_report,
        "citations":     citations,
        "sources":       sources,
        "sub_queries":   sub_queries,
        "confidence":    confidence,
        "total_sources": len(citations),
    }


# ─── Non-streaming API (preserved for backward compat) ───────────────────────

async def deep_research(query: str, depth: int = 3, sources_limit: int = 8) -> Dict:
    """
    Multi-step research pipeline (non-streaming batch version).
    Used by quick_research endpoint and fallback paths.
    """
    sub_queries = await _decompose(query, depth)
    snippets, citations, web_answers = await _parallel_search(sub_queries, sources_limit)
    confidence = round(min(0.95, 0.5 + (len(citations) / max(1, sources_limit)) * 0.45), 2)

    prompt = _build_synthesis_prompt(query, sub_queries, snippets, web_answers)
    report = await generate(prompt, system_instruction=_SYNTHESIS_SYSTEM, temperature=0.55, max_tokens=3500)

    return {
        "report":        report,
        "citations":     citations,
        "sources":       [{"title": c["title"], "url": c["url"], "snippet": ""} for c in citations],
        "sub_queries":   sub_queries,
        "confidence":    confidence,
        "total_sources": len(citations),
        "query":         query,
        "agent":         "deep_research",
        "status":        "complete",
    }
