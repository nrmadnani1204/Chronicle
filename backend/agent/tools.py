"""
Tools for Chronicle's conversational agent. Most operate on data already
present in the current request (memories, past sessions the client already
sent) — built as closures over per-request context rather than taking that
context as function-call arguments, since LLMs are unreliable at faithfully
echoing back large structured payloads as tool-call arguments. A few do real
outbound I/O: `find_song_to_play` (YouTube search), `find_nearby_places`
(Places API), and the built-in `google_search` (Gemini's native Google
Search grounding, for career/learning questions that need current or
specific information beyond memory).

`send_weekly_meme` is deliberately NOT a tool here — it's reserved for the
background weekly-digest job only, so a normal chat turn can never trigger an
email send.
"""
import datetime
from typing import Any, Optional

import httpx
from google.adk.tools.google_search_tool import GoogleSearchTool
from googleapiclient.discovery import build as build_google_api_client

from backend.config import PLACES_API_KEY, YOUTUBE_API_KEY


def _memory_texts(memories: list[Any]) -> list[str]:
    return [m if isinstance(m, str) else str(m.get("text", "")) for m in memories if m]


def _memory_pairs(memories: list[Any]) -> list[dict[str, str]]:
    """Only memories sent as {id, text} objects can be targeted for deletion —
    a plain string has no id to delete by."""
    return [
        {"id": m["id"], "text": m["text"]}
        for m in memories
        if isinstance(m, dict) and m.get("id") and m.get("text")
    ]


