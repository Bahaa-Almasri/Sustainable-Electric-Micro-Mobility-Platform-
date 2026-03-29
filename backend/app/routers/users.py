from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status

from app.deps import get_current_user_id
from app.db import get_pool
from app.schemas import UserPublic
from app.util_json import record_to_dict

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me", response_model=UserPublic)
async def me(user_id: UUID = Depends(get_current_user_id)):
    pool = get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            SELECT user_id, email, name, phone_number, status
            FROM public.users
            WHERE user_id = $1
            """,
            user_id,
        )
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    d = record_to_dict(row)
    return UserPublic(**d)


@router.get("/{uid}", response_model=UserPublic)
async def get_user(uid: UUID, user_id: UUID = Depends(get_current_user_id)):
    if uid != user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
    pool = get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            SELECT user_id, email, name, phone_number, status
            FROM public.users
            WHERE user_id = $1
            """,
            uid,
        )
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return UserPublic(**record_to_dict(row))
