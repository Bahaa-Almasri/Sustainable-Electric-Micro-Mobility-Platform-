from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    database_url: str
    jwt_secret: str = "dev-only-change-in-production"
    jwt_algorithm: str = "HS256"
    jwt_expire_days: int = 7
    cors_origins: str = (
        "http://localhost:8081,http://127.0.0.1:8081,"
        "http://localhost:19006,http://127.0.0.1:19006"
    )
    #: Match any port on localhost / 127.0.0.1 (Expo web often moves ports). Disable in locked-down prod.
    cors_allow_localhost_regex: bool = True
    debug_http_log: bool = Field(
        default=False,
        description="Print every HTTP request (method + path) to stderr. Set env DEBUG_HTTP_LOG=true.",
    )


settings = Settings()
