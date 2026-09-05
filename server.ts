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

// Resilient Model Fallback Ladder
const MODEL_FALLBACK_LADDER = [
  "gemini-3.6-flash",
  "gemini-3.1-flash-lite",
  "gemini-flash-latest",
  "gemini-3.7-flash",
];

// Lazy Initialization of GoogleGenAI client
let genAIClient: GoogleGenAI | null = null;
function getGenAI(): GoogleGenAI {
  if (!genAIClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is missing.");
    }
    genAIClient = new GoogleGenAI({ apiKey });
  }
  return genAIClient;
}

// Reusable Helper with Fallback Matrix
async function generateContentWithFallback(params: {
  contents: any[];
  systemInstruction?: string;
  config?: any;
}) {
  const ai = getGenAI();
  let lastError: any = null;

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
      lastError = err;
      const status = err?.status || err?.statusCode || err?.code || "";
      const msg = String(err?.message || "");
      console.warn(`[Gemini Fallback] Model '${model}' failed with status: ${status}. Message: ${msg}. Attempting next ladder step...`);
      // Continue to next model in the fallback ladder
    }
  }

  throw new Error(
    `All models in the fallback ladder failed. Last error: ${lastError?.message || "Unknown error"}`
  );
}

// Health Check Endpoint
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// AI Reflection & Conversation API Endpoint
app.post("/api/gemini/reflect", async (req, res) => {
  try {
    // Defensive Payload Ingestion (Null-Safe Destructuring)
    const data = req.body && typeof req.body === "object" ? req.body : {};
    const prompt = typeof data.prompt === "string" ? data.prompt.trim() : "";
    const mode = typeof data.mode === "string" ? data.mode : "reflect";
    const history = Array.isArray(data.history) ? data.history : [];

    if (!prompt) {
      return res.status(400).json({
        error: "Prompt is required and must be non-empty.",
      });
    }

    // Input sanitization / length limit
    if (prompt.length > 20000) {
      return res.status(400).json({
        error: "Input exceeds maximum character limit of 20,000 characters.",
      });
    }

    // Determine system instructions based on reflection mode
    let systemInstruction = `You are a thoughtful, empathetic, and intellectually rigorous reflective companion and journaling guide.
Your purpose is to help the user unpack their thoughts, gain clarity, recognize patterns, brainstorm actionable next steps, and develop deeper self-awareness.
- Treat all user reflections as personal, subjective experiences.
- Maintain an encouraging, non-judgmental, grounded tone.
- Format responses clearly with markdown, utilizing bullet points, structured headings, or concise thought-provoking questions where appropriate.
- Never claim to replace professional psychological counseling or medical advice.`;

    if (mode === "summarize") {
      systemInstruction += `\nMode: EXECUTIVE SUMMARY & KEY THEMES.
Provide a crystal-clear summary of the entry:
1. Core Themes (2-3 key insights)
2. Emotional Landscape (tone and unexpressed feelings)
3. Actionable Takeaways & Next Steps`;
    } else if (mode === "brainstorm") {
      systemInstruction += `\nMode: DIVERGENT BRAINSTORMING & PERSPECTIVES.
Provide inventive perspectives, creative options, alternative angles, and constructive thought experiments based directly on what the user shared.`;
    } else if (mode === "chat") {
      systemInstruction += `\nMode: MULTI-TURN SOCRATIC DIALOGUE.
Engage in a continuous thoughtful conversation with the user, referencing prior turns and asking 1 or 2 targeted questions to deepen the reflection.`;
    } else {
      systemInstruction += `\nMode: DEEP REFLECTIVE MIRROR.
Synthesize the user's reflection, validate their sentiments, mirror back key discoveries, and offer an empowering perspective.`;
    }

    // Build multi-turn content representation for @google/genai SDK
    const contents: any[] = [];

    // Add prior sanitized history turns (limit last 16 turns to avoid context overflow)
    const recentHistory = history.slice(-16);
    for (const msg of recentHistory) {
      if (msg && typeof msg === "object" && typeof msg.content === "string") {
        contents.push({
          role: msg.role === "user" ? "user" : "model",
          parts: [{ text: String(msg.content) }],
        });
      }
    }

    // Append the current turn
    contents.push({
      role: "user",
      parts: [{ text: prompt }],
    });

    const result = await generateContentWithFallback({
      contents,
      systemInstruction,
    });

    return res.json({
      success: true,
      text: result.text,
      modelUsed: result.modelUsed,
    });
  } catch (error: any) {
    console.error("Gemini API generation error:", error);
    return res.status(500).json({
      error: error?.message || "Failed to generate reflection from Gemini.",
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

    return res.json({
      title: result.text.replace(/["'*]/g, "").trim(),
    });
  } catch (err: any) {
    console.warn("Title generation failed, using fallback:", err?.message);
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
