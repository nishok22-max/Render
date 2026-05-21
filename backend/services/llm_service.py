"""
Aetheris OS — LLM Service
Primary: AWS Bedrock — moonshotai.kimi-k2.5
Fallback: Google Gemini (generativelanguage.googleapis.com)

All inference calls in the platform route through this module.
Never call Gemini directly from routes or agents.
"""
from __future__ import annotations

import asyncio
import base64
import json
import logging
import struct
import os
from typing import AsyncGenerator, Optional

import httpx
from app_config import settings

logger = logging.getLogger("aetheris.llm")

# ─── Bedrock constants ────────────────────────────────────────────────────────

BEDROCK_MODEL_ID   = settings.BEDROCK_MODEL_ID          # moonshotai.kimi-k2.5
BEDROCK_REGION     = settings.AWS_REGION                 # eu-north-1
BEDROCK_RUNTIME_EP = (
    f"https://bedrock-runtime.{BEDROCK_REGION}.amazonaws.com"
)

# ─── Gemini fallback constants ────────────────────────────────────────────────

GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models"
GEMINI_FALLBACK_ORDER = [
    "gemini-2.5-flash",
    "gemini-2.0-flash",
    "gemini-1.5-flash",
]

# Kept for backward-compat with routes that pass model_name=
DEFAULT_TEXT_MODEL = BEDROCK_MODEL_ID

# ─── AWS Signature v4 (pure-Python, no botocore dependency at import) ─────────

def _sign_bedrock_request(
    method: str,
    path: str,
    payload_bytes: bytes,
    content_type: str = "application/json",
) -> dict[str, str]:
    """
    Build AWS Signature Version 4 headers for a Bedrock Runtime request.
    Uses only stdlib — no botocore required at sign time.
    """
    import hashlib
    import hmac
    from datetime import datetime, timezone

    access_key = settings.AWS_ACCESS_KEY_ID
    secret_key = settings.AWS_SECRET_ACCESS_KEY
    region     = BEDROCK_REGION
    service    = "bedrock"

    now        = datetime.now(timezone.utc)
    amzdate    = now.strftime("%Y%m%dT%H%M%SZ")
    datestamp  = now.strftime("%Y%m%d")

    host = f"bedrock-runtime.{region}.amazonaws.com"

    payload_hash = hashlib.sha256(payload_bytes).hexdigest()

    canonical_headers = (
        f"content-type:{content_type}\n"
        f"host:{host}\n"
        f"x-amz-content-sha256:{payload_hash}\n"
        f"x-amz-date:{amzdate}\n"
    )
    signed_headers = "content-type;host;x-amz-content-sha256;x-amz-date"

    canonical_request = "\n".join([
        method,
        path,
        "",                   # no query string
        canonical_headers,
        signed_headers,
        payload_hash,
    ])

    credential_scope = f"{datestamp}/{region}/{service}/aws4_request"
    string_to_sign = "\n".join([
        "AWS4-HMAC-SHA256",
        amzdate,
        credential_scope,
        hashlib.sha256(canonical_request.encode()).hexdigest(),
    ])

    def _hmac(key: bytes, msg: str) -> bytes:
        return hmac.new(key, msg.encode(), hashlib.sha256).digest()

    signing_key = _hmac(
        _hmac(
            _hmac(
                _hmac(f"AWS4{secret_key}".encode(), datestamp),
                region,
            ),
            service,
        ),
        "aws4_request",
    )
    signature = hmac.new(signing_key, string_to_sign.encode(), hashlib.sha256).hexdigest()

    auth_header = (
        f"AWS4-HMAC-SHA256 "
        f"Credential={access_key}/{credential_scope}, "
        f"SignedHeaders={signed_headers}, "
        f"Signature={signature}"
    )

    return {
        "Authorization":        auth_header,
        "Content-Type":         content_type,
        "x-amz-date":           amzdate,
        "x-amz-content-sha256": payload_hash,
    }


# ─── Bedrock payload builders (Converse API) ──────────────────────────────────

