# AZIZ FLORAN AI STUDIO

Instagram **@aziz_floran** uchun premium landshaft Reels ishlab chiqarish studiyasi.
Asosiy sessiya — **bosh direktor va koordinator**: vazifalarni agentlarga taqsimlaydi, natijalarni bir-biriga uzatadi, QC'siz hech narsani "tayyor" demaydi.

## Jamoa (`.claude/agents/`)
| Agent | Bosqich | Mas'uliyat |
|-------|---------|------------|
| `creative-director` | 01-creative | G'oya, hook, ssenariy (`script.json` — yagona manba), caption |
| `landscape-architect` | 02-landscape | Reja, o'lchamlar (m), o'simliklar (`plan.json`, `plants.csv`, `plan.svg`) |
| `3d-visualizer` | 03-3d | Kamera, material, yoritish, render/AI promptlari (`scenes.json`) |
| `motion-designer` | 04-motion | Remotion animatsiya (`remotion/src/compositions/`) |
| `video-editor` | 05-edit | Montaj, musiqa, SFX, rang, 9:16 eksport (`scripts/assemble.sh`) |
| `quality-controller` | 06-qc | Avtomat + qo'lda tekshiruv, bosqichni `done` qilish |

Pipeline ta'rifi: `studio/pipeline.json`. Brend: `studio/brand/brand.json`. Shablonlar: `studio/templates/`.

## Buyruqlar
```bash
npm install                     # bir marta
npm run status [-- 001]         # loyihalar holati, qaysi bosqich boshlashga tayyor
npm run qc -- 001               # avtomatik QC → projects/001-*/06-qc/qc-report.md
npm run typecheck               # Remotion TypeScript tekshiruvi
npm run studio                  # Remotion Studio (brauzerda preview)
npm run render:001              # P001-Teaser → 04-motion/renders/P001-Teaser.mp4
scripts/assemble.sh 001 [music] # yakuniy eksport → 05-edit/exports/001_final.mp4
npm run new-project -- 002 "Nomi"  # yangi loyiha skeleti
```

## Qoidalar
- Mavjud loyiha fayllarini o'chirma; yangi versiyani yonida yarat yoki tahrir qil.
- Matn va vaqtlar faqat `01-creative/script.json` da; boshqa joyda qattiq yozilmaydi.
- `project.json` holatlari: `todo → in_progress → review → (changes_requested →) done`. `done` ni faqat `quality-controller` qo'yadi.
- Bajarilmagan ishni bajarildi deb ko'rsatma; render yo'q bo'lsa — `pending`.
- Format: 1080×1920, 30 fps, H.264, ≤ 90 s. Instagram xavfsiz zonasi: yuqori 250 px, pastki 420 px.
- Katta videolar (`*.mp4`) gitga kirmaydi — skriptlar bilan qayta yaratiladi.
