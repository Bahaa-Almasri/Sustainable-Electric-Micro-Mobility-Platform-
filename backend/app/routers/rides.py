import logging
from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status

from app.deps import get_current_user_id
from app.db import get_pool
from app.schemas import EndRideRequest, StartRideRequest
from app.services.pricing import (
    calculate_ride_price,
    get_vehicle_pricing,
    naive_utc_for_timestamp_column,
    strip_internal_keys,
)
from app.services.reservations import (
    convert_active_reservation_to_ride,
    expire_due_reservations,
    find_active_reservation_for_vehicle,
)
from app.util_json import record_to_dict

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/rides", tags=["rides"])


def _ride_row_dict(record) -> dict:
    """Map DB column names to the API shape the mobile client expects."""
    d = record_to_dict(record)
    if d.get("start_time") is None and d.get("started_at") is not None:
        d["start_time"] = d["started_at"]
    if d.get("end_time") is None and d.get("ended_at") is not None:
        d["end_time"] = d["ended_at"]
    if d.get("cost") is None and d.get("total_cost") is not None:
        d["cost"] = d["total_cost"]
    return d


def _pricing_breakdown(d: dict) -> dict | None:
    if d.get("initial_fee") is None and d.get("price_per_minute") is None:
        return None
    return {
        "initial_fee": d.get("initial_fee"),
        "price_per_minute": d.get("price_per_minute"),
    }


@router.get("/me/active")
async def active_ride(user_id: UUID = Depends(get_current_user_id)):
    pool = get_pool()
    async with pool.acquire() as conn:
        try:
            row = await conn.fetchrow(
                """
                SELECT
                  r.*,
                  NULL::text AS model,
                  v.type::text AS type,
                  NULL::text AS qr_code
                FROM rides r
                LEFT JOIN vehicles v ON v.vehicle_id = r.vehicle_id
                WHERE r.user_id = $1
                  AND r.status = 'started'
                ORDER BY r.started_at DESC NULLS LAST
                LIMIT 1
                """,
                user_id,
            )
        except Exception as exc:
            logger.exception("Failed to query active ride for user %s", user_id)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Database error checking active ride: {exc}",
            ) from exc
    if not row:
        return None
    d = _ride_row_dict(row)
    pricing = _pricing_breakdown(d)
    out = {
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
        "duration_minutes": d.get("duration_minutes"),
        "vehicles": {"model": d.get("model"), "type": d.get("type"), "qr_code": d.get("qr_code")},
    }
    if pricing is not None:
        out["pricing"] = pricing
    return out


@router.get("/me")
async def list_my_rides(user_id: UUID = Depends(get_current_user_id)):
    pool = get_pool()
    async with pool.acquire() as conn:
        try:
            rows = await conn.fetch(
                """
                SELECT *
                FROM rides
                WHERE user_id = $1
                ORDER BY started_at DESC NULLS LAST
                """,
                user_id,
            )
        except Exception as exc:
            logger.exception("Failed to list rides for user %s", user_id)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Database error listing rides: {exc}",
            ) from exc
    return [_enrich_ride_for_client(_ride_row_dict(r)) for r in rows]


def _enrich_ride_for_client(d: dict) -> dict:
    pricing = _pricing_breakdown(d)
    if pricing is not None:
        return {**d, "pricing": pricing}
    return d


@router.get("/pricing/catalog")
async def pricing_catalog(_user_id: UUID = Depends(get_current_user_id)):
    """
    All standard vehicle types with resolved rates (DB first, then defaults).
    Use for map/list UIs; ride start/end still return authoritative snapshots.
    """
    pool = get_pool()
    out: dict = {}
    async with pool.acquire() as conn:
        for raw in ("scooter", "bike", "car"):
            p = await get_vehicle_pricing(conn, raw)
            out[raw] = {
                "initial_fee": p.initial_fee,
                "price_per_minute": p.price_per_minute,
                "source": p.source,
            }
    return {"rates": out}


