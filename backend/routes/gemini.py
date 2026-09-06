from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from backend.fallbacks import extract_memory_fallback, generate_companion_fallback_response
from backend.gemini_client import generate_content_with_fallback
import re

router = APIRouter()


# --- Backwards-compatible AI Reflection Endpoint ---
class ReflectPayload(BaseModel):
    prompt: str = ""
    mode: str = "listen"
    history: list[dict[str, Any]] = []


@router.post("/api/gemini/reflect")
async def gemini_reflect(payload: ReflectPayload):
    prompt = payload.prompt.strip()
    if not prompt:
        raise HTTPException(status_code=400, detail="Prompt is required.")

    system_instruction = "You are Chronicle: an attentive, empathetic friend. Keep responses short (1-2 sentences), genuine, and listening-focused. Never lecture or write long essays."

    contents: list[dict[str, Any]] = []
    for msg in payload.history[-10:]:
        content = msg.get("content")
        if isinstance(content, str):
            contents.append({
                "role": "user" if msg.get("role") == "user" else "model",
                "parts": [{"text": content}],
            })
    contents.append({"role": "user", "parts": [{"text": prompt}]})

    result = await generate_content_with_fallback(
        contents,
        system_instruction,
        config={"temperature": 0.75, "max_output_tokens": 150},
    )

    if result and result.get("text"):
        return {"success": True, "text": result["text"].strip(), "modelUsed": result["modelUsed"]}

    fallback_text = generate_companion_fallback_response(prompt=prompt, mode=payload.mode)
    return {"success": True, "text": fallback_text, "modelUsed": "chronicle-companion"}


# --- Auto-Title Generation for Journal Sessions ---
class TitlePayload(BaseModel):
    prompt: str = ""


@router.post("/api/gemini/title")
async def gemini_title(payload: TitlePayload):
    prompt = payload.prompt.strip()
    if not prompt:
        raise HTTPException(status_code=400, detail="Prompt is required for title generation.")

    result = await generate_content_with_fallback(
        [{"role": "user", "parts": [{"text": prompt}]}],
        "Generate a concise, elegant, 3-to-6-word title summarizing this journal entry or prompt. Return ONLY the plain text title without quotation marks, markdown, or punctuation.",
        config={"temperature": 0.3, "max_output_tokens": 25},
    )

    if result and result.get("text"):
        return {"title": re.sub(r"[\"'*]", "", result["text"]).strip()}

    memory_fallback = extract_memory_fallback(prompt)
    return {"title": memory_fallback["title"] or "Reflective Vent"}
