import logging
from uuid import UUID

import asyncpg

logger = logging.getLogger(__name__)

DEFAULT_RESERVATION_TTL_MINUTES = 15
MIN_RESERVATION_TTL_MINUTES = 1
MAX_RESERVATION_TTL_MINUTES = 60


def normalize_reservation_ttl(minutes_ttl: int) -> int:
    if minutes_ttl < MIN_RESERVATION_TTL_MINUTES:
        return MIN_RESERVATION_TTL_MINUTES
    if minutes_ttl > MAX_RESERVATION_TTL_MINUTES:
        return MAX_RESERVATION_TTL_MINUTES
    return minutes_ttl


async def expire_due_reservations(conn: asyncpg.Connection) -> int:
    """Expire active reservations that passed TTL and release reserved vehicles."""
    row = await conn.fetchrow(
        """
        WITH expired AS (
            UPDATE public.reservations
            SET status = 'expired'
            WHERE status = 'active'
              AND expires_at IS NOT NULL
              AND expires_at <= now()
            RETURNING vehicle_id
        ),
        released AS (
            UPDATE public.vehicles v
            SET availability_status = 'available'
            WHERE v.vehicle_id IN (SELECT DISTINCT vehicle_id FROM expired)
              AND v.availability_status = 'reserved'
            RETURNING v.vehicle_id
        )
        SELECT
          (SELECT COUNT(*)::int FROM expired) AS expired_count,
          (SELECT COUNT(*)::int FROM released) AS released_count
        """
    )
    return int(row["expired_count"]) if row else 0


async def create_reservation_if_available(
    conn: asyncpg.Connection,
    *,
    user_id: UUID,
    vehicle_id: UUID,
    minutes_ttl: int = DEFAULT_RESERVATION_TTL_MINUTES,
):
    ttl_minutes = normalize_reservation_ttl(minutes_ttl)
    return await conn.fetchrow(
        """
        WITH updated AS (
            UPDATE public.vehicles
            SET availability_status = 'reserved'
            WHERE vehicle_id = $2
              AND availability_status = 'available'
            RETURNING vehicle_id
        )
        INSERT INTO public.reservations (reservation_id, user_id, vehicle_id, expires_at)
        SELECT gen_random_uuid(), $1, vehicle_id, now() + $3 * interval '1 minute'
        FROM updated
        RETURNING reservation_id, user_id, vehicle_id, status, created_at, expires_at
        """,
        user_id,
        vehicle_id,
        ttl_minutes,
    )


async def find_active_reservation_for_vehicle(conn: asyncpg.Connection, *, vehicle_id: UUID):
    return await conn.fetchrow(
        """
        SELECT reservation_id, user_id, vehicle_id, status, created_at, expires_at
        FROM public.reservations
        WHERE vehicle_id = $1
          AND status = 'active'
          AND (expires_at IS NULL OR expires_at > now())
        ORDER BY created_at DESC NULLS LAST
        LIMIT 1
        """,
        vehicle_id,
    )


async def convert_active_reservation_to_ride(
    conn: asyncpg.Connection,
    *,
    user_id: UUID,
    vehicle_id: UUID,
) -> int:
    result = await conn.execute(
        """
        UPDATE public.reservations
        SET status = 'converted_to_ride'
        WHERE reservation_id IN (
            SELECT reservation_id
            FROM public.reservations
            WHERE user_id = $1
              AND vehicle_id = $2
              AND status = 'active'
              AND (expires_at IS NULL OR expires_at > now())
            ORDER BY created_at DESC NULLS LAST
            LIMIT 1
        )
        """,
        user_id,
        vehicle_id,
    )
    return int(result.split(" ")[1])


async def expire_reservation_by_id(
    conn: asyncpg.Connection,
    *,
    reservation_id: UUID,
) -> tuple[str | None, int]:
    logger.info(
        "Reservations cancel requested (reservation_id=%s)",
        reservation_id,
    )

    status_row = await conn.fetchrow(
        """
        SELECT status::text AS status
        FROM public.reservations
        WHERE reservation_id = $1
        """,
        reservation_id,
    )
    if not status_row:
        return None, 0

    current_status = str(status_row["status"])
    if current_status != "active":
        logger.info(
            "Reservation already non-active (reservation_id=%s, status=%s)",
            reservation_id,
            current_status,
        )
        return current_status, 0

    row = await conn.fetchrow(
        """
        WITH cancelled AS (
            UPDATE public.reservations
            SET status = 'cancelled',
                cancelled_at = now()
            WHERE reservation_id = $1
              AND status = 'active'
            RETURNING *
        ),
        released AS (
            UPDATE public.vehicles v
            SET availability_status = 'available'
            WHERE v.vehicle_id IN (SELECT vehicle_id FROM cancelled)
              AND v.availability_status = 'reserved'
            RETURNING v.vehicle_id
        )
        SELECT
          (SELECT COUNT(*)::int FROM released) AS released_count
        """,
        reservation_id,
    )
    released_count = int(row["released_count"]) if row else 0
    logger.info(
        "Reservation cancelled (reservation_id=%s, released_count=%s)",
        reservation_id,
        released_count,
    )
    return "cancelled", released_count
