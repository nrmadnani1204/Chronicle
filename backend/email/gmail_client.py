import base64
from email.mime.text import MIMEText
from typing import Any, Optional

from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build

from backend.config import (
    GMAIL_OAUTH_CLIENT_ID,
    GMAIL_OAUTH_CLIENT_SECRET,
    GMAIL_OAUTH_REFRESH_TOKEN,
    GMAIL_SENDER_ADDRESS,
)

GMAIL_SEND_SCOPE = "https://www.googleapis.com/auth/gmail.send"

_gmail_service: Optional[Any] = None


def _build_credentials() -> Credentials:
    return Credentials(
        token=None,
        refresh_token=GMAIL_OAUTH_REFRESH_TOKEN,
        client_id=GMAIL_OAUTH_CLIENT_ID,
        client_secret=GMAIL_OAUTH_CLIENT_SECRET,
        token_uri="https://oauth2.googleapis.com/token",
        scopes=[GMAIL_SEND_SCOPE],
    )


def get_gmail_service() -> Any:
    global _gmail_service
    if _gmail_service is None:
        if not all([GMAIL_OAUTH_CLIENT_ID, GMAIL_OAUTH_CLIENT_SECRET, GMAIL_OAUTH_REFRESH_TOKEN]):
            raise RuntimeError(
                "Gmail OAuth credentials are not configured — run scripts/gmail_oauth_setup.py "
                "and set GMAIL_OAUTH_CLIENT_ID / GMAIL_OAUTH_CLIENT_SECRET / GMAIL_OAUTH_REFRESH_TOKEN."
            )
        _gmail_service = build("gmail", "v1", credentials=_build_credentials(), cache_discovery=False)
    return _gmail_service


def send_email(to: str, subject: str, html_body: str) -> None:
    service = get_gmail_service()
    message = MIMEText(html_body, "html")
    message["to"] = to
    message["from"] = GMAIL_SENDER_ADDRESS or "me"
    message["subject"] = subject
    raw = base64.urlsafe_b64encode(message.as_bytes()).decode("utf-8")
    service.users().messages().send(userId="me", body={"raw": raw}).execute()
