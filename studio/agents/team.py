"""AI agentlar jamoasi: koordinator + mutaxassislar."""

import json
import logging
from typing import Literal

import anthropic
from pydantic import BaseModel

from studio.agents.base import Agent, Context, Tool, object_schema
from studio.config import settings
from studio.tools import social

log = logging.getLogger(__name__)

STYLE = (
    "Mijoz qaysi tilda yozsa (o'zbek, rus yoki ingliz), o'sha tilda javob bering. "
    "Javoblar qisqa, samimiy va aniq bo'lsin; messenjer uchun yozyapsiz, katta sarlavhalar va jadvallar ishlatmang. "
    "Bilmagan narsangizni (narx, muddat) o'ylab topmang: aniqlashtirib, menejer bog'lanishini ayting."
)


# ---------------- Tool handlerlar ----------------

async def _save_lead(inp: dict, ctx: Context) -> str:
    lead_id = ctx.storage.add_lead(
        ctx.channel, ctx.user_id, inp["name"], inp["contact"], inp["service"], inp["details"]
    )
    from studio import notify  # aylanma importdan qochish uchun

    await notify.admin(
        f"🆕 Yangi ariza #{lead_id} ({ctx.channel})\n"
        f"👤 {inp['name']}\n📞 {inp['contact']}\n🎯 {inp['service']}\n📝 {inp['details']}"
    )
    return json.dumps({"ok": True, "lead_id": lead_id})


async def _save_draft(inp: dict, ctx: Context) -> str:
    draft_id = ctx.storage.add_draft(inp["platform"], inp["title"], inp["body"])
    return json.dumps({"ok": True, "draft_id": draft_id})


async def _recent_drafts(inp: dict, ctx: Context) -> str:
    return json.dumps(ctx.storage.recent_drafts(inp["limit"]), ensure_ascii=False)


async def _yt_stats(inp: dict, ctx: Context) -> str:
    return await social.youtube_channel_stats(inp["channel_id"])


async def _yt_trending(inp: dict, ctx: Context) -> str:
    return await social.youtube_search_trending(inp["query"], inp["days"])


async def _ig_stats(inp: dict, ctx: Context) -> str:
    return await social.instagram_profile_stats()


async def _studio_stats(inp: dict, ctx: Context) -> str:
    return ctx.storage.stats_json()


SAVE_LEAD = Tool(
    "save_lead",
    "Mijoz buyurtma bermoqchi bo'lsa va ismi hamda aloqa ma'lumoti (telefon yoki username) ma'lum bo'lsa, "
    "arizani saqlaydi va menejerga xabar yuboradi.",
    object_schema(
        {
            "name": {"type": "string", "description": "Mijoz ismi"},
            "contact": {"type": "string", "description": "Telefon raqam yoki username"},
            "service": {"type": "string", "description": "Qaysi xizmat kerak"},
            "details": {"type": "string", "description": "Buyurtma tafsilotlari, muddat, byudjet"},
        }
    ),
    _save_lead,
)

SAVE_DRAFT = Tool(
    "save_content_draft",
    "Tayyor kontent (post, caption, ssenariy, kontent-reja)ni keyinroq ishlatish uchun saqlaydi.",
    object_schema(
        {
            "platform": {"type": "string", "enum": ["instagram", "youtube", "telegram", "tiktok", "other"]},
            "title": {"type": "string"},
            "body": {"type": "string", "description": "To'liq matn"},
        }
    ),
    _save_draft,
)

RECENT_DRAFTS = Tool(
    "recent_content_drafts",
    "Oxirgi saqlangan kontent qoralamalarini ko'rsatadi (takrorlanmaslik uchun).",
    object_schema({"limit": {"type": "integer", "description": "Nechta (1-20)"}}),
    _recent_drafts,
)

YT_STATS = Tool(
    "youtube_channel_stats",
    "YouTube kanal statistikasi: obunachilar, ko'rishlar, videolar soni. Bo'sh channel_id = studiya kanali.",
    object_schema({"channel_id": {"type": "string"}}),
    _yt_stats,
)

YT_TRENDING = Tool(
    "youtube_trending_search",
    "Mavzu bo'yicha oxirgi kunlardagi eng ko'p ko'rilgan YouTube videolarni topadi (O'zbekiston regioni).",
    object_schema(
        {
            "query": {"type": "string", "description": "Qidiruv so'zi"},
            "days": {"type": "integer", "description": "Necha kun ichida (1-30)"},
        }
    ),
    _yt_trending,
)

IG_STATS = Tool(
    "instagram_profile_stats",
    "Studiya Instagram akkaunti statistikasi va oxirgi postlar (layk, izohlar).",
    object_schema({}),
    _ig_stats,
)

STUDIO_STATS = Tool(
    "studio_bot_stats",
    "Bot statistikasi: arizalar, qoralamalar va noyob mijozlar soni.",
    object_schema({}),
    _studio_stats,
)


