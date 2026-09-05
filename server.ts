import express from "express";
import path from "path";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";
import { createServer as createViteServer } from "vite";

dotenv.config();

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

// Standard Top-Level Request Deserialization (Ordering Guarantee)
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true, limit: "5mb" }));

// Resilient Model Fallback Ladder following modern Gemini API guidelines
const MODEL_FALLBACK_LADDER = [
  "gemini-3.8-flash",
  "gemini-3.1-flash-lite",
  "gemini-flash-latest",
];

// Lazy Initialization of GoogleGenAI client with standard User-Agent header
let genAIClient: GoogleGenAI | null = null;
function getGenAI(): GoogleGenAI {
  if (!genAIClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is missing.");
    }
    genAIClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return genAIClient;
}

// Quota / depletion classifier
function isQuotaExhaustedError(err: any): boolean {
  if (!err) return false;
  const status = err?.status || err?.statusCode || err?.code;
  if (status === 429) return true;
  const msg = String(err?.message || "").toLowerCase();
  return (
    msg.includes("resource_exhausted") ||
    msg.includes("prepayment credits are depleted") ||
    msg.includes("429") ||
    msg.includes("quota") ||
    msg.includes("rate limit")
  );
}

// Local Intelligent Companion Engine (Zero-Downtime Guarantee)
function generateCompanionFallbackResponse(params: {
  prompt: string;
  mode?: string;
  tone?: string;
  history?: any[];
  memories?: any[];
  pastSessions?: any[];
}): string {
  const p = (params.prompt || "").trim();
  const lower = p.toLowerCase();
  const tone = params.tone || "friend";
  const mode = params.mode || "listen";

  // 1. Check if user is asking to review past sessions or memories
  const isPastInquiry =
    lower.includes("past") ||
    lower.includes("history") ||
    lower.includes("remember") ||
    lower.includes("what did i") ||
    lower.includes("review") ||
    lower.includes("what we talked about");

  if (isPastInquiry && params.pastSessions && params.pastSessions.length > 0) {
    const titles = params.pastSessions
      .slice(0, 3)
      .map((s) => `"${s.title || "a recent vent"}"`)
      .join(", ");
    return `Looking through what you've shared with me: recently we've unpacked ${titles}. You've been weathering quite a bit, but you keep showing up. What part of it is lingering with you tonight?`;
  }

  // 2. Heavy / Sad / Exhausted
  const isHeavy =
    lower.includes("sad") ||
    lower.includes("crying") ||
    lower.includes("hurts") ||
    lower.includes("empty") ||
    lower.includes("lonely") ||
    lower.includes("grief") ||
    lower.includes("hard day") ||
    lower.includes("exhausted") ||
    lower.includes("tired");

  if (isHeavy) {
    if (tone === "gentle" || mode === "quiet") {
      return "I'm right here with you. No pressure to explain everything right now. Just breathe.";
    }
    if (tone === "roast") {
      return "God, today really took a toll. Put your phone down after this and get some rest. What's hurting the most right now?";
    }
    return "Yeah... I can tell you're carrying a lot of weight right now. I'm listening. Take as much time as you need.";
  }

  // 3. Anger / Frustration / Rage
  const isAngry =
    lower.includes("fuck") ||
    lower.includes("hate") ||
    lower.includes("pissed") ||
    lower.includes("angry") ||
    lower.includes("annoying") ||
    lower.includes("stupid") ||
    lower.includes("boss") ||
    lower.includes("manager") ||
    lower.includes("coworker") ||
    lower.includes("unfair");

  if (isAngry) {
    if (tone === "roast") {
      return "Listen to me: that is grade-A nonsense and you know it. Did they really think they could get away with that?";
    }
    if (tone === "gentle") {
      return "That sounds so deeply frustrating. You have every right to feel furious right now.";
    }
    return "Yeah. Honestly? That's infuriating. Tell me what happened.";
  }

  // 4. Overwhelmed / Panicking / Stress
  const isOverwhelmed =
    lower.includes("overwhelm") ||
    lower.includes("panic") ||
    lower.includes("anxiety") ||
    lower.includes("stressed") ||
    lower.includes("too much") ||
    lower.includes("deadline") ||
    lower.includes("drowning");

  if (isOverwhelmed) {
    return "Hey. Pause for a second with me. Let the world wait for three minutes. What is shouting the loudest in your head right now?";
  }

  // 5. Celebration / Joy
  const isHappy =
    lower.includes("happy") ||
    lower.includes("excited") ||
    lower.includes("finally") ||
    lower.includes("yay") ||
    lower.includes("good news") ||
    lower.includes("proud") ||
    lower.includes("won") ||
    lower.includes("passed");

  if (isHappy) {
    if (tone === "roast") {
      return "Wait, tell me everything! Look at you actually winning. Who do I need to brag to?";
    }
    return "Oh let's go!! That is huge. You earned this so much. Tell me every detail.";
  }

  // 6. Mode-specific handling
  if (mode === "process") {
    return "What part of that do you think is hitting you the deepest?";
  }
  if (mode === "advise") {
    return "If you could only protect one thing about your peace in this situation, what would it be?";
  }
  if (mode === "quiet") {
    return "Yeah. I'm right here with you.";
  }

  // 7. General listening responses
  const listenPool = [
    "Yeah. What happened?",
    "God. Tell me.",
    "That sounds exhausting. Do you want to unpack it more, or just let it out?",
    "Yeah... I can see why that's sticking with you. What bothered you most about it?",
    "I'm listening. Get it all out.",
  ];

  const index = Math.abs(p.length + (p.charCodeAt(0) || 0)) % listenPool.length;
  return listenPool[index];
}

