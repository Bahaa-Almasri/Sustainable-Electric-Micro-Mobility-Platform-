import logging
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status

from app.deps import get_current_user_id
from app.db import get_pool
from app.schemas import ReservationCreate
from app.services.reservations import (
    create_reservation_if_available,
    expire_reservation_by_id,
    expire_due_reservations,
)
from app.util_json import record_to_dict

router = APIRouter(prefix="/reservations", tags=["reservations"])
logger = logging.getLogger(__name__)


@router.get("/me")
async def my_reservations(user_id: UUID = Depends(get_current_user_id)):
    pool = get_pool()
    async with pool.acquire() as conn:
        await expire_due_reservations(conn)
        rows = await conn.fetch(
            """
            SELECT
              r.*,
              v.vehicle_id AS v_id,
              NULL::text AS model,
              v.type::text AS type,
              NULL::text AS qr_code,
              v.availability_status::text AS vehicle_status
            FROM public.reservations r
            LEFT JOIN public.vehicles v ON v.vehicle_id = r.vehicle_id
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
        async with conn.transaction():
            await expire_due_reservations(conn)
            row = await create_reservation_if_available(
                conn,
                user_id=user_id,
                vehicle_id=body.vehicle_id,
                minutes_ttl=body.minutes_ttl,
            )
            if not row:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Vehicle is not available for reservation",
                )

    d = record_to_dict(row)
    return {
        "ok": True,
        "reservation": {
            "reservation_id": d.get("reservation_id"),
            "user_id": d.get("user_id"),
            "vehicle_id": d.get("vehicle_id"),
            "status": d.get("status"),
            "created_at": d.get("created_at"),
            "expires_at": d.get("expires_at"),
        },
    }


@router.delete("/me/{reservation_id}")
async def remove_reservation(reservation_id: UUID, user_id: UUID = Depends(get_current_user_id)):
    print(
        "[Reservations][router] received cancel request",
        {"reservation_id": str(reservation_id), "user_id": str(user_id)},
        flush=True,
    )
    logger.info(
        "DELETE /reservations/me/%s hit by user_id=%s",
        reservation_id,
        user_id,
    )
    print(
        "[Reservations][router] endpoint hit",
        {"reservation_id": str(reservation_id), "user_id": str(user_id), "method": "DELETE"},
        flush=True,
    )
    pool = get_pool()
    async with pool.acquire() as conn:
        async with conn.transaction():
            await expire_due_reservations(conn)
            updated_status, released_count = await expire_reservation_by_id(
                conn,
                reservation_id=reservation_id,
            )
            if updated_status is None:
                logger.warning(
                    "Reservation cancel not found (reservation_id=%s, user_id=%s). Returning 404.",
                    reservation_id,
                    user_id,
                )
                print(
                    "[Reservations][router] cancel not found",
                    {"reservation_id": str(reservation_id), "user_id": str(user_id)},
                    flush=True,
                )
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Reservation not found",
                )
        logger.info(
            "Reservation cancel transaction committed (reservation_id=%s, user_id=%s, status=%s, released_count=%s)",
            reservation_id,
            user_id,
            updated_status,
            released_count,
        )
        print(
            "[Reservations][router] transaction committed",
            {
                "reservation_id": str(reservation_id),
                "user_id": str(user_id),
                "status": updated_status,
                "released_count": released_count,
            },
            flush=True,
        )
    return {
        "ok": True,
        "message": (
            "Reservation cancelled successfully"
            if updated_status == "cancelled"
            else "Reservation already inactive"
        ),
        "reservation_id": str(reservation_id),
        "status": updated_status,
        "released_vehicle_count": released_count,
    }
