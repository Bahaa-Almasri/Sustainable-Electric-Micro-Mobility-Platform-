from uuid import UUID

import asyncpg
from fastapi import APIRouter, HTTPException, status

from app.auth_jwt import create_access_token, hash_password, verify_password
from app.db import get_pool
from app.schemas import LoginRequest, RegisterRequest, TokenResponse

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=TokenResponse)
async def register(body: RegisterRequest):
    try:
        pw_hash = hash_password(body.password)
    except Exception as e:  # pragma: no cover
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Could not hash password ({e}). Check bcrypt is installed.",
        ) from e

    email_clean = str(body.email).lower().strip()
    name_clean = body.name.strip()
    phone_clean = body.phone_number.strip()

    pool = get_pool()
    async with pool.acquire() as conn:
        try:
            row = await conn.fetchrow(
                """
                INSERT INTO public.users (user_id, email, password_hash, name, phone_number, status)
                VALUES (gen_random_uuid(), $1, $2, $3, $4, 'active')
                RETURNING user_id, email
                """,
                email_clean,
                pw_hash,
                name_clean,
                phone_clean,
            )
        except asyncpg.UniqueViolationError:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Email or phone number is already registered",
            )
        except asyncpg.UndefinedColumnError as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=(
                    "A column in public.users does not match the app. "
                    f"Postgres: {e}. "
                    "Expected: user_id, email, password_hash, name, phone_number, status. "
                    "Run 004, 006 (rename phone→phone_number), 001."
                ),
            ) from e
        except asyncpg.NotNullViolationError as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    "Database rejected signup: a required column is empty. "
                    "Often `phone_number` or `name` are NOT NULL without default — run 003_users_nullable_optional.sql. "
                    f"Detail: {e}"
                ),
            )
        except asyncpg.PostgresError as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Database error during signup: {e}",
            )

    if not row:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Insert returned no row")

    uid = row["user_id"]
    token = create_access_token(uid, row["email"])
    return TokenResponse(access_token=token, user_id=uid, email=row["email"])


@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest):
    pool = get_pool()
    async with pool.acquire() as conn:
        try:
            row = await conn.fetchrow(
                """
                SELECT user_id, email, password_hash
                FROM public.users
                WHERE lower(email) = lower($1)
                """,
                body.email.strip(),
            )
        except asyncpg.UndefinedColumnError as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=(
                    f"public.users column mismatch: {e}. "
                    "Need user_id, email, password_hash. Run 001_auth_password.sql; "
                    "if user_id is missing your PK may be id — see 004_register_columns.sql."
                ),
            ) from e
    if not row or not verify_password(body.password, row["password_hash"]):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")
    uid = row["user_id"]
    token = create_access_token(uid, row["email"])
    return TokenResponse(access_token=token, user_id=uid, email=row["email"])