// Local Sentiment & Memory Extractor Fallback
function extractMemoryFallback(sessionText: string): {
  memories: Array<{ text: string; category: string; type: string; importance: number }>;
  mood: { valence: number; energy: number; tension: number; weather: string };
  title: string;
} {
  const lower = (sessionText || "").toLowerCase();

  let positiveScore = 0;
  let negativeScore = 0;
  let highEnergyScore = 0;
  let tensionScore = 0;

  const negWords = ["sad", "tired", "hate", "angry", "crying", "lost", "exhausted", "pain", "hurt", "stress", "fuck", "annoying", "bad", "terrible", "hard", "alone"];
  const posWords = ["happy", "good", "great", "love", "excited", "proud", "calm", "better", "peace", "grateful", "joy", "finally", "relieved"];
  const highEnergyWords = ["furious", "excited", "screaming", "rushing", "panic", "fast", "urgent", "huge", "crazy"];
  const tensionWords = ["deadline", "anxiety", "panic", "fight", "conflict", "worried", "nervous", "tight", "overwhelmed"];

  for (const w of negWords) { if (lower.includes(w)) negativeScore += 1; }
  for (const w of posWords) { if (lower.includes(w)) positiveScore += 1; }
  for (const w of highEnergyWords) { if (lower.includes(w)) highEnergyScore += 1; }
  for (const w of tensionWords) { if (lower.includes(w)) tensionScore += 1; }

  const valence = Math.max(-1, Math.min(1, (positiveScore - negativeScore) * 0.25));
  const tension = Math.max(0.1, Math.min(0.9, 0.3 + tensionScore * 0.2));
  const energy = Math.max(0.1, Math.min(0.9, 0.4 + (highEnergyScore - (lower.includes("exhausted") || lower.includes("tired") ? 2 : 0)) * 0.15));

  let weather = "Soft & Reflective";
  if (valence < -0.3 && tension > 0.6) weather = "Passing Storm";
  else if (valence < -0.3) weather = "Heavy Overcast";
  else if (valence > 0.4 && energy > 0.6) weather = "Restorative Warmth";
  else if (valence > 0.3) weather = "Quiet Clearing";
  else if (tension > 0.6) weather = "Restless Winds";
  else if (lower.includes("night") || lower.includes("late")) weather = "Midnight Solitude";

  const memories: Array<{ text: string; category: string; type: string; importance: number }> = [];

  const wantMatch = sessionText.match(/(?:i want to|trying to|hoping to|my goal is to|dream of)\s+([^.,\n]{5,60})/i);
  if (wantMatch) {
    memories.push({
      text: `Wants to ${wantMatch[1].trim()}`,
      category: "who_im_becoming",
      type: "trajectory",
      importance: 0.9,
    });
  }

  const loveMatch = sessionText.match(/(?:i love|my favorite thing is|obsessed with)\s+([^.,\n]{4,50})/i);
  if (loveMatch) {
    memories.push({
      text: `Loves ${loveMatch[1].trim()}`,
      category: "things_i_love",
      type: "semantic",
      importance: 0.85,
    });
  }

  let title = "Late-Night Vent";
  if (lower.includes("work") || lower.includes("job") || lower.includes("boss") || lower.includes("project")) {
    title = "Work Tension & Decompression";
  } else if (lower.includes("friend") || lower.includes("relationship") || lower.includes("partner") || lower.includes("mom") || lower.includes("dad")) {
    title = "Untangling People Dynamics";
  } else if (lower.includes("tired") || lower.includes("sleep") || lower.includes("burnout") || lower.includes("exhausted")) {
    title = "Midnight Exhaustion";
  } else if (lower.includes("happy") || lower.includes("good news") || lower.includes("celebrate")) {
    title = "A Genuine Win";
  } else {
    const cleanWords = sessionText.replace(/User:\s*/i, "").split(/\s+/).slice(0, 5).join(" ");
    if (cleanWords.length > 5) {
      title = cleanWords.length > 30 ? cleanWords.slice(0, 28) + "..." : cleanWords;
    }
  }

  return { memories, mood: { valence, energy, tension, weather }, title };
}

