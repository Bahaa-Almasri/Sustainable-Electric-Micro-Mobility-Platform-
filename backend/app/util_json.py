from datetime import date, datetime
from decimal import Decimal
from uuid import UUID


def serialize_value(v):
    if v is None:
        return None
    if isinstance(v, UUID):
        return str(v)
    if isinstance(v, (datetime, date)):
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
