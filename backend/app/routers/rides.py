from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status

from app.deps import get_current_user_id
from app.db import get_pool
from app.schemas import EndRideRequest, StartRideRequest
from app.util_json import record_to_dict

router = APIRouter(prefix="/rides", tags=["rides"])


@router.get("/me/active")
async def active_ride(user_id: UUID = Depends(get_current_user_id)):
    pool = get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            SELECT r.*, v.model, v.type, v.qr_code
            FROM rides r
            LEFT JOIN vehicles v ON v.vehicle_id = r.vehicle_id
            WHERE r.user_id = $1
              AND r.status IN ('active', 'in_progress')
            ORDER BY r.start_time DESC NULLS LAST
            LIMIT 1
            """,
            user_id,
        )
    if not row:
        return None
    d = record_to_dict(row)
    return {
        "ride_id": d["ride_id"],
        "user_id": d["user_id"],
        "vehicle_id": d["vehicle_id"],
        "start_time": d.get("start_time"),
        "end_time": d.get("end_time"),
        "start_lat": d.get("start_lat"),
        "start_lng": d.get("start_lng"),
        "end_lat": d.get("end_lat"),
        "end_lng": d.get("end_lng"),
        "distance_meters": d.get("distance_meters"),
        "status": d.get("status"),
        "cost": d.get("cost"),
        "vehicles": {"model": d.get("model"), "type": d.get("type"), "qr_code": d.get("qr_code")},
    }


@router.get("/me")
async def list_my_rides(user_id: UUID = Depends(get_current_user_id)):
    pool = get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT *
            FROM rides
            WHERE user_id = $1
            ORDER BY start_time DESC NULLS LAST
            """,
            user_id,
        )
    return [record_to_dict(r) for r in rows]


@router.post("/start")
async def start_ride(body: StartRideRequest, user_id: UUID = Depends(get_current_user_id)):
    pool = get_pool()
    async with pool.acquire() as conn:
        async with conn.transaction():
            active = await conn.fetchrow(
                """
                SELECT ride_id FROM rides
                WHERE user_id = $1 AND status IN ('active', 'in_progress')
                LIMIT 1
                """,
                user_id,
            )
            if active:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="You already have an active ride. End it before starting another.",
                )
            vrow = await conn.fetchrow(
                "SELECT status FROM vehicles WHERE vehicle_id = $1 FOR UPDATE",
                body.vehicle_id,
            )
            if not vrow:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vehicle not found")
            if (vrow["status"] or "").lower() not in ("available",):
                raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Vehicle is not available")

            await conn.execute(
                """
                INSERT INTO rides (ride_id, user_id, vehicle_id, start_time, status, start_lat, start_lng)
                VALUES (gen_random_uuid(), $1, $2, now(), 'active', $3, $4)
                """,
                user_id,
                body.vehicle_id,
                body.start_lat,
                body.start_lng,
            )
            await conn.execute(
                "UPDATE vehicles SET status = 'in_use' WHERE vehicle_id = $1",
                body.vehicle_id,
            )
            await conn.execute(
                """
                UPDATE vehicle_current_state
                SET status = 'in_use', last_updated = now()
                WHERE vehicle_id = $1
                """,
                body.vehicle_id,
            )
    return {"ok": True}


@router.post("/end")
async def end_ride(body: EndRideRequest, user_id: UUID = Depends(get_current_user_id)):
    pool = get_pool()
    async with pool.acquire() as conn:
        async with conn.transaction():
            row = await conn.fetchrow(
                """
                SELECT ride_id, vehicle_id, user_id, status
                FROM rides
                WHERE ride_id = $1
                FOR UPDATE
                """,
                body.ride_id,
            )
            if not row:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ride not found")
            if row["user_id"] != user_id:
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not your ride")
            if (row["status"] or "").lower() not in ("active", "in_progress"):
                raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Ride is not active")

            vehicle_id = row["vehicle_id"]
            await conn.execute(
                """
                UPDATE rides
                SET end_time = now(), status = 'completed', end_lat = $1, end_lng = $2
                WHERE ride_id = $3
                """,
                body.end_lat,
                body.end_lng,
                body.ride_id,
            )
            await conn.execute(
                "UPDATE vehicles SET status = 'available' WHERE vehicle_id = $1",
                vehicle_id,
            )
            await conn.execute(
                """
                UPDATE vehicle_current_state
                SET status = 'available', last_updated = now()
                WHERE vehicle_id = $1
                """,
                vehicle_id,
            )
    return {"ok": True}
