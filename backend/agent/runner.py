import uuid
from typing import Any, Optional

from google.adk.runners import InMemoryRunner
from google.genai import types

from backend.agent.chronicle_agent import build_chronicle_agent
from backend.config import MODEL_FALLBACK_LADDER
from backend.gemini_client import is_quota_exhausted_error


async def run_chronicle_agent(
    prompt: str,
    system_instruction: str,
    memories: list[Any],
    graph_context: Optional[list[Any]] = None,
) -> Optional[dict[str, str]]:
    """Runs Chronicle's ADK agent through the same model-fallback-ladder,
    None-on-total-failure contract as gemini_client.generate_content_with_fallback,
    so callers don't need to know whether a reply came from the raw model or
    the tool-calling agent."""
    saw_quota_exhaustion = False

    for model in MODEL_FALLBACK_LADDER:
        try:
            agent = build_chronicle_agent(
                model=model, instruction=system_instruction, memories=memories, graph_context=graph_context
            )
            runner = InMemoryRunner(agent=agent, app_name="chronicle")
            user_id = "chronicle_user"
            session_id = f"req_{uuid.uuid4().hex}"
            await runner.session_service.create_session(
                app_name="chronicle", user_id=user_id, session_id=session_id
            )
            content = types.Content(role="user", parts=[types.Part(text=prompt)])

            final_text = None
            error_message = None
            async for event in runner.run_async(user_id=user_id, session_id=session_id, new_message=content):
                if event.error_message:
                    error_message = event.error_message
                if event.is_final_response() and event.content and event.content.parts:
                    text = "".join(p.text for p in event.content.parts if getattr(p, "text", None))
                    if text:
                        final_text = text

            if final_text:
                return {"text": final_text, "modelUsed": model}

            if error_message:
                print(f"[adk-agent] {model} failed: {error_message}")
                if is_quota_exhausted_error(Exception(error_message)):
                    saw_quota_exhaustion = True
                continue

            print(f"[adk-agent] {model} returned no text; trying next model in ladder.")
        except Exception as err:
            print(f"[adk-agent] {model} raised: {err}")
            if is_quota_exhausted_error(err):
                saw_quota_exhaustion = True
            continue

    if saw_quota_exhaustion:
        print("[adk-agent] All models in the fallback ladder hit quota/rate limits.")
    else:
        print("[adk-agent] All models in the fallback ladder failed (non-quota errors).")
    return None
