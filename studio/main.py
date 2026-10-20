"""Ilova kirish nuqtasi: FastAPI + Telegram bot + rejalashtiruvchi, bitta jarayonda 24/7."""

import logging
from contextlib import asynccontextmanager

import anthropic
from fastapi import FastAPI

from studio.agents.team import Team
from studio.channels import instagram
from studio.config import settings
from studio.storage import Storage

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
log = logging.getLogger("studio")

state: dict = {}


@asynccontextmanager
async def lifespan(app: FastAPI):
    from studio.scheduler import build_scheduler

    team = Team(anthropic.AsyncAnthropic(max_retries=4), Storage(settings.db_path))
    state["team"] = team

    tg_app = None
    if settings.telegram_token:
        from studio.channels.telegram import build_application

        tg_app = build_application(team)
        await tg_app.initialize()
        await tg_app.start()
        await tg_app.updater.start_polling(drop_pending_updates=False)
        log.info("Telegram bot ishga tushdi")
    else:
        log.warning("TELEGRAM_BOT_TOKEN yo'q — Telegram o'chirilgan")

    scheduler = build_scheduler(team)
    scheduler.start()
    log.info("Rejali vazifalar ishga tushdi: %s", [j.id for j in scheduler.get_jobs()])

    try:
        yield
    finally:
        scheduler.shutdown(wait=False)
        if tg_app:
            await tg_app.updater.stop()
            await tg_app.stop()
            await tg_app.shutdown()


app = FastAPI(title=settings.studio_name, lifespan=lifespan)
app.include_router(instagram.build_router(lambda: state["team"]))


@app.get("/health")
async def health():
    return {"status": "ok", "studio": settings.studio_name}
