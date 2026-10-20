"""Admin (studiya egasi)ga Telegram orqali xabar yuborish."""

import logging

import httpx

from studio.config import settings

log = logging.getLogger(__name__)

TELEGRAM_LIMIT = 4000


def chunks(text: str, size: int = TELEGRAM_LIMIT) -> list[str]:
    """Uzun matnni Telegram chegarasiga mos bo'laklarga ajratadi (iloji bo'lsa qator bo'yicha)."""
    parts = []
    while len(text) > size:
        cut = text.rfind("\n", 0, size)
        if cut <= 0:
            cut = size
        parts.append(text[:cut])
        text = text[cut:].lstrip("\n")
    if text:
        parts.append(text)
    return parts


async def admin(text: str) -> None:
    if not (settings.telegram_token and settings.admin_chat_id):
        log.info("Admin chat sozlanmagan, xabar faqat logga yozildi:\n%s", text)
        return
    url = f"https://api.telegram.org/bot{settings.telegram_token}/sendMessage"
    async with httpx.AsyncClient(timeout=20) as http:
        for part in chunks(text):
            try:
                r = await http.post(url, json={"chat_id": settings.admin_chat_id, "text": part})
                r.raise_for_status()
            except httpx.HTTPError:
                log.exception("Admin'ga xabar yuborilmadi")
                return
