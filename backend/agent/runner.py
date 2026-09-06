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
    people: Optional[list[Any]] = None,
    latitude: Optional[float] = None,
    longitude: Optional[float] = None,
) -> Optional[dict[str, Any]]:
    """Runs Chronicle's ADK agent through the same model-fallback-ladder,
    None-on-total-failure contract as gemini_client.generate_content_with_fallback,
    so callers don't need to know whether a reply came from the raw model or
    the tool-calling agent."""
    saw_quota_exhaustion = False

    for model in MODEL_FALLBACK_LADDER:
        try:
            agent = build_chronicle_agent(
                model=model,
                instruction=system_instruction,
                memories=memories,
                graph_context=graph_context,
                people=people,
                latitude=latitude,
                longitude=longitude,
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
            song: Optional[dict[str, Any]] = None
            places: Optional[list[dict[str, Any]]] = None
            pending_deletion: Optional[dict[str, Any]] = None
            async for event in runner.run_async(user_id=user_id, session_id=session_id, new_message=content):
                if event.error_message:
                    error_message = event.error_message
                # Pull the actual tool return values straight from the event
                # stream rather than trusting the model to echo structured
                # data back in its text — the frontend needs the real
                # videoId / memoryId, not the model's paraphrase of them.
                for fr in event.get_function_responses():
                    if fr.name == "find_song_to_play" and isinstance(fr.response, dict) and fr.response.get("videoId"):
                        song = fr.response
                    elif fr.name == "find_nearby_places":
                        # ADK wraps a tool's non-dict return value as
                        # {"result": <value>} before attaching it to the
                        # FunctionResponse, since find_nearby_places returns a
                        # bare list rather than a dict.
                        raw_places = fr.response
                        if isinstance(raw_places, dict) and isinstance(raw_places.get("result"), list):
                            raw_places = raw_places["result"]
                        if isinstance(raw_places, list) and raw_places:
                            places = raw_places
                    elif (
                        fr.name == "propose_memory_deletion"
                        and isinstance(fr.response, dict)
                        and fr.response.get("memoryId")
                    ):
                        pending_deletion = fr.response
                if event.is_final_response() and event.content and event.content.parts:
                    text = "".join(p.text for p in event.content.parts if getattr(p, "text", None))
                    if text:
                        final_text = text

            if final_text:
                result: dict[str, Any] = {"text": final_text, "modelUsed": model}
                if song:
                    result["song"] = song
                if places:
                    result["places"] = places
                if pending_deletion:
                    result["pendingDeletion"] = pending_deletion
                return result

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
