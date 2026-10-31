# AZIZ FLORAN AI STUDIO — Floran 3D

**Floran 3D** — bog' va landshaft loyihalash uchun brauzerda ishlaydigan dastur. Relyef, qoplamalar, o'simliklar, inshootlar va yer osti tarmoqlari bitta 3D modelda turadi.

## Ishga tushirish

Hech narsa o'rnatish shart emas: Three.js `vendor/` papkasida, dastur internetsiz ishlaydi.
Faqat oddiy statik server kerak (ES-modullar `file://` orqali ochilmaydi):

```bash
python3 -m http.server 8000
# brauzerda: http://localhost:8000
```

Yoki GitHub Pages orqali joylashtiring: *Settings → Pages → Branch*.

## Imkoniyatlar

| Bo'lim | Nima qiladi |
|---|---|
| **Mavjud / Loyiha** | Mavjud holatni (syomka) va loyihani bitta modelda solishtirish |
| **Relyef** | Ko'tarish, pasaytirish, tekislash, silliqlash; qazish/to'kish hajmi (m³) va grunt balansi |
| **Belgilar va gorizontallar** | Har 0,25 m da gorizontallar, kursor ostida yer belgisi |
| **Qoplamalar** | Maysa, shag'al yo'lak, plitka, gulzor, suv havzasi (o'zi qaziladi), qum, o'tloq |
| **O'simliklar** | 20 tur (daraxt, buta, ko'p yillik, yer qoplovchi, bezak o'tlar); bittalab yoki mo'yqalam bilan; har biri sanaladi |
| **Kichik shakllar** | Shiypon, pergola, o'rindiq, xo'jalik binosi, issiqxona, o'choq, chiroq, purkagich |
| **Tarmoqlar** | Sug'orish, yoritish kabeli, drenaj; ko'rinish rejimlari: Yuza / Ochilgan / Faqat tarmoqlar |
| **Kun va tun** | Tungi yoritish: chiroqlar, derazalar, o'choq |
| **Sayr** | Bog' bo'ylab ko'z balandligida yurish (WASD, Esc — chiqish) |
| **Render** | Joriy kameradan yuqori sifatli PNG (kunduzi / kechasi) |
| **Normakontrol** | SP 42 / SP 53 bo'yicha: tarmoq ustida ekish, chegara va binoga masofa va boshqalar; modelda qizil belgilar, CSV |
| **AI-agent** | Buyruq oddiy so'z bilan (o'zbek/rus/ingliz): «Tepalik qo'sh: balandligi 1,2 m, R 6 m», «Chegara bo'ylab 12 ta qarag'ay ek», «hovuz R 4» |
| **Avto-rejalash** | 36 ta variant (Tabiiy, Muntazam, Yapon, O'rmon), 10 bandli nazorat varaqasi bo'yicha baholanadi |
| **Avto-injeneriya** | Sug'orish, yoritish va drenajni avtomatik yotqizish, uzunliklar va so'mdagi taxminiy narx |
| **Eksport** | DXF (AutoCAD/ArchiCAD), OBJ, GLB (Blender, Twinmotion, Unreal), CSV vedomostlar, PNG, JSON loyiha |

## Boshqaruv

- Aylantirish — chap tugma; siljitish — o'ng tugma; masshtab — g'ildirak (telefonda barmoqlar bilan)
- `Ctrl+Z` / `Ctrl+Y` — bekor qilish / qaytarish · `Delete` — tanlanganni o'chirish · `R` — burish · `N` — kun/tun
- Loyiha brauzerda avtomatik saqlanadi; faylga saqlash: yuqoridagi 💾 tugma

## Tuzilishi

```
index.html, css/style.css
js/config.js       — kataloglar (o'simliklar, qoplamalar, inshootlar, narxlar)
js/state.js        — ma'lumot modeli, relyef va qoplama amallari
js/generator.js    — mavjud uchastka va avto-rejalash generatori
js/norms.js        — normakontrol va variantlarni baholash
js/engineering.js  — avto-injeneriya (MST bo'yicha trassalash)
js/agent.js        — matnli buyruqlar tahlili
js/world.js        — Three.js sahna
js/exporters.js    — DXF / OBJ / GLB / CSV
js/main.js         — interfeys
```
