from uuid import UUID

from fastapi import APIRouter, Depends

from app.deps import get_current_user_id
from app.db import get_pool
from app.schemas import SupportTicketCreate
from app.util_json import record_to_dict

router = APIRouter(prefix="/support", tags=["support"])


@router.get("/tickets")
async def list_tickets(user_id: UUID = Depends(get_current_user_id)):
    pool = get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT * FROM support_tickets
            WHERE user_id = $1
            ORDER BY created_at DESC NULLS LAST
            """,
            user_id,
        )
    return [record_to_dict(r) for r in rows]


@router.post("/tickets")
async def create_ticket(body: SupportTicketCreate, user_id: UUID = Depends(get_current_user_id)):
    pool = get_pool()
    async with pool.acquire() as conn:
        await conn.execute(
            """
            INSERT INTO support_tickets (ticket_id, user_id, subject, description, status, created_at)
            VALUES (gen_random_uuid(), $1, $2, $3, 'open', now())
            """,
            user_id,
            body.subject,
            body.description,
        )
    return {"ok": True}