def _bedrock_text_payload(
    prompt: str,
    system: Optional[str] = None,
    temperature: float = 0.7,
    max_tokens: int = 4096,
) -> dict:
    """Build a Bedrock Converse API payload for text."""
    body: dict = {
        "messages": [{"role": "user", "content": [{"text": prompt}]}],
        "inferenceConfig": {
            "temperature": temperature,
            "maxTokens":   max_tokens,
        },
    }
    if system:
        body["system"] = [{"text": system}]
    return body


def _bedrock_chat_payload(
    messages: list[dict],
    system: Optional[str] = None,
    temperature: float = 0.7,
    max_tokens: int = 4096,
) -> dict:
    """
    Build a Bedrock Converse API payload from a structured messages[] array.
    Each message: {"role": "user"|"assistant", "content": str}
    This preserves multi-turn conversation structure instead of flattening to a single prompt.
    """
    converse_messages = []
    for msg in messages:
        role = msg.get("role", "user")
        text = msg.get("content", "")
        if text and role in ("user", "assistant"):
            converse_messages.append({"role": role, "content": [{"text": text}]})

    # Ensure messages alternate correctly and end with user
    if not converse_messages:
        converse_messages = [{"role": "user", "content": [{"text": "Hello"}]}]

    body: dict = {
        "messages": converse_messages,
        "inferenceConfig": {
            "temperature": temperature,
            "maxTokens":   max_tokens,
        },
    }
    if system:
        body["system"] = [{"text": system}]
    return body


def _bedrock_vision_payload(
    image_data: bytes,
    prompt: str,
    mime_type: str = "image/png",
    system: Optional[str] = None,
    max_tokens: int = 4096,
) -> dict:
    """Build a Bedrock Converse API payload for vision (image + text)."""
    fmt = mime_type.split("/")[-1].lower()
    if fmt == "jpg":
        fmt = "jpeg"

    body: dict = {
        "messages": [
            {
                "role": "user",
                "content": [
                    {
                        "image": {
                            "format": fmt,
                            "source": {
                                "bytes": base64.b64encode(image_data).decode()
                            },
                        }
                    },
                    {"text": prompt},
                ],
            }
        ],
        "inferenceConfig": {"maxTokens": max_tokens, "temperature": 0.2},
    }
    if system:
        body["system"] = [{"text": system}]
    return body


# ─── Singleton Bedrock HTTP clients (pooled, not per-request) ─────────────────

_bedrock_client: Optional[httpx.AsyncClient] = None
_bedrock_stream_client: Optional[httpx.AsyncClient] = None


def _get_bedrock_client() -> httpx.AsyncClient:
    """Return (or lazily create) a persistent client for non-streaming Bedrock calls."""
    global _bedrock_client
    if _bedrock_client is None or _bedrock_client.is_closed:
        _bedrock_client = httpx.AsyncClient(
            timeout=httpx.Timeout(30.0, connect=10.0),
            limits=httpx.Limits(
                max_connections=20,
                max_keepalive_connections=10,
                keepalive_expiry=120.0,
            ),
            http2=True,
        )
    return _bedrock_client


def _get_bedrock_stream_client() -> httpx.AsyncClient:
    """Return (or lazily create) a persistent client for Bedrock streaming calls."""
    global _bedrock_stream_client
    if _bedrock_stream_client is None or _bedrock_stream_client.is_closed:
        _bedrock_stream_client = httpx.AsyncClient(
            timeout=httpx.Timeout(120.0, connect=10.0),
            limits=httpx.Limits(
                max_connections=10,
                max_keepalive_connections=5,
                keepalive_expiry=120.0,
            ),
            http2=True,
        )
    return _bedrock_stream_client


async def close_bedrock_clients():
    """Gracefully close shared Bedrock HTTP clients (call on shutdown)."""
    global _bedrock_client, _bedrock_stream_client
    for client in (_bedrock_client, _bedrock_stream_client):
        if client and not client.is_closed:
            await client.aclose()
    _bedrock_client = None
    _bedrock_stream_client = None


# ─── Bedrock caller ───────────────────────────────────────────────────────────

