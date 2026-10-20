"""Barcha sozlamalar muhit o'zgaruvchilaridan (.env) o'qiladi."""

import os
from dataclasses import dataclass, field


def _env(name: str, default: str = "") -> str:
    return os.environ.get(name, default).strip()


@dataclass(frozen=True)
class Settings:
    # Claude
    claude_model: str = field(default_factory=lambda: _env("CLAUDE_MODEL", "claude-opus-5-5"))

    # Biznes haqida ma'lumot (agentlarning tizim promptiga qo'shiladi)
    studio_name: str = field(default_factory=lambda: _env("STUDIO_NAME", "AZIZ FLORAN AI STUDIO"))
    studio_info: str = field(default_factory=lambda: _env("STUDIO_INFO"))

    # Telegram
    telegram_token: str = field(default_factory=lambda: _env("TELEGRAM_BOT_TOKEN"))
    admin_chat_id: str = field(default_factory=lambda: _env("TELEGRAM_ADMIN_CHAT_ID"))

    # Instagram (Meta Graph API)
    ig_access_token: str = field(default_factory=lambda: _env("INSTAGRAM_ACCESS_TOKEN"))
    ig_account_id: str = field(default_factory=lambda: _env("INSTAGRAM_ACCOUNT_ID"))
    ig_verify_token: str = field(default_factory=lambda: _env("INSTAGRAM_VERIFY_TOKEN"))
    ig_app_secret: str = field(default_factory=lambda: _env("INSTAGRAM_APP_SECRET"))

    # YouTube Data API
    youtube_api_key: str = field(default_factory=lambda: _env("YOUTUBE_API_KEY"))
    youtube_channel_id: str = field(default_factory=lambda: _env("YOUTUBE_CHANNEL_ID"))

    # Saqlash va rejalashtirish
    db_path: str = field(default_factory=lambda: _env("DB_PATH", "data/studio.db"))
    timezone: str = field(default_factory=lambda: _env("TIMEZONE", "Asia/Tashkent"))
    daily_content_hour: int = field(default_factory=lambda: int(_env("DAILY_CONTENT_HOUR", "9")))
    weekly_report_day: str = field(default_factory=lambda: _env("WEEKLY_REPORT_DAY", "mon"))


settings = Settings()
