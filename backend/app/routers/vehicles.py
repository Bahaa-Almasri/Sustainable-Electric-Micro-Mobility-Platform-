import logging
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status

from app.deps import get_current_user_id
from app.db import get_pool
from app.util_json import record_to_dict

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/vehicles", tags=["vehicles"])


@router.get("/available")
async def list_available(_user_id: UUID = Depends(get_current_user_id)):
    pool = get_pool()
    async with pool.acquire() as conn:
        try:
            rows = await conn.fetch(
                """
                SELECT
                  s.vehicle_id AS state_id,
                  s.vehicle_id,
                  s.current_battery_percent AS battery_level,
                  s.current_lat AS lat,
                  s.current_lng AS lng,
                  v.operational_status::text AS state_status,
                  s.updated_at AS last_updated,
                  NULL::text AS model,
                  v.type::text AS type,
                  NULL::text AS qr_code,
                  v.availability_status::text AS vehicle_status,
                  s.updated_at AS last_gps_at
                FROM vehicles v
                INNER JOIN vehicle_current_state s ON s.vehicle_id = v.vehicle_id
                WHERE v.availability_status = 'available'
                  AND s.current_lat IS NOT NULL
                  AND s.current_lng IS NOT NULL
                """
            )
        except Exception as exc:
            logger.exception("Failed to query available vehicles")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Database error fetching vehicles: {exc}",
            ) from exc
    result = []
    for r in rows:
        d = record_to_dict(r)
        result.append(
            {
                "state_id": d["state_id"],
                "vehicle_id": d["vehicle_id"],
                "battery_level": d.get("battery_level"),
                "lat": d["lat"],
                "lng": d["lng"],
                "status": d.get("state_status"),
                "last_updated": d.get("last_updated"),
                "vehicles": {
                    "vehicle_id": d["vehicle_id"],
                    "model": d.get("model"),
                    "type": d.get("type"),
                    "qr_code": d.get("qr_code"),
                    "status": d.get("vehicle_status"),
                    "last_gps_at": d.get("last_gps_at"),
                },
            }
        )
    return result


@router.get("/{vehicle_id}")
async def get_vehicle(vehicle_id: UUID, _user_id: UUID = Depends(get_current_user_id)):
    pool = get_pool()
    async with pool.acquire() as conn:
        try:
            row = await conn.fetchrow(
                """
                SELECT
                  s.vehicle_id AS state_id,
                  s.vehicle_id,
                  s.current_battery_percent AS battery_level,
                  s.current_lat AS lat,
                  s.current_lng AS lng,
                  v.operational_status::text AS state_status,
                  s.updated_at AS last_updated,
                  NULL::text AS model,
                  v.type::text AS type,
                  NULL::text AS qr_code,
                  v.availability_status::text AS vehicle_status,
                  s.updated_at AS last_gps_at
                FROM vehicles v
                LEFT JOIN vehicle_current_state s ON s.vehicle_id = v.vehicle_id
                WHERE v.vehicle_id = $1
                """,
                vehicle_id,
            )
        except Exception as exc:
            logger.exception("Failed to query vehicle %s", vehicle_id)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Database error fetching vehicle: {exc}",
            ) from exc
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vehicle not found")
    d = record_to_dict(row)
    return {
        "state_id": d.get("state_id"),
        "vehicle_id": d["vehicle_id"],
        "battery_level": d.get("battery_level"),
        "lat": d.get("lat"),
        "lng": d.get("lng"),
        "status": d.get("state_status"),
        "last_updated": d.get("last_updated"),
        "vehicles": {
            "vehicle_id": d["vehicle_id"],
            "model": d.get("model"),
            "type": d.get("type"),
            "qr_code": d.get("qr_code"),
            "status": d.get("vehicle_status"),
            "last_gps_at": d.get("last_gps_at"),
        },
    }
