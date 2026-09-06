# Chronicle — Cloud Run AI Challenge Application

**"You don't have to write. Just talk."** Chronicle is a voice-first AI journaling companion: you vent out loud (or type), and it responds like a close friend texting back at 2 AM — short, grounded, zero corporate wellness-app tone — while quietly building a long-term memory and knowledge graph of who you are underneath the venting. It's not a chatbot with a memory feature bolted on; the memory, mood, and graph systems are the product.

All user data (interactions, memories, mood history, knowledge-graph nodes/edges) is strictly isolated per user in Cloud Firestore under `/users/{userId}/...`, enforced by owner-scoped security rules (`request.auth.uid == userId`, never a blanket `allow read, write: if true`).

---

## What Chronicle actually does

- **Voice-first venting.** Press "Vent," talk freely. Speech-to-text runs entirely in the browser (native Web Speech API — `SpeechRecognition`/`webkitSpeechRecognition`), so there's no server round-trip or extra API cost just to transcribe. Replies are read back via the browser's native `speechSynthesis` (Text-to-Speech), so a session can be fully hands-free — talk, listen, repeat — with a text-input fallback for quiet environments.
- **A real agent, not a prompt.** Every reply goes through a Google ADK (`google-adk`) `LlmAgent` with function-calling tools (see below), not a single raw `generate_content` call. The agent decides *whether* a tool is worth calling for this specific message — it doesn't reach for memory search or Search grounding on every turn, matching the "close friend," not "customer support bot," personality.
- **Long-term, deduplicated memory.** Memories (things you love, who you're becoming, routines, etc.) are extracted from each session by Gemini, then run through a two-layer dedup pipeline before being saved: a cheap client-side fuzzy-match shortlist, then — only if that shortlist is non-empty — a dedicated Gemini "judge" call that decides whether a new memory is genuinely new or should *update* an existing one (versioned via `history[]`/`updatedAt`) instead of creating a near-duplicate.
- **A living knowledge graph ("Reflections").** Every session, person, like/dislike, aspiration, and mood moment becomes a node in a per-user graph (Firestore `graph_nodes`/`graph_edges`), explorable as an interactive 3D visualization. Nodes are further grouped into floating, semantically-clustered **themes** (e.g. "Comfort Food," "Family," "Career & Growth") that span otherwise-unrelated nodes — assigned by Gemini at extraction time and deduplicated the same way memories are, so themes stay consistent instead of fragmenting.
- **Mood that isn't just a today-snapshot.** Each session gets a numeric mood (valence/energy/tension + a poetic "weather" label like "Passing Storm"), and the whole app's background/tone is derived from a recency-weighted *trajectory* across recent sessions, not just the latest one.
- **Agentic real-world actions**, gated behind judgment rather than reflex:
  - **Google Search grounding** (Gemini's built-in tool) for concrete "I don't know where to start with X" career/learning questions, combined with what the agent already knows about the user from memory.
  - **YouTube Data API** — if you mention a song, the agent can actually find and embed it so it plays right in the chat.
  - **Google Places API** — if you mention craving something ("I love cupcakes"), the agent can look up real nearby places using the browser's Geolocation API, never a hardcoded/fake place name.
  - **Knowledge-graph-based "reach out" nudges** — if you seem genuinely isolated, the agent can suggest reaching out to a specific real person already in your graph (e.g. "have you talked to Sam about this?"), instead of a generic "talk to someone" platitude. Deliberately reuses the existing graph instead of integrating the real Google Contacts/People API, which would need sensitive-scope OAuth consent and Google app verification for a 2-user hackathon project.
  - **Human-in-the-loop memory correction** — if you tell the agent it misremembered something ("that's not right"), it proposes a specific memory to forget; deletion only happens after you explicitly confirm in the UI, never silently.
- **A weekly email digest**, sent via the Gmail API (not the user's own inbox — a dedicated sending account authorized once via OAuth, refresh-token-based, triggered by Cloud Scheduler hitting an internal endpoint protected by a shared secret) — a funny, graph-informed recap, not a generic analytics email.

---

## Architecture & Tech Stack

| Layer | Technology | Purpose |
| :--- | :--- | :--- |
| **Frontend** | React 19, Vite, Tailwind CSS, Lucide Icons, `motion` | Single-page conversational studio, mood-adaptive background, 3D graph explorer |
| **Voice I/O** | Web Speech API (`SpeechRecognition` for STT), `window.speechSynthesis` (TTS) | Fully client-side, zero extra cost/latency, hands-free vent sessions |
| **3D Knowledge Graph** | `react-force-graph-3d`, `three`, `three-spritetext` | Interactive, orbit-able visualization of the per-user knowledge graph with floating thematic clusters |
| **Node/Express layer** | Node 20, Express, `tsx`/esbuild | Thin edge: static asset serving (with correct cache-control split for hashed vs. entry files), auth-adjacent proxying to the Python sidecar, the one place the internal-digest shared-secret is checked |
| **Agent/AI backend** | Python, FastAPI, **Google ADK** (`LlmAgent` + function-calling tools), `google-genai` | Owns all Gemini calls: conversational agent, memory extraction, duplicate-memory judge, deterministic offline fallbacks |
| **Gemini access** | Vertex AI + Application Default Credentials (ADC) | Zero API keys for the core model — local `gcloud auth application-default login`, production via the Cloud Run service account's identity |
| **Auth** | Firebase Authentication (Google Sign-In) | Passwordless federated identity; Firebase Auth is also the source of truth for user enumeration (weekly digest, backfill scripts) since Firestore never gets an explicit `users/{uid}` parent doc |
| **Database** | Cloud Firestore (named database) | Owner-isolated persistence: interactions, memories, mood history, `graph_nodes`/`graph_edges` |
| **Google Search** | Gemini's built-in `GoogleSearchTool` (`bypass_multi_tools_limit=True`) | Grounds career/learning advice in current information, mixed into the same agent as the custom function tools |
| **Google Places API** | Legacy Nearby Search (`maps.googleapis.com/maps/api/place/nearbysearch`) | Real nearby places for "I love X" moments, using browser Geolocation |
| **YouTube Data API v3** | `googleapiclient` search, `videoCategoryId=10` (Music) | Finds and embeds an actual matching song |
| **Gmail API** | `google-auth`/`google-api-python-client`, OAuth refresh-token flow | Sends the real weekly digest from a dedicated account, never the user's own Gmail |
| **Deployment** | Google Cloud Run (`chronicle-ai`, `europe-west1`), Cloud Scheduler, Secret Manager | Single container running both the Node edge and the Python sidecar (`--no-cpu-throttling` so the sidecar's background import graph doesn't starve) |

---

## Architecture deep dive

**Request flow.** Browser → Express (`server.ts`, the only internet-facing edge) → Python/FastAPI sidecar (`127.0.0.1`-only, same container) → Vertex AI. Express does almost no logic of its own by design — it deserializes, proxies, and is the single place that checks the `X-Internal-Secret` header on the Cloud Scheduler-triggered digest endpoint, so the Python side can trust that check already happened. The sidecar owns every Gemini call, the model fallback ladder, and all deterministic offline fallbacks (so the app degrades gracefully — `isOfflineCompanion: true` — rather than erroring, if every model in the ladder is exhausted).

**Why Google ADK instead of a raw prompt-and-parse loop.** This is a Google-run hackathon, and ADK's `LlmAgent` gives native, well-tested Gemini function-calling plus the ability to mix a built-in tool (`GoogleSearchTool`) with custom Python function tools in the same agent (`bypass_multi_tools_limit=True` — normally Gemini restricts you to one built-in tool XOR custom tools). Each request builds a fresh `LlmAgent` closed over that request's context (memories, graph, location, people) via `backend/agent/tools.py`'s `build_tools(...)` — tools take no arguments the LLM would have to faithfully echo back, since LLMs are unreliable at round-tripping large structured payloads through function-call arguments. The real tool return values are pulled directly from the ADK event stream (`event.get_function_responses()`), never trusted from the model's paraphrased text — important because ADK wraps a tool's non-dict return (e.g. `find_nearby_places`'s list) as `{"result": [...]}`, a real bug this project hit and fixed.

**Why Firestore for the knowledge graph, not Neo4j/mem0.** Avoids standing up new hosted infra for a hackathon timeline, and reuses the exact owner-isolation security-rule pattern already proven for the rest of the app (`users/{userId}/graph_nodes/{nodeId}`, `.../graph_edges/{edgeId}`) instead of a second access-control model to get right under time pressure.

**Why Vertex AI + ADC, never an API key, for the core model.** No secret to leak, rotate, or restrict — the Cloud Run service account's identity is the credential, and local dev uses the developer's own `gcloud auth application-default login` session. (The *other* Google APIs — Places, YouTube — do use restricted, single-purpose API keys, since ADC doesn't apply to them the same way; each key is scoped to exactly one API via `gcloud services api-keys create --api-target`.)

**Memory dedup, concretely.** A screenshot during development showed two near-duplicate memories ("loves Happy by Pharrell Williams," worded two different ways) both getting saved. Fix: Layer 1 is `src/utils/textSimilarity.ts`'s cheap word-overlap/stemming shortlist (client-side, same-category candidates only); Layer 2 is `/api/chronicle/judge-memory-duplicates`, a dedicated Gemini call *only* invoked when Layer 1's shortlist is non-empty (saving cost/latency on the common case of a genuinely new memory), which returns a verdict per candidate: `new` or `update` (with a merged text and the existing memory's id). An `update` appends the old text to `history[]` with a timestamp rather than overwriting silently — versioned, not duplicated, not lost.

**The 3D Reflections graph, concretely.** `GraphExplorerPage.tsx` renders the live per-user graph via `react-force-graph-3d`. Two non-obvious, hard-won details:
1. **Theme clustering is a soft physics nudge, not a hard grouping.** A custom d3 force (`d3Force('cluster', ...)`) gently pulls same-theme nodes toward a fixed, deterministic per-theme anchor point every simulation tick, layered *on top of* the library's default link/charge/center forces rather than replacing them — so real graph structure (who actually connects to what) still shows through the clustering. A floating `three-spritetext` label marks each cluster's anchor, and clicking a theme chip flies the camera there while dimming everything else (camera control is explicitly handed back to OrbitControls only once the fly-to tween finishes, to avoid the two fighting over the camera if you drag mid-transition).
2. **Mount-timing is the single biggest source of bugs in this component.** `<ForceGraph3D>` exposes methods (`.scene()`, `.d3Force()`, `.controls()`) that all forward to an internal renderer object the library creates during its *own* mount — calling into them before that's ready throws deep inside the library's animation loop (`Cannot read properties of undefined (reading 'tick')`), not in application code, making it easy to misdiagnose as a data or network issue. Two concrete fixes were needed: never let the container's `width`/`height` change from a guessed default to the real measured size right after first mount (that prop change alone can retrigger the library's internal reinit mid-flight — the fix is to measure synchronously via `useLayoutEffect` and not mount `<ForceGraph3D>` at all until the real size is known), and defer any of *our own* calls into the imperative handle to the next animation frame inside a try/catch backstop.

**Voice pipeline is intentionally zero-backend.** Both STT and TTS are native browser APIs (`SpeechRecognition`, `speechSynthesis`) — no Google Cloud Speech-to-Text/Text-to-Speech API, no audio ever leaves the browser except as the transcribed text sent to `/api/chronicle/respond`. This keeps voice free and low-latency, at the cost of depending on browser support (Chrome-family only for `SpeechRecognition`) and voice-quality being whatever the OS/browser ships — an accepted, deliberate tradeoff for a hackathon timeline, not an oversight.

**Notable bugs hit and fixed along the way** (kept here because they're genuinely instructive, not just changelog noise): a trailing newline baked into a Secret Manager value (`echo "x" | gcloud secrets versions add`) made the digest endpoint's shared-secret check fail forever despite the values "looking" identical everywhere they were inspected — HTTP headers can't carry a literal newline, so the fix was trimming both sides of the comparison; a stale cached `index.html` pointing at a now-deleted revision's hashed JS/CSS chunks after a rollback, fixed by giving `index.html` (only) a `no-cache` header while hashed assets stay `immutable`; and a Cloud Run traffic-pinning gotcha where a manual `update-traffic --to-revisions=X=100` rollback silently overrides the "new deploys get traffic automatically" default until you explicitly issue `--to-latest` again.

---

## 1. Environment & Prerequisites

1. **Install Google Cloud SDK (`gcloud`)**:
   ```bash
   gcloud components update
   gcloud auth login
   ```

2. **Set your Google Cloud Project**:
   ```bash
   export PROJECT_ID="YOUR_PROJECT_ID"
   export REGION="us-central1"
   gcloud config set project $PROJECT_ID
   ```

3. **Enable Required Google Cloud APIs**:
   ```bash
   gcloud services enable \
     run.googleapis.com \
     secretmanager.googleapis.com \
     firestore.googleapis.com \
     aiplatform.googleapis.com
   ```

---

## 2. Gemini Authentication (Vertex AI + ADC — no API key)

Gemini access goes through **Vertex AI with Application Default Credentials**, not an AI Studio API key. There is no secret to create or inject.

**Local development** — one-time login, ADC is cached to your machine:
```bash
gcloud auth application-default login
```

**Production (Cloud Run)** — grant the service's runtime service account permission to call Vertex AI; ADC is then supplied automatically via the metadata server, no credentials file involved:
```bash
export PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format="value(projectNumber)")

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/aiplatform.user"
```

---

## 3. Database Security Configuration (Cloud Firestore)

Deploy secure, owner-bound Firestore rules that enforce user data isolation. No user can read or write documents belonging to another user:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/interactions/{interactionId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

Deploy the rules using the Firebase CLI:
```bash
firebase deploy --only firestore:rules
```

---

## 4. Cloud Run Deployment Flow

Deploy the containerized full-stack application directly to Google Cloud Run:

```bash
export SERVICE_NAME="reflections-journal"

gcloud run deploy $SERVICE_NAME \
  --source . \
  --region $REGION \
  --platform managed \
  --allow-unauthenticated \
  --set-env-vars="GOOGLE_GENAI_USE_VERTEXAI=true,GOOGLE_CLOUD_PROJECT=$PROJECT_ID,GOOGLE_CLOUD_LOCATION=global" \
  --port 3000
```

---

## 5. Weekly Gmail Digest (Cloud Scheduler)

Every Sunday, Chronicle emails each active user a personalized, funny recap of their week — generated from their actual sessions and knowledge-graph highlights, never a generic "insights" report. This is a background job (`POST /internal/weekly-digest`), not something the user triggers from the UI.

**5.1 — Enable APIs**:
```bash
gcloud services enable gmail.googleapis.com cloudscheduler.googleapis.com
```

**5.2 — Create OAuth credentials for the sending account** (a dedicated Gmail account, not any user's own inbox):
1. Google Cloud Console → APIs & Services → Credentials → Create Credentials → OAuth client ID → **Desktop app**. Download the client secret JSON.
2. Run the one-time local setup script, signing in as the dedicated sending account when the browser opens:
   ```bash
   uv run python scripts/gmail_oauth_setup.py path/to/client_secret.json
   ```
3. Copy the printed values into your local `.env` (see `.env.example`) and into Secret Manager for production. **Never commit or paste these values anywhere else** — they're equivalent to that account's password for sending mail.

**5.3 — Grant the Firestore-read + Auth-admin IAM role** the digest job needs to enumerate users and their recent sessions:
```bash
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/datastore.viewer"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/firebaseauth.viewer"
```

**5.4 — Store the Gmail + internal-secret values in Secret Manager**, then deploy with them (in addition to the Vertex AI env vars from section 2):
```bash
gcloud run deploy $SERVICE_NAME \
  --update-secrets="GMAIL_OAUTH_CLIENT_ID=GMAIL_OAUTH_CLIENT_ID:latest,GMAIL_OAUTH_CLIENT_SECRET=GMAIL_OAUTH_CLIENT_SECRET:latest,GMAIL_OAUTH_REFRESH_TOKEN=GMAIL_OAUTH_REFRESH_TOKEN:latest,GMAIL_SENDER_ADDRESS=GMAIL_SENDER_ADDRESS:latest,INTERNAL_DIGEST_SECRET=INTERNAL_DIGEST_SECRET:latest"
```

**5.5 — Create the Cloud Scheduler job** pointed at your deployed service:
```bash
gcloud scheduler jobs create http chronicle-weekly-digest \
  --schedule="0 20 * * 0" \
  --uri="https://<cloud-run-url>/internal/weekly-digest" \
  --http-method=POST \
  --headers="X-Internal-Secret=$INTERNAL_DIGEST_SECRET" \
  --time-zone="America/Los_Angeles"
```

Trigger it manually to test end-to-end: `gcloud scheduler jobs run chronicle-weekly-digest`.

*Production hardening (recommended over the shared-secret header above): use a Cloud Scheduler OIDC token with a dedicated invoker service account instead, verified in FastAPI via `google.auth.transport` — the shared secret is the simpler thing to ship first.*

**Local testing** — set `DIGEST_DRY_RUN=true` in `.env` (default in `.env.example`) so the job logs the rendered email instead of calling Gmail:
```bash
curl -X POST http://localhost:3000/internal/weekly-digest -H "X-Internal-Secret: $INTERNAL_DIGEST_SECRET"
```

---

## 6. Required Campaign Labeling (Verification Binding)

Apply the mandatory challenge verification label to your deployed Cloud Run service:

```bash
gcloud run services update $SERVICE_NAME \
  --update-labels=dev-tutorial=cloud-run-ai-challenge \
  --region=$REGION
```

---

## 7. Local Development

1. Ensure dependencies are installed:
   ```bash
   npm install
   ```

2. Configure environment variables in `.env` (see `.env.example`) and authenticate ADC once:
   ```bash
   gcloud auth application-default login
   ```

3. Run the development server (Express + Vite on port 3000):
   ```bash
   npm run dev
   ```

4. Build for production:
   ```bash
   npm run build
   npm start
   ```

---

## 8. Functional Stability & End-to-End Walkthrough Test Cases

Every user interaction has a corresponding test case:

### Test Suite 1: Authentication & Access Control
- **TC-AUTH-01 (Landing State)**: Navigate to `/`. Verify landing screen displays the hero section, Google Sign-In CTA button (`#landing-hero-signin-btn` and `#landing-header-signin-btn`), and feature overview cards.
- **TC-AUTH-02 (Sign In with Google)**: Click "Continue with Google Sign-In". Complete federated identity popup. Confirm user is redirected to the private journal dashboard.
- **TC-AUTH-03 (Sign Out)**: In the header, click the "Sign Out" button (`#header-signout-btn`). Confirm user session terminates and view returns to landing page.

### Test Suite 2: Journal Reflection & AI Generation
- **TC-AI-01 (New Entry Creation)**: Click "+ New Reflection" (`#new-reflection-btn`). Type a reflection in `#journal-input-textarea`.
- **TC-AI-02 (Submit Reflection)**: Click `#journal-submit-btn` or press `Ctrl+Enter`. Verify live spinner activates with "Reflecting...". Verify Gemini 3.6 Flash returns a response rendered with markdown formatting.
- **TC-AI-03 (Mode Selection)**: Switch between modes (`#mode-selector-reflect`, `#mode-selector-summarize`, `#mode-selector-brainstorm`, `#mode-selector-chat`). Submit follow-up questions and verify tailored model behavior.
- **TC-AI-04 (Inspiration Starters)**: In a blank session, click an inspiration prompt chip (`#inspiration-prompt-0`). Verify prompt populates into the textarea ready to send.
- **TC-AI-05 (Response Copying)**: Click the "Copy" button on an AI response. Confirm visual "Copied" confirmation appears and text is copied to clipboard.

### Test Suite 3: Firestore Persistence & Data Isolation
- **TC-DATA-01 (Immediate Persistence)**: Upon AI generation completion, verify interaction is automatically saved to Firestore under `/users/{userId}/interactions/{interactionId}`.
- **TC-DATA-02 (Session Title Renaming)**: Click `#rename-reflection-btn`, enter a custom title, and click Save. Verify updated title updates in header and sidebar immediately.
- **TC-DATA-03 (History Browsing & Search)**: In the sidebar, type into `#search-reflections-input`. Confirm filter matches titles and preview snippets. Click a history item to load prior turns.
- **TC-DATA-04 (Interaction Deletion)**: Click the trash icon (`#delete-interaction-btn`) on a sidebar item and accept confirmation. Confirm item is deleted from Firestore and UI updates.
- **TC-DATA-05 (Cross-User Isolation)**: Verify security rule prevents user B from reading `/users/USER_A_ID/interactions/{id}` via browser DevTools or direct Firestore REST call.
