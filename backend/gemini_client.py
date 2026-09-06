from typing import Any, Optional

from google import genai
from google.genai import types

from backend.config import GOOGLE_CLOUD_LOCATION, GOOGLE_CLOUD_PROJECT, MODEL_FALLBACK_LADDER

_genai_client: Optional[genai.Client] = None


def get_genai_client() -> genai.Client:
    global _genai_client
    if _genai_client is None:
        if not GOOGLE_CLOUD_PROJECT:
            raise RuntimeError("GOOGLE_CLOUD_PROJECT environment variable is missing.")
        # No api_key — auth is Application Default Credentials (gcloud CLI
        # locally, the Cloud Run service account in production).
        _genai_client = genai.Client(
            vertexai=True,
            project=GOOGLE_CLOUD_PROJECT,
            location=GOOGLE_CLOUD_LOCATION,
        )
    return _genai_client


def is_quota_exhausted_error(err: Exception) -> bool:
    status = getattr(err, "status_code", None) or getattr(err, "code", None)
    if status == 429:
        return True
    msg = str(err).lower()
    return any(
        s in msg
        for s in (
            "resource_exhausted",
            "prepayment credits are depleted",
            "429",
            "quota",
            "rate limit",
        )
    )


async def generate_content_with_fallback(
    contents: list[dict[str, Any]],
    system_instruction: str,
    config: Optional[dict[str, Any]] = None,
) -> Optional[dict[str, str]]:
    try:
        client = get_genai_client()
    except RuntimeError:
        return None

    # Gemini 3.x deprecates temperature/top_p/top_k in favor of thinkingLevel —
    # strip them here so every caller (and every model in the ladder) stays
    # valid without having to edit each call site individually.
    clean_config = {
        k: v for k, v in (config or {}).items() if k not in ("temperature", "top_p", "top_k")
    }

    saw_quota_exhaustion = False

    for model in MODEL_FALLBACK_LADDER:
        try:
            response = await client.aio.models.generate_content(
                model=model,
                contents=contents,
                config=types.GenerateContentConfig(
                    system_instruction=system_instruction,
                    **clean_config,
                ),
            )
            if response and response.text:
                return {"text": response.text, "modelUsed": model}
            print(f"[gemini] {model} returned no text; trying next model in ladder.")
        except Exception as err:
            # Always log — a swallowed error here is invisible in the UI, and
            # this is usually the only trace of *why* the app fell back to a
            # canned response.
            print(f"[gemini] {model} failed: {err}")
            if is_quota_exhausted_error(err):
                saw_quota_exhaustion = True
                # Don't abort here — quota can be per-model, so still give
                # the rest of the ladder a chance.
            continue

    if saw_quota_exhaustion:
        print("[gemini] All models in the fallback ladder hit quota/rate limits.")
    else:
        print("[gemini] All models in the fallback ladder failed (non-quota errors).")
    return None
