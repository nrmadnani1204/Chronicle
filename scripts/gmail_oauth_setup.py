"""
One-time LOCAL script to mint a Gmail API OAuth refresh token for Chronicle's
weekly digest sender. Run this once, on your own machine — never in
production, never in CI.

Prerequisites:
1. In Google Cloud Console (the same project as the rest of Chronicle),
   enable the Gmail API: APIs & Services > Library > Gmail API > Enable.
2. Create an OAuth 2.0 Client ID of type "Desktop app":
   APIs & Services > Credentials > Create Credentials > OAuth client ID.
   Download the client secret JSON file.

Usage:
    uv run python scripts/gmail_oauth_setup.py path/to/client_secret.json

A browser window will open — sign in as the DEDICATED account that should
send the weekly digest emails (not necessarily your own account).

IMPORTANT: The values this prints are secrets. Put them directly into your
local .env (or Secret Manager for production) yourself. Do not paste them
into a chat, a commit, or anywhere else they could be logged or shared.
"""
import sys

from google_auth_oauthlib.flow import InstalledAppFlow

SCOPES = ["https://www.googleapis.com/auth/gmail.send"]


def main() -> None:
    if len(sys.argv) != 2:
        print("Usage: uv run python scripts/gmail_oauth_setup.py <path-to-client_secret.json>")
        sys.exit(1)

    client_secret_path = sys.argv[1]
    flow = InstalledAppFlow.from_client_secrets_file(client_secret_path, SCOPES)
    # Force IPv4 explicitly (host defaults to "localhost", which some Windows
    # setups resolve to IPv6 "::1" in the browser while this server only
    # binds IPv4 — the redirect then never reaches it and this hangs until
    # WSGITimeoutError). "127.0.0.1" is unambiguous and still a valid loopback
    # redirect URI for a Desktop-app OAuth client.
    credentials = flow.run_local_server(host="127.0.0.1", port=0, timeout_seconds=180)

    print("\nSign-in complete.")
    print("Add these to your local .env yourself — do NOT paste them into a chat:\n")
    print(f"GMAIL_OAUTH_CLIENT_ID={credentials.client_id}")
    print(f"GMAIL_OAUTH_CLIENT_SECRET={credentials.client_secret}")
    print(f"GMAIL_OAUTH_REFRESH_TOKEN={credentials.refresh_token}")
    print("GMAIL_SENDER_ADDRESS=<the Gmail address you just signed in with>")


if __name__ == "__main__":
    main()
