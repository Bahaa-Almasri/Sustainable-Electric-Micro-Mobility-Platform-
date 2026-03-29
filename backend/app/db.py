import asyncpg

from app.config import settings

_pool: asyncpg.Pool | None = None


def _connection_help() -> str:
    return (
        "Check DATABASE_URL in backend/.env. Use the full URI from Neon: Dashboard → your project → "
        "Connect → copy the **psql** or **URI** connection string (not REST). "
        "It must use your real Neon **role** (e.g. neondb_owner) and **password**, not the "
        "placeholder `user:password` from .env.example. If the password contains @, #, etc., "
        "URL-encode it in the URI."
    )


async def init_pool() -> asyncpg.Pool:
    global _pool
    if _pool is None:
        try:
            _pool = await asyncpg.create_pool(
                settings.database_url,
                min_size=1,
                max_size=10,
                command_timeout=60,
            )
        except asyncpg.InvalidPasswordError as e:
            raise RuntimeError(
                f"PostgreSQL rejected the password (user may be wrong too). {_connection_help()}"
            ) from e
        except asyncpg.InvalidCatalogNameError as e:
            raise RuntimeError(
                f"Database name in DATABASE_URL does not exist on the server. {_connection_help()}"
            ) from e
        except (OSError, asyncpg.PostgresConnectionError) as e:
            raise RuntimeError(
                f"Could not reach the database host. {_connection_help()} Underlying: {e}"
            ) from e
    return _pool


async def close_pool() -> None:
    global _pool
    if _pool is not None:
        await _pool.close()
        _pool = None


def get_pool() -> asyncpg.Pool:
    if _pool is None:
        raise RuntimeError("Database pool not initialized")
    return _pool
