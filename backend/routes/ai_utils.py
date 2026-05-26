"""
ThinkSync OS — AI Utility Routes
Convenience endpoints for PDF analysis and structured JSON generation.
"""
import base64
import json
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Any, Dict

from services import llm_service

router = APIRouter()


class PDFAnalyzeRequest(BaseModel):
    pdf_base64: str       # base64-encoded PDF bytes
    prompt: str = "Summarize the contents of this PDF."


class StructuredGenerateRequest(BaseModel):
    prompt: str
    schema: Dict[str, Any]
    model_name: str = llm_service.DEFAULT_TEXT_MODEL


@router.post("/analyze/pdf")
async def analyze_pdf(request: PDFAnalyzeRequest):
    try:
        pdf_bytes = base64.b64decode(request.pdf_base64)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid base64 PDF data")
    result = await llm_service.analyze_pdf(pdf_bytes, prompt=request.prompt)
    return {"result": result}


@router.post("/generate/structured")
async def generate_structured(request: StructuredGenerateRequest):
    result = await llm_service.generate_structured(
        prompt=request.prompt,
        schema=request.schema,
        model_name=request.model_name,
    )
    return {"result": result}
