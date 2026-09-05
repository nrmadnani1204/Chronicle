"""
Minimal Python sidecar for testing Node <-> Python wiring inside the same
Cloud Run container. Binds to 127.0.0.1 only — it should never be reachable
from outside the container. server.ts is the only process bound to $PORT.

Once wiring is confirmed working, replace /echo with your real LLM logic.
"""
import os

from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI()

# Port is passed in by server.ts when it spawns this process (see server.ts changes).
PORT = int(os.environ.get("PORT", "8001"))


@app.get("/health")
def health():
    return {"status": "ok", "service": "python-sidecar"}


class EchoPayload(BaseModel):
    prompt: str | None = None


@app.post("/echo")
def echo(payload: EchoPayload):
    return {
        "received_prompt": payload.prompt,
        "reply": f"[python-sidecar echo] you said: {payload.prompt!r}",
    }


if __name__ == "__main__":
    import uvicorn

    # 127.0.0.1 only, not 0.0.0.0 — this must stay internal to the container.
    uvicorn.run(app, host="127.0.0.1", port=PORT)