# AZIZ FLORAN — «Landshaftning 12 mashhur uslubi» (Instagram Reels)

- `aziz-floran-12-uslub.mp4` — tayyor video: 1080×1920, 30 fps, 72 s, H.264, ovozsiz AAC treki bor (ustiga diktor ovozini qo‘shish uchun).
- `DIKTOR-MATNI.md` — vaqtlari ko‘rsatilgan diktor matni.
- `index.html` + `reel.js` — animatsiyaning manba kodi (Canvas 2D). Barcha kadrlar `render(t)` funksiyasi bilan chiziladi.
- `fonts/` — Playfair Display va Montserrat (SIL OFL litsenziyasi).

## Grafika haqida
Bu haqiqiy 3D render emas, **sxematik grafika**. Bitta oddiy 3D model bor (uy, hovli chegarasi, yo‘laklar, daraxtlar va boshqalar). Shu model avval tepadan reja sifatida, keyin perspektivada ko‘rsatiladi. Shuning uchun reja va hajmli ko‘rinishda har bir element bir joyda turadi.

## Brauzerda ko‘rish
```bash
cd reels && npx serve .      # yoki: python3 -m http.server
# http://localhost:3000 ni oching (pauza va vaqt slayderi bor)
```

## MP4 ga qayta eksport
Talablar: Node 18+, `playwright` (Chromium bilan) va `ffmpeg`.
```bash
cd reels
npm i playwright && npx playwright install chromium   # bir martalik
node tools/render.js aziz-floran-12-uslub.mp4 30 4    # fayl, fps, parallel jarayonlar
node tools/stills.js ./kadrlar 5.5 30 66              # alohida kadrlarni PNG qilib olish
```
Matnlar, ranglar va uslublar `reel.js` faylidagi `buildStyles()` funksiyasida turadi. Har bir element uchun `at` — u paydo bo‘ladigan vaqt (sahna boshidan hisoblanadi).