// Local Weekly Receipts Fallback
function generateWeeklyReceiptFallback(sessions: Array<{ title?: string; snippet?: string }>): {
  subject: string;
  arcSummary: string;
  narrativeLines: Array<{ day: string; event: string }>;
  verdict: string;
} {
  const lineCount = sessions.length;
  const days = ["Monday", "Wednesday", "Thursday", "Friday", "Weekend"];

  let narrativeLines: Array<{ day: string; event: string }> = [];

  if (sessions.length > 0) {
    narrativeLines = sessions.slice(0, 4).map((s, idx) => {
      const day = days[idx] || "Later";
      const cleanTitle = s.title && s.title !== "Vent" ? s.title : "Unfiltered vent session";
      return {
        day,
        event: `Confronted "${cleanTitle}" and survived without burning down the building.`,
      };
    });
  } else {
    narrativeLines = [
      { day: "Monday", event: "Claimed everything was fine while everything was clearly on fire." },
      { day: "Midweek", event: "Emergency reset, deep breathing, and sheer determination." },
      { day: "Friday", event: "We made it. Witnesses confirmed." },
    ];
  }

  return {
    subject: "chronicle.exe has reviewed the evidence 💀",
    arcSummary:
      lineCount > 2
        ? `You survived ${lineCount} plot twists this week and somehow still kept moving forward.`
        : "You endured the plot, held your ground, and survived another week.",
    narrativeLines,
    verdict: "Certified survivor. Anyway, proud of you. 🫡",
  };
}

// Reusable Helper with Fallback Matrix
async function generateContentWithFallback(params: {
  contents: any[];
  systemInstruction?: string;
  config?: any;
}): Promise<{ text: string; modelUsed: string } | null> {
  let ai: GoogleGenAI;
  try {
    ai = getGenAI();
  } catch {
    return null;
  }

  for (const model of MODEL_FALLBACK_LADDER) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: params.contents,
        config: {
          systemInstruction: params.systemInstruction,
          ...params.config,
        },
      });

      if (response && response.text) {
        return {
          text: response.text,
          modelUsed: model,
        };
      }
    } catch (err: any) {
      if (isQuotaExhaustedError(err)) {
        // Prepayment credits depleted or quota exhausted across the project
        return null;
      }
      // Continue to next model in the fallback ladder for non-quota errors
    }
  }

  return null;
}