@router.post("/start")
async def start_ride(body: StartRideRequest, user_id: UUID = Depends(get_current_user_id)):
    pool = get_pool()
    async with pool.acquire() as conn:
        async with conn.transaction():
            await expire_due_reservations(conn)
            active = await conn.fetchrow(
                """
                SELECT ride_id FROM rides
                WHERE user_id = $1 AND status = 'started'
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
                """
                SELECT availability_status, type::text AS vehicle_type
                FROM vehicles
                WHERE vehicle_id = $1
                FOR UPDATE
                """,
                body.vehicle_id,
            )
            if not vrow:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vehicle not found")
            raw_vtype = vrow["vehicle_type"]
            if raw_vtype is None or not str(raw_vtype).strip():
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Vehicle type is not set; cannot price this ride.",
                )
            vehicle_availability = (str(vrow["availability_status"]) or "").lower()
            reservation = await find_active_reservation_for_vehicle(conn, vehicle_id=body.vehicle_id)

            if vehicle_availability == "reserved":
                if not reservation:
                    raise HTTPException(
                        status_code=status.HTTP_409_CONFLICT,
                        detail="Vehicle is not available",
                    )
                if reservation["user_id"] != user_id:
                    raise HTTPException(
                        status_code=status.HTTP_409_CONFLICT,
                        detail="Vehicle is currently reserved by another user",
                    )
            elif vehicle_availability == "available":
                if reservation and reservation["user_id"] != user_id:
                    raise HTTPException(
                        status_code=status.HTTP_409_CONFLICT,
                        detail="Vehicle is currently reserved by another user",
                    )
            else:
                raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Vehicle is not available")

            pricing_row = await get_vehicle_pricing(conn, str(raw_vtype))
            start_insert = await conn.fetchrow(
                """
                INSERT INTO rides (
                  ride_id, user_id, vehicle_id, started_at, status,
                  start_lat, start_lng, initial_fee, price_per_minute
                )
                VALUES (gen_random_uuid(), $1, $2, now(), 'started', $3, $4, $5, $6)
                RETURNING ride_id
                """,
                user_id,
                body.vehicle_id,
                body.start_lat,
                body.start_lng,
                pricing_row.initial_fee,
                pricing_row.price_per_minute,
            )
            ride_id = start_insert["ride_id"] if start_insert else None
            updated_vehicle = await conn.execute(
                """
                UPDATE vehicles
                SET availability_status = 'in_use'
                WHERE vehicle_id = $1
                  AND availability_status IN ('available', 'reserved')
                """,
                body.vehicle_id,
            )
            if updated_vehicle != "UPDATE 1":
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Vehicle is not available",
                )
            await convert_active_reservation_to_ride(conn, user_id=user_id, vehicle_id=body.vehicle_id)
            await conn.execute(
                """
                UPDATE vehicle_current_state
                SET updated_at = now()
                WHERE vehicle_id = $1
                """,
                body.vehicle_id,
            )
    return {
        "ok": True,
        "ride_id": ride_id,
        "pricing": {
            "initial_fee": pricing_row.initial_fee,
            "price_per_minute": pricing_row.price_per_minute,
        },
    }


@router.post("/end")
async def end_ride(body: EndRideRequest, user_id: UUID = Depends(get_current_user_id)):
    pool = get_pool()
    end_dt = datetime.now(timezone.utc)
    async with pool.acquire() as conn:
        async with conn.transaction():
            row = await conn.fetchrow(
                """
                SELECT
                  r.ride_id,
                  r.vehicle_id,
                  r.user_id,
                  r.status,
                  r.started_at,
                  v.type::text AS vehicle_type
                FROM rides r
                INNER JOIN vehicles v ON v.vehicle_id = r.vehicle_id
                WHERE r.ride_id = $1
                FOR UPDATE
                """,
                body.ride_id,
            )
            if not row:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ride not found")
            if row["user_id"] != user_id:
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not your ride")
            if str(row["status"] or "").lower() not in ("started", "paused"):
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Ride has already ended or is not active",
                )

            vehicle_id = row["vehicle_id"]
            started_at = row["started_at"]
            if started_at is None:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Ride start time is missing",
                )

            raw_vtype = row["vehicle_type"]
            if raw_vtype is None or not str(raw_vtype).strip():
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Vehicle type is not set; cannot finalize pricing.",
                )

            full = await calculate_ride_price(conn, started_at, end_dt, str(raw_vtype))
            breakdown = strip_internal_keys(full)
            duration_minutes = breakdown["duration_minutes"]
            price_initial = breakdown["pricing"]["initial_fee"]
            price_per_min = breakdown["pricing"]["price_per_minute"]
            total_price = breakdown["total_price"]

            # PG `timestamp` columns + asyncpg: bind naive UTC (aware datetimes can raise DataError).
            ended_at_db = naive_utc_for_timestamp_column(end_dt)

            await conn.execute(
                """
                UPDATE rides
                SET ended_at = $1,
                    status = 'completed',
                    end_lat = $2,
                    end_lng = $3,
                    duration_minutes = $4,
                    initial_fee = $5,
                    price_per_minute = $6,
                    total_cost = $7
                WHERE ride_id = $8
                """,
                ended_at_db,
                body.end_lat,
                body.end_lng,
                duration_minutes,
                price_initial,
                price_per_min,
                total_price,
                body.ride_id,
            )
            await conn.execute(
                "UPDATE vehicles SET availability_status = 'available' WHERE vehicle_id = $1",
                vehicle_id,
            )
            await conn.execute(
                """
                UPDATE vehicle_current_state
                SET updated_at = now()
                WHERE vehicle_id = $1
                """,
                vehicle_id,
            )

    return {
        "ok": True,
        "duration_minutes": duration_minutes,
        "pricing": {
            "initial_fee": price_initial,
            "price_per_minute": price_per_min,
        },
        "total_price": total_price,
    }
