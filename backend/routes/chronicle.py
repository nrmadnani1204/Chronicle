import json
from typing import Any, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from backend.agent.persona import (
    build_graph_context,
    build_history_transcript,
    build_memory_context,
    build_past_history_context,
    build_system_instruction,
)
from backend.agent.runner import run_chronicle_agent
from backend.fallbacks import extract_memory_fallback, generate_companion_fallback_response
from backend.gemini_client import generate_content_with_fallback

router = APIRouter()


# --- Chronicle Attentive Friend Conversation API ---
class RespondPayload(BaseModel):
    prompt: str = ""
    mode: str = "listen"
    history: list[dict[str, Any]] = []
    # Sent as {id, text} objects (not bare strings) so tools that need to
    # target a specific memory — propose_memory_deletion — have an id to act on.
    memories: list[Any] = []
    graphContext: list[Any] = []
    # Person-type graph nodes only, most-referenced first — powers
    # suggest_reaching_out without needing real Contacts API access.
    people: list[Any] = []
    tone: str = "friend"
    pastSessions: list[dict[str, Any]] = []
    latitude: Optional[float] = None
    longitude: Optional[float] = None


@router.post("/api/chronicle/respond")
async def chronicle_respond(payload: RespondPayload):
    prompt = payload.prompt.strip()
    if not prompt:
        raise HTTPException(status_code=400, detail="Prompt is required.")

    mode = payload.mode
    preferred_tone = payload.tone

    system_instruction = build_system_instruction(
        mode=mode,
        tone=preferred_tone,
        memory_context=build_memory_context(payload.memories),
        past_history_context=build_past_history_context(payload.pastSessions),
        history_transcript=build_history_transcript(payload.history),
        graph_context=build_graph_context(payload.graphContext),
    )

    result = await run_chronicle_agent(
        prompt=prompt,
        system_instruction=system_instruction,
        memories=payload.memories,
        graph_context=payload.graphContext,
        people=payload.people,
        latitude=payload.latitude,
        longitude=payload.longitude,
    )

    if result and result.get("text"):
        response: dict[str, Any] = {
            "success": True,
            "text": result["text"].strip(),
            "modelUsed": result["modelUsed"],
            "isOfflineCompanion": False,
        }
        if result.get("song"):
            response["song"] = result["song"]
        if result.get("places"):
            response["places"] = result["places"]
        if result.get("pendingDeletion"):
            response["pendingDeletion"] = result["pendingDeletion"]
        return response

    fallback_text = generate_companion_fallback_response(
        prompt=prompt,
        mode=mode,
        tone=preferred_tone,
        past_sessions=payload.pastSessions,
    )
    return {
        "success": True,
        "text": fallback_text,
        "modelUsed": "chronicle-companion",
        "isOfflineCompanion": True,
    }


# --- Chronicle Memory Extraction & Emotional Weather API ---
class ExtractMemoryPayload(BaseModel):
    sessionText: str = ""
    # Existing knowledge-graph node labels the client already knows about, so
    # extraction can link new context to them instead of creating duplicates.
    graphNodeLabels: list[str] = []


@router.post("/api/chronicle/extract-memory")
async def chronicle_extract_memory(payload: ExtractMemoryPayload):
    session_text = payload.sessionText.strip()

    if not session_text or len(session_text) < 20:
        return {
            "memories": [],
            "mood": {"valence": 0, "energy": 0.5, "tension": 0.3, "weather": "Soft & Reflective"},
            "title": "Quick Vent",
            "nodes": [],
            "edges": [],
        }

    existing_labels_block = ""
    if payload.graphNodeLabels:
        existing_labels = "\n".join(f"- {label}" for label in payload.graphNodeLabels[:40])
        existing_labels_block = f"""

EXISTING KNOWLEDGE GRAPH NODES (reuse these exact labels via sourceLabel/targetLabel
when this session relates to them, instead of inventing a near-duplicate label):
{existing_labels}"""

    system_instruction = f"""You are the memory engine of Chronicle.
Analyze this conversation between a user and their companion.
Extract:
1. Significant persistent facts, preferences, goals, or life details about the user (e.g. career aspirations, preferred music, comfort food, hobbies, relationships, things they love).
DO NOT extract fleeting complaints like 'traffic was bad' as permanent memories.
Categories: 'things_i_love', 'who_im_becoming', 'where_i_am_now', 'happy_place', 'routine', 'general'.
Types: 'episodic' (time-bound key event), 'semantic' (persistent preference/fact), 'trajectory' (goal/aspiration).
2. Mood assessment:
- valence: -1.0 (very negative) to +1.0 (very positive)
- energy: 0.0 (lethargic/exhausted) to 1.0 (hyper/high energy)
- tension: 0.0 (totally relaxed) to 1.0 (extremely stressed)
- weather: a poetic 2-4 word emotional weather descriptor (e.g. "Passing Storm", "Soft & Reflective", "Heavy Overcast", "Restorative Warmth", "Bright & Sunny", "Quiet Waters")
3. Suggested Title: 3 to 5 words capturing the essence.
4. Knowledge graph nodes: distinct people, aspirations, likes, dislikes, activities, or notable mood moments worth remembering as their own graph node. Keep labels short (2-6 words) and reusable across sessions (e.g. "Learning distributed systems", "Friend Sam", "Running", not full sentences).
   Types: 'like', 'dislike', 'aspiration', 'person', 'activity', 'mood_moment'.
5. Knowledge graph edges: relationships between the nodes above (or referencing an existing node label from the list below), e.g. a person node connected to an aspiration node they're pushing the user toward.
   Relations: 'mentions', 'relates_to', 'causes', 'contradicts', 'progresses_toward', 'about_person', 'evokes_mood', 'similar_to'.
{existing_labels_block}

Respond ONLY with valid JSON in this exact schema:
{{
  "memories": [
    {{
      "text": "Wants to learn distributed systems",
      "category": "who_im_becoming",
      "type": "trajectory",
      "importance": 0.9
    }}
  ],
  "mood": {{
    "valence": -0.4,
    "energy": 0.6,
    "tension": 0.7,
    "weather": "Passing Storm"
  }},
  "title": "Unpacking the Team Meeting",
  "nodes": [
    {{
      "label": "Learning distributed systems",
      "type": "aspiration",
      "description": "Wants to go deeper on distributed systems.",
      "importance": 0.9
    }}
  ],
  "edges": [
    {{
      "sourceLabel": "Friend Sam",
      "targetLabel": "Running",
      "relation": "progresses_toward",
      "weight": 0.6
    }}
  ]
}}
If there are no new nodes or edges worth recording, return empty arrays for "nodes" and "edges" — never omit the fields."""

    result = await generate_content_with_fallback(
        [{"role": "user", "parts": [{"text": session_text}]}],
        system_instruction,
        config={"temperature": 0.2, "response_mime_type": "application/json"},
    )

    if result and result.get("text"):
        try:
            parsed = json.loads(result["text"])
            return {
                "success": True,
                "memories": parsed.get("memories") if isinstance(parsed.get("memories"), list) else [],
                "mood": parsed.get("mood") or {"valence": 0, "energy": 0.5, "tension": 0.3, "weather": "Soft & Reflective"},
                "title": parsed.get("title") or "Reflective Vent",
                "nodes": parsed.get("nodes") if isinstance(parsed.get("nodes"), list) else [],
                "edges": parsed.get("edges") if isinstance(parsed.get("edges"), list) else [],
            }
        except ValueError:
            pass  # JSON parse failed, fall through to fallback

    fallback = extract_memory_fallback(session_text)
    return {
        "success": True,
        "memories": fallback["memories"],
        "mood": fallback["mood"],
        "title": fallback["title"],
        "nodes": fallback["nodes"],
        "edges": fallback["edges"],
        "isOfflineCompanion": True,
    }


