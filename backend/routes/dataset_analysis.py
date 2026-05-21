"""
Aetheris OS — /api/dataset
Dataset analysis endpoint (CSV, JSON, Excel).
"""
from fastapi import APIRouter, UploadFile, File, HTTPException
from pydantic import BaseModel
from typing import Optional
import base64

from app_config import settings

router = APIRouter()


class DatasetAnalysisRequest(BaseModel):
    filename: str
    content_base64: str
    prompt: Optional[str] = "Analyze this dataset. Describe columns, types, and key statistics."


@router.post("/dataset/analyze")
async def analyze_dataset(request: DatasetAnalysisRequest):
    """Analyze a dataset using Gemini (text description approach)."""
    try:
        import services.llm_service as llm
        content_bytes = base64.b64decode(request.content_base64)
        content_str = content_bytes.decode("utf-8", errors="replace")[:4000]  # truncate large files

        prompt = (
            f"File: {request.filename}\n\n"
            f"Content (first 4000 chars):\n{content_str}\n\n"
            f"{request.prompt}"
        )
        result = await llm.generate(prompt=prompt)
        return {"analysis": result, "filename": request.filename, "status": "complete"}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/dataset/upload")
async def upload_and_analyze(
    file: UploadFile = File(...),
    prompt: str = "Analyze this dataset.",
):
    """Upload a dataset file and get an immediate analysis."""
    content = await file.read()
    b64 = base64.b64encode(content).decode()
    req = DatasetAnalysisRequest(
        filename=file.filename or "dataset",
        content_base64=b64,
        prompt=prompt,
    )
    return await analyze_dataset(req)