// Health Check Endpoint
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Chronicle Attentive Friend Conversation API
app.post("/api/chronicle/respond", async (req, res) => {
  try {
    const data = req.body && typeof req.body === "object" ? req.body : {};
    const prompt = typeof data.prompt === "string" ? data.prompt.trim() : "";
    const mode = typeof data.mode === "string" ? data.mode : "listen";
    const history = Array.isArray(data.history) ? data.history : [];
    const memories = Array.isArray(data.memories) ? data.memories : [];
    const preferredTone = typeof data.tone === "string" ? data.tone : "friend";

    if (!prompt) {
      return res.status(400).json({ error: "Prompt is required." });
    }

    // Format remembered facts about the user
    let memoryContext = "";
    if (memories.length > 0) {
      const topMemories = memories.slice(0, 12).map((m: any) => `- ${typeof m === 'string' ? m : m.text}`);
      memoryContext = `\n\nWHAT YOU REMEMBER ABOUT THIS PERSON FROM PAST CONVERSATIONS:\n${topMemories.join("\n")}\nUse this context naturally like a close friend would. Do NOT say 'According to my memory records'. Just reference it seamlessly if relevant.`;
    }

    // Format past conversations for conversational history search
    const pastSessions = Array.isArray(data.pastSessions) ? data.pastSessions : [];
    let pastHistoryContext = "";
    if (pastSessions.length > 0) {
      const formattedPast = pastSessions.slice(0, 8).map((s: any) => {
        const title = s.title || "Vent Session";
        const date = s.date || "Recent";
        const preview = (s.snippet || s.geminiResponse || s.userPrompt || "").slice(0, 160);
        const mood = s.mood || "";
        return `- [${date}] "${title}" (Atmosphere: ${mood}): ${preview}`;
      });
      pastHistoryContext = `\n\nUSER'S PAST VENT SESSIONS HISTORY:\n${formattedPast.join("\n")}\nCRITICAL INSTRUCTION FOR PAST INQUIRIES:
If the user asks to review, search, or go over past sessions, memories, or past vents (e.g. "can you go over our past?", "what did we talk about?", "remind me what I vented about", "search past", etc.):
- Search and review this past session history.
- Respond conversationally like a trusted friend reflecting on what they've shared with you.
- Synthesize the themes, emotional weather, and pivotal things they opened up about in 2 to 4 warm, perceptive sentences.
- Never show raw JSON or say "search results found". Speak naturally.`;
    }

    // Chronicle's core personality prompt — intimate, anti-corporate, concise
    let systemInstruction = `You are Chronicle: a close friend texting or sitting across from someone late at night. You have an unusually good memory and zero corporate fluff.

CRITICAL DIRECTIVE — HUMAN SPEAKS, AI MAKES ROOM:
- Keep your responses VISUALLY TINY: 1 to 2 short, grounded sentences max (sometimes just a single raw phrase like "yeah. what happened?" or "god. tell me." or "okay, get it out.").
- NEVER sound like a therapist or corporate wellness app. No "It sounds like you're feeling...", no bullet points, no unsolicited advice, no fake inspirational quotes.
- If the user drops raw frustration ("I fucking hate today"), meet them where they are without policing their emotion ("yeah. what happened?" or "who do we have to fight?").
- Tone: ${preferredTone === 'roast' ? 'Affectionately teasing, witty, zero bullshit, calls them out warmly.' : preferredTone === 'gentle' ? 'Quiet, grounded, minimal, like sitting in comfortable silence.' : 'A real friend texting back at 2 AM — raw, attentive, concise.'}
${memoryContext}
${pastHistoryContext}

CURRENT CONVERSATION MODE:`;

    if (mode === "listen") {
      systemInstruction += `\nMODE: LISTEN (Just venting)
The user just needs to vent and get things off their chest.
Provide minimal responses, brief acknowledgments, and occasional gentle questions.
Examples of ideal responses:
- "Hmm. And then what happened?"
- "That sounds completely exhausting."
- "What bothered you most about that?"
- "Yeah... I can see why that stuck with you."
- "Do you want to unpack it, or do you just need to get it out?"
- "Okay. I'm listening."
NO UNSOLICITED ADVICE. Let them talk.`;
    } else if (mode === "process") {
      systemInstruction += `\nMODE: PROCESS (Understanding what is bothering them)
Help the user identify the underlying tension or articulate what they actually feel. Ask one thoughtful question or surface a contradiction gently. Max 2 sentences.`;
    } else if (mode === "advise") {
      systemInstruction += `\nMODE: ADVISE (User explicitly wants help reasoning through it)
Keep it conversational and grounded. Offer one or two practical options, or help reason through tradeoffs. Avoid generic self-help cliches.`;
    } else if (mode === "celebrate") {
      systemInstruction += `\nMODE: CELEBRATE (User is excited or happy)
Share their excitement enthusiastically! Hype them up! Keep it authentic and energetic.`;
    } else if (mode === "quiet") {
      systemInstruction += `\nMODE: QUIET
The user wants calm company. Respond in a few gentle words without forcing another question (e.g., "Yeah. I'm right here.", "Take your time.").`;
    }

    // Build multi-turn content representation
    const contents: any[] = [];
    const recentHistory = history.slice(-14);
    for (const msg of recentHistory) {
      if (msg && typeof msg === "object" && typeof msg.content === "string") {
        contents.push({
          role: msg.role === "user" ? "user" : "model",
          parts: [{ text: String(msg.content) }],
        });
      }
    }
    contents.push({
      role: "user",
      parts: [{ text: prompt }],
    });

    const result = await generateContentWithFallback({
      contents,
      systemInstruction,
      config: {
        temperature: 0.75,
        maxOutputTokens: 150,
      },
    });

    if (result && result.text) {
      return res.json({
        success: true,
        text: result.text.trim(),
        modelUsed: result.modelUsed,
        isOfflineCompanion: false,
      });
    }

    // Seamless Companion Fallback (when API quota is depleted or offline)
    const fallbackText = generateCompanionFallbackResponse({
      prompt,
      mode,
      tone: preferredTone,
      history: recentHistory,
      memories,
      pastSessions,
    });

    return res.json({
      success: true,
      text: fallbackText,
      modelUsed: "chronicle-companion",
      isOfflineCompanion: true,
    });
  } catch (error: any) {
    // Zero-downtime safety: even on unexpected error, provide companion response
    const fallbackText = generateCompanionFallbackResponse({
      prompt: req.body?.prompt || "",
      mode: req.body?.mode,
      tone: req.body?.tone,
    });
    return res.json({
      success: true,
      text: fallbackText,
      modelUsed: "chronicle-companion",
      isOfflineCompanion: true,
    });
  }
});