# --- Memory Duplicate Judge API ---
# Layer 2 of memory dedup: layer 1 (client-side, textSimilarity.ts) cheaply
# shortlists existing memories that might already describe the same fact as
# a newly-extracted candidate; this endpoint only runs when that shortlist is
# non-empty, and makes the real "is this new, or does it update an existing
# memory" call so near-duplicates (e.g. two differently-worded "loves this
# song" memories) collapse into one versioned memory instead of piling up.
class JudgeCandidate(BaseModel):
    index: int
    text: str = ""
    category: str = "general"
    type: str = "semantic"
    importance: float = 0.5


class JudgeShortlistEntry(BaseModel):
    id: str
    text: str = ""
    category: str = "general"


class JudgeMemoryDuplicatesPayload(BaseModel):
    candidates: list[JudgeCandidate] = []
    shortlist: list[JudgeShortlistEntry] = []


@router.post("/api/chronicle/judge-memory-duplicates")
async def chronicle_judge_memory_duplicates(payload: JudgeMemoryDuplicatesPayload):
    if not payload.candidates or not payload.shortlist:
        return {"success": True, "verdicts": []}

    candidates_block = "\n".join(
        f'{c.index}. [{c.category}] "{c.text}"' for c in payload.candidates
    )
    shortlist_block = "\n".join(
        f'{s.id}. [{s.category}] "{s.text}"' for s in payload.shortlist
    )

    system_instruction = f"""You are a memory-deduplication judge for a personal journaling app.

For each NEW CANDIDATE memory below, decide whether it describes a genuinely
NEW fact, or whether it is the same underlying fact as one of the EXISTING
MEMORIES (just phrased differently, more specifically, or updated) — in which
case it should UPDATE that existing memory instead of creating a duplicate.

Only match an existing memory if it is really the same fact (e.g. "loves the
song Happy by Pharrell" and "Happy by Pharrell Williams makes them so happy"
are the SAME fact — update). Different facts in the same category (e.g. two
different songs they both love) are NOT duplicates — each stays new.

NEW CANDIDATES (index. [category] "text"):
{candidates_block}

EXISTING MEMORIES (id. [category] "text"):
{shortlist_block}

Respond ONLY with valid JSON in this exact schema:
{{
  "verdicts": [
    {{
      "index": 0,
      "action": "new",
      "matchedMemoryId": null,
      "mergedText": null
    }},
    {{
      "index": 1,
      "action": "update",
      "matchedMemoryId": "abc123",
      "mergedText": "A concise merged version combining both phrasings"
    }}
  ]
}}
Include exactly one verdict per candidate index. For "new" actions, matchedMemoryId and mergedText must be null."""

    result = await generate_content_with_fallback(
        [{"role": "user", "parts": [{"text": "Judge these candidates now."}]}],
        system_instruction,
        config={"temperature": 0.1, "response_mime_type": "application/json"},
    )

    if result and result.get("text"):
        try:
            parsed = json.loads(result["text"])
            verdicts = parsed.get("verdicts")
            if isinstance(verdicts, list):
                return {"success": True, "verdicts": verdicts}
        except ValueError:
            pass  # JSON parse failed, fall through to the safe default

    # Safe default on any failure: treat every candidate as new rather than
    # risk silently discarding a real new memory.
    return {
        "success": True,
        "verdicts": [{"index": c.index, "action": "new", "matchedMemoryId": None, "mergedText": None} for c in payload.candidates],
    }
