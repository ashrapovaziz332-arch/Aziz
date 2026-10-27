# AZIZ FLORAN — perspektiv sweep yozuv (kino uslubi)

Namuna: katta 3D perspektiv yozuv (chap tomoni yaqin/katta, o'ngi uzoqqa ketadi).

Animatsiya (`persp_sweep.py`):
1. **Kirish** (0.55 s) — yondan tez uchib chiqadi, burilib to'g'rilanadi, motion blur, kamera zarbasi + whip blur.
2. **Turish** (`hold`, ~2.2 s) — sekin suzadi, biroz qimirlaydi, ozgina kattalashadi.
3. **Chiqish** (0.45 s) — teskari tomonga tezlashib, chuqurlikka kirib ketadi.

Qatorlar ketma-ket (0.07 s kechikish) chiqadi. `alpha` berilsa, matn odamning orqasidan o'tadi.

```bash
python3 persp_sweep.py FON.mp4 out.mp4 --alpha alpha.npy --t0 1.0 --hold 2.0
```

Boshqa render'ga qo'shish: `layer = sweep_layer(t, W, H)` (BGRA, premultiplied) —
`comp = over(img, layer)` va undan keyin odam maskasini ustiga qo'yish.
Matn/rang/joy: `LINES`, burchak/tomon/vaqt: `STYLE` (`side=-1` chapdan kiradi).
