import base64
from typing import Dict, Any

from services.llm_service import analyze_image, generate

from .preprocessing import preprocess_image
from .ocr import extract_text
from .classification import detect_type
from .reasoning import synthesize_response

async def analyze(image_base64: str, prompt: str = "Analyze this image in detail.") -> Dict[str, Any]:
    """High‑level entry point for the Vision pipeline.

    Steps:
    1️⃣ Decode and preprocess the image.
    2️⃣ Perform OCR to obtain raw text.
    3️⃣ Classify the image type (error, chart, ui, code, diagram, meme, generic).
    4️⃣ Generate a detailed description using Gemini Vision.
    5️⃣ Combine all context with the user *prompt* and invoke the LLM reasoning step.
    """
    # 1️⃣ Pre‑process image (resize, denoise, etc.)
    raw_bytes, _ = preprocess_image(image_base64)

    # 2️⃣ OCR extraction (fallback handled inside extract_text)
    ocr_text = await extract_text(raw_bytes)

    # 3️⃣ Simple classification – can be expanded later
    img_type = detect_type(ocr_text)

    # 4️⃣ Vision description – use the generic Gemini Vision call
    vision_desc = await analyze_image(raw_bytes, prompt="Describe the visual content of this image.")

    # 5️⃣ Reasoning – produce a query‑aware answer
    answer = await synthesize_response(
        user_query=prompt,
        image_type=img_type,
        vision_description=vision_desc,
        ocr_text=ocr_text,
    )

    return {
        "analysis": answer,
        "ocr": ocr_text,
        "vision": vision_desc,
        "type": img_type,
        "status": "complete",
        "agent": "vision",
    }
