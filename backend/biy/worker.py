"""arq worker (owner: Raphaël). Run: arq biy.worker.WorkerSettings. See contract/services.md#biyworker."""

import logging

from arq.connections import RedisSettings

from .config import settings

log = logging.getLogger("biy.worker")


async def execute_run(ctx, run_id: str) -> None:
    log.info("execute_run %s: not implemented yet", run_id)


class WorkerSettings:
    functions = [execute_run]
    redis_settings = RedisSettings.from_dsn(settings.redis_url or "redis://localhost:6379")
    max_jobs = 4
    job_timeout = 3600
