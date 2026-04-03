import logging
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status

from app.deps import get_current_user_id
from app.db import get_pool
from app.util_json import record_to_dict

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/stations", tags=["stations"])


@router.get("/parking-available")
async def list_parking_available_stations(_user_id=Depends(get_current_user_id)):
    """
    Active stations with at least one free parking slot.

    A slot is free when: station.capacity > count of vehicles assigned to that station
    that are not on an active ride (status = started).
    Stations with NULL capacity are excluded (cannot compute availability).
    """
    pool = get_pool()
    async with pool.acquire() as conn:
        try:
            rows = await conn.fetch(
                """
                SELECT
                  s.station_id,
                  s.name,
                  s.lat,
                  s.lng,
                  s.capacity,
                  0::int AS available_vehicles,
                  GREATEST(0, s.capacity - COALESCE(occ.cnt, 0))::int AS available_parking_spots
                FROM stations s
                LEFT JOIN (
                  SELECT v.station_id, COUNT(*)::int AS cnt
                  FROM vehicles v
                  WHERE v.station_id IS NOT NULL
                    AND NOT EXISTS (
                      SELECT 1
                      FROM rides r
                      WHERE r.vehicle_id = v.vehicle_id
                        AND r.status = 'started'
                    )
                  GROUP BY v.station_id
                ) occ ON occ.station_id = s.station_id
                WHERE s.status = 'active'
                  AND s.capacity IS NOT NULL
                  AND s.capacity > COALESCE(occ.cnt, 0)
                ORDER BY s.name
                """
            )
        except Exception as exc:
            logger.exception("Failed to query stations with parking availability")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Database error fetching parking stations: {exc}",
            ) from exc

    out = []
    for row in rows:
        d = record_to_dict(row)
        out.append(
            {
                "station_id": d["station_id"],
                "name": d["name"],
                "lat": d["lat"],
                "lng": d["lng"],
                "capacity": d["capacity"],
                "available_vehicles": d.get("available_vehicles") or 0,
                "available_parking_spots": d.get("available_parking_spots") or 0,
            }
        )
    return out


@router.get("/active")
async def list_active_stations(_user_id=Depends(get_current_user_id)):
    """One row per real station from `stations` (status = active). Optional available count via vehicles + rides."""
    pool = get_pool()
    async with pool.acquire() as conn:
        try:
            rows = await conn.fetch(
                """
                SELECT
                  s.station_id,
                  s.name,
                  s.lat,
                  s.lng,
                  s.capacity,
                  COALESCE(avail.cnt, 0)::int AS available_vehicles
                FROM stations s
                LEFT JOIN (
                  SELECT v.station_id, COUNT(*)::int AS cnt
                  FROM vehicles v
                  INNER JOIN vehicle_current_state gcs ON gcs.vehicle_id = v.vehicle_id
                  WHERE v.station_id IS NOT NULL
                    AND v.availability_status = 'available'
                    AND NOT EXISTS (
                      SELECT 1
                      FROM rides r
                      WHERE r.vehicle_id = v.vehicle_id
                        AND r.status = 'started'
                    )
                  GROUP BY v.station_id
                ) avail ON avail.station_id = s.station_id
                WHERE s.status = 'active'
                ORDER BY s.name
                """
            )
        except Exception as exc:
            logger.exception("Failed to query stations table for active stations")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Database error fetching stations: {exc}",
            ) from exc

    out = []
    for row in rows:
        d = record_to_dict(row)
        out.append(
            {
                "station_id": d["station_id"],
                "name": d["name"],
                "lat": d["lat"],
                "lng": d["lng"],
                "capacity": d["capacity"],
                "available_vehicles": d.get("available_vehicles") or 0,
            }
        )
    return out


@router.get("/{station_id}/vehicles")
async def station_vehicles(station_id: UUID, _user_id=Depends(get_current_user_id)):
    pool = get_pool()
    async with pool.acquire() as conn:
        try:
            row = await conn.fetchrow(
                """
                SELECT 1 FROM stations s
                WHERE s.station_id = $1 AND s.status = 'active'
                """,
                station_id,
            )
            if not row:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Station not found or inactive",
                )
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
                WHERE v.station_id = $1
                  AND v.availability_status = 'available'
                  AND NOT EXISTS (
                    SELECT 1
                    FROM rides r
                    WHERE r.vehicle_id = v.vehicle_id
                      AND r.status = 'started'
                  )
                ORDER BY s.updated_at DESC NULLS LAST
                """,
                station_id,
            )
        except HTTPException:
            raise
        except Exception as exc:
            logger.exception("Failed to query vehicles for station %s", station_id)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Database error fetching station vehicles: {exc}",
            ) from exc

    result = []
    for r in rows:
        d = record_to_dict(r)
        result.append(
            {
                "state_id": d["state_id"],
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
        )
    return result
