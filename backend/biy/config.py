from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

# Repo root locally (backend/biy/config.py → ../..), /app in the Docker image.
ROOT = Path(__file__).resolve().parents[2] if (Path(__file__).resolve().parents[2] / "catalog").exists() \
    else Path(__file__).resolve().parents[1]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=ROOT / ".env", extra="ignore")

    database_url: str | None = None
    db_pool_size: int = 4  # per process; Supabase's session pooler caps all clients at 15
    redis_url: str | None = None
    # arq queue. Local workers must not share prod's queue (prod would pick up local runs, and the reverse).
    arq_queue: str = "arq:queue"
    supabase_url: str | None = None  # dashboard tokens are verified against its JWKS (ES256)
    nebius_api_key: str | None = None
    openrouter_api_key: str | None = None
    openai_api_key: str | None = None
    # In-flight calls per connection in the worker (stay under provider rate limits).
    nebius_concurrency: int = 16
    openrouter_concurrency: int = 8
    openai_concurrency: int = 8
    # Local development only: no token needed, every request uses one demo workspace.
    biy_dev_no_auth: bool = False
    static_dir: Path = ROOT / "frontend" / "dist"
    catalog_path: Path = ROOT / "catalog" / "models.json"


settings = Settings()