def build_tools(
    memories: list[Any],
    graph_context: Optional[list[Any]] = None,
    people: Optional[list[Any]] = None,
    latitude: Optional[float] = None,
    longitude: Optional[float] = None,
) -> list[Any]:
    # Search over both the flat memory list and the richer knowledge-graph
    # context (people, aspirations, likes/dislikes) — the graph often carries
    # detail (e.g. a person's name) that the flat memory text doesn't.
    memory_texts = _memory_texts(memories) + _memory_texts(graph_context or [])
    memory_pairs = _memory_pairs(memories)
    people_list = _memory_texts(people or [])

    def search_user_memories(query: str, limit: int = 5) -> list[str]:
        """Search what you remember about this person for anything relevant to `query`.

        Use this when the user asks you to recall something specific, or when
        recalling a relevant past detail would make your response land better.

        Args:
            query: What to search for (e.g. "career goals", "music taste").
            limit: Max number of matching memories to return.

        Returns:
            Up to `limit` memory snippets most relevant to the query.
        """
        if not memory_texts:
            return []
        q_words = [w for w in query.lower().split() if len(w) > 2]
        scored = []
        for m in memory_texts:
            m_lower = m.lower()
            score = sum(1 for w in q_words if w in m_lower)
            if score > 0:
                scored.append((score, m))
        scored.sort(key=lambda x: -x[0])
        results = [m for _, m in scored[:limit]]
        return results or memory_texts[:limit]

    def get_user_preferences(category: str) -> list[str]:
        """List what you know this person likes or prefers related to `category`.

        Args:
            category: A rough topic, e.g. "things they love", "routines",
                "happy places", "who they're becoming".

        Returns:
            Memory snippets that best match the requested category.
        """
        return search_user_memories(category, limit=6)

    def suggest_activity() -> str:
        """Suggest one small, personalized comfort activity for this user right
        now, based on things they've actually told you they enjoy — never a
        generic wellness suggestion."""
        activity_words = ("walk", "run", "shower", "bath", "nap", "sleep", "call", "game", "gaming", "draw", "paint", "read", "book", "cook", "bake", "yoga", "gym", "workout", "boxing")
        for m in memory_texts:
            m_lower = m.lower()
            if any(w in m_lower for w in activity_words):
                return m
        return "no specific comfort activity on record yet — ask them what usually helps"

    def recommend_song() -> str:
        """Recommend a song, artist, or genre this specific user might like
        right now, based on what they've told you they love — never a generic
        pop recommendation."""
        music_words = ("song", "music", "artist", "album", "playlist", "band", "singer")
        for m in memory_texts:
            m_lower = m.lower()
            if any(w in m_lower for w in music_words):
                return m
        return "no specific music preference on record yet — ask them what they've been listening to"

    def get_current_time() -> str:
        """Returns the current local server time, e.g. to reason about
        late-night conversations."""
        return datetime.datetime.now().strftime("%A, %I:%M %p")

    def find_song_to_play(query: str) -> dict:
        """Finds a specific song on YouTube so it can actually be played for
        the user right here in the chat — use this whenever the user mentions
        a song or artist they like, asks you to play something, or you want
        to act on a music recommendation instead of just describing it.

        Args:
            query: The song and/or artist to search for, as specific as
                possible (e.g. "Bohemian Rhapsody Queen", not just "queen song").

        Returns:
            {videoId, title, channelTitle} on success, or {} if not found —
            in that case, just mention the song by name instead of pretending
            to play it.
        """
        if not YOUTUBE_API_KEY:
            return {}
        try:
            youtube = build_google_api_client("youtube", "v3", developerKey=YOUTUBE_API_KEY, cache_discovery=False)
            response = (
                youtube.search()
                .list(part="snippet", type="video", videoCategoryId="10", maxResults=1, q=query)
                .execute()
            )
            items = response.get("items") or []
            if not items:
                return {}
            item = items[0]
            return {
                "videoId": item["id"]["videoId"],
                "title": item["snippet"]["title"],
                "channelTitle": item["snippet"]["channelTitle"],
            }
        except Exception as err:
            print(f"[find_song_to_play] error: {err}")
            return {}

    def find_nearby_places(query: str) -> list[dict]:
        """Finds real nearby places matching `query` (a food, activity, or
        place type) so you can suggest somewhere specific and real — use this
        when the user mentions liking something findable nearby (a food,
        a type of place) and it would genuinely help in the moment.

        Args:
            query: What to search for nearby, e.g. "cupcakes", "bowling alley".

        Returns:
            Up to 3 {name, address, rating} results, or [] if location isn't
            available or nothing was found — in that case, don't pretend to
            know of a specific place.
        """
        if not PLACES_API_KEY or latitude is None or longitude is None:
            return []
        try:
            resp = httpx.get(
                "https://maps.googleapis.com/maps/api/place/nearbysearch/json",
                params={
                    "location": f"{latitude},{longitude}",
                    "radius": 5000,
                    "keyword": query,
                    "key": PLACES_API_KEY,
                },
                timeout=5.0,
            )
            data = resp.json()
            results = []
            for item in (data.get("results") or [])[:3]:
                results.append({
                    "name": item.get("name", ""),
                    "address": item.get("vicinity", ""),
                    "rating": item.get("rating"),
                })
            return results
        except Exception as err:
            print(f"[find_nearby_places] error: {err}")
            return []

    def suggest_reaching_out() -> str:
        """Suggests a specific person from the user's life worth reaching out
        to right now, based on people they've actually mentioned before —
        never a generic "talk to someone" placeholder. Use this only when the
        user seems genuinely isolated or like they're carrying something
        heavy alone.

        Returns:
            A specific person reference (e.g. "Sister: ..."), or a note that
            no one specific is on record yet.
        """
        if not people_list:
            return "no specific person on record yet — just encourage them to reach out to someone they trust, without naming anyone"
        return people_list[0]

    def propose_memory_deletion(memory_description: str) -> dict:
        """Use this when the user explicitly corrects a memory you referenced
        — "I don't like that", "you misunderstood me", "that's not right" —
        to propose forgetting the specific memory they're correcting. This
        does NOT delete anything itself — it surfaces an explicit confirm/
        cancel choice to the user in the UI, so don't ask for confirmation
        yourself in your reply, just acknowledge naturally and briefly.

        Args:
            memory_description: What the memory is about, in your own words
                (e.g. "liking sad songs"), used to find the actual memory.

        Returns:
            {memoryId, memoryText} if a matching memory was found, or {} if
            nothing matched closely enough — in that case, just ask them to
            clarify what you got wrong instead.
        """
        if not memory_pairs:
            return {}
        desc_words = [w for w in memory_description.lower().split() if len(w) > 2]
        if not desc_words:
            return {}
        best: Optional[dict[str, str]] = None
        best_score = 0
        for pair in memory_pairs:
            text_lower = pair["text"].lower()
            score = sum(1 for w in desc_words if w in text_lower)
            if score > best_score:
                best_score = score
                best = pair
        if not best:
            return {}
        return {"memoryId": best["id"], "memoryText": best["text"]}

    return [
        search_user_memories,
        get_user_preferences,
        suggest_activity,
        recommend_song,
        get_current_time,
        find_song_to_play,
        find_nearby_places,
        suggest_reaching_out,
        propose_memory_deletion,
        # Gemini's native Google Search grounding — for career/learning
        # questions needing current or specific information beyond memory
        # (e.g. "I don't know where to start with DSA"). bypass_multi_tools_limit
        # is required to mix this built-in tool with the custom function
        # tools above in the same agent.
        GoogleSearchTool(bypass_multi_tools_limit=True),
    ]
