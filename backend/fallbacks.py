import re
from typing import Any, Optional


# --- Local Intelligent Companion Engine (Zero-Downtime Guarantee) ---
def generate_companion_fallback_response(
    prompt: str,
    mode: str = "listen",
    tone: str = "friend",
    past_sessions: Optional[list[dict[str, Any]]] = None,
) -> str:
    p = (prompt or "").strip()
    lower = p.lower()
    past_sessions = past_sessions or []

    is_past_inquiry = any(
        w in lower
        for w in ("past", "history", "remember", "what did i", "review", "what we talked about")
    )

    if is_past_inquiry and past_sessions:
        titles = ", ".join(f'"{s.get("title") or "a recent vent"}"' for s in past_sessions[:3])
        return (
            f"Looking through what you've shared with me: recently we've unpacked {titles}. "
            "You've been weathering quite a bit, but you keep showing up. "
            "What part of it is lingering with you tonight?"
        )

    # A bare greeting has no emotional content to pattern-match against — catch
    # it before the keyword buckets below, otherwise a short hash-bucketed pool
    # pick can land on something wildly mismatched (e.g. "hi" -> "sounds exhausting").
    greeting_words = {"hi", "hii", "hiii", "hello", "helloo", "hey", "heyy", "yo", "sup", "howdy", "morning", "evening", "afternoon", "good"}
    filler_words = {"there", "everyone", "chronicle", "again", "morning", "afternoon", "evening"}
    tokens = re.findall(r"[a-z']+", lower)
    if tokens and all(t in greeting_words or t in filler_words for t in tokens):
        greetings = [
            "Hey. What's going on?",
            "Hey there. What's on your mind?",
            "Hi. I'm here — what's up?",
        ]
        return greetings[len(lower) % len(greetings)]

    is_heavy = any(
        w in lower
        for w in ("sad", "crying", "hurts", "empty", "lonely", "grief", "hard day", "exhausted", "tired")
    )
    if is_heavy:
        if tone == "gentle" or mode == "quiet":
            return "I'm right here with you. No pressure to explain everything right now. Just breathe."
        if tone == "roast":
            return "God, today really took a toll. Put your phone down after this and get some rest. What's hurting the most right now?"
        return "Yeah... I can tell you're carrying a lot of weight right now. I'm listening. Take as much time as you need."

    is_angry = any(
        w in lower
        for w in ("fuck", "hate", "pissed", "angry", "annoying", "stupid", "boss", "manager", "coworker", "unfair")
    )
    if is_angry:
        if tone == "roast":
            return "Listen to me: that is grade-A nonsense and you know it. Did they really think they could get away with that?"
        if tone == "gentle":
            return "That sounds so deeply frustrating. You have every right to feel furious right now."
        return "Yeah. Honestly? That's infuriating. Tell me what happened."

    is_overwhelmed = any(
        w in lower
        for w in ("overwhelm", "panic", "anxiety", "stressed", "too much", "deadline", "drowning")
    )
    if is_overwhelmed:
        return "Hey. Pause for a second with me. Let the world wait for three minutes. What is shouting the loudest in your head right now?"

    is_happy = any(
        w in lower
        for w in ("happy", "excited", "finally", "yay", "good news", "proud", "won", "passed")
    )
    if is_happy:
        if tone == "roast":
            return "Wait, tell me everything! Look at you actually winning. Who do I need to brag to?"
        return "Oh let's go!! That is huge. You earned this so much. Tell me every detail."

    if mode == "process":
        return "What part of that do you think is hitting you the deepest?"
    if mode == "advise":
        return "If you could only protect one thing about your peace in this situation, what would it be?"
    if mode == "quiet":
        return "Yeah. I'm right here with you."

    listen_pool = [
        "Yeah. What happened?",
        "God. Tell me.",
        "That sounds exhausting. Do you want to unpack it more, or just let it out?",
        "Yeah... I can see why that's sticking with you. What bothered you most about it?",
        "I'm listening. Get it all out.",
    ]
    index = abs(len(p) + (ord(p[0]) if p else 0)) % len(listen_pool)
    return listen_pool[index]


