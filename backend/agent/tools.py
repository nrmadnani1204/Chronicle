"""
Tools for Chronicle's conversational agent. All operate on data already
present in the current request (memories, past sessions the client already
sent) — no new network I/O, no new secrets. Built as closures over per-request
context rather than taking that context as function-call arguments, since
LLMs are unreliable at faithfully echoing back large structured payloads as
tool-call arguments.

`send_weekly_meme` is deliberately NOT a tool here — it's reserved for the
background weekly-digest job only, so a normal chat turn can never trigger an
email send.
"""
import datetime
from typing import Any, Callable, Optional


def _memory_texts(memories: list[Any]) -> list[str]:
    return [m if isinstance(m, str) else str(m.get("text", "")) for m in memories if m]


def build_tools(memories: list[Any], graph_context: Optional[list[Any]] = None) -> list[Callable]:
    # Search over both the flat memory list and the richer knowledge-graph
    # context (people, aspirations, likes/dislikes) — the graph often carries
    # detail (e.g. a person's name) that the flat memory text doesn't.
    memory_texts = _memory_texts(memories) + _memory_texts(graph_context or [])

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

    return [search_user_memories, get_user_preferences, suggest_activity, recommend_song, get_current_time]
