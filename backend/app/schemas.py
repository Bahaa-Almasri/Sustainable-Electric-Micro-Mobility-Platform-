from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field, field_validator


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: UUID
    email: str | None = None


class LoginRequest(BaseModel):
    email: EmailStr
    # Keep minimum low so dev logins don’t 422; enforce strength in UI / policy if needed.
    password: str = Field(min_length=1, max_length=500)


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=500)
    name: str = Field(min_length=1, max_length=200)
    phone_number: str = Field(min_length=7, max_length=32)

    @field_validator("name", "phone_number", mode="before")
    @classmethod
    def strip_spaces(cls, v: str) -> str:
        return v.strip() if isinstance(v, str) else v


class UserPublic(BaseModel):
    user_id: UUID
    email: str | None = None
    name: str | None = None
    phone_number: str | None = None
    status: str | None = None


class StartRideRequest(BaseModel):
    vehicle_id: UUID
    start_lat: float
    start_lng: float


class EndRideRequest(BaseModel):
    ride_id: UUID
    end_lat: float
    end_lng: float


class ReservationCreate(BaseModel):
    vehicle_id: UUID
    minutes_ttl: int = 15


class SupportTicketCreate(BaseModel):
    subject: str
    description: str


class PurchasePackageRequest(BaseModel):
    package_id: UUID
