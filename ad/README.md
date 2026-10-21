# Aziz Floran — dinamik reklama

- `index.html` — animatsiyali reklama (brauzerda oching; bosilsa qaytadan boshlanadi).
- `aziz-floran-ad.mp4` — tayyor video (1086×1448, 10 s, 30 fps).
- `assets/tree.png` — fondan ajratilgan daraxt (shaffof PNG).
- `assets/background.jpg` — daraxt va yozuvlarsiz toza fon.
- `render.js` — videoni qayta yaratish: `node ad/render.js 10 30` (Playwright + ffmpeg kerak).

Qatlamlar alohida harakatlanadi: fon (sekin zoom + quyosh nuri), daraxt (pastdan o'sib chiqadi, keyin shamolda tebranadi), yozuvlar (logo chiziladi, nom ochiladi, sarlavha so'zma-so'z ko'tariladi, tugma sakrab chiqadi va yaltiraydi).
