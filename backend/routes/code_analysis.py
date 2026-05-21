"""
Aetheris OS — Code Analysis Endpoint
Code intelligence powered by Gemini.
"""
from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional

from agents.code_agent import analyze_code

router = APIRouter()


class CodeAnalysisRequest(BaseModel):
    code: str
    language: Optional[str] = "python"
    task: Optional[str] = "explain"


@router.post("/code-analysis")
async def handle_code_analysis(request: CodeAnalysisRequest):
    result = await analyze_code(
        code=request.code,
        language=request.language,
        task=request.task,
    )
    return result