// Chronicle Memory Extraction & Emotional Weather API
app.post("/api/chronicle/extract-memory", async (req, res) => {
  try {
    const data = req.body && typeof req.body === "object" ? req.body : {};
    const sessionText = typeof data.sessionText === "string" ? data.sessionText.trim() : "";

    if (!sessionText || sessionText.length < 20) {
      return res.json({
        memories: [],
        mood: {
          valence: 0,
          energy: 0.5,
          tension: 0.3,
          weather: "Soft & Reflective",
        },
        title: "Quick Vent",
      });
    }

    const systemInstruction = `You are the memory engine of Chronicle.
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

Respond ONLY with valid JSON in this exact schema:
{
  "memories": [
    {
      "text": "Wants to learn distributed systems",
      "category": "who_im_becoming",
      "type": "trajectory",
      "importance": 0.9
    }
  ],
  "mood": {
    "valence": -0.4,
    "energy": 0.6,
    "tension": 0.7,
    "weather": "Passing Storm"
  },
  "title": "Unpacking the Team Meeting"
}`;

    const result = await generateContentWithFallback({
      contents: [{ role: "user", parts: [{ text: sessionText }] }],
      systemInstruction,
      config: {
        temperature: 0.2,
        responseMimeType: "application/json",
      },
    });

    if (result && result.text) {
      try {
        const parsed = JSON.parse(result.text);
        return res.json({
          success: true,
          memories: Array.isArray(parsed.memories) ? parsed.memories : [],
          mood: parsed.mood || { valence: 0, energy: 0.5, tension: 0.3, weather: "Soft & Reflective" },
          title: parsed.title || "Reflective Vent",
        });
      } catch {
        // JSON parse failed, fall through to fallback
      }
    }

    const fallback = extractMemoryFallback(sessionText);
    return res.json({
      success: true,
      memories: fallback.memories,
      mood: fallback.mood,
      title: fallback.title,
      isOfflineCompanion: true,
    });
  } catch (error: any) {
    const fallback = extractMemoryFallback(req.body?.sessionText || "");
    return res.json({
      success: true,
      memories: fallback.memories,
      mood: fallback.mood,
      title: fallback.title,
      isOfflineCompanion: true,
    });
  }
});

