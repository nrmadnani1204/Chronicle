import datetime
import html
import json
from typing import Any, Optional

import firebase_admin
from firebase_admin import auth as fb_auth
from firebase_admin import firestore
from google.cloud.firestore_v1.base_query import FieldFilter

from backend.config import FIRESTORE_DATABASE_ID
from backend.email.gmail_client import send_email
from backend.fallbacks import generate_weekly_receipt_fallback
from backend.gemini_client import generate_content_with_fallback

_firebase_app: Optional[firebase_admin.App] = None


def _get_firestore_client():
    global _firebase_app
    if _firebase_app is None:
        # Application Default Credentials — the Cloud Run service account in
        # production, `gcloud auth application-default login` locally. Needs
        # a Firestore-read IAM role and Firebase Auth admin access (see
        # README's Weekly Gmail Digest section).
        _firebase_app = firebase_admin.initialize_app()
    # The app uses a named Firestore database (see FIRESTORE_DATABASE_ID),
    # not "(default)" — passing None here would 404 against a database that
    # doesn't exist.
    return firestore.client(_firebase_app, database_id=FIRESTORE_DATABASE_ID)


def _seven_days_ago_ms() -> int:
    cutoff = datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(days=7)
    return int(cutoff.timestamp() * 1000)


def list_users_for_digest() -> list[dict[str, Any]]:
    """Firebase Auth users with an email who have at least one interaction in
    the last 7 days. Firebase Auth (not the Firestore `users` collection) is
    the source of truth for enumeration + email — a `users/{uid}` Firestore
    document is never actually created by this app (only its subcollections
    are written to), so a phantom parent document never shows up in a
    Firestore collection listing even when its subcollections have data."""
    db = _get_firestore_client()
    cutoff_ms = _seven_days_ago_ms()

    users_to_email: list[dict[str, Any]] = []
    page = fb_auth.list_users()
    while page:
        for user in page.users:
            if not user.email:
                continue
            interactions_ref = (
                db.collection("users").document(user.uid).collection("interactions")
                .where(filter=FieldFilter("updatedAt", ">=", cutoff_ms))
                .limit(1)
            )
            if list(interactions_ref.stream()):
                users_to_email.append({"userId": user.uid, "email": user.email})
        page = page.get_next_page()
    return users_to_email


async def build_digest_for_user(user_id: str) -> dict[str, Any]:
    db = _get_firestore_client()
    cutoff_ms = _seven_days_ago_ms()

    interactions_ref = (
        db.collection("users").document(user_id).collection("interactions")
        .where(filter=FieldFilter("updatedAt", ">=", cutoff_ms))
        .order_by("updatedAt")
    )
    sessions = []
    for doc in interactions_ref.stream():
        data = doc.to_dict() or {}
        sessions.append({
            "title": data.get("title") or "Vent",
            "snippet": (data.get("userPrompt") or "")[:160],
            "mood": (data.get("mood") or {}).get("weather", ""),
        })

    # A few of the week's most-referenced graph nodes give the recap real,
    # personal specifics (a recurring person, goal, activity) instead of a
    # generic recap — this is what makes it feel like Chronicle actually
    # knows the person, not a templated newsletter.
    graph_nodes_ref = (
        db.collection("users").document(user_id).collection("graph_nodes")
        .order_by("referenceCount", direction=firestore.Query.DESCENDING)
        .limit(5)
    )
    graph_highlights = [
        label for doc in graph_nodes_ref.stream()
        if (label := (doc.to_dict() or {}).get("label"))
    ]

    system_instruction = f"""You are Chronicle, generating this user's weekly recap email ('Chronicle has reviewed the evidence 💀').
This is a FRIEND'S JOKE, not an analysis report, not a productivity summary, not a wellness newsletter.

Rules:
- Never use clinical/analytical language ("insights", "patterns", "metrics", "trends").
- Never give unsolicited advice, never a "5 things you should do" list.
- Weave in real specifics from the recurring people/goals/activities below so it feels personal — not a generic "Monday was rough" template.
- The subject line must stay NON-sensitive (it shows in an email notification/inbox preview) — never expose a specific private detail there. Save any real personalization for the body.
- Tone: affectionate, funny, like a close friend lovingly roasting them about their own week.

Recurring people/goals/activities that came up this week: {', '.join(graph_highlights) or 'none on record yet'}

Respond ONLY with valid JSON in this schema:
{{
  "subject": "bro survived 💀",
  "arcSummary": "You survived three crises that could have been an email and somehow still made dinner.",
  "narrativeLines": [
    {{ "day": "Monday", "event": "Claimed everything was fine while everything was clearly on fire." }},
    {{ "day": "Wednesday", "event": "Emergency matcha run and deep contemplation of moving to a farm." }},
    {{ "day": "Friday", "event": "We made it. Witnesses confirmed." }}
  ],
  "verdict": "Keep whatever you did Friday. You are officially stronger than the plot."
}}"""

    session_briefs = "\n".join(f"- {s['title']}: {s['snippet']}" for s in sessions)
    prompt = session_briefs or "User had a quiet week with no vent sessions logged."

    result = await generate_content_with_fallback(
        [{"role": "user", "parts": [{"text": prompt}]}],
        system_instruction,
        config={"temperature": 0.7, "response_mime_type": "application/json"},
    )

    if result and result.get("text"):
        try:
            return json.loads(result["text"])
        except ValueError:
            pass  # fall through to fallback

    return generate_weekly_receipt_fallback(
        [{"title": s["title"], "snippet": s["snippet"]} for s in sessions]
    )


