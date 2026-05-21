"""
Aetheris OS — Vision Endpoint (DEPRECATED)

All vision analysis is now routed through /api/chat → orchestrator → analyze_image().
These endpoints are kept for backward compatibility only but are not called by any
frontend component. Do NOT add new features here — use /api/chat instead.
"""
from fastapi import APIRouter, UploadFile, File
from pydantic import BaseModel
from typing import Optional
import base64

from agents.vision_agent import analyze

router = APIRouter()


class VisionRequest(BaseModel):
    image_base64: str
    prompt: Optional[str] = (
        "Analyze this image in detail. Describe visual elements, "
        "extract text, and identify charts or data."
    )


@router.post("/vision", deprecated=True, summary="DEPRECATED — use /api/chat instead")
async def analyze_image_endpoint(request: VisionRequest):
    """
    DEPRECATED: Kept for backward compatibility.
    All vision analysis flows through /api/chat → orchestrator.
    """
    result = await analyze(
        image_base64=request.image_base64,
        prompt=request.prompt,
    )
    return result


@router.post("/vision/upload", deprecated=True, summary="DEPRECATED — use /api/chat instead")
async def analyze_uploaded_image(
    file: UploadFile = File(...),
    prompt: str = "Analyze this image in detail.",
):
    """
    DEPRECATED: Kept for backward compatibility.
    All vision analysis flows through /api/chat → orchestrator.
    """
    content = await file.read()
    image_b64 = base64.b64encode(content).decode()

    result = await analyze(
        image_base64=image_b64,
        prompt=prompt,
    )
    result["filename"] = file.filename
    return result
