"""Instagram Direct xabarlari uchun Meta webhook."""

import hashlib
import hmac
import logging

from fastapi import APIRouter, BackgroundTasks, HTTPException, Request
from fastapi.responses import PlainTextResponse

from studio.config import settings
from studio.tools import social

log = logging.getLogger(__name__)


def valid_signature(body: bytes, header: str | None, secret: str) -> bool:
    if not secret:
        # App secret berilmagan bo'lsa tekshiruv o'tkazib yuboriladi (faqat test uchun!)
        return True
    if not header or not header.startswith("sha256="):
        return False
    expected = hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, header.removeprefix("sha256="))


def extract_messages(payload: dict, own_id: str) -> list[tuple[str, str]]:
    """Webhook payloadidan (sender_id, text) juftliklarini ajratadi."""
    out = []
    for entry in payload.get("entry", []):
        for event in entry.get("messaging", []):
            message = event.get("message") or {}
            sender = (event.get("sender") or {}).get("id", "")
            if message.get("is_echo") or not message.get("text") or not sender or sender == own_id:
                continue
            out.append((sender, message["text"]))
    return out


def build_router(get_team) -> APIRouter:
    router = APIRouter()

    async def reply(sender: str, text: str) -> None:
        try:
            answer = await get_team().handle("instagram", sender, text)
            await social.instagram_send_message(sender, answer)
        except Exception:
            log.exception("Instagram xabariga javob berilmadi")

    @router.get("/webhooks/instagram")
    async def verify(request: Request):
        q = request.query_params
        if q.get("hub.mode") == "subscribe" and settings.ig_verify_token and q.get("hub.verify_token") == settings.ig_verify_token:
            return PlainTextResponse(q.get("hub.challenge", ""))
        raise HTTPException(status_code=403)

    @router.post("/webhooks/instagram")
    async def receive(request: Request, background: BackgroundTasks):
        body = await request.body()
        if not valid_signature(body, request.headers.get("x-hub-signature-256"), settings.ig_app_secret):
            raise HTTPException(status_code=403)
        payload = await request.json()
        # Meta 200 javobni tez kutadi, shuning uchun javob fon rejimida tayyorlanadi
        for sender, text in extract_messages(payload, settings.ig_account_id):
            background.add_task(reply, sender, text)
        return {"ok": True}

    return router

