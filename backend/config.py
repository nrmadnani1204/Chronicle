import json
import os

PORT = int(os.environ.get("PORT", "8001"))

# The app uses a named Firestore database, not "(default)" — read the same
# ID the frontend uses (src/firebase.ts) from the same committed config file,
# so the Admin SDK (used only by the weekly digest job) never drifts from it.
FIRESTORE_DATABASE_ID = None
try:
    with open(
        os.path.join(os.path.dirname(__file__), "..", "firebase-applet-config.json"), encoding="utf-8"
    ) as f:
        FIRESTORE_DATABASE_ID = json.load(f).get("firestoreDatabaseId") or None
except (FileNotFoundError, ValueError):
    pass

# Gemini access goes through Vertex AI + Application Default Credentials, not
# an AI Studio API key. Locally: `gcloud auth application-default login`.
# On Cloud Run: the service's attached service account is used automatically
# via the metadata server — no key file needed there either.
GOOGLE_CLOUD_PROJECT = os.environ.get("GOOGLE_CLOUD_PROJECT")
GOOGLE_CLOUD_LOCATION = os.environ.get("GOOGLE_CLOUD_LOCATION", "global")
os.environ.setdefault("GOOGLE_GENAI_USE_VERTEXAI", "true")

MODEL_FALLBACK_LADDER = [
    "gemini-3.8-flash",
    "gemini-3.1-flash-lite",
    "gemini-flash-latest",
]

# Weekly Gmail digest — sent via a dedicated account's OAuth refresh token
# (see scripts/gmail_oauth_setup.py), not the user's own Gmail. Never a
# secret used for anything except this one background job.
GMAIL_OAUTH_CLIENT_ID = os.environ.get("GMAIL_OAUTH_CLIENT_ID")
GMAIL_OAUTH_CLIENT_SECRET = os.environ.get("GMAIL_OAUTH_CLIENT_SECRET")
GMAIL_OAUTH_REFRESH_TOKEN = os.environ.get("GMAIL_OAUTH_REFRESH_TOKEN")
GMAIL_SENDER_ADDRESS = os.environ.get("GMAIL_SENDER_ADDRESS")

# When true, the weekly digest job logs the rendered email instead of
# actually sending it via Gmail — safe for local testing.
DIGEST_DRY_RUN = os.environ.get("DIGEST_DRY_RUN", "false").lower() in ("true", "1")

# YouTube Data API v3 — used only for the agent's find_song_to_play tool
# (public search, read-only). Not a secret in the credential sense, but kept
# out of source control anyway; restricted to youtube.googleapis.com only.
YOUTUBE_API_KEY = os.environ.get("YOUTUBE_API_KEY")

# Places API — used only for the agent's find_nearby_places tool (public
# search, read-only). Restricted to places-backend.googleapis.com only.
PLACES_API_KEY = os.environ.get("PLACES_API_KEY")
