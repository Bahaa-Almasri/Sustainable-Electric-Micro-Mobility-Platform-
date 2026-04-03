from datetime import date, datetime, timezone
from decimal import Decimal
from uuid import UUID


def serialize_value(v):
    if v is None:
        return None
    if isinstance(v, UUID):
        return str(v)
    # datetime is a subclass of date — handle datetime first.
    if isinstance(v, datetime):
        # Naive timestamps from the DB are UTC; JS must not parse them as local time
        # (that skews ride duration by the device's UTC offset, e.g. +180 min at UTC+3).
        if v.tzinfo is None:
            v = v.replace(tzinfo=timezone.utc)
        else:
            v = v.astimezone(timezone.utc)
        return v.isoformat().replace("+00:00", "Z")
    if isinstance(v, date):
        return v.isoformat()
    if isinstance(v, Decimal):
        return float(v)
    if isinstance(v, dict):
        return {k: serialize_value(x) for k, x in v.items()}
    if isinstance(v, list):
        return [serialize_value(x) for x in v]
    return v


def record_to_dict(row) -> dict:
    return {k: serialize_value(v) for k, v in dict(row).items()}
