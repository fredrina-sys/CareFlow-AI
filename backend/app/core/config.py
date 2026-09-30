from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    DATABASE_URL: str = "sqlite:///./dev.db"  # dev/test fallback; PostgreSQL in Docker
    JWT_SECRET: str = "dev-only-change-me-please-use-env"
    JWT_EXPIRE_MINUTES: int = 60
    CORS_ORIGINS: str = "http://localhost:5173,http://127.0.0.1:5173"
    AI_PROVIDER: str = "mock"
    UPLOAD_DIR: str = "./uploads"
    MAX_UPLOAD_MB: int = 10

settings = Settings()
