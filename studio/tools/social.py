"""YouTube Data API va Instagram Graph API bilan ishlash."""

import json
from datetime import datetime, timedelta, timezone

import httpx

from studio.config import settings

YOUTUBE_API = "https://www.googleapis.com/youtube/v3"
# "Instagram API with Instagram Login" uchun bazaviy manzil
INSTAGRAM_API = "https://graph.instagram.com/v21.0"

_TIMEOUT = httpx.Timeout(20.0)


class NotConfigured(RuntimeError):
    pass


async def _get(url: str, params: dict) -> dict:
    async with httpx.AsyncClient(timeout=_TIMEOUT) as http:
        r = await http.get(url, params=params)
        r.raise_for_status()
        return r.json()


# ---------------- YouTube ----------------

async def youtube_channel_stats(channel_id: str = "") -> str:
    if not settings.youtube_api_key:
        raise NotConfigured("YOUTUBE_API_KEY sozlanmagan")
    channel_id = channel_id or settings.youtube_channel_id
    if not channel_id:
        raise NotConfigured("YOUTUBE_CHANNEL_ID sozlanmagan")
    data = await _get(
        f"{YOUTUBE_API}/channels",
        {"part": "snippet,statistics", "id": channel_id, "key": settings.youtube_api_key},
    )
    items = data.get("items", [])
    if not items:
        return json.dumps({"error": "Kanal topilmadi"})
    ch = items[0]
    return json.dumps(
        {"title": ch["snippet"]["title"], **ch["statistics"]},
        ensure_ascii=False,
    )


async def youtube_search_trending(query: str, days: int = 7, region: str = "UZ") -> str:
    if not settings.youtube_api_key:
        raise NotConfigured("YOUTUBE_API_KEY sozlanmagan")
    after = (datetime.now(timezone.utc) - timedelta(days=days)).strftime("%Y-%m-%dT%H:%M:%SZ")
    data = await _get(
        f"{YOUTUBE_API}/search",
        {
            "part": "snippet",
            "q": query,
            "type": "video",
            "order": "viewCount",
            "publishedAfter": after,
            "regionCode": region,
            "maxResults": 10,
            "key": settings.youtube_api_key,
        },
    )
    videos = [
        {
            "title": it["snippet"]["title"],
            "channel": it["snippet"]["channelTitle"],
            "url": f"https://youtu.be/{it['id']['videoId']}",
            "published": it["snippet"]["publishedAt"],
        }
        for it in data.get("items", [])
    ]
    return json.dumps(videos, ensure_ascii=False)


# ---------------- Instagram ----------------

def _ig_ready() -> None:
    if not (settings.ig_access_token and settings.ig_account_id):
        raise NotConfigured("INSTAGRAM_ACCESS_TOKEN / INSTAGRAM_ACCOUNT_ID sozlanmagan")


async def instagram_profile_stats() -> str:
    _ig_ready()
    profile = await _get(
        f"{INSTAGRAM_API}/{settings.ig_account_id}",
        {"fields": "username,followers_count,follows_count,media_count", "access_token": settings.ig_access_token},
    )
    media = await _get(
        f"{INSTAGRAM_API}/{settings.ig_account_id}/media",
        {
            "fields": "caption,media_type,like_count,comments_count,timestamp,permalink",
            "limit": 10,
            "access_token": settings.ig_access_token,
        },
    )
    return json.dumps({"profile": profile, "recent_posts": media.get("data", [])}, ensure_ascii=False)


async def instagram_send_message(recipient_id: str, text: str) -> None:
    _ig_ready()
    async with httpx.AsyncClient(timeout=_TIMEOUT) as http:
        r = await http.post(
            f"{INSTAGRAM_API}/{settings.ig_account_id}/messages",
            params={"access_token": settings.ig_access_token},
            json={"recipient": {"id": recipient_id}, "message": {"text": text[:1000]}},
        )
        r.raise_for_status()
