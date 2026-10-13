"""
Screen-level aggregation endpoints: one request per screen instead of several.

Each endpoint reuses the existing route handlers (same SQL, same response shapes)
and runs them concurrently. Sections the screen can live without fail on their
own: they come back as null and their message is listed under `errors`.
"""

import asyncio
import logging
from typing import Any, Awaitable
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException

from app.deps import get_current_user_id
from app.routers.reservations import my_reservations
from app.routers.rides import active_ride, list_my_rides, pricing_catalog
from app.routers.stations import list_active_stations, list_parking_available_stations
from app.routers.users import me
from app.routers.vehicles import get_vehicle
from app.routers.wallet import wallet_overview

logger = logging.getLogger(__name__)

router = APIRouter(tags=["aggregates"])


async def _optional(name: str, call: Awaitable[Any], errors: dict[str, str]) -> Any:
    """Await one section; on failure record the error and return None instead of failing the request."""
    try:
        return await call
    except HTTPException as exc:
        errors[name] = str(exc.detail)
    except Exception:
        logger.exception("Aggregate section %s failed", name)
        errors[name] = f"Failed to load {name}"
    return None


@router.get("/map/overview")
async def map_overview(user_id: UUID = Depends(get_current_user_id)):
    """
    Everything the map screen needs.

    With an active ride, `parking_stations` lists stations with a free slot and
    `stations` is empty; otherwise `stations` lists active stations.
    """
    errors: dict[str, str] = {}
    ride, pricing = await asyncio.gather(
        _optional("active_ride", active_ride(user_id=user_id), errors),
        _optional("pricing", pricing_catalog(_user_id=user_id), errors),
    )
    stations: list = []
    parking_stations: list = []
    if ride:
        parking_stations = await _optional(
            "parking_stations", list_parking_available_stations(_user_id=user_id), errors
        ) or []
    else:
        stations = await _optional("stations", list_active_stations(_user_id=user_id), errors) or []
    return {
        "active_ride": ride,
        "pricing_rates": pricing["rates"] if pricing else None,
        "stations": stations,
        "parking_stations": parking_stations,
        "errors": errors,
    }


@router.get("/users/me/summary")
async def account_summary(user_id: UUID = Depends(get_current_user_id)):
    """Everything the account screen needs. The profile is required; other sections may fail on their own."""
    errors: dict[str, str] = {}
    profile, rides, reservations, wallet = await asyncio.gather(
        me(user_id=user_id),
        _optional("rides", list_my_rides(user_id=user_id), errors),
        _optional("reservations", my_reservations(user_id=user_id), errors),
        _optional("wallet", wallet_overview(user_id=user_id), errors),
    )
    return {
        "profile": profile,
        "rides": rides,
        "reservations": reservations,
        "wallet": wallet,
        "errors": errors,
    }


@router.get("/vehicles/{vehicle_id}/details")
async def vehicle_details(vehicle_id: UUID, user_id: UUID = Depends(get_current_user_id)):
    """
    Everything the vehicle screen needs. The vehicle is required (404 if missing);
    `my_reservations` holds only the current user's reservations for this vehicle.
    """
    errors: dict[str, str] = {}
    vehicle, reservations, pricing = await asyncio.gather(
        get_vehicle(vehicle_id, _user_id=user_id),
        _optional("reservations", my_reservations(user_id=user_id), errors),
        _optional("pricing", pricing_catalog(_user_id=user_id), errors),
    )
    mine = None
    if reservations is not None:
        mine = [r for r in reservations if r.get("vehicle_id") == str(vehicle_id)]
    return {
        "vehicle": vehicle,
        "my_reservations": mine,
        "pricing_rates": pricing["rates"] if pricing else None,
        "errors": errors,
    }