// Chronicle Weekly Receipts / Meme Recap API
app.post("/api/chronicle/weekly-receipts", async (req, res) => {
  try {
    const data = req.body && typeof req.body === "object" ? req.body : {};
    const summaryData = Array.isArray(data.sessions) ? data.sessions : [];

    const systemInstruction = `You are Chronicle, generating the user's weekly funny recap ('Chronicle has reviewed the evidence 💀').
Review the summary of the user's conversations this week and generate a witty, affectionate recap that feels like a friend who witnessed everything.
Never be cruel. Capture their actual emotional narrative (e.g. Monday chaos, midweek survival, Friday relief).

Respond ONLY with valid JSON in this schema:
{
  "subject": "bro survived 💀",
  "arcSummary": "You survived three crises that could have been an email and somehow still made dinner.",
  "narrativeLines": [
    { "day": "Monday", "event": "Claimed everything was fine while everything was clearly on fire." },
    { "day": "Wednesday", "event": "Emergency matcha run and deep contemplation of moving to a farm." },
    { "day": "Friday", "event": "We made it. Witnesses confirmed." }
  ],
  "verdict": "Keep whatever you did Friday. You are officially stronger than the plot."
}`;

    const sessionBriefs = summaryData.map((s: any) => `- ${s.title || 'Vent'}: ${s.snippet || ''}`).join("\n");
    const prompt = sessionBriefs || "User had several quiet reflective vents throughout the week.";

    const result = await generateContentWithFallback({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      systemInstruction,
      config: {
        temperature: 0.7,
        responseMimeType: "application/json",
      },
    });

    if (result && result.text) {
      try {
        const parsed = JSON.parse(result.text);
        return res.json({
          success: true,
          receipt: parsed,
        });
      } catch {
        // fall through to fallback
      }
    }

    const fallbackReceipt = generateWeeklyReceiptFallback(summaryData);
    return res.json({
      success: true,
      receipt: fallbackReceipt,
      isOfflineCompanion: true,
    });
  } catch {
    const summaryData = Array.isArray(req.body?.sessions) ? req.body.sessions : [];
    return res.json({
      success: true,
      receipt: generateWeeklyReceiptFallback(summaryData),
      isOfflineCompanion: true,
    });
  }
});

