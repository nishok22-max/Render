import base64
from typing import Dict
import asyncio

from services.llm_service import analyze_image

# Prompt that asks Gemini to perform OCR extraction.
OCR_SYSTEM_PROMPT = "You are an OCR assistant. Extract **all** visible text from the provided image. Return the text exactly as it appears, preserving line breaks. Do NOT add explanations or make inferences."

async def extract_text(image_bytes: bytes) -> str:
    """Extract text from an image using Gemini Vision OCR.

    If the Gemini call fails, fall back to Tesseract (if available).
    """
    # Encode image for Gemini (base64)
    b64_image = base64.b64encode(image_bytes).decode("utf-8")
    prompt = "Perform OCR on the image and return raw text."
    try:
        # Use the generic generate call with image payload
        response = await analyze_image(
            image_data=image_bytes,
            prompt=prompt + "\n\n" + OCR_SYSTEM_PROMPT,
            model_name="gemini-3-flash-preview",
        )
        # If Gemini returns a non‑empty string, assume success
        if response and not response.startswith("[Gemini"):
            return response.strip()
    except Exception:
        pass

    # ----- Fallback to Tesseract -----
    try:
        import pytesseract
        from PIL import Image
        import io
        img = Image.open(io.BytesIO(image_bytes))
        return pytesseract.image_to_string(img)
    except Exception as e:
        # If even Tesseract fails, return an empty string with a note
        return f"[OCR extraction failed: {e}]"
