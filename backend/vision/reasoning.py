"""
Reasoning layer for the Vision pipeline.
It builds a query‑aware prompt that combines:
- Image type (error, chart, ui, …)
- Gemini Vision description
- OCR extracted text
- The original user prompt
It then calls the LLM via `services.llm_service.generate`.
"""
from typing import Dict, Any

from services.llm_service import generate

SYSTEM_PROMPT = (
    "You are an expert AI assistant that analyzes visual content. "
    "Given the image type, a detailed visual description, and any extracted text, "
    "answer the user's question concisely and accurately. "
    "Do NOT repeat the entire OCR text unless it is directly needed. "
    "If the image contains an error screenshot, provide debugging steps. "
    "If it is a chart, summarize trends. "
    "If it is a UI, infer possible frameworks. "
    "If additional research is required, indicate that you would search the web."
)

async def synthesize_response(
    user_query: str,
    image_type: str,
    vision_description: str,
    ocr_text: str,
) -> str:
    """Create a final answer using the LLM.

    The function builds a prompt that forces the model to reason over the image
    context and the user's query. It returns the generated text.
    """
    # Build context sections
    context_parts = [
        f"**Image type:** {image_type}",
        f"**Vision description:** {vision_description}",
        f"**Extracted text:** {ocr_text[:500]}"  # limit size
    ]
    context = "\n\n".join(context_parts)

    prompt = (
        f"Context:\n{context}\n\nUser question: {user_query}\n\n"
        "Provide a clear answer that directly addresses the question using the above context. "
        "If you need external information, mention that you would perform a web search, but do not actually call any APIs here."
    )

    # Call Gemini directly – stream not needed here
    answer = await generate(
        prompt=prompt,
        system_instruction=SYSTEM_PROMPT,
        model_name="gemini-3-flash-preview",
        temperature=0.2,
        max_tokens=1024,
    )
    return answer