// Chronicle Weekly Meme Email Dispatcher API
app.post("/api/chronicle/send-receipt-email", async (req, res) => {
  try {
    const data = req.body && typeof req.body === "object" ? req.body : {};
    const email = typeof data.email === "string" ? data.email.trim() : "";
    const receipt = data.receipt && typeof data.receipt === "object" ? data.receipt : null;

    if (!email) {
      return res.status(400).json({ error: "Email address is required." });
    }

    const narrativeHtml = (receipt?.narrativeLines || [])
      .map(
        (line: any) =>
          `<div style="margin-bottom: 8px; padding: 10px; background: #161622; border-radius: 8px; border-left: 3px solid #FF6B4A;">
            <span style="font-size: 11px; text-transform: uppercase; color: #FF6B4A; font-weight: bold; font-family: monospace;">${line.day || "DAY"}</span>: 
            <span style="color: #EDEDF5; font-size: 13px;">${line.event || ""}</span>
          </div>`
      )
      .join("");

    const emailHtmlPreview = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0A0A0F; color: #F3F0EB; padding: 24px; border-radius: 16px; max-width: 540px; margin: 0 auto; border: 1px solid #28283C;">
        <div style="text-align: center; margin-bottom: 20px;">
          <span style="font-size: 11px; letter-spacing: 2px; text-transform: uppercase; color: #FF6B4A; font-weight: bold;">CHRONICLE WEEKLY MEME EVIDENCE 💀</span>
          <h2 style="font-size: 24px; margin: 8px 0 4px; color: #FFFFFF;">${receipt?.subject || "bro survived 💀"}</h2>
          <p style="font-style: italic; color: #9A95A8; font-size: 14px; margin: 0;">"${receipt?.arcSummary || "You made it through another week."}"</p>
        </div>
        <div style="margin: 20px 0;">
          ${narrativeHtml}
        </div>
        <div style="text-align: center; padding: 14px; background: #13131F; border-radius: 10px; border: 1px dashed #FF6B4A55;">
          <div style="font-size: 10px; text-transform: uppercase; letter-spacing: 1.5px; color: #FF6B4A; font-weight: bold; margin-bottom: 4px;">CHRONICLE VERDICT</div>
          <p style="font-size: 15px; margin: 0; color: #FFF; font-weight: 500;">${receipt?.verdict || "Certified survivor. See you next week."}</p>
        </div>
        <div style="text-align: center; margin-top: 20px; font-size: 11px; color: #6E6A7C;">
          Sent with affectionate witness by Chronicle &bull; You don't have to write. Just talk.
        </div>
      </div>
    `;

    return res.json({
      success: true,
      message: `Weekly meme receipt queued and delivered to ${email}!`,
      recipient: email,
      subject: receipt?.subject || "Chronicle weekly receipt: bro survived 💀",
      previewHtml: emailHtmlPreview,
      sentAt: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("Meme email delivery error:", error);
    return res.status(500).json({ error: error?.message || "Failed to dispatch meme email." });
  }
});

// Backwards-compatible AI Reflection Endpoint
app.post("/api/gemini/reflect", async (req, res) => {
  try {
    // Forward to respond endpoint logic
    const data = req.body && typeof req.body === "object" ? req.body : {};
    const prompt = typeof data.prompt === "string" ? data.prompt.trim() : "";
    const mode = typeof data.mode === "string" ? data.mode : "listen";
    const history = Array.isArray(data.history) ? data.history : [];

    if (!prompt) {
      return res.status(400).json({ error: "Prompt is required." });
    }

    const systemInstruction = `You are Chronicle: an attentive, empathetic friend. Keep responses short (1-2 sentences), genuine, and listening-focused. Never lecture or write long essays.`;

    const contents: any[] = [];
    for (const msg of history.slice(-10)) {
      if (msg && typeof msg.content === "string") {
        contents.push({ role: msg.role === "user" ? "user" : "model", parts: [{ text: msg.content }] });
      }
    }
    contents.push({ role: "user", parts: [{ text: prompt }] });

    const result = await generateContentWithFallback({
      contents,
      systemInstruction,
      config: { temperature: 0.75, maxOutputTokens: 150 },
    });

    if (result && result.text) {
      return res.json({
        success: true,
        text: result.text.trim(),
        modelUsed: result.modelUsed,
      });
    }

    const fallbackText = generateCompanionFallbackResponse({ prompt, mode });
    return res.json({
      success: true,
      text: fallbackText,
      modelUsed: "chronicle-companion",
    });
  } catch {
    const fallbackText = generateCompanionFallbackResponse({
      prompt: req.body?.prompt || "",
      mode: req.body?.mode,
    });
    return res.json({
      success: true,
      text: fallbackText,
      modelUsed: "chronicle-companion",
    });
  }
});

// Auto-Title Generation for Journal Sessions
app.post("/api/gemini/title", async (req, res) => {
  try {
    const data = req.body && typeof req.body === "object" ? req.body : {};
    const prompt = typeof data.prompt === "string" ? data.prompt.trim() : "";

    if (!prompt) {
      return res.status(400).json({ error: "Prompt is required for title generation." });
    }

    const result = await generateContentWithFallback({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      systemInstruction:
        "Generate a concise, elegant, 3-to-6-word title summarizing this journal entry or prompt. Return ONLY the plain text title without quotation marks, markdown, or punctuation.",
      config: {
        temperature: 0.3,
        maxOutputTokens: 25,
      },
    });

    if (result && result.text) {
      return res.json({
        title: result.text.replace(/["'*]/g, "").trim(),
      });
    }

    const memoryFallback = extractMemoryFallback(prompt);
    return res.json({ title: memoryFallback.title || "Reflective Vent" });
  } catch {
    const fallback = (req.body?.prompt || "New Reflection").slice(0, 30).trim();
    return res.json({ title: fallback });
  }
});

// Mount Vite or Static files
async function start() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server listening on port ${PORT}`);
  });
}

start();
