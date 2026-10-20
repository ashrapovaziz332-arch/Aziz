# Sarv (Italian cypress) — 3ds Max uchun 3D model, 1:1 masshtab

Model rasmdagi daraxt siluetidan (balandlik bo'yicha har bir qatordagi kenglik) o'lchab qurilgan.

| Parametr | Qiymat |
|---|---|
| Balandlik | **10.0 m** |
| Toj diametri (eng keng joyi) | ~1.64 m |
| Birlik | metr (OBJ ichida) |
| Poligonlar | ~9 300 (stvol + ichki toj + 3 200 ta barg "kartochka") |
| Billboard varianti | 3 ta kesishgan tekislik (6 poligon) |

## Fayllar
- `cypress.obj / cypress.mtl` — asosiy 3D model (Trunk, CrownCore, FoliageCards obyektlari)
- `cypress_billboard.obj / .mtl` — uzoq plan uchun yengil variant (asl rasm, alfa bilan)
- `textures/` — barg atlasi (diffuse + opacity), toj teksturasi, po'stloq, billboard
- `import_cypress.ms` — 3ds Max skripti (tavsiya etiladi)

## 3ds Max ga import qilish
**1-usul (tavsiya):** `Scripting > Run Script...` → `import_cypress.ms`.
Skript modelni import qiladi, tik turg'izadi, joriy System Units da aniq **10 m** ga masshtablaydi,
barglar uchun ikki tomonli opacity materiallarni o'rnatadi.

**2-usul (qo'lda):** `File > Import > cypress.obj`, importer oynasida:
- *Flip ZY-axis* — yoqilgan
- *Units/Scale*: model metrda (`1 unit = 1 m`)
- Keyin `Cypress_FoliageCards` materialiga opacity xaritasini
  `textures/cypress_foliage_atlas_opacity.png` va *2-Sided* ni yoqing.

Corona / V-Ray uchun: Standard materiallarni *Scene Converter* bilan o'tkazing
(opacity xaritasi saqlanadi).

## Boshqa balandlik kerak bo'lsa
```
python3 tools/generate_cypress.py 12   # 12 m li sarv
```
yoki `import_cypress.ms` ichida `treeHeight = "10m"` qiymatini o'zgartiring.