async def _bedrock_invoke(payload: dict, stream: bool = False) -> str | None:
    """
    Call Bedrock Converse and return the full text.
    Returns None on any failure (caller tries Gemini fallback).
    Uses pooled singleton client — no TCP handshake per call.
    """
    if not (settings.AWS_ACCESS_KEY_ID and settings.AWS_SECRET_ACCESS_KEY):
        logger.warning("[Bedrock] AWS credentials not configured — skipping.")
        return None

    path       = f"/model/{BEDROCK_MODEL_ID}/converse"
    url        = BEDROCK_RUNTIME_EP + path
    body_bytes = json.dumps(payload).encode()
    headers    = _sign_bedrock_request("POST", path, body_bytes)

    try:
        client = _get_bedrock_client()
        resp   = await client.post(url, content=body_bytes, headers=headers)

        if not resp.is_success:
            logger.warning(
                "[Bedrock] %s converse — %s", resp.status_code, resp.text[:400]
            )
            return None

        data = resp.json()
        try:
            return data["output"]["message"]["content"][0]["text"]
        except (KeyError, IndexError):
            logger.warning("[Bedrock] Unexpected response shape: %s", str(data)[:300])
            return None

    except Exception as exc:
        logger.warning("[Bedrock] Request failed: %s", exc)
        return None


# ─── Bedrock streaming — FIX BUG-04 ──────────────────────────────────────────
#
# Bedrock ConverseStream uses the AWS Event Stream binary protocol, NOT
# newline-delimited JSON. Each frame is:
#   [total_len 4B][headers_len 4B][prelude_crc 4B][headers bytes][payload bytes][msg_crc 4B]
#
# The payload is a JSON object containing the event type and data. We parse the
# binary frames correctly here, replacing the broken line-split approach.

def _parse_event_stream_frames(raw: bytes) -> tuple[list[dict], int]:
    """
    Parse AWS binary Event Stream frames from a byte buffer.
    Returns (list_of_parsed_events, bytes_consumed).
    """
    events = []
    offset = 0
    while offset + 12 <= len(raw):
        total_len   = struct.unpack_from(">I", raw, offset)[0]
        headers_len = struct.unpack_from(">I", raw, offset + 4)[0]

        if offset + total_len > len(raw):
            break  # incomplete frame, wait for more data

        payload_start = offset + 12 + headers_len
        payload_end   = offset + total_len - 4

        if payload_start < payload_end:
            try:
                payload_bytes = raw[payload_start:payload_end]
                event = json.loads(payload_bytes)
                events.append(event)
            except (json.JSONDecodeError, UnicodeDecodeError):
                pass

        offset += total_len

    return events, offset


async def _bedrock_stream(payload: dict) -> AsyncGenerator[str, None]:
    """
    Call Bedrock ConverseStream, parse the AWS binary event-stream protocol,
    and yield text chunks.
    Falls through (yields nothing) on any failure so caller can use Gemini.
    Uses pooled singleton client — no TCP handshake per stream request.
    """
    if not (settings.AWS_ACCESS_KEY_ID and settings.AWS_SECRET_ACCESS_KEY):
        return

    path       = f"/model/{BEDROCK_MODEL_ID}/converse-stream"
    url        = BEDROCK_RUNTIME_EP + path
    body_bytes = json.dumps(payload).encode()
    headers    = _sign_bedrock_request("POST", path, body_bytes)

    yielded_any = False
    try:
        client = _get_bedrock_stream_client()
        async with client.stream("POST", url, content=body_bytes, headers=headers) as resp:
            if not resp.is_success:
                body = await resp.aread()
                logger.warning(
                    "[Bedrock/stream] %s — %s", resp.status_code, body[:300]
                )
                return

            buffer = b""
            async for chunk in resp.aiter_bytes():
                buffer += chunk
                events, consumed = _parse_event_stream_frames(buffer)
                buffer = buffer[consumed:]

                for event in events:
                    text = (
                        event.get("contentBlockDelta", {})
                             .get("delta", {})
                             .get("text", "")
                    )
                    if text:
                        yield text
                        yielded_any = True

    except Exception as exc:
        logger.warning("[Bedrock/stream] Exception: %s", exc)
        return

    if yielded_any:
        return