# --- Local Sentiment & Memory Extractor Fallback ---
def extract_memory_fallback(session_text: str) -> dict[str, Any]:
    lower = (session_text or "").lower()

    neg_words = ["sad", "tired", "hate", "angry", "crying", "lost", "exhausted", "pain", "hurt", "stress", "fuck", "annoying", "bad", "terrible", "hard", "alone"]
    pos_words = ["happy", "good", "great", "love", "excited", "proud", "calm", "better", "peace", "grateful", "joy", "finally", "relieved"]
    high_energy_words = ["furious", "excited", "screaming", "rushing", "panic", "fast", "urgent", "huge", "crazy"]
    tension_words = ["deadline", "anxiety", "panic", "fight", "conflict", "worried", "nervous", "tight", "overwhelmed"]

    negative_score = sum(1 for w in neg_words if w in lower)
    positive_score = sum(1 for w in pos_words if w in lower)
    high_energy_score = sum(1 for w in high_energy_words if w in lower)
    tension_score = sum(1 for w in tension_words if w in lower)

    valence = max(-1.0, min(1.0, (positive_score - negative_score) * 0.25))
    tension = max(0.1, min(0.9, 0.3 + tension_score * 0.2))
    energy = max(
        0.1,
        min(
            0.9,
            0.4 + (high_energy_score - (2 if ("exhausted" in lower or "tired" in lower) else 0)) * 0.15,
        ),
    )

    weather = "Soft & Reflective"
    if valence < -0.3 and tension > 0.6:
        weather = "Passing Storm"
    elif valence < -0.3:
        weather = "Heavy Overcast"
    elif valence > 0.4 and energy > 0.6:
        weather = "Restorative Warmth"
    elif valence > 0.3:
        weather = "Quiet Clearing"
    elif tension > 0.6:
        weather = "Restless Winds"
    elif "night" in lower or "late" in lower:
        weather = "Midnight Solitude"

    memories: list[dict[str, Any]] = []
    nodes: list[dict[str, Any]] = []

    want_match = re.search(
        r"(?:i want to|trying to|hoping to|my goal is to|dream of)\s+([^.,\n]{5,60})", session_text, re.IGNORECASE
    )
    if want_match:
        label = f"Wants to {want_match.group(1).strip()}"[:60]
        memories.append({
            "text": label,
            "category": "who_im_becoming",
            "type": "trajectory",
            "importance": 0.9,
        })
        nodes.append({"label": label, "type": "aspiration", "importance": 0.85})

    love_match = re.search(
        r"(?:i love|my favorite thing is|obsessed with)\s+([^.,\n]{4,50})", session_text, re.IGNORECASE
    )
    if love_match:
        label = f"Loves {love_match.group(1).strip()}"[:60]
        memories.append({
            "text": label,
            "category": "things_i_love",
            "type": "semantic",
            "importance": 0.85,
        })
        nodes.append({"label": label, "type": "like", "importance": 0.75})

    # Only connect the two nodes if both were found — never invent a fake
    # second endpoint just to have an edge.
    edges: list[dict[str, Any]] = []
    if len(nodes) >= 2:
        edges.append({
            "sourceLabel": nodes[0]["label"],
            "targetLabel": nodes[1]["label"],
            "relation": "relates_to",
            "weight": 0.4,
        })

    title = "Late-Night Vent"
    if any(w in lower for w in ("work", "job", "boss", "project")):
        title = "Work Tension & Decompression"
    elif any(w in lower for w in ("friend", "relationship", "partner", "mom", "dad")):
        title = "Untangling People Dynamics"
    elif any(w in lower for w in ("tired", "sleep", "burnout", "exhausted")):
        title = "Midnight Exhaustion"
    elif any(w in lower for w in ("happy", "good news", "celebrate")):
        title = "A Genuine Win"
    else:
        clean_words = " ".join(re.sub(r"User:\s*", "", session_text, flags=re.IGNORECASE).split()[:5])
        if len(clean_words) > 5:
            title = clean_words[:28] + "..." if len(clean_words) > 30 else clean_words

    return {
        "memories": memories,
        "mood": {"valence": valence, "energy": energy, "tension": tension, "weather": weather},
        "title": title,
        "nodes": nodes,
        "edges": edges,
    }


# --- Local Weekly Receipts Fallback ---
def generate_weekly_receipt_fallback(sessions: list[dict[str, Any]]) -> dict[str, Any]:
    line_count = len(sessions)
    days = ["Monday", "Wednesday", "Thursday", "Friday", "Weekend"]

    if sessions:
        narrative_lines = []
        for idx, s in enumerate(sessions[:4]):
            day = days[idx] if idx < len(days) else "Later"
            title = s.get("title")
            clean_title = title if title and title != "Vent" else "Unfiltered vent session"
            narrative_lines.append({
                "day": day,
                "event": f'Confronted "{clean_title}" and survived without burning down the building.',
            })
    else:
        narrative_lines = [
            {"day": "Monday", "event": "Claimed everything was fine while everything was clearly on fire."},
            {"day": "Midweek", "event": "Emergency reset, deep breathing, and sheer determination."},
            {"day": "Friday", "event": "We made it. Witnesses confirmed."},
        ]

    return {
        "subject": "chronicle.exe has reviewed the evidence \U0001f480",
        "arcSummary": (
            f"You survived {line_count} plot twists this week and somehow still kept moving forward."
            if line_count > 2
            else "You endured the plot, held your ground, and survived another week."
        ),
        "narrativeLines": narrative_lines,
        "verdict": "Certified survivor. Anyway, proud of you. \U0001fae1",
    }