def render_digest_html(receipt: dict[str, Any]) -> str:
    narrative_html = "".join(
        f'''<div style="margin-bottom: 8px; padding: 10px; background: #161622; border-radius: 8px; border-left: 3px solid #FF6B4A;">
            <span style="font-size: 11px; text-transform: uppercase; color: #FF6B4A; font-weight: bold; font-family: monospace;">{html.escape(str(line.get("day", "DAY")))}</span>:
            <span style="color: #EDEDF5; font-size: 13px;">{html.escape(str(line.get("event", "")))}</span>
          </div>'''
        for line in (receipt.get("narrativeLines") or [])
    )

    subject = html.escape(str(receipt.get("subject") or "bro survived 💀"))
    arc_summary = html.escape(str(receipt.get("arcSummary") or "You made it through another week."))
    verdict = html.escape(str(receipt.get("verdict") or "Certified survivor. See you next week."))

    return f"""
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0A0A0F; color: #F3F0EB; padding: 24px; border-radius: 16px; max-width: 540px; margin: 0 auto; border: 1px solid #28283C;">
        <div style="text-align: center; margin-bottom: 20px;">
          <span style="font-size: 11px; letter-spacing: 2px; text-transform: uppercase; color: #FF6B4A; font-weight: bold;">CHRONICLE WEEKLY MEME EVIDENCE 💀</span>
          <h2 style="font-size: 24px; margin: 8px 0 4px; color: #FFFFFF;">{subject}</h2>
          <p style="font-style: italic; color: #9A95A8; font-size: 14px; margin: 0;">"{arc_summary}"</p>
        </div>
        <div style="margin: 20px 0;">
          {narrative_html}
        </div>
        <div style="text-align: center; padding: 14px; background: #13131F; border-radius: 10px; border: 1px dashed #FF6B4A55;">
          <div style="font-size: 10px; text-transform: uppercase; letter-spacing: 1.5px; color: #FF6B4A; font-weight: bold; margin-bottom: 4px;">CHRONICLE VERDICT</div>
          <p style="font-size: 15px; margin: 0; color: #FFF; font-weight: 500;">{verdict}</p>
        </div>
        <div style="text-align: center; margin-top: 20px; font-size: 11px; color: #6E6A7C;">
          Sent with affectionate witness by Chronicle &bull; You don't have to write. Just talk.
        </div>
      </div>
    """


async def send_weekly_digest_to_all_users(dry_run: bool = False) -> dict[str, Any]:
    users = list_users_for_digest()
    sent: list[str] = []
    failed: list[str] = []

    for user in users:
        try:
            receipt = await build_digest_for_user(user["userId"])
            subject = receipt.get("subject") or "Chronicle has reviewed the evidence 💀"
            html_body = render_digest_html(receipt)

            if dry_run:
                print(f"[weekly-digest] DRY RUN — would send to {user['email']}: subject={subject!r}")
            else:
                send_email(user["email"], subject, html_body)

            sent.append(user["email"])
        except Exception as err:
            # One user's failure (bad Gemini output, Gmail hiccup) must never
            # abort the run for everyone else.
            print(f"[weekly-digest] Failed for {user['email']}: {err}")
            failed.append(user["email"])

    return {"sent": sent, "failed": failed, "dryRun": dry_run}
