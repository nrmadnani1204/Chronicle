from fastapi import APIRouter

from backend.config import DIGEST_DRY_RUN
from backend.email.weekly_digest import send_weekly_digest_to_all_users

router = APIRouter()


# Not internet-facing directly — server.ts checks the X-Internal-Secret
# header before ever proxying here, since it's the actual edge. This route
# trusts that check rather than repeating it.
@router.post("/internal/weekly-digest")
async def weekly_digest():
    result = await send_weekly_digest_to_all_users(dry_run=DIGEST_DRY_RUN)
    return {"success": True, **result}
