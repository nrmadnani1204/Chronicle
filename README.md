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
| **AI Engine** | Gemini 3.6 Flash (`@google/genai`) | Empathetic mirroring, executive summaries, brainstorming, and multi-turn dialogue |
| **Secret Management** | Google Cloud Secret Manager | API key injection without client exposure |

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

## 2. Secret Management Setup

Gemini API keys must be securely stored in **Google Cloud Secret Manager** and accessed exclusively by the server runtime:

```bash
# Create and populate the secret
gcloud secrets create GEMINI_API_KEY --replication-policy="automatic"
echo -n "YOUR_API_KEY" | gcloud secrets versions add GEMINI_API_KEY --data-file=-

# Obtain project number
export PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format="value(projectNumber)")

# Grant the default Cloud Run service account access to read the secret
gcloud secrets add-iam-policy-binding GEMINI_API_KEY \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
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
  --set-secrets="GEMINI_API_KEY=GEMINI_API_KEY:latest" \
  --port 3000
```

---

## 5. Required Campaign Labeling (Verification Binding)

Apply the mandatory challenge verification label to your deployed Cloud Run service:

```bash
gcloud run services update $SERVICE_NAME \
  --update-labels=dev-tutorial=cloud-run-ai-challenge \
  --region=$REGION
```

---

## 6. Local Development

1. Ensure dependencies are installed:
   ```bash
   npm install
   ```

2. Configure environment variables in `.env`:
   ```bash
   GEMINI_API_KEY="your-gemini-api-key"
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

## 7. Functional Stability & End-to-End Walkthrough Test Cases

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
