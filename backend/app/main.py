from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.db import close_pool, get_pool, init_pool
from app.routers import auth, reservations, rides, support, users, vehicles, wallet


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_pool()
    yield
    await close_pool()


app = FastAPI(title="Micro-mobility API", lifespan=lifespan)

origins = [o.strip() for o in settings.cors_origins.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(users.router)
app.include_router(vehicles.router)
app.include_router(rides.router)
app.include_router(wallet.router)
app.include_router(reservations.router)
app.include_router(support.router)


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.get("/health/db")
async def health_db():
    """Same connection as the API: use this to verify public.users columns vs Neon SQL editor."""
    pool = get_pool()
    async with pool.acquire() as conn:
        db_row = await conn.fetchrow("SELECT current_database() AS db, current_user AS db_user")
        cols = await conn.fetch(
            """
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'users'
            ORDER BY ordinal_position
            """
        )
    return {
        "database": db_row["db"] if db_row else None,
        "connected_as": db_row["db_user"] if db_row else None,
        "public_users_column_count": len(cols),
        "public_users_columns": [
            {"name": c["column_name"], "type": c["data_type"], "nullable": c["is_nullable"]} for c in cols
        ],
        "signup_expects": ["user_id", "email", "password_hash", "name", "phone_number", "status"],
    }
