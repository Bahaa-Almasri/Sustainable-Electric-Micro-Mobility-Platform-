"""
Ride pricing: database-backed rates with code defaults (surge/discounts hook points later).

`vehicle_pricing` is the primary source of truth; `DEFAULT_VEHICLE_PRICING` is the fallback
when a row is missing or the DB is unavailable.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import datetime, timezone
from math import ceil
from typing import Any

import asyncpg

logger = logging.getLogger(__name__)


# Fallback when DB row missing or query fails (must stay in sync with seeded migration defaults).
DEFAULT_VEHICLE_PRICING: dict[str, tuple[float, float]] = {
    "scooter": (0.5, 0.2),
    "bike": (0.75, 0.25),
    "car": (1.5, 0.5),
}

_SAFE_FALLBACK_TYPE = "scooter"


@dataclass(frozen=True)
class VehiclePricing:
    initial_fee: float
    price_per_minute: float
    source: str  # "database" | "default" | "safe_fallback"


def normalize_vehicle_type(raw: str | None) -> str:
    if raw is None or not str(raw).strip():
        raise ValueError("vehicle_type is required")
    v = str(raw).strip().lower()
    if v == "ebike":
        return "bike"
    return v


def _fallback_pricing_for_type(vehicle_type: str) -> VehiclePricing:
    key = normalize_vehicle_type(vehicle_type) if vehicle_type else _SAFE_FALLBACK_TYPE
    pair = DEFAULT_VEHICLE_PRICING.get(key)
    if pair is not None:
        init_, per = pair
        return VehiclePricing(float(init_), float(per), "default")
    # Unknown type: use safe tier so rides do not fail completely.
    init_, per = DEFAULT_VEHICLE_PRICING[_SAFE_FALLBACK_TYPE]
    return VehiclePricing(float(init_), float(per), "safe_fallback")


async def get_vehicle_pricing(
    conn: asyncpg.Connection,
    vehicle_type: str | None,
) -> VehiclePricing:
    """
    Load per-minute pricing for a vehicle type.

    Priority: `vehicle_pricing` row → DEFAULT_VEHICLE_PRICING → safe scooter tier.
    On DB errors, logs and uses defaults (no raise).
    """
    try:
        vtype = normalize_vehicle_type(vehicle_type)
    except ValueError:
        return _fallback_pricing_for_type(_SAFE_FALLBACK_TYPE)

    try:
        row = await conn.fetchrow(
            """
            SELECT initial_fee, price_per_minute
            FROM vehicle_pricing
            WHERE vehicle_type = $1
            """,
            vtype,
        )
    except Exception as exc:
        logger.warning("vehicle_pricing query failed; using defaults: %s", exc)
        return _fallback_pricing_for_type(vtype)

    if row is not None:
        return VehiclePricing(
            float(row["initial_fee"]),
            float(row["price_per_minute"]),
            "database",
        )
    return _fallback_pricing_for_type(vtype)


def duration_minutes_billed(start_time: datetime, end_time: datetime) -> int:
    """Billable minutes, at least 1, using ceiling of elapsed wall time."""
    if end_time < start_time:
        end_time = start_time
    elapsed = end_time - start_time
    sec = elapsed.total_seconds()
    return max(1, int(ceil(sec / 60.0)))


def _ensure_aware_utc(dt: datetime) -> datetime:
    """Normalize to UTC-aware for duration math (handles naive DB timestamps and offset-aware values)."""
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def naive_utc_for_timestamp_column(dt: datetime) -> datetime:
    """
    Values for PostgreSQL `timestamp without time zone` / asyncpg: pass naive UTC to avoid
    encoder errors mixing naive vs aware (see asyncpg DataError on bind).
    """
    return _ensure_aware_utc(dt).replace(tzinfo=None)


async def calculate_ride_price(
    conn: asyncpg.Connection,
    start_time: datetime,
    end_time: datetime,
    vehicle_type: str | None,
) -> dict[str, Any]:
    """
    Compute final ride cost from wall-clock duration and current pricing rules.

    Returns a dict suitable for JSON: duration_minutes, pricing breakdown, total_price.
    Always re-resolves pricing from DB (with fallback) so admin rate changes apply at trip end.
    """
    start_aware = _ensure_aware_utc(start_time)
    end_aware = _ensure_aware_utc(end_time)
    duration_minutes = duration_minutes_billed(start_aware, end_aware)
    pricing = await get_vehicle_pricing(conn, vehicle_type)
    total_price = pricing.initial_fee + (duration_minutes * pricing.price_per_minute)
    return {
        "duration_minutes": duration_minutes,
        "pricing": {
            "initial_fee": pricing.initial_fee,
            "price_per_minute": pricing.price_per_minute,
        },
        "total_price": round(total_price, 4),
        "_source": pricing.source,  # internal; stripped before HTTP if desired
    }


def strip_internal_keys(payload: dict[str, Any]) -> dict[str, Any]:
    out = {k: v for k, v in payload.items() if not k.startswith("_")}
    return out


# Future: surge_multiplier, promo_id, region_id — pass into calculate_ride_price and multiply.
