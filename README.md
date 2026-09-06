# Reflections Journal: Cloud Run AI Challenge Application

A secure, user-authenticated reflection and journaling application built with **React**, **Express**, **Firebase Authentication (Google Sign-In)**, **Cloud Firestore**, and **Gemini 3.6 Flash**.

All reflections and multi-turn conversations are strictly isolated per user in Cloud Firestore under `/users/{userId}/interactions/{interactionId}`.

---

## Architecture & Tech Stack

| Layer | Technology | Purpose |
| :--- | :--- | :--- |
| **Frontend** | React 19, Tailwind CSS, Lucide Icons, React-Markdown | Single-page reflective journaling studio & history browser |
| **Backend API** | Node.js Express & `@google/genai` | Top-level deserialization, defensive payload ingestion, model fallback ladder |
| **Authentication** | Firebase Authentication (Google Sign-In) | Passwordless federated identity management |
| **Database** | Cloud Firestore | User-isolated persistence for journal turns and summaries |
| **AI Engine** | Gemini (via Vertex AI, `google-genai` Python SDK + Google ADK) | Empathetic mirroring, memory extraction, and multi-turn dialogue |
| **Gemini Auth** | Vertex AI + Application Default Credentials (ADC) | No API key at all — local `gcloud auth application-default login`, production via the Cloud Run service account |

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