# ─── Gemini helpers (fallback) ────────────────────────────────────────────────

def _gemini_text_payload(
    prompt: str,
    system: Optional[str] = None,
    temperature: float = 0.7,
    max_tokens: int = 4096,
) -> dict:
    payload: dict = {
        "contents": [{"role": "user", "parts": [{"text": prompt}]}],
        "generationConfig": {"temperature": temperature, "maxOutputTokens": max_tokens},
    }
    if system:
        payload["systemInstruction"] = {"parts": [{"text": system}]}
    return payload


def _gemini_chat_payload(
    messages: list[dict],
    system: Optional[str] = None,
    temperature: float = 0.7,
    max_tokens: int = 4096,
) -> dict:
    """Build a Gemini payload from structured messages[] for multi-turn."""
    contents = []
    for msg in messages:
        role = "user" if msg.get("role") == "user" else "model"
        text = msg.get("content", "")
        if text:
            contents.append({"role": role, "parts": [{"text": text}]})
    if not contents:
        contents = [{"role": "user", "parts": [{"text": "Hello"}]}]
    payload: dict = {
        "contents": contents,
        "generationConfig": {"temperature": temperature, "maxOutputTokens": max_tokens},
    }
    if system:
        payload["systemInstruction"] = {"parts": [{"text": system}]}
    return payload


def _gemini_vision_payload(
    image_data: bytes,
    prompt: str,
    mime_type: str = "image/png",
    system: Optional[str] = None,
) -> dict:
    payload: dict = {
        "contents": [
            {
                "role": "user",
                "parts": [
                    {"text": prompt},
                    {
                        "inline_data": {
                            "mime_type": mime_type,
                            "data": base64.b64encode(image_data).decode(),
                        }
                    },
                ],
            }
        ],
        "generationConfig": {"temperature": 0.2, "maxOutputTokens": 4096},
    }
    if system:
        payload["systemInstruction"] = {"parts": [{"text": system}]}
    return payload


async def _gemini_generate(payload: dict) -> str:
    """Try each Gemini model in fallback order. Raises if all fail."""
    api_key = settings.GEMINI_API_KEY
    if not api_key:
        raise RuntimeError("Gemini API key not set — all models failed.")
    for model in GEMINI_FALLBACK_ORDER:
        url = f"{GEMINI_BASE}/{model}:generateContent"
        logger.info("[Gemini/fallback] Trying %s", model)
        async with httpx.AsyncClient(timeout=120.0) as client:
            resp = await client.post(url, json=payload, headers={"x-goog-api-key": api_key})
        if resp.is_success:
            data = resp.json()
            try:
                return data["candidates"][0]["content"]["parts"][0]["text"]
            except (KeyError, IndexError) as exc:
                raise RuntimeError(f"Unexpected Gemini response: {data}") from exc
        logger.warning("[Gemini/fallback] %s — %s %s", model, resp.status_code, resp.text[:200])
    raise RuntimeError("All Gemini fallback models failed.")


async def _gemini_stream(payload: dict) -> AsyncGenerator[str, None]:
    """Stream from Gemini fallback models, yield text chunks."""
    api_key = settings.GEMINI_API_KEY
    if not api_key:
        raise RuntimeError("Gemini API key not set.")
    for model in GEMINI_FALLBACK_ORDER:
        url = f"{GEMINI_BASE}/{model}:streamGenerateContent?alt=sse"
        logger.info("[Gemini/fallback-stream] Trying %s", model)
        async with httpx.AsyncClient(timeout=180.0) as client:
            async with client.stream("POST", url, json=payload, headers={"x-goog-api-key": api_key}) as resp:
                if resp.is_success:
                    yielded_any = False
                    async for line in resp.aiter_lines():
                        if line.startswith("data: "):
                            raw = line[6:]
                            if raw.strip() == "[DONE]":
                                return
                            try:
                                chunk = json.loads(raw)
                                text  = chunk["candidates"][0]["content"]["parts"][0]["text"]
                                yield text
                                yielded_any = True
                            except (KeyError, IndexError, json.JSONDecodeError):
                                continue
                    if yielded_any:
                        return
                else:
                    body = await resp.aread()
                    logger.warning("[Gemini/fallback-stream] %s — %s", model, body[:200])
    raise RuntimeError("All Gemini streaming models failed.")


