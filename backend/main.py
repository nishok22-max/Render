import os
from contextlib import asynccontextmanager

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app_config import settings

# Pre-import singletons so they initialize at startup, not first request
from rag.vector_store import get_supabase

# Route imports
from routes.health import router as health_router
from routes.chat import router as chat_router
from routes.upload import router as upload_router
from routes.documents import router as documents_router
from routes.sessions import router as sessions_router
from routes.agents import router as agents_router
from routes.research import router as research_router
from routes.vision import router as vision_router
from routes.code_analysis import router as code_analysis_router
from routes.dataset_analysis import router as dataset_analysis_router
from routes.rag_chat import router as rag_chat_router


# ─── Lifespan (replaces deprecated @app.on_event) — FIX BUG-05 ──────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup → yield → shutdown lifecycle handler."""
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)

    # Eagerly initialize the Supabase singleton to avoid cold-start latency
    try:
        get_supabase()
    except Exception as e:
        print(f"  [WARN] Supabase init failed at startup: {e}")

    print("=" * 60)
    print("  ThinkSync OS Backend — Neural Core Online")
    print("=" * 60)
    print(f"  Bedrock Ready  : {settings.bedrock_ready}")
    print(f"  Bedrock Model  : {settings.BEDROCK_MODEL_ID}")
    print(f"  Bedrock Region : {settings.AWS_REGION}")
    print(f"  Gemini Ready   : {settings.gemini_ready}")
    print(f"  Groq Key Set   : {bool(settings.GROQ_API_KEY)}")
    print(f"  Tavily Key Set : {bool(settings.TAVILY_API_KEY)}")
    print(f"  Supabase URL   : {'set' if settings.SUPABASE_URL else 'MISSING'}")
    print(f"  CORS Origins   : {settings.CORS_ORIGINS}")
    print(f"  Chunk Size     : {settings.CHUNK_SIZE} chars")
    print(f"  Top-K Retrieval: {settings.TOP_K}")
    print("=" * 60)

    yield  # application runs here

    # Shutdown — close all shared httpx clients
    try:
        from rag.embeddings import close_client
        await close_client()
        print("  [Shutdown] Embeddings HTTP client closed.")
    except Exception:
        pass
    try:
        from services.llm_service import close_bedrock_clients
        await close_bedrock_clients()
        print("  [Shutdown] Bedrock HTTP clients closed.")
    except Exception:
        pass
    print("ThinkSync OS Backend — Shutting down.")


# ─── App ─────────────────────────────────────────────────────────────────────

app = FastAPI(
    title="ThinkSync OS API",
    description="Multimodal Autonomous Research + RAG AI Agent Platform",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Simple rate limiting ─────────────────────────────────────────────────────
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse
import time as _time
from collections import defaultdict as _defaultdict


class _RateLimitMiddleware(BaseHTTPMiddleware):
    """Simple per-IP rate limiter: 60 requests/minute for AI endpoints."""

    def __init__(self, app, rpm: int = 60):
        super().__init__(app)
        self._rpm = rpm
        self._requests: dict = _defaultdict(list)

    async def dispatch(self, request, call_next):
        path = request.url.path
        if not any(path.startswith(p) for p in ["/api/chat", "/api/research", "/api/rag/query", "/api/vision"]):
            return await call_next(request)

        client_ip = request.client.host if request.client else "unknown"
        now = _time.time()
        window = [t for t in self._requests[client_ip] if now - t < 60]
        self._requests[client_ip] = window

        if len(window) >= self._rpm:
            return JSONResponse(
                {"detail": "Rate limit exceeded. Please wait before trying again."},
                status_code=429,
            )
        self._requests[client_ip].append(now)
        return await call_next(request)


app.add_middleware(_RateLimitMiddleware, rpm=60)

# Register routes
app.include_router(health_router,          prefix="/api", tags=["Health"])
app.include_router(chat_router,            prefix="/api", tags=["Chat"])
app.include_router(upload_router,          prefix="/api", tags=["Upload"])
app.include_router(documents_router,       prefix="/api", tags=["Documents"])
app.include_router(sessions_router,        prefix="/api", tags=["Sessions"])
app.include_router(agents_router,          prefix="/api", tags=["Agents"])
app.include_router(research_router,        prefix="/api", tags=["Research"])
app.include_router(vision_router,          prefix="/api", tags=["Vision"])
app.include_router(code_analysis_router,   prefix="/api", tags=["Code Analysis"])
app.include_router(dataset_analysis_router, prefix="/api", tags=["Dataset Analysis"])
app.include_router(rag_chat_router,          prefix="/api", tags=["RAG Agent"])


if __name__ == "__main__":
    uvicorn.run("main:app", host=settings.HOST, port=settings.PORT, reload=True)
