"""Telegram bot: mijozlar va admin uchun."""

import logging

from telegram import Update
from telegram.constants import ChatAction
from telegram.ext import Application, CommandHandler, ContextTypes, MessageHandler, filters

from studio.agents.team import Team
from studio.config import settings
from studio.notify import chunks

log = logging.getLogger(__name__)

WELCOME = (
    "Assalomu alaykum! 👋 {name} ga xush kelibsiz.\n"
    "Men studiyaning AI yordamchisiman — 24/7 ishlayman. Xizmatlar, narxlar yoki buyurtma "
    "haqida bemalol yozing."
)
ADMIN_HELP = (
    "\n\n🔑 Siz adminsiz. Qo'shimcha imkoniyatlar:\n"
    "• Kontent so'rang: \"Reels uchun 5 ta g'oya yoz\"\n"
    "• Tahlil so'rang: \"Instagram statistikamni tahlil qil\"\n"
    "• /leads — oxirgi arizalar\n• /stats — bot statistikasi"
)


def _is_admin(update: Update) -> bool:
    return bool(settings.admin_chat_id) and str(update.effective_chat.id) == settings.admin_chat_id


def build_application(team: Team) -> Application:
    app = Application.builder().token(settings.telegram_token).build()

    async def start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        text = WELCOME.format(name=settings.studio_name)
        if _is_admin(update):
            text += ADMIN_HELP
        await update.message.reply_text(text)

    async def leads(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        if not _is_admin(update):
            return
        rows = team.storage.recent_leads(10)
        if not rows:
            await update.message.reply_text("Hozircha arizalar yo'q.")
            return
        lines = [
            f"#{r['id']} [{r['channel']}] {r['name']} — {r['contact']}\n   {r['service']}: {r['details']}"
            for r in rows
        ]
        for part in chunks("\n\n".join(lines)):
            await update.message.reply_text(part)

    async def stats(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        if _is_admin(update):
            await update.message.reply_text(team.storage.stats_json())

    async def on_message(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        msg = update.message
        if not msg or not msg.text:
            return
        await context.bot.send_chat_action(msg.chat_id, ChatAction.TYPING)
        reply = await team.handle("telegram", str(msg.chat_id), msg.text, is_staff=_is_admin(update))
        for part in chunks(reply):
            await msg.reply_text(part)

    async def on_error(update: object, context: ContextTypes.DEFAULT_TYPE) -> None:
        log.error("Telegram xatosi", exc_info=context.error)

    app.add_handler(CommandHandler("start", start))
    app.add_handler(CommandHandler("leads", leads))
    app.add_handler(CommandHandler("stats", stats))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, on_message))
    app.add_error_handler(on_error)
    return app
