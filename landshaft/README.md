# Landshaft loyiha albomi — xususiy hovli 20×30 m

Xususiy turar-joy hovlisini obodonlashtirish va ko'kalamzorlashtirish bo'yicha to'liq loyiha albomi:
eskizdan ishchi chizmalar, smeta, ish grafigi va parvarish yo'riqnomasigacha.

- **`album.pdf`** — tayyor albom (A3, muqova + 18 varaq), chop etish uchun.
- **`album.html`** — xuddi shu albom brauzerda ko'rish uchun.
- **`generate.py`** — albom generatori. Barcha varaqlar bitta geometriyadan chiziladi:
  uchastka, uy, yo'lkalar yoki o'simliklar o'zgartirilsa, reja, dendroplan, sug'orish,
  yoritish va smeta birga yangilanadi.

## Albom tarkibi

| Varaq | Nomi | M |
|---|---|---|
| — | Muqova | — |
| L-01 | Umumiy ma'lumotlar, mundarija, texnik-iqtisodiy ko'rsatkichlar | — |
| L-02 | Mavjud holat, topografik asos | 1:150 |
| L-03 | Bosh reja (rangli) | 1:150 |
| L-04 | Funksional zonalash | 1:150 |
| L-05 | Aksonometriya | — |
| L-06 | Rejalashtirish (razbivka) chizmasi | 1:150 |
| L-07 | Vertikal rejalashtirish, drenaj | 1:150 |
| L-08 | Qoplamalar rejasi | 1:150 |
| L-09 | Qoplama konstruksiyalari, tugunlar 1–7 | 1:10 |
| L-10 | Dendroplan va assortiment qaydnomasi | 1:150 |
| L-11 | Gulzorlar sxemalari, maysa | 1:50 |
| L-12 | Avtomatik sug'orish tizimi | 1:150 |
| L-13 | Landshaft yoritish | 1:150 |
| L-14 | Kichik me'moriy shakllar (shiypon, mangal, ishkom…) | 1:50; 1:75 |
| L-15 | Uchastka kesimlari A–A, B–B | 1:100 |
| L-16 | Taxminiy smeta | — |
| L-17 | Ishlarni bajarish kalendar grafigi | — |
| L-18 | Parvarish kalendari | — |

## Qayta yaratish

```bash
python3 generate.py            # album.html
chromium --headless --no-pdf-header-footer --print-to-pdf=album.pdf album.html
```

Loyiha ma'lumotlari (uchastka 600 m², uy 11×10 m, Toshkent sharoiti, narxlar 2026-yil oktyabr)
namunaviy; aniq uchastka uchun `generate.py` boshidagi o'lcham va koordinatalarni o'zgartiring.
