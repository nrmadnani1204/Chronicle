import express from "express";
import path from "path";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import { spawn, ChildProcess } from "child_process";

dotenv.config();

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

// Standard Top-Level Request Deserialization (Ordering Guarantee)
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true, limit: "5mb" }));

// --- Python sidecar (same container, internal-only port) ---
const PYTHON_SIDECAR_PORT = 8001;
const PYTHON_SIDECAR_URL = `http://127.0.0.1:${PYTHON_SIDECAR_PORT}`;
let pythonProcess: ChildProcess | null = null;
let pythonReady = false;

function startPythonSidecar() {
  try {
    pythonProcess = spawn("python3", ["main.py"], {
      stdio: "inherit",
      env: { ...process.env, PORT: String(PYTHON_SIDECAR_PORT) },
    });

    pythonProcess.on("error", (err) => {
      // ENOENT here almost always means python3 isn't installed/on PATH —
      // common on local Windows dev. Non-fatal: the rest of the app still runs.
      console.error("[python-sidecar] Failed to start:", err.message);
      console.error("[python-sidecar] Continuing without it — routes that depend on it will return 503.");
    });

    pythonProcess.on("exit", (code) => {
      pythonReady = false;
      console.error(`[python-sidecar] Exited with code ${code}.`);
    });
  } catch (err: any) {
    console.error("[python-sidecar] Could not spawn:", err?.message || err);
  }
}

async function waitForPythonSidecar(timeoutMs = 30000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${PYTHON_SIDECAR_URL}/health`);
      if (res.ok) {
        pythonReady = true;
        console.log("[python-sidecar] Ready.");
        return;
      }
    } catch {
      // Not up yet — keep polling.
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  console.error(`[python-sidecar] Did not become ready within ${timeoutMs}ms — continuing without it.`);
}

// Thin proxy to the Python sidecar, which owns all Gemini/LLM logic (model
// fallback ladder, prompt construction, offline-companion fallbacks).
async function proxyToPython(path: string, body: any, res: express.Response) {
  if (!pythonReady) {
    // The initial startup wait may have simply been too short (e.g. a slow
    // cold-start import under CPU throttling) rather than a real failure —
    // self-heal with one on-demand check instead of staying degraded for
    // this container instance's entire lifetime.
    try {
      const healthRes = await fetch(`${PYTHON_SIDECAR_URL}/health`, { signal: AbortSignal.timeout(2000) });
      if (healthRes.ok) {
        pythonReady = true;
        console.log("[python-sidecar] Became ready on retry.");
      }
    } catch {
      // Still not up — fall through to the 503 below.
    }
  }
  if (!pythonReady) {
    return res.status(503).json({ error: "Python sidecar is not ready." });
  }
  try {
    const pyRes = await fetch(`${PYTHON_SIDECAR_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body || {}),
    });
    const data = await pyRes.json();
    return res.status(pyRes.status).json(data);
  } catch (err: any) {
    console.error(`[python-sidecar] Request to ${path} failed:`, err?.message || err);
    return res.status(502).json({ error: "Python sidecar request failed." });
  }
}

// Health Check Endpoint
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Chronicle Attentive Friend Conversation API — proxied to the Python sidecar,
// which owns the Gemini call, fallback ladder, and offline-companion logic.
app.post("/api/chronicle/respond", (req, res) => proxyToPython("/api/chronicle/respond", req.body, res));

// Chronicle Memory Extraction & Emotional Weather API — proxied to Python.
app.post("/api/chronicle/extract-memory", (req, res) => proxyToPython("/api/chronicle/extract-memory", req.body, res));

// Memory duplicate judge (layer 2 of dedup, only called when the client's
// cheap fuzzy shortlist is non-empty) — proxied to Python.
app.post("/api/chronicle/judge-memory-duplicates", (req, res) => proxyToPython("/api/chronicle/judge-memory-duplicates", req.body, res));

// Internal weekly-digest trigger (Cloud Scheduler). This is the actual
// internet-facing edge, so the shared-secret check happens here, not in
// Python — the sidecar trusts that this check already ran.
app.post("/internal/weekly-digest", (req, res) => {
  const provided = req.header("X-Internal-Secret");
  const expected = process.env.INTERNAL_DIGEST_SECRET;
  if (!expected || provided !== expected) {
    return res.status(401).json({ error: "Unauthorized." });
  }
  return proxyToPython("/internal/weekly-digest", req.body, res);
});

// Backwards-compatible AI Reflection Endpoint — proxied to Python.
app.post("/api/gemini/reflect", (req, res) => proxyToPython("/api/gemini/reflect", req.body, res));

// Auto-Title Generation for Journal Sessions — proxied to Python.
app.post("/api/gemini/title", (req, res) => proxyToPython("/api/gemini/title", req.body, res));

// Mount Vite or Static files
async function start() {
  startPythonSidecar();
  // Fire-and-forget bounded wait — doesn't block app.listen() below. If
  // python3 isn't available (e.g. local Windows dev with no Python
  // installed) or its import graph is just slow on a cold start, this times
  // out and the app starts serving anyway; proxyToPython() self-heals with
  // an on-demand check afterward rather than staying degraded forever.
  waitForPythonSidecar();

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