# №001 — Islomiy landshaft · Vazifalar taqsimoti

Holatni ko'rish: `npm run status -- 001` · Avtomatik tekshiruv: `npm run qc -- 001`

| # | Bosqich | Ishchi (agent) | Kimdan oladi | Vazifa | Natija (fayllar) | Holat |
|---|---------|----------------|--------------|--------|------------------|-------|
| 1 | 01-creative | `creative-director` | `00-brief.md` | Seed ssenariyni qayta ishlash: 5+ hook, tanlangan hook, 30 s / 6 sahna, oʻzbek lotin imlosi (oʻ, gʻ), musiqa yoʻnalishi, caption + hashtaglar | `concept.md`, `script.json` (status `final`), `caption.md` | todo — **boshlashga tayyor** |
| 2 | 02-landscape | `landscape-architect` | `script.json` → `landscapeNeeds` | ~20×20 m chorbogʻ: 4 parter, kesishgan suv kanallari (1 m), markazda 8 qirrali favvora (r = 2 m), ravoq, sarv qatori, anor, atirgul, lavanda; aniq oʻlchamlar va oʻsimlik soni | `plan.json`, `plants.csv`, `plan.svg`, `notes.md` | todo (1 ni kutadi) |
| 3 | 03-3d | `3d-visualizer` | `plan.json`, `script.json` → `shot` | 6 sahna uchun kamera, material (zellij, travertin, suv), yoritish (golden hour, tun), 9:16 render/AI promptlari | `scenes.json`, `prompts.md`, `assets/renders-3d/s0X.*` | todo (2 ni kutadi) |
| 4 | 04-motion | `motion-designer` | `script.json`, `plan.json`, `scenes.json` | `P001-Teaser` kompozitsiyasini yakuniy holatga keltirish: `ChorbaghPlan` ga real oʻlchamlar, 3D renderlarni `<OffthreadVideo>` bilan fonga qoʻyish, transitionlar | `remotion/src/compositions/P001*.tsx`, `renders/*.mp4`, `motion-notes.md` | todo (texnik test render bor) |
| 5 | 05-edit | `video-editor` | `renders/*.mp4`, `assets/music`, `assets/sfx` | Litsenziyali ambient musiqa (oud/ney, ~70 BPM), suv/shamol SFX, −14 LUFS, rang, yakuniy eksport | `exports/001_final.mp4`, `edit-decision-list.md` | todo (4 ni kutadi) |
| 6 | 06-qc | `quality-controller` | barcha bosqichlar | Har bosqichdan keyin avtomat + qoʻlda tekshiruv; bosqichni `done` qilish yoki `changes_requested` | `06-qc/qc-report.md` | todo |

## Ish oqimi
```
brief → [1 Creative] → QC → [2 Landscape] → QC → [3 3D] → QC → [4 Motion] → QC → [5 Edit] → [6 Final QC] → Instagram
```
- Har bosqich tugagach agent `project.json` da oʻz holatini `review` qiladi.
- QC `npm run qc -- 001` + qoʻlda tekshiruv qilib `done` yoki `changes_requested` qoʻyadi.
- Keyingi bosqich faqat oldingisi `done` boʻlgach boshlanadi (`npm run status` koʻrsatadi).

## Hozir mavjud boʻlgan narsalar (haqiqiy holat)
- `01-creative/script.json` — koordinator yozgan **seed** (yakuniy emas). QC 3 ta imlo ogohlantirishini topgan.
- `04-motion/renders/P001-Teaser.mp4` — Remotion **texnik/uslub testi** (1080×1920, 30 fps, 30 s; gitga kirmaydi, `npm run render:001` bilan qayta yaratiladi). Kadrlar: `04-motion/renders/P001-Teaser-contact.jpg`.
- Qolgan barcha bosqich natijalari hali yoʻq.
