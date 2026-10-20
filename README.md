# AZIZ FLORAN AI STUDIO

24/7 ishlaydigan **AI agentlar jamoasi** (Claude asosida). Telegram va Instagram Direct'da mijozlarga javob beradi, kontent yaratadi va YouTube/Instagram statistikasini tahlil qiladi.

## Jamoa tarkibi

| Agent | Vazifasi | Kim foydalana oladi |
|---|---|---|
| 🧭 **Koordinator** | Har bir xabarni o'qib, kerakli agentga yo'naltiradi | — |
| 💬 **Mijozlar menejeri** | Xizmatlar, narxlar haqida javob beradi, buyurtma (ariza) qabul qiladi va sizga darhol xabar yuboradi | Hamma |
| ✍️ **Kontent yaratuvchi** | Post, caption, hashtag, Reels/Shorts ssenariysi, AI rasm promptlari, kontent-reja | Faqat admin |
| 📊 **SMM tahlilchi** | YouTube/Instagram statistikasi, trendlar, o'sish bo'yicha tavsiyalar | Faqat admin |
| 🤝 **Yordamchi** | Boshqa umumiy savollar | Hamma |

### Avtomatik (rejali) vazifalar
- **Har kuni soat 9:00** — kontent paketi (post + Reels ssenariysi + AI rasm prompti) Telegram'ingizga keladi.
- **Har dushanba 9:30** — haftalik SMM hisobot.

### Admin buyruqlari (Telegram)
- `/start` — yordam
- `/leads` — oxirgi arizalar
- `/stats` — bot statistikasi
- Oddiy yozing: *"Reels uchun 5 ta g'oya yoz"*, *"Instagram statistikamni tahlil qil"*

## Ishga tushirish

### 1. Kalitlarni tayyorlang
1. **Claude API kaliti** — https://platform.claude.com → API Keys
2. **Telegram bot** — Telegram'da `@BotFather` → `/newbot` → token oling
3. **Telegram ID'ingiz** — `@userinfobot` ga yozing (siz admin bo'lasiz)
4. *(ixtiyoriy)* **YouTube API kaliti** — Google Cloud Console → YouTube Data API v3
5. *(ixtiyoriy)* **Instagram** — Meta for Developers'da ilova yarating, "Instagram API with Instagram Login" ni ulang (Business/Creator akkaunt kerak)

```bash
cp .env.example .env
# .env faylini to'ldiring, ayniqsa STUDIO_INFO ga xizmatlar va narxlarni yozing
```

### 2. 24/7 serverda ishga tushirish

**Docker bilan (istalgan VPS):**
```bash
docker compose up -d --build
```
`restart: always` tufayli server qayta yuklansa ham bot o'zi qayta ishga tushadi.

**Render.com:** repozitoriyni ulang → `render.yaml` avtomatik o'qiladi → kalitlarni kiriting. (Bepul tarif uxlab qoladi — 24/7 uchun pullik "Starter" tarif kerak.)

**Railway.app:** "Deploy from GitHub" → Dockerfile avtomatik topiladi → Variables bo'limiga `.env` qiymatlarini kiriting → `/app/data` uchun Volume qo'shing.

### 3. Instagram webhook
Meta ilova sozlamalarida webhook manzili: `https://<sizning-domeningiz>/webhooks/instagram`, Verify token = `INSTAGRAM_VERIFY_TOKEN`. `messages` hodisasiga obuna bo'ling.

### Lokal sinov
```bash
pip install -r requirements-dev.txt
pytest
uvicorn studio.main:app --reload
```

## Tuzilma
```
studio/
  main.py              FastAPI + Telegram + rejalashtiruvchi (bitta jarayon)
  agents/base.py       Claude bilan tool-use sikli, xatolarni ushlash
  agents/team.py       Agentlar, ularning tool'lari va koordinator
  channels/telegram.py Telegram bot
  channels/instagram.py Instagram Direct webhook
  tools/social.py      YouTube / Instagram API
  scheduler.py         Kunlik kontent va haftalik hisobot
  storage.py           SQLite: suhbatlar, arizalar, qoralamalar
```