# ─────────────────────────────────────────────────────────────────────────────
#  Public API — all agents / routes call ONLY these functions
# ─────────────────────────────────────────────────────────────────────────────

AETHERIS_SYSTEM = (
    "You are ThinkSync, a smart and friendly AI assistant. "
    "You help users with conversations, reasoning, tasks, and general questions. "
    "Be natural, clear, and easy to understand. "
    "Use Markdown formatting when helpful. "
    "Keep your responses concise but thorough. "
    "Speak in a warm, human-like tone — avoid technical jargon unless the user asks for it. "
    "Focus on being helpful, accurate, and conversational."
)


async def generate(
    prompt: str,
    system_instruction: Optional[str] = None,
    model_name: str = BEDROCK_MODEL_ID,   # kept for API compat, Bedrock is always tried first
    temperature: float = 0.7,
    max_tokens: int = 4096,
) -> str:
    """
    Generate a text response.
    1. Try Bedrock / Kimi K2.5
    2. Fall back to Gemini if Bedrock fails
    """
    system = system_instruction or AETHERIS_SYSTEM

    # ── Primary: Bedrock ──────────────────────────────────────────────────────
    logger.info("[LLM] generate — primary=Bedrock, prompt_len=%d", len(prompt))
    payload = _bedrock_text_payload(prompt, system, temperature, max_tokens)
    result  = await _bedrock_invoke(payload)
    if result is not None:
        logger.info("[LLM] generate — Bedrock OK")
        return result

    # ── Fallback: Gemini ──────────────────────────────────────────────────────
    logger.warning("[LLM] generate — Bedrock failed, falling back to Gemini")
    gem_payload = _gemini_text_payload(prompt, system, temperature, max_tokens)
    return await _gemini_generate(gem_payload)


async def generate_stream(
    prompt: str,
    system_instruction: Optional[str] = None,
    model_name: str = BEDROCK_MODEL_ID,
    temperature: float = 0.7,
    max_tokens: int = 4096,
) -> AsyncGenerator[str, None]:
    """
    Stream a text response.
    1. Try Bedrock ConverseStream / Kimi K2.5 (binary event-stream protocol)
    2. Fall back to Gemini SSE stream if Bedrock yields nothing
    """
    system  = system_instruction or AETHERIS_SYSTEM
    payload = _bedrock_text_payload(prompt, system, temperature, max_tokens)

    logger.info("[LLM] generate_stream — primary=Bedrock, prompt_len=%d", len(prompt))
    yielded_any = False

    async for chunk in _bedrock_stream(payload):
        yield chunk
        yielded_any = True

    if yielded_any:
        return  # Bedrock succeeded

    # ── Fallback: Gemini SSE ──────────────────────────────────────────────────
    logger.warning("[LLM] generate_stream — Bedrock empty, falling back to Gemini")
    gem_payload = _gemini_text_payload(prompt, system, temperature, max_tokens)
    async for chunk in _gemini_stream(gem_payload):
        yield chunk


async def generate_chat(
    messages: list[dict],
    system_instruction: Optional[str] = None,
    temperature: float = 0.7,
    max_tokens: int = 4096,
) -> str:
    """
    Generate a response from a structured multi-turn conversation.
    Accepts messages[] array: [{"role": "user"|"assistant", "content": str}]
    Preserves full conversation structure for proper multi-turn reasoning.
    """
    system = system_instruction or AETHERIS_SYSTEM

    # Primary: Bedrock
    logger.info("[LLM] generate_chat — primary=Bedrock, turns=%d", len(messages))
    payload = _bedrock_chat_payload(messages, system, temperature, max_tokens)
    result = await _bedrock_invoke(payload)
    if result is not None:
        return result

    # Fallback: Gemini
    logger.warning("[LLM] generate_chat — Bedrock failed, falling back to Gemini")
    gem_payload = _gemini_chat_payload(messages, system, temperature, max_tokens)
    return await _gemini_generate(gem_payload)