# ---------------- Agentlar ----------------

SUPPORT = Agent(
    name="Mijozlar menejeri",
    role="support",
    effort="low",
    system_prompt=(
        "Vazifangiz: Telegram va Instagram'da mijozlarga 24/7 javob berish, studiya xizmatlari "
        "(AI rasm, AI video, reklama kontenti, SMM, brending) haqida tushuntirish va buyurtmalarni qabul qilish. "
        "Mijoz buyurtma bermoqchi bo'lsa: ismi, aloqa ma'lumoti, kerakli xizmat va tafsilotlarni so'rang, "
        "hammasi to'plangach save_lead tool'ini chaqiring va menejer tez orada bog'lanishini ayting. " + STYLE
    ),
    tools=[SAVE_LEAD],
)

CONTENT = Agent(
    name="Kontent yaratuvchi",
    role="content",
    effort="medium",
    system_prompt=(
        "Vazifangiz: Instagram, YouTube, Telegram va TikTok uchun kontent yaratish: post matnlari, caption, "
        "hashtaglar, Reels/Shorts ssenariylari, video g'oyalari, AI rasm/video uchun promptlar va kontent-rejalar. "
        "Yangi g'oya berishdan oldin recent_content_drafts bilan takrorlanmasligini tekshiring, "
        "tayyor ishni save_content_draft bilan saqlang. " + STYLE
    ),
    tools=[SAVE_DRAFT, RECENT_DRAFTS, YT_TRENDING],
)

ANALYST = Agent(
    name="SMM tahlilchi",
    role="analyst",
    effort="medium",
    system_prompt=(
        "Vazifangiz: YouTube va Instagram statistikasini tahlil qilish, trendlarni topish va "
        "o'sish uchun aniq tavsiyalar berish. Raqamlarni faqat tool natijalaridan oling. "
        "Agar API sozlanmagan bo'lsa, buni ochiq ayting va qaysi kalit kerakligini tushuntiring. " + STYLE
    ),
    tools=[YT_STATS, YT_TRENDING, IG_STATS, STUDIO_STATS],
)

GENERAL = Agent(
    name="Yordamchi",
    role="general",
    effort="low",
    system_prompt="Vazifangiz: boshqa agentlarga tegishli bo'lmagan umumiy savollarga yordam berish. " + STYLE,
)

AGENTS = {a.role: a for a in (SUPPORT, CONTENT, ANALYST, GENERAL)}

# Kontent va tahlil — ichki ish; begona mijozlar bu agentlardan foydalanmasligi kerak.
STAFF_ONLY = {"content", "analyst"}


class Route(BaseModel):
    agent: Literal["support", "content", "analyst", "general"]


ROUTER_PROMPT = (
    f"Siz {settings.studio_name} jamoasining koordinatorisiz. Oxirgi xabarni qaysi agent bajarishini tanlang:\n"
    "- support: mijoz xizmatlar, narx, buyurtma, hamkorlik haqida so'raydi yoki salomlashadi\n"
    "- content: post, caption, ssenariy, g'oya, kontent-reja, AI prompt yozish so'raladi\n"
    "- analyst: YouTube/Instagram statistikasi, trendlar, o'sish tahlili so'raladi\n"
    "- general: boshqa hamma narsa"
)


class Team:
    """Xabarni to'g'ri agentga yo'naltiradi va suhbat tarixini yuritadi."""

    def __init__(self, client: anthropic.AsyncAnthropic, storage):
        self.client = client
        self.storage = storage

    async def route(self, history: list[dict]) -> str:
        try:
            response = await self.client.messages.parse(
                model=settings.claude_model,
                max_tokens=1024,
                system=ROUTER_PROMPT,
                messages=history[-6:],
                output_config={"effort": "low"},
                output_format=Route,
            )
            if response.stop_reason != "refusal" and response.parsed_output:
                return response.parsed_output.agent
        except anthropic.APIError:
            log.exception("Router xatosi; support agentiga yo'naltirildi")
        return "support"

    async def handle(self, channel: str, user_id: str, text: str, is_staff: bool = False) -> str:
        self.storage.add_message(channel, user_id, "user", text)
        history = self.storage.history(channel, user_id)

        role = await self.route(history)
        if role in STAFF_ONLY and not is_staff:
            role = "support"
        agent = AGENTS[role]
        log.info("%s:%s -> %s", channel, user_id, agent.name)

        reply = await agent.run(self.client, history, Context(channel, user_id, self.storage))
        self.storage.add_message(channel, user_id, "assistant", reply)
        return reply

    async def run_task(self, role: str, prompt: str) -> str:
        """Rejali vazifalar uchun: tarixsiz, bitta agentga to'g'ridan-to'g'ri topshiriq."""
        agent = AGENTS[role]
        ctx = Context("scheduler", "system", self.storage)
        return await agent.run(self.client, [{"role": "user", "content": prompt}], ctx)
