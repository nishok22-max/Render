"""
ThinkSync OS — Vision Analysis Agent
Image understanding using Gemini Vision.
"""
import base64
from typing import Dict
from services.llm_service import analyze_image


async def analyze(
    image_path: str = None,
    image_base64: str = None,
    prompt: str = "Analyze this image in detail. Extract all text, describe visual elements, charts, UI components, and any data present.",
) -> Dict:
    """Analyze an image using Gemini Vision."""
    try:
        if image_path:
            with open(image_path, "rb") as f:
                image_data = f.read()
        elif image_base64:
            image_data = base64.b64decode(image_base64)
        else:
            return {"analysis": "No image provided", "status": "error"}

        result = await analyze_image(image_data, prompt)

        return {
            "analysis": result,
            "agent": "vision",
            "status": "complete",
        }
    except Exception as e:
        return {
            "analysis": f"Vision analysis failed: {str(e)}",
            "agent": "vision",
            "status": "error",
        }
