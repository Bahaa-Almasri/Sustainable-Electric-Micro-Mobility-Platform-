from uuid import UUID

from fastapi import APIRouter, Depends

from app.deps import get_current_user_id
from app.db import get_pool
from app.schemas import ReservationCreate
from app.util_json import record_to_dict

router = APIRouter(prefix="/reservations", tags=["reservations"])


@router.get("/me")
async def my_reservations(user_id: UUID = Depends(get_current_user_id)):
    pool = get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT
              r.*,
              v.vehicle_id AS v_id,
              NULL::text AS model,
              v.type::text AS type,
              NULL::text AS qr_code,
              v.availability_status::text AS vehicle_status
            FROM reservations r
            LEFT JOIN vehicles v ON v.vehicle_id = r.vehicle_id
            WHERE r.user_id = $1
            ORDER BY r.created_at DESC NULLS LAST
            """,
            user_id,
        )
    out = []
    for row in rows:
        d = record_to_dict(row)
        out.append(
            {
                **{k: v for k, v in d.items() if k not in ("model", "type", "qr_code", "vehicle_status", "v_id")},
                "vehicles": {
                    "vehicle_id": d.get("vehicle_id"),
                    "model": d.get("model"),
                    "type": d.get("type"),
                    "qr_code": d.get("qr_code"),
                    "status": d.get("vehicle_status"),
                },
            }
        )
    return out


@router.post("/me")
async def create_reservation(body: ReservationCreate, user_id: UUID = Depends(get_current_user_id)):
    pool = get_pool()
    async with pool.acquire() as conn:
        await conn.execute(
            """
            INSERT INTO reservations (reservation_id, user_id, vehicle_id, status, created_at, expires_at)
            VALUES (gen_random_uuid(), $1, $2, 'pending', now(), now() + $3 * interval '1 minute')
            """,
            user_id,
            body.vehicle_id,
            body.minutes_ttl,
        )
    return {"ok": True}
