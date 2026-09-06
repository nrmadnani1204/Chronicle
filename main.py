"""
Entrypoint for the Python sidecar. All Gemini/LLM logic lives in the
`backend` package (agent, memory extraction, deterministic fallbacks, route
handlers) — this file only wires up uvicorn. Binds to 127.0.0.1 only — it
should never be reachable from outside the container. server.ts proxies
routes to this sidecar (see server.ts's PYTHON_SIDECAR_URL) and is the only
process bound to $PORT.
"""
from backend.app import app
from backend.config import PORT

if __name__ == "__main__":
    import uvicorn

    # 127.0.0.1 only, not 0.0.0.0 — this must stay internal to the container.
    uvicorn.run(app, host="127.0.0.1", port=PORT)
