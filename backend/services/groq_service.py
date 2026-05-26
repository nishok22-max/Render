"""
ThinkSync OS — Groq Service
Fast inference via Groq API for text generation (Llama, Mixtral, etc.)
Used as a fallback/supplementary model when Gemini is unavailable.
"""
import json
from typing import AsyncGenerator, Optional

import httpx
from app_config import settings

GROQ_API_BASE = "https://api.groq.com/openai/v1"
DEFAULT_MODEL = "llama-3.3-70b-versatile"


async def generate(
    prompt: str,
    system_instruction: Optional[str] = None,
    model_name: str = DEFAULT_MODEL,
    temperature: float = 0.7,
    max_tokens: int = 2048,
) -> str:
    """Generate a completion via Groq (non-streaming)."""
    api_key = settings.GROQ_API_KEY
    if not api_key:
        raise ValueError("GROQ_API_KEY is not set.")

    messages = []
    if system_instruction:
        messages.append({"role": "system", "content": system_instruction})
    messages.append({"role": "user", "content": prompt})

    payload = {
        "model": model_name,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
    }

    print(f"[Groq] generate - model={model_name}, prompt_len={len(prompt)}")

    async with httpx.AsyncClient(timeout=60.0) as client:
        resp = await client.post(
            f"{GROQ_API_BASE}/chat/completions",
            headers={"Authorization": f"Bearer {api_key}"},
            json=payload,
        )

    if not resp.is_success:
        raise RuntimeError(f"Groq API error {resp.status_code}: {resp.text[:200]}")

    data = resp.json()
    return data["choices"][0]["message"]["content"]


async def generate_stream(
    prompt: str,
    system_instruction: Optional[str] = None,
    model_name: str = DEFAULT_MODEL,
    temperature: float = 0.7,
    max_tokens: int = 2048,
) -> AsyncGenerator[str, None]:
    """Stream a completion via Groq (SSE)."""
    api_key = settings.GROQ_API_KEY
    if not api_key:
        raise ValueError("GROQ_API_KEY is not set.")

    messages = []
    if system_instruction:
        messages.append({"role": "system", "content": system_instruction})
    messages.append({"role": "user", "content": prompt})

    payload = {
        "model": model_name,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
        "stream": True,
    }

    async with httpx.AsyncClient(timeout=120.0) as client:
        async with client.stream(
            "POST",
            f"{GROQ_API_BASE}/chat/completions",
            headers={"Authorization": f"Bearer {api_key}"},
            json=payload,
        ) as resp:
            if not resp.is_success:
                body = await resp.aread()
                raise RuntimeError(f"Groq stream error {resp.status_code}: {body[:200]}")

            async for line in resp.aiter_lines():
                if line.startswith("data: "):
                    raw = line[6:]
                    if raw.strip() == "[DONE]":
                        break
                    try:
                        chunk = json.loads(raw)
                        delta = chunk["choices"][0]["delta"].get("content", "")
                        if delta:
                            yield delta
                    except (KeyError, json.JSONDecodeError):
                        continue
