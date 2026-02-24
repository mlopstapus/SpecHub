from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql+asyncpg://pcp:pcp@localhost:5432/pcp"
    auth_token: str = "dev-token-123"
    jwt_secret: str = "dev-jwt-secret-change-me-in-production"
    jwt_expiry_hours: int = 24
    invitation_expiry_hours: int = 72
    log_level: str = "info"

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