async def generate_chat_stream(
    messages: list[dict],
    system_instruction: Optional[str] = None,
    temperature: float = 0.7,
    max_tokens: int = 4096,
) -> AsyncGenerator[str, None]:
    """
    Stream a response from a structured multi-turn conversation.
    Accepts messages[] array for proper Bedrock Converse multi-turn.
    """
    system = system_instruction or AETHERIS_SYSTEM
    payload = _bedrock_chat_payload(messages, system, temperature, max_tokens)

    logger.info("[LLM] generate_chat_stream — primary=Bedrock, turns=%d", len(messages))
    yielded_any = False

    async for chunk in _bedrock_stream(payload):
        yield chunk
        yielded_any = True

    if yielded_any:
        return

    # Fallback: Gemini
    logger.warning("[LLM] generate_chat_stream — Bedrock empty, falling back to Gemini")
    gem_payload = _gemini_chat_payload(messages, system, temperature, max_tokens)
    async for chunk in _gemini_stream(gem_payload):
        yield chunk


async def analyze_image(
    image_data: bytes,
    prompt: str = "Analyze this image in detail.",
    model_name: str = BEDROCK_MODEL_ID,
    mime_type: str = "image/png",
    system_instruction: Optional[str] = None,
) -> str:
    """
    Multimodal image analysis.
    1. Try Bedrock / Kimi K2.5 (vision via Converse API)
    2. Fall back to Gemini Vision
    """
    system = system_instruction or AETHERIS_SYSTEM

    # ── Primary: Bedrock vision ───────────────────────────────────────────────
    logger.info(
        "[LLM] analyze_image — primary=Bedrock, size=%dKB, mime=%s",
        len(image_data) // 1024, mime_type,
    )
    payload = _bedrock_vision_payload(image_data, prompt, mime_type, system)
    result  = await _bedrock_invoke(payload)
    if result is not None:
        logger.info("[LLM] analyze_image — Bedrock OK")
        return result

    # ── Fallback: Gemini Vision ───────────────────────────────────────────────
    logger.warning("[LLM] analyze_image — Bedrock failed, falling back to Gemini Vision")
    gem_payload = _gemini_vision_payload(image_data, prompt, mime_type, system)
    return await _gemini_generate(gem_payload)


async def analyze_image_from_base64(
    image_base64: str,
    prompt: str = "Analyze this image in detail.",
    model_name: str = BEDROCK_MODEL_ID,
    mime_type: str = "image/png",
) -> str:
    """Convenience: accepts data-URL or raw base64 string."""
    if "," in image_base64:
        image_base64 = image_base64.split(",", 1)[1]
    image_bytes = base64.b64decode(image_base64)
    return await analyze_image(image_bytes, prompt, model_name, mime_type)


async def generate_structured(
    prompt: str,
    schema: dict,
    model_name: str = BEDROCK_MODEL_ID,
) -> dict:
    """Generate JSON conforming to the provided schema."""
    schema_str  = json.dumps(schema, indent=2)
    full_prompt = (
        f"{prompt}\n\nRespond with valid JSON matching this schema:\n{schema_str}"
    )
    raw = await generate(full_prompt, model_name=model_name, temperature=0.1)
    # Strip markdown code fences properly
    cleaned = raw.strip()
    if cleaned.startswith("```json"):
        cleaned = cleaned[7:]
    elif cleaned.startswith("```"):
        cleaned = cleaned[3:]
    if cleaned.endswith("```"):
        cleaned = cleaned[:-3]
    cleaned = cleaned.strip()
    return json.loads(cleaned)


async def analyze_pdf(pdf_bytes: bytes, prompt: str = "Summarize this PDF.") -> str:
    """Encode PDF and ask the model to summarize (best-effort)."""
    b64         = base64.b64encode(pdf_bytes).decode()
    full_prompt = f"{prompt}\n\n[PDF content, base64-encoded]\n{b64[:2000]}..."
    return await generate(full_prompt)
