"""Rejali vazifalar: har kungi kontent g'oyalari va haftalik tahlil hisobot."""

import logging

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

from studio import notify
from studio.agents.team import Team
from studio.config import settings

log = logging.getLogger(__name__)

DAILY_CONTENT_PROMPT = (
    "Bugun uchun kontent paketi tayyorla: 1 ta Instagram post (matn + hashtaglar), "
    "1 ta Reels/Shorts ssenariysi (hook, 3-4 kadr, CTA) va 1 ta AI rasm uchun prompt. "
    "Avval oxirgi qoralamalarni tekshirib takrorlanma, kerak bo'lsa trendlarni ko'r, "
    "natijani save_content_draft bilan saqla va qisqa xulosa ber."
)

WEEKLY_REPORT_PROMPT = (
    "Haftalik SMM hisobot tayyorla: YouTube va Instagram statistikasi, bot statistikasi, "
    "eng yaxshi postlar, sohadagi trendlar va keyingi hafta uchun 3-5 ta aniq tavsiya."
)


async def daily_content(team: Team) -> None:
    text = await team.run_task("content", DAILY_CONTENT_PROMPT)
    await notify.admin("☀️ Bugungi kontent paketi\n\n" + text)


async def weekly_report(team: Team) -> None:
    text = await team.run_task("analyst", WEEKLY_REPORT_PROMPT)
    await notify.admin("📊 Haftalik hisobot\n\n" + text)


def build_scheduler(team: Team) -> AsyncIOScheduler:
    scheduler = AsyncIOScheduler(timezone=settings.timezone)
    scheduler.add_job(
        daily_content,
        CronTrigger(hour=settings.daily_content_hour, minute=0, timezone=settings.timezone),
        args=[team],
        id="daily_content",
        misfire_grace_time=3600,
    )
    scheduler.add_job(
        weekly_report,
        CronTrigger(day_of_week=settings.weekly_report_day, hour=settings.daily_content_hour, minute=30,
                    timezone=settings.timezone),
        args=[team],
        id="weekly_report",
        misfire_grace_time=3600,
    )
    return scheduler
