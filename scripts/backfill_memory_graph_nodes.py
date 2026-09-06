"""
One-off backfill: creates a knowledge-graph node for every existing Firestore
memory that predates the manual-memory -> graph sync fix (App.tsx's
syncMemoryToGraph). Safe to re-run — skips memories that already have a
corresponding node (id `node_memory_{memoryId}`).

Usage (local, using your own `gcloud auth application-default login`):
    uv run python scripts/backfill_memory_graph_nodes.py
"""
import json
import os
import time

import firebase_admin
from firebase_admin import auth as fb_auth
from firebase_admin import firestore

# Read the same named-database id the app uses (src/firebase.ts / backend/config.py)
# directly, rather than importing the backend package — keeps this script
# runnable standalone regardless of cwd/sys.path.
with open(
    os.path.join(os.path.dirname(__file__), "..", "firebase-applet-config.json"), encoding="utf-8"
) as f:
    FIRESTORE_DATABASE_ID = json.load(f).get("firestoreDatabaseId") or None

CATEGORY_TO_NODE_TYPE = {
    "things_i_love": "like",
    "who_im_becoming": "aspiration",
    "happy_place": "like",
    "little_things": "like",
    "routine": "activity",
    "where_i_am_now": "memory",
    "general": "memory",
}


def build_memory_node(user_id: str, memory: dict) -> dict:
    text = memory.get("text") or ""
    label = text if len(text) <= 60 else text[:57] + "..."
    now = int(time.time() * 1000)
    return {
        "id": f"node_memory_{memory['id']}",
        "userId": user_id,
        "type": CATEGORY_TO_NODE_TYPE.get(memory.get("category"), "memory"),
        "label": label,
        "description": text if len(text) > 60 else None,
        "sourceMemoryId": memory["id"],
        "sourceSessionId": memory.get("sourceSessionId"),
        "importance": memory.get("importance", 0.6),
        "createdAt": memory.get("createdAt", now),
        "lastReferencedAt": now,
        "referenceCount": 1,
    }


def main() -> None:
    app = firebase_admin.initialize_app()
    db = firestore.client(app, database_id=FIRESTORE_DATABASE_ID)

    total_created = 0
    for user in fb_auth.list_users().users:
        memories_ref = db.collection("users").document(user.uid).collection("memories")
        nodes_ref = db.collection("users").document(user.uid).collection("graph_nodes")

        existing_node_ids = {doc.id for doc in nodes_ref.stream()}
        created_for_user = 0

        for mem_doc in memories_ref.stream():
            memory = mem_doc.to_dict() or {}
            memory.setdefault("id", mem_doc.id)
            node_id = f"node_memory_{memory['id']}"
            if node_id in existing_node_ids:
                continue

            node = build_memory_node(user.uid, memory)
            nodes_ref.document(node_id).set(node, merge=True)
            created_for_user += 1

        if created_for_user:
            print(f"{user.email}: created {created_for_user} graph node(s)")
        total_created += created_for_user

    print(f"\nDone. Total graph nodes created: {total_created}")


if __name__ == "__main__":
    main()
