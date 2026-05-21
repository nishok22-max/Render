import os
from pathlib import Path
from dotenv import load_dotenv

env_path = Path(__file__).parent / ".env"
load_dotenv(dotenv_path=env_path, override=True)


class Settings:
    # ── AWS Bedrock (primary AI) ─────────────────────────────────────────────
    AWS_ACCESS_KEY_ID:     str = os.getenv("AWS_ACCESS_KEY_ID", "")
    AWS_SECRET_ACCESS_KEY: str = os.getenv("AWS_SECRET_ACCESS_KEY", "")
    AWS_REGION:            str = os.getenv("AWS_REGION", "eu-north-1")
    BEDROCK_MODEL_ID:      str = os.getenv("MODEL_ID", "moonshotai.kimi-k2.5")

    # ── Google Gemini (fallback AI) ──────────────────────────────────────────
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")

    # ── Other AI APIs ────────────────────────────────────────────────────────
    GROQ_API_KEY:        str = os.getenv("GROQ_API_KEY", "")
    OPENROUTER_API_KEY:  str = os.getenv("OPENROUTER_API_KEY", "")

    # ── Supabase ─────────────────────────────────────────────────────────────
    SUPABASE_URL: str = os.getenv("SUPABASE_URL", "")
    SUPABASE_KEY: str = os.getenv("SUPABASE_KEY", "")

    # ── Web Research ─────────────────────────────────────────────────────────
    TAVILY_API_KEY: str = os.getenv("TAVILY_API_KEY", "")

    # ── Server ───────────────────────────────────────────────────────────────
    HOST:         str  = os.getenv("HOST", "0.0.0.0")
    PORT:         int  = int(os.getenv("PORT", "8000"))
    CORS_ORIGINS: list = os.getenv(
        "CORS_ORIGINS", "http://localhost:3000"
    ).split(",")

    # ── RAG (optimized for speed) ─────────────────────────────────────────────
    # Larger chunks → fewer embeddings → ~40% faster ingestion
    CHUNK_SIZE:           int   = int(os.getenv("CHUNK_SIZE", "1200"))
    # Smaller overlap → fewer total chunks without losing retrieval quality
    CHUNK_OVERLAP:        int   = int(os.getenv("CHUNK_OVERLAP", "100"))
    # Reduced top_k → faster retrieval + less LLM context → faster response
    TOP_K:                int   = int(os.getenv("TOP_K", "5"))
    SIMILARITY_THRESHOLD: float = float(os.getenv("SIMILARITY_THRESHOLD", "0.3"))

    # ── Upload ───────────────────────────────────────────────────────────────
    MAX_FILE_SIZE: int = 50 * 1024 * 1024   # 50 MB
    UPLOAD_DIR:    str = os.getenv("UPLOAD_DIR", "./uploads")

    @property
    def bedrock_ready(self) -> bool:
        return bool(self.AWS_ACCESS_KEY_ID and self.AWS_SECRET_ACCESS_KEY)

    @property
    def gemini_ready(self) -> bool:
        return bool(self.GEMINI_API_KEY)


settings = Settings()
