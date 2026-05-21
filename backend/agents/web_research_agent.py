"""
Aetheris OS — Web Research Agent
Performs real-time web search using Tavily API.
"""
from typing import Dict, List, Optional
import httpx
from app_config import settings


async def web_search(query: str, max_results: int = 5) -> Dict:
    """
    Search the web using Tavily and return structured results.
    Falls back to an empty result if Tavily key is not configured.
    """
    if not settings.TAVILY_API_KEY:
        return {
            "results": [],
            "query": query,
            "status": "skipped",
            "message": "Tavily API key not configured.",
        }

    payload = {
        "api_key": settings.TAVILY_API_KEY,
        "query": query,
        "search_depth": "advanced",
        "max_results": max_results,
        "include_answer": True,
        "include_raw_content": False,
    }

    print(f"[WebResearch] Searching: {query!r}")

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post("https://api.tavily.com/search", json=payload)
        if not resp.is_success:
            return {
                "results": [],
                "query": query,
                "status": "error",
                "message": f"Tavily error {resp.status_code}: {resp.text[:200]}",
            }
        data = resp.json()
        return {
            "results": data.get("results", []),
            "answer": data.get("answer", ""),
            "query": query,
            "status": "complete",
        }
    except Exception as exc:
        return {
            "results": [],
            "query": query,
            "status": "error",
            "message": str(exc),
        }
