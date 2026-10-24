from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

# Repo root locally (backend/biy/config.py → ../..), /app in the Docker image.
ROOT = Path(__file__).resolve().parents[2] if (Path(__file__).resolve().parents[2] / "catalog").exists() \
    else Path(__file__).resolve().parents[1]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=ROOT / ".env", extra="ignore")

    database_url: str | None = None
    redis_url: str | None = None
    supabase_url: str | None = None
    supabase_jwt_secret: str | None = None
    nebius_api_key: str | None = None
    openrouter_api_key: str | None = None
    static_dir: Path = ROOT / "frontend" / "dist"
    catalog_path: Path = ROOT / "catalog" / "models.json"


settings = Settings()
