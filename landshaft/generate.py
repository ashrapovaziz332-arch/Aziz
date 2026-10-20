#!/usr/bin/env python3
"""Xususiy hovli landshaft loyihasi albomini generatsiya qiladi.

Barcha varaqlar bitta geometriya (uchastka ma'lumotlari) asosida chiziladi,
shuning uchun reja, dendroplan, sug'orish, yoritish va smeta o'zaro mos.
Natija: album.html (A3 albom formatidagi varaqlar, brauzerda chop etish/PDF).
"""
import math
from datetime import date, timedelta
from html import escape
from pathlib import Path

OUT = Path(__file__).with_name("album.html")

PAGE_W, PAGE_H = 420, 297          # A3, mm
PLOT_W, PLOT_H = 20.0, 30.0        # uchastka, m (6 sotix)
PROJECT_CODE = "LL-2026-014"
PROJECT_NAME = "Xususiy turar-joy hovlisini obodonlashtirish va ko'kalamzorlashtirish"
STAGE = "IL"                        # ishchi loyiha
FONT = "Liberation Sans, Arial, Helvetica, sans-serif"


# ----------------------------------------------------------------------------
# SVG yordamchilari
# ----------------------------------------------------------------------------

def f(v):
    return f"{v:.2f}".rstrip("0").rstrip(".")


def attrs(kw):
    out = []
    for k, v in kw.items():
        if v is None:
            continue
        out.append(f'{k.rstrip("_").replace("_", "-")}="{v if isinstance(v, str) else f(v)}"')
    return " ".join(out)


def E(tag, content=None, **kw):
    if content is None:
        return f"<{tag} {attrs(kw)}/>"
    return f"<{tag} {attrs(kw)}>{content}</{tag}>"


def T(x, y, s, size=3.0, anchor="start", weight="normal", fill="#1d1d1b", **kw):
    return E("text", escape(str(s)), x=x, y=y, font_size=size, text_anchor=anchor,
             font_weight=weight, fill=fill, **kw)


def rect(x, y, w, h, **kw):
    return E("rect", x=x, y=y, width=w, height=h, **kw)


def line(x1, y1, x2, y2, **kw):
    kw.setdefault("stroke", "#1d1d1b")
    kw.setdefault("stroke_width", 0.25)
    return E("line", x1=x1, y1=y1, x2=x2, y2=y2, **kw)


def g(content, **kw):
    return E("g", "".join(content) if isinstance(content, list) else content, **kw)


class Plan:
    """Metrdagi uchastka koordinatalarini varaqdagi mm ga o'tkazadi."""

    def __init__(self, ox, oy, scale=150):
        self.ox, self.oy, self.scale = ox, oy, scale
        self.k = 1000 / scale

    def p(self, x, y):
        return self.ox + x * self.k, self.oy + y * self.k

    def rect(self, r, **kw):
        x, y, w, h = r
        X, Y = self.p(x, y)
        return rect(X, Y, w * self.k, h * self.k, **kw)

    def circle(self, x, y, r, **kw):
        X, Y = self.p(x, y)
        return E("circle", cx=X, cy=Y, r=r * self.k, **kw)

    def line(self, x1, y1, x2, y2, **kw):
        X1, Y1 = self.p(x1, y1)
        X2, Y2 = self.p(x2, y2)
        return line(X1, Y1, X2, Y2, **kw)

    def poly(self, pts, close=True, **kw):
        d = " ".join(f"{f(a)},{f(b)}" for a, b in (self.p(x, y) for x, y in pts))
        return E("polygon" if close else "polyline", points=d, **kw)

    def text(self, x, y, s, **kw):
        X, Y = self.p(x, y)
        return T(X, Y, s, **kw)


# ----------------------------------------------------------------------------
# Uchastka geometriyasi (m). Koordinatalar: x — g'arbdan sharqqa, y — shimoldan
# janubga (ko'cha janubda, y = 30).
# ----------------------------------------------------------------------------

HOUSE = (2, 14, 11, 10)
PORCH = (5.5, 24, 2.5, 1.5)
FRONT_PATH = (6, 25.5, 1.5, 4.5)
DRIVEWAY = (14.5, 18, 4.5, 12)
SIDE_PATH = (13, 8, 1.5, 10)
PAD = (13.5, 0.5, 6, 7.5)
GAZEBO = (14.5, 1.0, 4, 4)
BBQ = (17.6, 6.2, 1.8, 1.1)
TERRACE = (2, 10.5, 8, 3.5)
TERRACE_BED = (2, 9.7, 8, 0.8)
KIDS = (0.8, 0.8, 4, 4)
GRAVEL = (15.0, 8.6, 4.4, 6.0)
VEG_BEDS = [(15.6, 9.2 + i * 1.9, 3.4, 1.1) for i in range(3)]
ROUND_BED = (6.5, 6.0, 1.3)
BACK_LAWN = (0.8, 0.8, 12.2, 8.9)
LAWN_L = (0.6, 25.4, 4.9, 3.9)
LAWN_R = (8.0, 25.4, 5.4, 3.9)
ROSE_BED = (8.5, 24.3, 4.0, 0.9)
MIX_BED = (2.2, 24.3, 3.1, 0.9)
STREET_BED_L = (0.6, 29.3, 4.6, 0.6)
STREET_BED_R = (8.6, 29.3, 4.8, 0.6)
HIBISCUS_BED = (13.5, 24.5, 1.0, 4.8)
EAST_STRIP = (19.0, 18.0, 1.0, 11.6)
GATE_SMALL = (6.0, 7.5)
GATE_CAR = (14.5, 19.0)


def bezier(p0, p1, p2, n):
    pts = []
    for i in range(n):
        t = i / (n - 1)
        x = (1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * p1[0] + t ** 2 * p2[0]
        y = (1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * p1[1] + t ** 2 * p2[1]
        pts.append((x, y))
    return pts


STONES = bezier((8.6, 9.2), (11.6, 7.8), (12.9, 4.4), 7) + \
    [(4.0, 9.2 - i * 0.78) for i in range(6)]


# Assortiment: kod -> (nomi, lotincha, o'lchami ekishda, toj diametri m, turi, narxi so'm)
SPECIES = {
    "1": ("O'rik", "Prunus armeniaca 'Subhoniy'", "mavjud, saqlanadi", 5.0, "fruit", 0),
    "2": ("Olma", "Malus domestica 'Golden Delicious' (M106)", "3 yosh, ZKS", 4.0, "fruit", 260_000),
    "3": ("Gilos", "Prunus avium 'Napoleon'", "3 yosh, ZKS", 4.5, "fruit", 280_000),
    "4": ("Shaftoli", "Prunus persica 'Anjir shaftoli'", "2 yosh, ZKS", 3.5, "fruit", 220_000),
    "5": ("Anor", "Punica granatum 'Qayim anor'", "buta, 3 yosh", 2.5, "fruit", 180_000),
    "6": ("Xurmo", "Diospyros kaki 'Hachiya'", "3 yosh, ZKS", 4.0, "fruit", 350_000),
    "7": ("Ko'k qoraqarag'ay", "Picea pungens 'Glauca'", "H 2,0–2,5 m, kom", 3.0, "conifer", 1_800_000),
    "8": ("Qizil arg'uvon", "Cercis siliquastrum", "H 2,5 m, kom", 4.0, "flower", 950_000),
    "9": ("Katalpa (shar)", "Catalpa bignonioides 'Nana'", "shtamb 2,0 m", 3.0, "orn", 1_100_000),
    "11": ("G'arb tuyasi", "Thuja occidentalis 'Smaragd'", "H 1,4–1,6 m, C15", 1.0, "conifer", 190_000),
    "12": ("Tik archa", "Juniperus scopulorum 'Skyrocket'", "H 1,8 m, C20", 0.8, "conifer", 420_000),
    "13": ("Shamshod", "Buxus sempervirens", "H 0,3 m, C3", 0.3, "hedge", 45_000),
    "14": ("Atirgul (choy-duragay)", "Rosa × hybrida", "2 yosh, C3", 0.6, "rose", 65_000),
    "15": ("Lavanda", "Lavandula angustifolia 'Hidcote'", "C2", 0.5, "perennial", 38_000),
    "16": ("Barbaris", "Berberis thunbergii 'Atropurpurea Nana'", "C3", 0.6, "shrub", 70_000),
    "17": ("Suriya gulxayrisi", "Hibiscus syriacus", "H 1,0 m, C7", 1.5, "shrub", 160_000),
    "18": ("Yotiq archa", "Juniperus horizontalis 'Blue Chip'", "C5", 1.2, "conifer", 140_000),
    "19": ("Spireya", "Spiraea japonica 'Goldflame'", "C3", 0.8, "shrub", 60_000),
    "20": ("Uzum (ishkom)", "Vitis vinifera 'Husayni'", "2 yosh, ZKS", 0.6, "vine", 120_000),
    "21": ("Ko'p yillik gullar", "Echinacea, Rudbeckia, Salvia, Hemerocallis", "C1–C2, 7 dona/m²", 0.35, "perennial", 32_000),
}

PLANTS = [
    ("1", 6.8, 2.3), ("2", 9.9, 2.3), ("3", 1.5, 6.8), ("4", 1.5, 9.9),
    ("5", 11.4, 12.3), ("5", 1.0, 12.4), ("6", 17.3, 16.3),
    ("7", 2.6, 27.4), ("8", 11.2, 27.4), ("9", 9.6, 6.4),
    ("12", 5.4, 29.45), ("12", 8.1, 29.45), ("12", 13.15, 0.9), ("12", 13.15, 7.3),
    ("17", 14.0, 25.3), ("17", 14.0, 27.0), ("17", 14.0, 28.7),
]
PLANTS += [("11", 5.6 + i * 0.82, 0.45) for i in range(10)]
PLANTS += [("11", 19.55, 8.8 + i * 0.8) for i in range(11)]
PLANTS += [("11", 0.45, 14.4 + i * 0.8) for i in range(12)]
PLANTS += [("13", 5.75, 25.7 + i * 0.3) for i in range(13)]
PLANTS += [("13", 7.75, 25.7 + i * 0.3) for i in range(13)]
PLANTS += [("14", 9.0 + i * 0.6, 24.75) for i in range(6)]
PLANTS += [("14", 6.5 + 0.35 * math.cos(a), 6.0 + 0.35 * math.sin(a)) for a in (0, 2.1, 4.2)]
PLANTS += [("15", 2.5 + i * 0.5, 24.55) for i in range(6)]
PLANTS += [("15", 6.5 + 1.0 * math.cos(i * math.pi / 5), 6.0 + 1.0 * math.sin(i * math.pi / 5)) for i in range(10)]
PLANTS += [("16", 0.9 + i * 0.66, 29.6) for i in range(7)]
PLANTS += [("16", 8.9 + i * 0.64, 29.6) for i in range(8)]
PLANTS += [("18", 19.5, 19.0 + i * 2.2) for i in range(5)]
PLANTS += [("19", x, 10.1) for x in (2.7, 5.4, 6.4, 7.4, 9.5)]
PLANTS += [("20", x, 10.3) for x in (2.3, 6.0, 9.7)]
PLANTS += [("21", 2.5 + i * 0.45, 25.0) for i in range(6)]
PLANTS += [("21", 6.5 + 0.7 * math.cos(i * math.pi / 4 + 0.3), 6.0 + 0.7 * math.sin(i * math.pi / 4 + 0.3)) for i in range(8)]

PERENNIAL_EXTRA = 21   # gulzor maydoni bo'yicha qo'shimcha (7 dona/m²)


def plant_count(code):
    n = sum(1 for c, *_ in PLANTS if c == code)
    if code == "21":
        n += PERENNIAL_EXTRA
    return n


def area(r):
    return r[2] * r[3]


LAWN_BACK_AREA = area(BACK_LAWN) - area(KIDS) - math.pi * ROUND_BED[2] ** 2
LAWN_FRONT_AREA = area(LAWN_L) + area(LAWN_R)
LAWN_AREA = LAWN_BACK_AREA + LAWN_FRONT_AREA
BEDS_AREA = (area(ROSE_BED) + area(MIX_BED) + area(STREET_BED_L) + area(STREET_BED_R)
             + area(HIBISCUS_BED) + area(EAST_STRIP) + area(TERRACE_BED)
             + math.pi * ROUND_BED[2] ** 2 + 0.6 * (8.2 + 11.4 + 9.6))
GRAVEL_AREA = area(GRAVEL) - sum(area(b) for b in VEG_BEDS)
PATH_AREA = area(FRONT_PATH) + area(SIDE_PATH)

# Sug'orish
SPRAYS = [(0.6, 25.4), (5.5, 25.4), (0.6, 29.3), (5.5, 29.3), (3.05, 25.4), (3.05, 29.3),
          (8.0, 25.4), (13.4, 25.4), (8.0, 29.3), (13.4, 29.3), (10.7, 25.4), (10.7, 29.3)]
ROTORS = [(0.8, 0.8 + 4.2), (0.8, 9.7), (5.0, 0.8), (13.0, 0.8), (13.0, 5.2), (13.0, 9.7), (6.9, 9.7)]
CONTROLLER = (13.0, 16.5)
VALVE_BOX = (13.75, 17.4)
WATER_IN = (16.2, 30.0)
DRIP_LINES = [
    [(5.6, 0.45), (13.0, 0.45)],
    [(19.55, 8.8), (19.55, 16.8)],
    [(0.45, 14.4), (0.45, 23.2)],
    [(5.75, 25.7), (5.75, 29.3)],
    [(7.75, 25.7), (7.75, 29.3)],
    [(2.2, 24.6), (5.3, 24.6)], [(8.5, 24.75), (12.5, 24.75)],
    [(0.6, 29.6), (5.2, 29.6)], [(8.6, 29.6), (13.4, 29.6)],
    [(14.0, 24.6), (14.0, 29.2)], [(19.5, 18.5), (19.5, 29.3)],
    [(2.0, 10.1), (10.0, 10.1)],
] + [[(b[0] + 0.1, b[1] + yy), (b[0] + b[2] - 0.1, b[1] + yy)] for b in VEG_BEDS for yy in (0.3, 0.8)]


def polylen(pts):
    return sum(math.dist(pts[i], pts[i + 1]) for i in range(len(pts) - 1))


DRIP_LEN = sum(polylen(l) for l in DRIP_LINES) + 2 * math.pi * 0.6 * 9   # + daraxt halqalari
MAIN_LINES = {
    "Z1": [VALVE_BOX, (13.75, 24.2), (13.4, 25.2), (8.0, 25.2), (7.75, 25.2), (5.5, 25.2), (0.6, 25.2)],
    "Z2": [VALVE_BOX, (13.75, 9.9), (13.0, 9.9), (6.9, 9.9), (0.8, 9.9), (0.8, 0.8), (13.0, 0.8)],
    "Z3": [VALVE_BOX, (14.3, 17.4), (19.55, 17.4), (19.55, 8.8)],
    "Z4": [VALVE_BOX, (14.3, 17.7), (14.3, 14.4), (15.6, 14.4)],
}
PIPE_LEN = sum(polylen(v) for v in MAIN_LINES.values()) + math.dist(WATER_IN, VALVE_BOX) + 12

# Yoritish
BOLLARDS = [(5.7, 26.6), (7.8, 28.4), (14.7, 9.6), (14.7, 12.8), (14.7, 16.0), (13.3, 2.8)]
SPOTS = [(3.4, 27.8), (12.0, 27.9), (10.3, 7.0), (16.6, 16.9), (7.4, 3.0), (2.1, 7.4)]
INGROUND = [(14.7, 20.5), (14.7, 23.5), (18.8, 20.5), (18.8, 23.5), (14.7, 26.5), (18.8, 26.5)]
WALL_LIGHTS = [(5.9, 30.0), (7.6, 30.0), (14.4, 30.0), (19.1, 30.0), (5.4, 24.0), (8.1, 24.0)]
DECK_LEDS = [(2.4 + i * 1.1, 10.55) for i in range(8)]
STRING_LIGHT_M = 2 * (8 + 3.5) + 4 * 4
PANEL = (13.0, 18.6)
CABLES = [
    [PANEL, (13.0, 24.3), (8.1, 24.3), (8.1, 25.6), (7.8, 28.4), (7.6, 30.0), (5.9, 30.0), (5.7, 26.6)],
    [(8.1, 24.3), (3.4, 24.3), (3.4, 27.8)],
    [(13.0, 24.3), (14.4, 24.3), (14.7, 20.5), (14.7, 26.5), (14.4, 30.0)],
    [(14.7, 20.5), (18.8, 20.5), (18.8, 26.5), (19.1, 30.0)],
    [(14.4, 24.3), (12.0, 25.6), (12.0, 27.9)],
    [PANEL, (14.2, 18.0), (16.6, 16.9)],
    [PANEL, (14.7, 18.0), (14.7, 9.6), (14.7, 7.6), (16.5, 5.0)],
    [(14.7, 7.6), (13.3, 2.8)],
    [(14.7, 9.6), (13.2, 9.2), (10.3, 7.0), (7.4, 3.0)],
    [(13.2, 9.2), (10.0, 10.55), (2.4, 10.55), (2.1, 7.4)],
]
CABLE_LEN = sum(polylen(c) for c in CABLES) * 1.1


# ----------------------------------------------------------------------------
# Umumiy chizma elementlari
# ----------------------------------------------------------------------------

DEFS = """
<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>
<pattern id="pBrick" width="2.2" height="1.1" patternUnits="userSpaceOnUse">
  <rect width="2.2" height="1.1" fill="#cbc4b8"/>
  <path d="M0 0H2.2M0 0.55H2.2M0 0V0.55M1.1 0.55V1.1" stroke="#a69d8f" stroke-width="0.08"/></pattern>
<pattern id="pTile" width="2" height="2" patternUnits="userSpaceOnUse">
  <rect width="2" height="2" fill="#ddd0b6"/>
  <path d="M0 0H2V2" fill="none" stroke="#b9a988" stroke-width="0.1"/></pattern>
<pattern id="pStone" width="4" height="2.7" patternUnits="userSpaceOnUse">
  <rect width="4" height="2.7" fill="#e3dbcc"/>
  <path d="M0 0H4M0 1.35H4M0 0V1.35M2 1.35V2.7" stroke="#bdb19c" stroke-width="0.1"/></pattern>
<pattern id="pDeck" width="20" height="1" patternUnits="userSpaceOnUse">
  <rect width="20" height="1" fill="#b98657"/>
  <path d="M0 0H20M7 0V1" stroke="#8d6038" stroke-width="0.1"/></pattern>
<pattern id="pGravel" width="1.6" height="1.6" patternUnits="userSpaceOnUse">
  <rect width="1.6" height="1.6" fill="#e9e2d2"/>
  <circle cx="0.4" cy="0.4" r="0.15" fill="#b6ab95"/><circle cx="1.2" cy="1.1" r="0.12" fill="#a39780"/></pattern>
<pattern id="pLawn" width="3" height="3" patternUnits="userSpaceOnUse">
  <rect width="3" height="3" fill="#a9d07c"/>
  <path d="M0.5 1l0.2-0.5l0.2 0.5M2 2.5l0.2-0.5l0.2 0.5" stroke="#86b85a" stroke-width="0.1" fill="none"/></pattern>
<pattern id="pSoil" width="1.5" height="1.5" patternUnits="userSpaceOnUse">
  <rect width="1.5" height="1.5" fill="#8a6a49"/><circle cx="0.5" cy="0.5" r="0.12" fill="#6c5034"/></pattern>
<pattern id="pRubber" width="2" height="2" patternUnits="userSpaceOnUse">
  <rect width="2" height="2" fill="#e9a37a"/><circle cx="1" cy="1" r="0.18" fill="#d88b60"/></pattern>
<pattern id="pHatch" width="1.5" height="1.5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
  <path d="M0 0V1.5" stroke="#555" stroke-width="0.15"/></pattern>
<pattern id="pHatchLight" width="2" height="2" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
  <path d="M0 0V2" stroke="#bbb" stroke-width="0.15"/></pattern>
<pattern id="pEarth" width="3" height="3" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
  <path d="M0 0V3M1 0V3" stroke="#6d5a45" stroke-width="0.15"/></pattern>
<pattern id="pSand" width="1.2" height="1.2" patternUnits="userSpaceOnUse">
  <rect width="1.2" height="1.2" fill="#f2e5bf"/><circle cx="0.3" cy="0.4" r="0.1" fill="#b59f63"/><circle cx="0.9" cy="0.9" r="0.08" fill="#b59f63"/></pattern>
<pattern id="pCrushed" width="2.4" height="2.4" patternUnits="userSpaceOnUse">
  <rect width="2.4" height="2.4" fill="#d8d6d0"/><path d="M0.3 0.4l0.5-0.2 0.2 0.5-0.6 0.1zM1.4 1.4l0.6 0.1-0.2 0.5-0.5-0.2z" fill="#8f8c84"/></pattern>
<pattern id="pConcrete" width="3" height="3" patternUnits="userSpaceOnUse">
  <rect width="3" height="3" fill="#cfd1d1"/><circle cx="0.6" cy="0.8" r="0.15" fill="#888"/><path d="M1.8 1.8l0.4 0.6h-0.6z" fill="#888"/></pattern>
<clipPath id="cPlot" clipPathUnits="userSpaceOnUse"><rect x="40" y="30" width="133.33" height="200"/></clipPath>
<marker id="mArrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
  <path d="M0 0L10 5L0 10z" fill="#1d1d1b"/></marker>
<marker id="mTick" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="4" markerHeight="4" orient="auto">
  <path d="M2 8L8 2" stroke="#1d1d1b" stroke-width="1.6"/></marker>
<marker id="mBlueArrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto">
  <path d="M0 0L10 5L0 10z" fill="#2b6cb0"/></marker>
</defs></svg>
"""

SHEETS = []   # (kod, nomi) — mundarija uchun


def title_block(sheet, name, scale):
    x0, y0 = 230, 237
    o = [rect(x0, y0, 185, 55, fill="#fff", stroke="#1d1d1b", stroke_width=0.5)]
    # chap qism — imzolar
    rows = [("Lavozim", "F.I.Sh.", "Imzo", "Sana"), ("Bosh muhandis", "", "", "10.26"),
            ("Loyihachi", "", "", "10.26"), ("Dendrolog", "", "", "10.26"),
            ("Tekshirdi", "", "", "10.26"), ("N. nazorat", "", "", "10.26")]
    cw = [20, 20, 12, 13]
    for i, r in enumerate(rows):
        yy = y0 + 25 + i * 5
        o.append(line(x0, yy, x0 + 65, yy, stroke_width=0.2 if i else 0.4))
        xx = x0
        for j, c in enumerate(r):
            o.append(T(xx + 1, yy + 3.6, c, size=2.3, weight="bold" if i == 0 else "normal"))
            xx += cw[j]
    xx = x0
    for w in cw[:-1]:
        xx += w
        o.append(line(xx, y0 + 25, xx, y0 + 55, stroke_width=0.2))
    o.append(line(x0, y0 + 25, x0 + 65, y0 + 25, stroke_width=0.4))
    o.append(T(x0 + 32.5, y0 + 10, "Buyurtmachi:", size=2.4, anchor="middle", fill="#555"))
    o.append(T(x0 + 32.5, y0 + 16, "xususiy shaxs", size=2.8, anchor="middle"))
    o.append(line(x0 + 65, y0, x0 + 65, y0 + 55, stroke_width=0.5))
    # o'ng qism
    o.append(T(x0 + 125, y0 + 7, PROJECT_CODE, size=4.2, anchor="middle", weight="bold"))
    o.append(line(x0 + 65, y0 + 10, x0 + 185, y0 + 10, stroke_width=0.4))
    o.append(T(x0 + 67, y0 + 15, "Xususiy turar-joy hovlisini obodonlashtirish", size=2.8))
    o.append(T(x0 + 67, y0 + 19.5, "va ko'kalamzorlashtirish. Uchastka 20×30 m", size=2.8))
    o.append(line(x0 + 65, y0 + 25, x0 + 185, y0 + 25, stroke_width=0.4))
    # bosqich / varaq / varaqlar
    cx = x0 + 140
    o.append(line(cx, y0 + 10, cx, y0 + 40, stroke_width=0.4))
    for k, (lab, val) in enumerate((("Bosqich", STAGE), ("Varaq", str(sheet)), ("Varaqlar", "{TOTAL}"))):
        X = cx + k * 15
        if k:
            o.append(line(X, y0 + 10, X, y0 + 25, stroke_width=0.2))
        o.append(T(X + 7.5, y0 + 15, lab, size=2.3, anchor="middle"))
        o.append(T(X + 7.5, y0 + 22, val, size=3.4, anchor="middle", weight="bold"))
    o.append(line(cx, y0 + 17, x0 + 185, y0 + 17, stroke_width=0.2))
    # varaq nomi
    words, lines_, cur = name.split(), [], ""
    for w in words:
        if len(cur) + len(w) > 34:
            lines_.append(cur.strip())
            cur = ""
        cur += w + " "
    lines_.append(cur.strip())
    for i, l in enumerate(lines_[:3]):
        o.append(T(x0 + 102.5, y0 + 31 + i * 4.6, l, size=3.2, anchor="middle", weight="bold"))
    o.append(line(x0 + 65, y0 + 40, x0 + 185, y0 + 40, stroke_width=0.4))
    o.append(T(cx + 22.5, y0 + 30, "Masshtab", size=2.3, anchor="middle"))
    o.append(T(cx + 22.5, y0 + 36.5, scale, size=3.4, anchor="middle", weight="bold"))
    o.append(T(x0 + 125, y0 + 47, "LANDSHAFT LOYIHALASH STUDIYASI", size=3.0, anchor="middle", weight="bold"))
    o.append(T(x0 + 125, y0 + 52, "Toshkent · 2026", size=2.5, anchor="middle", fill="#555"))
    return g(o)


def sheet(name, scale, body, n=None):
    if n is None:
        n = len(SHEETS) + 1
        SHEETS.append((f"L-{n:02d}", name, scale))
    parts = [
        rect(0, 0, PAGE_W, PAGE_H, fill="#fff"),
        rect(20, 5, 395, 287, fill="none", stroke="#1d1d1b", stroke_width=0.6),
        body,
        title_block(n, name, scale),
        T(410, 10.5, f"L-{n:02d}", size=3, anchor="end", fill="#777"),
    ]
    return n, parts


def north_arrow(x, y, s=1.0):
    return g([
        E("circle", cx=x, cy=y, r=6 * s, fill="none", stroke="#1d1d1b", stroke_width=0.3),
        E("polygon", points=f"{f(x)},{f(y - 7 * s)} {f(x + 2.4 * s)},{f(y + 3 * s)} {f(x)},{f(y + 1.4 * s)}", fill="#1d1d1b"),
        E("polygon", points=f"{f(x)},{f(y - 7 * s)} {f(x - 2.4 * s)},{f(y + 3 * s)} {f(x)},{f(y + 1.4 * s)}", fill="#fff", stroke="#1d1d1b", stroke_width=0.25),
        T(x, y - 8.5 * s, "Sh", size=3.2 * s, anchor="middle", weight="bold"),
    ])


def scale_bar(x, y, k, meters=10, step=2):
    o = []
    for i in range(0, meters, step):
        o.append(rect(x + i * k, y, step * k, 1.2, fill="#1d1d1b" if (i // step) % 2 == 0 else "#fff",
                      stroke="#1d1d1b", stroke_width=0.2))
    for i in range(0, meters + 1, step):
        o.append(T(x + i * k, y + 4.2, i, size=2.2, anchor="middle"))
    o.append(T(x + meters * k + 3, y + 1.3, "m", size=2.4))
    return g(o)


def legend(x, y, items, title="Shartli belgilar", col_w=100, rows_per_col=99, size=2.5, sw=9, sh=4.5, gap=6):
    o = [T(x, y, title, size=3.4, weight="bold")]
    for i, (sym, label) in enumerate(items):
        col, row = divmod(i, rows_per_col)
        X, Y = x + col * col_w, y + 4 + row * gap
        o.append(sym(X, Y, sw, sh))
        o.append(T(X + sw + 2.5, Y + sh * 0.75, label, size=size))
    return g(o)


def sw_fill(fill, stroke="#555"):
    return lambda X, Y, w, h: rect(X, Y, w, h, fill=fill, stroke=stroke, stroke_width=0.2)


def sw_circle(fill, stroke, r=2):
    return lambda X, Y, w, h: E("circle", cx=X + w / 2, cy=Y + h / 2, r=r, fill=fill, stroke=stroke, stroke_width=0.25)


def sw_line(stroke, dash=None, width=0.5):
    return lambda X, Y, w, h: line(X, Y + h / 2, X + w, Y + h / 2, stroke=stroke, stroke_width=width, stroke_dasharray=dash)


# ----------------------------------------------------------------------------
# Rejaning qatlamlari
# ----------------------------------------------------------------------------

def layer_plot(P, fence=True, grid=False):
    o = []
    if grid:
        for i in range(0, int(PLOT_W) + 1):
            o.append(P.line(i, 0, i, PLOT_H, stroke="#e6e6e6", stroke_width=0.12))
        for j in range(0, int(PLOT_H) + 1):
            o.append(P.line(0, j, PLOT_W, j, stroke="#e6e6e6", stroke_width=0.12))
    # ko'cha
    X, Y = P.p(-1.5, PLOT_H + 0.6)
    o.append(rect(X, Y, (PLOT_W + 3) * P.k, 2.6 * P.k, fill="#ececec", stroke="none"))
    o.append(P.line(-1.5, PLOT_H + 1.6, PLOT_W + 1.5, PLOT_H + 1.6, stroke="#999", stroke_width=0.3))
    o.append(P.text(PLOT_W / 2 - 3, PLOT_H + 2.75, "KO'CHA (Mahalla ko'chasi)", size=2.8, anchor="middle", fill="#777"))
    if fence:
        sw = dict(fill="none", stroke="#1d1d1b", stroke_width=0.6)
        o.append(P.poly([(GATE_SMALL[0], PLOT_H), (0, PLOT_H), (0, 0), (PLOT_W, 0), (PLOT_W, PLOT_H),
                         (GATE_CAR[1], PLOT_H)], close=False, **sw))
        o.append(P.line(GATE_SMALL[1], PLOT_H, GATE_CAR[0], PLOT_H, stroke="#1d1d1b", stroke_width=0.6))
        for gx in (GATE_SMALL, GATE_CAR):
            o.append(P.line(gx[0], PLOT_H, gx[1], PLOT_H, stroke="#1d1d1b", stroke_width=0.25, stroke_dasharray="1,0.8"))
    return g(o)


def layer_house(P, color=True):
    o = [P.rect(HOUSE, fill="#d9d4cc" if color else "url(#pHatchLight)", stroke="#1d1d1b", stroke_width=0.5)]
    x, y, w, h = HOUSE
    if color:
        o.append(P.line(x + 0.3, y + 0.3, x + w - 0.3, y + h - 0.3, stroke="#b8b1a6", stroke_width=0.2))
        o.append(P.line(x + 0.3, y + h - 0.3, x + w - 0.3, y + 0.3, stroke="#b8b1a6", stroke_width=0.2))
    o.append(P.text(x + w / 2, y + h / 2 - 0.4, "TURAR-JOY UYI", size=3.2, anchor="middle", weight="bold"))
    o.append(P.text(x + w / 2, y + h / 2 + 1.4, "2 qavatli, 110 m² · ±0,000 = 450,90", size=2.3, anchor="middle", fill="#444"))
    o.append(P.rect(PORCH, fill="#bfb7ab" if color else "#fff", stroke="#1d1d1b", stroke_width=0.3))
    for i in range(1, 3):
        o.append(P.line(PORCH[0], PORCH[1] + i * 0.5, PORCH[0] + PORCH[2], PORCH[1] + i * 0.5, stroke="#555", stroke_width=0.15))
    return g(o)


def layer_hardscape(P, color=True):
    st = dict(stroke="#5a5348", stroke_width=0.3)
    if not color:
        st = dict(stroke="#1d1d1b", stroke_width=0.3)
    fill = (lambda c: c) if color else (lambda c: "#fff")
    o = [
        P.rect(DRIVEWAY, fill=fill("url(#pBrick)"), **st),
        P.rect(FRONT_PATH, fill=fill("url(#pTile)"), **st),
        P.rect(SIDE_PATH, fill=fill("url(#pTile)"), **st),
        P.rect(PAD, fill=fill("url(#pStone)"), **st),
        P.rect(GRAVEL, fill=fill("url(#pGravel)"), **st),
        P.rect(TERRACE, fill=fill("url(#pDeck)"), **st),
        P.rect(KIDS, fill=fill("url(#pRubber)"), **st),
    ]
    for b in VEG_BEDS:
        o.append(P.rect(b, fill=fill("url(#pSoil)") if color else "#f4f0ea", stroke="#7a5230", stroke_width=0.45))
    # shiypon
    gx, gy, gw, gh = GAZEBO
    o.append(P.rect(GAZEBO, fill="#a77a52" if color else "#fff", stroke="#1d1d1b", stroke_width=0.45))
    o.append(P.line(gx, gy, gx + gw, gy + gh, stroke="#5a3d24", stroke_width=0.2))
    o.append(P.line(gx, gy + gh, gx + gw, gy, stroke="#5a3d24", stroke_width=0.2))
    o.append(P.rect((gx + 1, gy + 1.4, 2, 1.2), fill="#e9dcc4" if color else "#fff", stroke="#5a3d24", stroke_width=0.2))
    o.append(P.rect(BBQ, fill="#9c4a32" if color else "#fff", stroke="#1d1d1b", stroke_width=0.35))
    # bolalar maydonchasi jihozlari
    o.append(P.rect((1.3, 1.3, 1.6, 1.6), fill="#f2e5bf" if color else "#fff", stroke="#7a5230", stroke_width=0.3))
    o.append(P.line(2.2, 3.6, 4.5, 3.6, stroke="#333", stroke_width=0.45))
    o.append(P.rect((2.8, 3.3, 0.5, 0.6), fill="#333"))
    o.append(P.rect((3.6, 3.3, 0.5, 0.6), fill="#333"))
    # ishkom (pergola) ustunlari
    for xx in (2.15, 4.75, 7.35, 9.85):
        o.append(P.rect((xx - 0.12, 10.55, 0.24, 0.24), fill="#3b3b3b"))
    o.append(P.rect((2.0, 10.5, 8, 3.5), fill="none", stroke="#3b3b3b", stroke_width=0.2, stroke_dasharray="1.2,0.6"))
    # qadamli toshlar
    for (sx, sy) in STONES:
        o.append(P.rect((sx - 0.3, sy - 0.2, 0.6, 0.4), fill=fill("#cfc6b6"), stroke="#776d5e", stroke_width=0.2, rx=0.5))
    # o'rindiqlar
    o.append(P.rect((8.2, 4.3, 1.6, 0.45), fill="#8d6038" if color else "#fff", stroke="#1d1d1b", stroke_width=0.2))
    o.append(P.rect((15.3, 6.6, 1.6, 0.45), fill="#8d6038" if color else "#fff", stroke="#1d1d1b", stroke_width=0.2))
    # avtomobillar
    for cx in (15.0, 17.0):
        o.append(P.rect((cx + 0.1, 22.6, 1.8, 4.5), fill="none", stroke="#9a9a9a", stroke_width=0.2,
                        stroke_dasharray="0.8,0.5", rx=1.2))
    return g(o)


def layer_softscape(P, color=True):
    if not color:
        return g([
            P.rect(BACK_LAWN, fill="none", stroke="#8bb867", stroke_width=0.2),
        ])
    o = [
        P.rect(BACK_LAWN, fill="url(#pLawn)", stroke="#86b85a", stroke_width=0.2),
        P.rect(LAWN_L, fill="url(#pLawn)", stroke="#86b85a", stroke_width=0.2),
        P.rect(LAWN_R, fill="url(#pLawn)", stroke="#86b85a", stroke_width=0.2),
    ]
    for r in (ROSE_BED, MIX_BED, STREET_BED_L, STREET_BED_R, HIBISCUS_BED, EAST_STRIP, TERRACE_BED):
        o.append(P.rect(r, fill="#9c7b5a", stroke="#6c5034", stroke_width=0.2))
    o.append(P.rect((0, 14, 2, 10), fill="#9c7b5a", stroke="none"))
    o.append(P.rect((0, 0, PLOT_W, 0.8), fill="#9c7b5a", stroke="none"))
    o.append(P.rect((19.4, 8.0, 0.6, 10.0), fill="#9c7b5a", stroke="none"))
    o.append(P.rect((0, 5.2, 0.8, 9), fill="#9c7b5a", stroke="none"))
    o.append(P.circle(*ROUND_BED, fill="#9c7b5a", stroke="#6c5034", stroke_width=0.25))
    # kichik yashil qism: Xurmo ostidagi mulcha
    o.append(P.rect((15.0, 14.8, 4.4, 3.2), fill="#9c7b5a", stroke="none"))
    return g(o)


PLANT_STYLE = {
    "fruit": ("#8cc063", "#4f7d32"),
    "conifer": ("#3f7656", "#1f4a33"),
    "flower": ("#d67fae", "#8e3c6b"),
    "orn": ("#6ea85a", "#3a6b2c"),
    "hedge": ("#4f8a3f", "#2d5a21"),
    "rose": ("#e24f5c", "#97222d"),
    "perennial": ("#a687d9", "#5f3f99"),
    "shrub": ("#b04f6a", "#6b2a3c"),
    "vine": ("#7aa33d", "#466522"),
}


def tree_symbol(P, code, x, y, color=True, label=True):
    name, lat, size, d, kind, price = SPECIES[code]
    r = d / 2
    fill, stroke = PLANT_STYLE[kind]
    o = []
    if not color:
        fill, stroke = "#fff", "#1d1d1b"
    if color and d >= 2:
        o.append(P.circle(x + 0.35, y + 0.35, r, fill="#000", opacity=0.13))
    if kind == "conifer" and d >= 2:
        pts = []
        n = 16
        for i in range(n * 2):
            rr = r if i % 2 == 0 else r * 0.78
            a = i * math.pi / n
            pts.append((x + rr * math.cos(a), y + rr * math.sin(a)))
        o.append(P.poly(pts, fill=fill, stroke=stroke, stroke_width=0.25, fill_opacity=0.9 if color else 1))
    else:
        o.append(P.circle(x, y, r, fill=fill, stroke=stroke, stroke_width=0.25 if d >= 1 else 0.18,
                          fill_opacity=0.82 if color else 1,
                          stroke_dasharray="0.6,0.3" if (code == "1" and not color) else None))
        if d >= 2.5:
            o.append(P.circle(x, y, r * 0.62, fill="none", stroke=stroke, stroke_width=0.15, stroke_opacity=0.6))
    if d >= 1.2:
        o.append(P.circle(x, y, 0.12, fill=stroke))
    if label and d >= 1.2:
        X, Y = P.p(x, y)
        o.append(E("circle", cx=X, cy=Y, r=2.1, fill="#fff", stroke=stroke, stroke_width=0.25))
        o.append(T(X, Y + 1.0, code, size=2.6, anchor="middle", weight="bold"))
    return g(o)


def layer_plants(P, color=True, label=True, small_labels=False):
    o = []
    order = sorted(PLANTS, key=lambda p: SPECIES[p[0]][3])
    for code, x, y in order:
        o.append(tree_symbol(P, code, x, y, color, label))
    if small_labels:
        # guruhlangan o'simliklar uchun chiqish chiziqli yozuvlar
        groups = {
            "11": [(9.0, 0.45, 9.0, -1.4), (19.55, 12.0, 21.6, 12.0), (0.45, 18.0, -1.6, 18.0)],
            "13": [(5.75, 27.2, 4.4, 26.7)],
            "14": [(10.5, 24.75, 10.5, 23.2)],
            "15": [(3.5, 24.55, 3.5, 23.2)],
            "16": [(2.9, 29.6, 2.9, 31.3), (11.3, 29.6, 11.3, 31.3)],
            "18": [(19.5, 23.4, 21.6, 23.4)],
            "19": [(5.4, 10.1, 5.4, 8.6)],
            "20": [(6.0, 10.3, 6.0, 11.6)],
            "21": [(7.2, 6.0, 8.2, 7.6), (4.6, 25.0, 4.6, 26.4)],
        }
        for code, items in groups.items():
            n = plant_count(code)
            for (x1, y1, x2, y2) in items:
                o.append(P.line(x1, y1, x2, y2, stroke="#1d1d1b", stroke_width=0.18))
                o.append(P.circle(x1, y1, 0.08, fill="#1d1d1b"))
                X, Y = P.p(x2, y2)
                o.append(E("circle", cx=X, cy=Y, r=2.1, fill="#fff", stroke="#1d1d1b", stroke_width=0.25))
                o.append(T(X, Y + 1.0, code, size=2.6, anchor="middle", weight="bold"))
    return g(o)


def base_plan(P, color=True, plants=True, labels=True, small_labels=False, grid=False):
    o = [layer_plot(P, grid=grid)]
    o.append(layer_softscape(P, color))
    o.append(layer_hardscape(P, color))
    o.append(layer_house(P, color))
    if plants:
        o.append(layer_plants(P, color, labels, small_labels))
    return g(o)


def ghost_plan(P):
    """Texnik varaqlar uchun och kulrang asos."""
    return g(base_plan(P, color=False, plants=False), opacity=0.42)


def ghost_with_trees(P):
    o = [ghost_plan(P)]
    for code, x, y in PLANTS:
        d = SPECIES[code][3]
        if d >= 2:
            o.append(P.circle(x, y, d / 2, fill="none", stroke="#9cbf86", stroke_width=0.2, stroke_dasharray="0.8,0.4"))
    return g(o)


def dim_h(P, x1, x2, y, text=None, off=0, size=2.2):
    X1, Y = P.p(x1, y)
    X2, _ = P.p(x2, y)
    Y += off
    t = text if text is not None else f"{x2 - x1:.2f}".replace(".", ",")
    return g([
        line(X1, Y, X2, Y, stroke_width=0.2, marker_start="url(#mTick)", marker_end="url(#mTick)"),
        line(X1, Y - 1.5, X1, Y + 1.5, stroke_width=0.15),
        line(X2, Y - 1.5, X2, Y + 1.5, stroke_width=0.15),
        T((X1 + X2) / 2, Y - 0.8, t, size=size, anchor="middle"),
    ])


def dim_v(P, y1, y2, x, text=None, off=0, size=2.2):
    X, Y1 = P.p(x, y1)
    _, Y2 = P.p(x, y2)
    X += off
    t = text if text is not None else f"{y2 - y1:.2f}".replace(".", ",")
    return g([
        line(X, Y1, X, Y2, stroke_width=0.2, marker_start="url(#mTick)", marker_end="url(#mTick)"),
        line(X - 1.5, Y1, X + 1.5, Y1, stroke_width=0.15),
        line(X - 1.5, Y2, X + 1.5, Y2, stroke_width=0.15),
        T(X - 0.8, (Y1 + Y2) / 2, t, size=size, anchor="middle",
          transform=f"rotate(-90 {f(X - 0.8)} {f((Y1 + Y2) / 2)})"),
    ])


def notes(x, y, title, items, size=2.5, width_chars=78, lh=3.6):
    o = [T(x, y, title, size=3.4, weight="bold")]
    yy = y + 5
    for i, it in enumerate(items, 1):
        words, cur, first = it.split(), "", True
        for w in words:
            if len(cur) + len(w) + 1 > width_chars:
                o.append(T(x + (0 if first else 4), yy, (f"{i}. " if first else "") + cur.strip(), size=size))
                first, cur = False, ""
                yy += lh
            cur += w + " "
        o.append(T(x + (0 if first else 4), yy, (f"{i}. " if first else "") + cur.strip(), size=size))
        yy += lh + 0.8
    return g(o), yy


def table(x, y, cols, rows, rh=5.0, size=2.4, head_h=7.0, zebra=True, bold_last=False):
    """cols: [(sarlavha, kenglik, tekislash)]"""
    o = []
    tw = sum(c[1] for c in cols)
    o.append(rect(x, y, tw, head_h, fill="#ecebe6", stroke="#1d1d1b", stroke_width=0.3))
    xx = x
    for title, w, al in cols:
        parts = title.split("\n")
        for i, p in enumerate(parts):
            o.append(T(xx + w / 2, y + head_h / 2 + 1 - (len(parts) - 1) * 1.4 + i * 2.8, p, size=size - 0.1,
                       anchor="middle", weight="bold"))
        xx += w
    yy = y + head_h
    for ri, r in enumerate(rows):
        is_group = isinstance(r, str)
        if is_group:
            o.append(rect(x, yy, tw, rh, fill="#f6f3ea", stroke="#1d1d1b", stroke_width=0.15))
            o.append(T(x + 2, yy + rh * 0.68, r, size=size, weight="bold"))
            yy += rh
            continue
        if zebra and ri % 2:
            o.append(rect(x, yy, tw, rh, fill="#fafaf8"))
        last = bold_last and ri == len(rows) - 1
        xx = x
        for (title, w, al), val in zip(cols, r):
            if callable(val):
                o.append(val(xx, yy, w, rh))
            else:
                tx = xx + 1.5 if al == "l" else (xx + w - 1.5 if al == "r" else xx + w / 2)
                anc = "start" if al == "l" else ("end" if al == "r" else "middle")
                o.append(T(tx, yy + rh * 0.68, val, size=size, anchor=anc, weight="bold" if last else "normal"))
            xx += w
        o.append(line(x, yy + rh, x + tw, yy + rh, stroke_width=0.12, stroke="#777"))
        yy += rh
    o.append(rect(x, y, tw, yy - y, fill="none", stroke="#1d1d1b", stroke_width=0.35))
    xx = x
    for title, w, al in cols[:-1]:
        xx += w
        o.append(line(xx, y, xx, yy, stroke_width=0.15))
    return g(o), yy


def money(v):
    return f"{v:,.0f}".replace(",", " ")


def num(v, d=1):
    return f"{v:.{d}f}".replace(".", ",")


# ----------------------------------------------------------------------------
# Varaqlar
# ----------------------------------------------------------------------------

def cover():
    P = Plan(250, 30, scale=125)
    o = [rect(0, 0, PAGE_W, PAGE_H, fill="#f4f1ea")]
    o.append(rect(0, 0, 200, PAGE_H, fill="#22392c"))
    o.append(T(24, 40, "LANDSHAFT LOYIHASI", size=5, fill="#c9d8b6", weight="bold", letter_spacing=1.2))
    o.append(T(24, 66, "Xususiy hovlini", size=13, fill="#fff", weight="bold"))
    o.append(T(24, 82, "obodonlashtirish va", size=13, fill="#fff", weight="bold"))
    o.append(T(24, 98, "ko'kalamzorlashtirish", size=13, fill="#fff", weight="bold"))
    o.append(line(24, 110, 90, 110, stroke="#c9d8b6", stroke_width=0.8))
    o.append(T(24, 122, "Loyiha albomi · eskizdan ishchi chizmalargacha", size=4.4, fill="#e3ead9"))
    info = [("Loyiha kodi", PROJECT_CODE), ("Bosqich", "Ishchi loyiha (IL)"),
            ("Uchastka", "20 × 30 m · 600 m² (6 sotix)"), ("Manzil", "Toshkent viloyati"),
            ("Buyurtmachi", "xususiy shaxs"), ("Varaqlar", "{TOTAL} ta, A3 format")]
    for i, (a, b) in enumerate(info):
        o.append(T(24, 150 + i * 11, a.upper(), size=2.8, fill="#9fb592", letter_spacing=0.6))
        o.append(T(24, 155.5 + i * 11, b, size=4.2, fill="#fff"))
    o.append(T(24, 278, "LANDSHAFT LOYIHALASH STUDIYASI  ·  TOSHKENT  ·  2026", size=3.2, fill="#9fb592", letter_spacing=0.8))
    o.append(base_plan(P, color=True, labels=False))
    o.append(north_arrow(400, 30, 0.9))
    o.append(T(250 + 10 * P.k, 30 + PLOT_H * P.k + 22, "Bosh reja (sxema)", size=3.2, anchor="middle", fill="#555"))
    return o


def sheet_general(contents_rows):
    o = []
    o.append(T(30, 18, "UMUMIY MA'LUMOTLAR", size=6, weight="bold"))
    tbl, _ = table(30, 26, [("Varaq", 18, "c"), ("Nomi", 112, "l"), ("Masshtab", 22, "c")],
                   [("—", "Muqova", "—")] + contents_rows, rh=5.2, size=2.6)
    o.append(T(30, 24, "Albom tarkibi (mundarija)", size=3.4, weight="bold"))
    o.append(tbl)
    paved = area(DRIVEWAY) + PATH_AREA + area(PAD) + area(PORCH)
    green = LAWN_AREA + BEDS_AREA + area(TERRACE_BED)
    total = PLOT_W * PLOT_H
    tep_rows = [
        ("1", "Uchastka maydoni", "m²", num(total, 0), "100"),
        ("2", "Uy (qurilish dog'i)", "m²", num(area(HOUSE), 0), num(area(HOUSE) / total * 100)),
        ("3", "Qattiq qoplamalar (yo'l, yo'lka, maydon)", "m²", num(paved), num(paved / total * 100)),
        ("4", "Terrasa (deking)", "m²", num(area(TERRACE)), num(area(TERRACE) / total * 100)),
        ("5", "Bolalar maydonchasi, shag'al qoplama", "m²", num(area(KIDS) + GRAVEL_AREA), num((area(KIDS) + GRAVEL_AREA) / total * 100)),
        ("6", "Maysazor (rulonli)", "m²", num(LAWN_AREA), num(LAWN_AREA / total * 100)),
        ("7", "Gulzor, butazor, pushtalar", "m²", num(BEDS_AREA + sum(area(b) for b in VEG_BEDS)),
         num((BEDS_AREA + sum(area(b) for b in VEG_BEDS)) / total * 100)),
        ("8", "Ko'kalamzorlashtirish darajasi", "%", num((LAWN_AREA + BEDS_AREA) / total * 100), "—"),
        ("9", "Daraxtlar (yangi / saqlanadigan)", "dona",
         f"{sum(plant_count(c) for c in ('2','3','4','5','6','7','8','9'))} / 1", "—"),
        ("10", "Butalar va ignabarglilar", "dona",
         str(sum(plant_count(c) for c in ('11','12','13','14','16','17','18','19','20'))), "—"),
        ("11", "Gullar (ko'p yillik, lavanda)", "dona", str(plant_count("15") + plant_count("21")), "—"),
    ]
    t2, y2 = table(205, 26, [("№", 9, "c"), ("Ko'rsatkich", 100, "l"), ("O'lch.", 14, "c"),
                             ("Miqdor", 22, "r"), ("%", 15, "r")], tep_rows, rh=5.2, size=2.6)
    o.append(T(205, 24, "Texnik-iqtisodiy ko'rsatkichlar", size=3.4, weight="bold"))
    o.append(t2)
    nts, _ = notes(205, y2 + 10, "Umumiy izohlar", [
        "Loyiha buyurtmachining texnik topshirig'i, uchastkaning geodezik s'yomkasi (M 1:200) va joyni "
        "ko'zdan kechirish natijalari asosida ishlab chiqilgan.",
        "Balandliklar Boltiq tizimida. Uyning toza pol sathi ±0,000 = 450,90 absolyut belgiga teng.",
        "O'lchamlar metrda, konstruktiv tugunlar millimetrda ko'rsatilgan.",
        "Iqlim: keskin kontinental; yozgi harorat +42 °C gacha, qishki −15 °C gacha. "
        "Assortiment shu sharoitga chidamli turlardan tanlangan.",
        "Tuproq — lyossimon qumoq, sizot suvlari 4 m dan chuqur. Ekish joylariga unumdor tuproq "
        "aralashmasi keltiriladi (tuproq:torf:qum = 2:1:1).",
        "Barcha yer osti tarmoqlari (gaz, suv, kanalizatsiya, kabel) ish boshlanishidan oldin joyida "
        "aniqlanib, belgilanadi. Tarmoqlardan 1,5 m radiusda faqat qo'lda qaziladi.",
        "Ishlar QMQ 3.07.01, QMQ 2.07.01 va mehnat xavfsizligi qoidalariga muvofiq bajariladi.",
        "Ishlarni bajarish ketma-ketligi: tayyorlov → yer ishlari → tarmoqlar → qoplamalar → KMSh → "
        "ko'kalamzorlashtirish → maysa → sozlash (L-17 varaq).",
    ], width_chars=92)
    o.append(nts)
    return sheet("Umumiy ma'lumotlar. Mundarija. TIK", "—", g(o), n=1)


def sheet_existing():
    P = Plan(40, 30)
    o = [layer_plot(P, grid=True)]
    o.append(P.rect(HOUSE, fill="url(#pHatch)", stroke="#1d1d1b", stroke_width=0.5))
    o.append(P.text(7.5, 19.3, "Mavjud uy", size=3, anchor="middle", weight="bold"))
    o.append(P.text(7.5, 20.6, "(saqlanadi)", size=2.4, anchor="middle"))
    # buziladigan inshootlar
    shed = (15.0, 1.0, 4.0, 3.0)
    o.append(P.rect(shed, fill="#fff", stroke="#c0392b", stroke_width=0.45, stroke_dasharray="1,0.6"))
    o.append(P.line(15, 1, 19, 4, stroke="#c0392b", stroke_width=0.3))
    o.append(P.line(15, 4, 19, 1, stroke="#c0392b", stroke_width=0.3))
    o.append(P.text(17, 5.0, "Eski omborxona — buziladi", size=2.2, anchor="middle", fill="#c0392b"))
    conc = (14.5, 21.0, 4.5, 7.0)
    o.append(P.rect(conc, fill="url(#pHatchLight)", stroke="#c0392b", stroke_width=0.35, stroke_dasharray="1,0.6"))
    o.append(P.text(16.75, 25.0, "Eski beton —", size=2.2, anchor="middle", fill="#c0392b"))
    o.append(P.text(16.75, 26.2, "demontaj, 30 m²", size=2.2, anchor="middle", fill="#c0392b"))
    # daraxtlar
    o.append(P.circle(6.8, 2.3, 2.5, fill="none", stroke="#2f7d32", stroke_width=0.45))
    o.append(P.circle(6.8, 2.3, 0.15, fill="#2f7d32"))
    o.append(P.text(6.8, 5.6, "O'rik, tana Ø 22 sm", size=2.1, anchor="middle", fill="#2f7d32"))
    o.append(P.text(6.8, 6.6, "— saqlanadi", size=2.1, anchor="middle", fill="#2f7d32"))
    o.append(P.circle(10.5, 7.5, 3.0, fill="none", stroke="#c0392b", stroke_width=0.45))
    o.append(P.line(9.6, 6.6, 11.4, 8.4, stroke="#c0392b", stroke_width=0.4))
    o.append(P.line(9.6, 8.4, 11.4, 6.6, stroke="#c0392b", stroke_width=0.4))
    o.append(P.text(10.5, 11.2, "Tut (qurigan) — kesiladi", size=2.1, anchor="middle", fill="#c0392b"))
    # tarmoqlar
    nets = [
        ([(16.2, 31.6), (16.2, 20.5), (13.0, 20.5)], "#2b6cb0", "V1 suv quvuri Ø32"),
        ([(10.0, 24.0), (10.0, 31.6)], "#7b4a1e", "K1 kanalizatsiya Ø110"),
        ([(1.5, 31.6), (1.5, 24.2), (2.0, 24.0)], "#c0392b", "Elektr kabeli 0,4 kV"),
        ([(12.2, 31.6), (12.2, 24.0)], "#d4a017", "G gaz quvuri (yer usti)"),
    ]
    for pts, col, lab in nets:
        o.append(P.poly(pts, close=False, fill="none", stroke=col, stroke_width=0.55, stroke_dasharray="2,0.8"))
    # balandlik belgilari
    marks = [(0.5, 0.5, "450,72"), (10, 0.5, "450,70"), (19.5, 0.5, "450,66"), (0.5, 9, "450,58"),
             (10, 9, "450,55"), (19.5, 9, "450,52"), (0.5, 13.5, "450,50"), (19.5, 15, "450,44"),
             (0.5, 25, "450,30"), (10, 25, "450,32"), (19.5, 25, "450,24"), (0.5, 29.5, "450,12"),
             (10, 29.5, "450,10"), (19.5, 29.5, "450,05")]
    for x, y, v in marks:
        o.append(P.line(x - 0.2, y - 0.2, x + 0.2, y + 0.2, stroke="#1d1d1b", stroke_width=0.2))
        o.append(P.line(x - 0.2, y + 0.2, x + 0.2, y - 0.2, stroke="#1d1d1b", stroke_width=0.2))
        o.append(P.text(x + (0.4 if x < 15 else -0.4), y - 0.3, v, size=1.9, anchor="start" if x < 15 else "end", fill="#333"))
    # gorizontallar
    for lvl, yy in ((450.6, 7.8), (450.5, 13.5), (450.3, 24.8), (450.2, 27.6)):
        o.append(P.poly([(0, yy - 0.15), (7, yy), (14, yy + 0.1), (20, yy + 0.4)], close=False,
                        fill="none", stroke="#a0784f", stroke_width=0.25))
        o.append(P.text(15.5, yy + 0.05, f"{lvl:.2f}".replace(".", ","), size=1.8, fill="#a0784f"))
    o.append(dim_h(P, 0, 20, 0, off=-5, text="20,00"))
    o.append(dim_v(P, 0, 30, 0, off=-6, text="30,00"))
    o.append(dim_h(P, 0, 2, 14, off=-2.5))
    o.append(dim_h(P, 13, 20, 14, off=-2.5))
    o.append(dim_v(P, 24, 30, 2, off=-2))
    # o'ng ustun
    o.append(north_arrow(390, 30))
    o.append(T(200, 22, "Mavjud holat va o'lchov rejasi (topos'yomka asosida)", size=4, weight="bold"))
    leg = legend(200, 32, [
        (sw_fill("url(#pHatch)"), "Mavjud bino (saqlanadi)"),
        (lambda X, Y, w, h: rect(X, Y, w, h, fill="#fff", stroke="#c0392b", stroke_width=0.4, stroke_dasharray="1,0.6"), "Buziladigan inshoot / qoplama"),
        (sw_circle("none", "#2f7d32"), "Saqlanadigan daraxt"),
        (lambda X, Y, w, h: g([E("circle", cx=X + w / 2, cy=Y + h / 2, r=2, fill="none", stroke="#c0392b", stroke_width=0.35),
                               line(X + 3, Y + 0.8, X + 6, Y + 3.8, stroke="#c0392b"), line(X + 3, Y + 3.8, X + 6, Y + 0.8, stroke="#c0392b")]),
         "Kesiladigan daraxt"),
        (sw_line("#2b6cb0", "2,0.8"), "V1 — suv quvuri"),
        (sw_line("#7b4a1e", "2,0.8"), "K1 — kanalizatsiya"),
        (sw_line("#c0392b", "2,0.8"), "Elektr kabeli"),
        (sw_line("#d4a017", "2,0.8"), "Gaz quvuri"),
        (sw_line("#a0784f", None, 0.3), "Gorizontallar (0,1 m oraliq)"),
        (lambda X, Y, w, h: T(X, Y + 3.5, "× 450,55", size=2.4), "Mavjud yer sathi belgisi"),
    ])
    o.append(leg)
    rose = wind_rose(345, 105)
    o.append(rose)
    nts, _ = notes(200, 120, "Uchastka tavsifi", [
        "Maydoni 600 m², shakli to'g'ri to'rtburchak, ko'cha tomoni janubda.",
        "Relyef: shimoldan janubga (ko'chaga) nishablik 2,2 %, o'rtacha farq 0,65 m.",
        "Uy oldida va uy orqasida suv to'planadigan joylar aniqlanmagan, lekin uy orqasiga "
        "shimoldan oqib keluvchi suv uchun drenaj kerak (L-07).",
        "Quyosh: uchastkaning shimoliy qismi (hovli) kun bo'yi quyoshda; uy oldi peshindan keyin soyada.",
        "Hukmron shamol — shimoli-sharqiy; qishki shamoldan himoya uchun sharqiy va shimoliy "
        "chegara bo'ylab doim yashil to'siq ko'zda tutilgan.",
        "Mavjud o'rik (≈15 yosh) sog'lom, saqlanadi; tanasi ish paytida taxta g'ilof bilan himoyalanadi.",
        "Tut daraxti qurigan, kesilib to'nkasi qo'poriladi. Eski omborxona va beton qoplama buziladi.",
        "Tuproq: lyossimon qumoq, pH 7,8–8,2; unumdor qatlam 10–15 sm, qurilish chiqindisi bilan aralashgan.",
    ], width_chars=70)
    o.append(nts)
    o.append(scale_bar(40, 260, P.k))
    return sheet("Mavjud holat. Topografik asos", "1:150", g(o))


def wind_rose(cx, cy):
    vals = [0.6, 1.0, 0.7, 0.4, 0.3, 0.35, 0.45, 0.5]   # Sh, ShSh, Sh, JSh, J, JG', G', ShG'
    pts = []
    for i, v in enumerate(vals):
        a = -math.pi / 2 + i * math.pi / 4
        pts.append(f"{f(cx + 12 * v * math.cos(a))},{f(cy + 12 * v * math.sin(a))}")
    o = [E("circle", cx=cx, cy=cy, r=12, fill="none", stroke="#bbb", stroke_width=0.2),
         line(cx - 13, cy, cx + 13, cy, stroke="#bbb", stroke_width=0.2),
         line(cx, cy - 13, cx, cy + 13, stroke="#bbb", stroke_width=0.2),
         E("polygon", points=" ".join(pts), fill="#5b8bd0", fill_opacity=0.35, stroke="#2b6cb0", stroke_width=0.35),
         T(cx, cy - 14, "Sh", size=2.4, anchor="middle"), T(cx + 15, cy + 1, "Shq", size=2.4),
         T(cx, cy + 17, "J", size=2.4, anchor="middle"), T(cx - 15, cy + 1, "G'", size=2.4, anchor="end"),
         T(cx, cy - 19, "Shamollar guli (yillik)", size=2.6, anchor="middle", weight="bold")]
    return g(o)


def sheet_master():
    P = Plan(40, 30)
    o = [base_plan(P, color=True, labels=False)]
    # zonalar nomlari
    tags = [(4.0, 3.0, "Bolalar maydonchasi"), (16.5, 0.2, "Shiypon"), (18.5, 7.0, "Mangal"),
            (6.0, 12.4, "Terrasa / ishkom"), (17.2, 9.0, "Sabzavot pushtalari"),
            (16.75, 24.8, "Avtoturargoh"), (6.75, 31.0, "Kirish"), (6.5, 8.1, "Gulzor"),
            (16.75, 31.0, "Darvoza")]
    for x, y, s in tags:
        X, Y = P.p(x, y)
        w = len(s) * 1.35 + 3
        o.append(rect(X - w / 2, Y - 2.8, w, 3.8, fill="#fff", fill_opacity=0.85, rx=1))
        o.append(T(X, Y, s, size=2.4, anchor="middle", weight="bold"))
    o.append(north_arrow(185, 30))
    o.append(scale_bar(40, 260, P.k))
    o.append(T(200, 22, "Bosh reja (rangli)", size=4, weight="bold"))
    items = [
        (sw_fill("url(#pLawn)"), "Maysazor (rulonli)"),
        (sw_fill("#9c7b5a"), "Gulzor / mulchalangan ekish joyi"),
        (sw_fill("url(#pBrick)"), "Beton brusschatka 80 mm (avto)"),
        (sw_fill("url(#pTile)"), "Vibropressli plitka 60 mm (yo'lka)"),
        (sw_fill("url(#pStone)"), "Tabiiy tosh — travertin 30 mm"),
        (sw_fill("url(#pDeck)"), "Terrasa — DPK deking"),
        (sw_fill("url(#pGravel)"), "Dekorativ shag'al 10–20 mm"),
        (sw_fill("url(#pRubber)"), "Rezina qoplama 20 mm"),
        (sw_fill("url(#pSoil)", "#7a5230"), "Ko'tarilgan sabzavot pushtasi"),
        (sw_fill("#a77a52"), "Shiypon 4×4 m"),
        (sw_fill("#9c4a32"), "Mangal kompleksi"),
        (sw_circle("#8cc063", "#4f7d32"), "Mevali daraxt"),
        (sw_circle("#6ea85a", "#3a6b2c"), "Manzarali bargli daraxt"),
        (sw_circle("#d67fae", "#8e3c6b"), "Gullaydigan daraxt"),
        (sw_circle("#3f7656", "#1f4a33"), "Ignabargli daraxt / buta"),
        (sw_circle("#b04f6a", "#6b2a3c", 1.5), "Manzarali buta"),
        (sw_circle("#e24f5c", "#97222d", 1.2), "Atirgul"),
        (sw_circle("#a687d9", "#5f3f99", 1.0), "Lavanda, ko'p yillik gullar"),
        (sw_circle("#4f8a3f", "#2d5a21", 0.9), "Shamshod jonli to'sig'i"),
        (lambda X, Y, w, h: rect(X + 1, Y + 0.6, 5, 3.2, fill="#cfc6b6", stroke="#776d5e", stroke_width=0.2, rx=1.2), "Qadamli toshlar"),
    ]
    o.append(legend(200, 30, items, rows_per_col=10, col_w=105))
    nts, _ = notes(200, 110, "Loyiha g'oyasi", [
        "Hovli uchta qismga bo'linadi: oldi hovli — vakillik zonasi (kirish, gulzor, avtoturargoh); "
        "yon yo'lak — xo'jalik va sabzavot zonasi; orqa hovli — oilaviy dam olish zonasi.",
        "Markaziy kompozitsiya o'qi — terrasadan bog'ga va shiyponga olib boruvchi qadamli toshlar yo'li.",
        "Uzbek hovlisi an'anasi saqlangan: terrasa ustida uzum ishkomi, mevali bog', mangal va shiypon.",
        "Ko'kalamzorlashtirish darajasi ≈ 32 %; maysa maydoni ochiq va o'yin uchun bo'sh qoldirilgan.",
        "Chegaralar bo'ylab doim yashil tuya to'siqlari — shamol, chang va shovqindan himoya, qo'shnilardan "
        "yopiqlik.",
        "Barcha ekinlar avtomatik tomchilatib va yomg'irlatib sug'oriladi (L-12); kechki yoritish — "
        "LED, astro-taymer bilan (L-13).",
    ], width_chars=96)
    o.append(nts)
    return sheet("Bosh reja (rangli)", "1:150", g(o))


def sheet_zoning():
    P = Plan(40, 30)
    o = [g(base_plan(P, color=True, plants=False), opacity=0.35)]
    zones = [
        ([(0, 24), (14.5, 24), (14.5, 30), (0, 30)], "#e8b04b", "A", "Kirish va vakillik zonasi"),
        ([(14.5, 18), (20, 18), (20, 30), (14.5, 30)], "#8c8c8c", "B", "Avtoturargoh"),
        ([(13, 8), (20, 8), (20, 18), (13, 18)], "#7a5230", "V", "Xo'jalik / sabzavot zonasi"),
        ([(13.4, 0), (20, 0), (20, 8), (13.4, 8)], "#c0392b", "G", "Shiypon va mangal"),
        ([(0, 0), (5.2, 0), (5.2, 5.2), (0, 5.2)], "#e67e22", "D", "Bolalar o'yin zonasi"),
        ([(5.2, 0), (13.4, 0), (13.4, 8), (13, 8), (13, 9.7), (0, 9.7), (0, 5.2), (5.2, 5.2)], "#4caf50", "E", "Bog' va maysazor"),
        ([(0, 9.7), (13, 9.7), (13, 14), (0, 14)], "#8e44ad", "J", "Terrasa (yozgi dam olish)"),
    ]
    for pts, col, letter, name in zones:
        o.append(P.poly(pts, fill=col, fill_opacity=0.38, stroke=col, stroke_width=0.6))
        cx = sum(p[0] for p in pts) / len(pts)
        cy = sum(p[1] for p in pts) / len(pts)
        X, Y = P.p(cx, cy)
        o.append(E("circle", cx=X, cy=Y, r=4, fill="#fff", stroke=col, stroke_width=0.6))
        o.append(T(X, Y + 1.5, letter, size=4.2, anchor="middle", weight="bold", fill=col))
    # harakat yo'nalishlari
    flows = [[(6.75, 31.5), (6.75, 25.0)], [(16.75, 31.5), (16.75, 19)], [(13.75, 18.5), (13.75, 8.5), (15.5, 5.5)],
             [(8.6, 10.0), (12.0, 7.0), (13.4, 4.4)], [(4.0, 10.0), (4.0, 5.2)]]
    for fl in flows:
        o.append(P.poly(fl, close=False, fill="none", stroke="#1d1d1b", stroke_width=0.45,
                        stroke_dasharray="1.6,0.8", marker_end="url(#mArrow)"))
    # ko'rinish nuqtalari
    for (x, y, a) in ((6.0, 12.0, -60), (2.0, 31.0, -60)):
        X, Y = P.p(x, y)
        o.append(E("path", d=f"M{f(X)},{f(Y)} l{f(18 * math.cos(math.radians(a - 18)))},{f(18 * math.sin(math.radians(a - 18)))} "
                   f"A18,18 0 0 1 {f(X + 18 * math.cos(math.radians(a + 18)))},{f(Y + 18 * math.sin(math.radians(a + 18)))} Z",
                   fill="#f1c40f", fill_opacity=0.25, stroke="#b7950b", stroke_width=0.25))
    o.append(layer_plot(P))
    o.append(north_arrow(185, 30))
    o.append(scale_bar(40, 260, P.k))
    o.append(T(200, 22, "Funksional zonalash va harakat sxemasi", size=4, weight="bold"))
    rows = []
    zone_area = {}
    for pts, col, letter, name in zones:
        a = 0
        for i in range(len(pts)):
            x1, y1 = pts[i]
            x2, y2 = pts[(i + 1) % len(pts)]
            a += x1 * y2 - x2 * y1
        zone_area[letter] = abs(a) / 2
        rows.append(((lambda c: (lambda X, Y, w, h: rect(X + 2, Y + 1, w - 4, h - 2, fill=c, fill_opacity=0.5, stroke=c)))(col),
                     letter, name, num(abs(a) / 2), ""))
    descr = {"A": "gulzor, maysa, archa, kirish yo'lagi", "B": "2 avtomobil, brusschatka",
             "V": "3 pushta, xurmo, kompost", "G": "travertin maydon, 6–8 kishi",
             "D": "qumdon, arg'imchoq, rezina", "E": "maysa, mevali daraxtlar, gulzor",
             "J": "DPK deking, uzum ishkomi"}
    rows = [(r[0], r[1], r[2], r[3], descr[r[1]]) for r in rows]
    tb, yb = table(200, 30, [("", 12, "c"), ("Zona", 10, "c"), ("Nomi", 50, "l"), ("Maydon, m²", 20, "r"),
                             ("Tarkibi", 108, "l")], rows, rh=6, size=2.6)
    o.append(tb)
    o.append(legend(200, yb + 10, [
        (lambda X, Y, w, h: line(X, Y + h / 2, X + w, Y + h / 2, stroke_width=0.45, stroke_dasharray="1.6,0.8", marker_end="url(#mArrow)"), "Asosiy piyodalar / avto harakati"),
        (lambda X, Y, w, h: E("path", d=f"M{f(X)},{f(Y + h)} l{f(w)},{f(-h)} l0,{f(h)} z", fill="#f1c40f", fill_opacity=0.35, stroke="#b7950b", stroke_width=0.25), "Asosiy ko'rinish nuqtasi"),
    ]))
    nts, _ = notes(200, yb + 32, "Zonalash tamoyillari", [
        "Shovqinli zonalar (bolalar, mangal) uy derazalaridan uzoqroq, lekin terrasadan ko'rinadigan "
        "joyda — ota-onalar kuzatib turishi uchun.",
        "Xo'jalik zonasi avtoturargoh va uyga yaqin: xarid va o'g'itlarni olib kirish qulay.",
        "Shiypon uchastkaning eng tinch shimoli-sharqiy burchagida, mangal tutuni hukmron shamol "
        "yo'nalishi bo'yicha uydan uzoqlashadi.",
        "Oldi hovli ochiq va past ekinlar bilan — uy fasadi ko'chadan ko'rinadi.",
    ], width_chars=96)
    o.append(nts)
    return sheet("Funksional zonalash", "1:150", g(o))


# --------------------------- Aksonometriya ---------------------------------

class Axo:
    def __init__(self, cx, cy, s):
        self.cx, self.cy, self.s = cx, cy, s

    def p(self, x, y, z=0):
        u, v = PLOT_H - y, x            # shimoli-sharqdan ko'rinish
        X = self.cx + (u - v) * math.cos(math.radians(30)) * self.s
        Y = self.cy + (u + v) * math.sin(math.radians(30)) * self.s - z * self.s
        return X, Y

    def depth(self, x, y):
        return (PLOT_H - y) + x

    def poly(self, pts, **kw):
        return E("polygon", points=" ".join(f"{f(a)},{f(b)}" for a, b in (self.p(*q) for q in pts)), **kw)

    def flat(self, r, z=0, **kw):
        x, y, w, h = r
        return self.poly([(x, y, z), (x + w, y, z), (x + w, y + h, z), (x, y + h, z)], **kw)

    def box(self, r, z0, z1, top, north, east, **kw):
        x, y, w, h = r
        sw = dict(stroke="#3a3a3a", stroke_width=0.2, stroke_linejoin="round")
        sw.update(kw)
        return g([
            self.poly([(x, y, z0), (x + w, y, z0), (x + w, y, z1), (x, y, z1)], fill=north, **sw),
            self.poly([(x + w, y, z0), (x + w, y + h, z0), (x + w, y + h, z1), (x + w, y, z1)], fill=east, **sw),
            self.poly([(x, y, z1), (x + w, y, z1), (x + w, y + h, z1), (x, y + h, z1)], fill=top, **sw),
        ])


def sheet_axo():
    A = Axo(150, 78, 6.4)
    o = []
    # yer
    o.append(A.flat((-1, -1, PLOT_W + 2, PLOT_H + 3), fill="#eef0ea", stroke="none"))
    o.append(A.flat((0, 0, PLOT_W, PLOT_H), fill="#9c7b5a", stroke="#5a4632", stroke_width=0.3))
    for r in (BACK_LAWN, LAWN_L, LAWN_R):
        o.append(A.flat(r, fill="#9fcb72", stroke="#86b85a", stroke_width=0.15))
    o.append(A.flat(DRIVEWAY, fill="#cbc4b8", stroke="#8a8174", stroke_width=0.2))
    o.append(A.flat(FRONT_PATH, fill="#ddd0b6", stroke="#8a8174", stroke_width=0.2))
    o.append(A.flat(SIDE_PATH, fill="#ddd0b6", stroke="#8a8174", stroke_width=0.2))
    o.append(A.flat(PAD, fill="#e3dbcc", stroke="#8a8174", stroke_width=0.2))
    o.append(A.flat(GRAVEL, fill="#e9e2d2", stroke="#8a8174", stroke_width=0.2))
    o.append(A.flat(KIDS, fill="#e9a37a", stroke="#8a8174", stroke_width=0.2))
    xs, ys, r = ROUND_BED
    o.append(A.poly([(xs + r * math.cos(a / 12 * math.pi), ys + r * math.sin(a / 12 * math.pi), 0) for a in range(24)],
                    fill="#9c7b5a", stroke="#6c5034", stroke_width=0.2))
    for (sx, sy) in STONES:
        o.append(A.flat((sx - 0.3, sy - 0.2, 0.6, 0.4), fill="#d8d0c2", stroke="#776d5e", stroke_width=0.1))

    objs = []   # (depth, svg)

    def add(depth, svg):
        objs.append((depth, svg))

    # uy
    hx, hy, hw, hh = HOUSE
    house = [A.box(HOUSE, 0, 7.0, "#b9bcc0", "#ece6db", "#ddd5c8")]
    # derazalar (shimoliy va sharqiy fasad)
    for i in range(4):
        wx = hx + 1 + i * 2.6
        for z0 in (1.0, 4.4):
            house.append(A.poly([(wx, hy, z0), (wx + 1.4, hy, z0), (wx + 1.4, hy, z0 + 1.8), (wx, hy, z0 + 1.8)],
                                fill="#6c8ba6", stroke="#3a3a3a", stroke_width=0.15))
    for i in range(3):
        wy = hy + 1.2 + i * 3
        for z0 in (1.0, 4.4):
            house.append(A.poly([(hx + hw, wy, z0), (hx + hw, wy + 1.4, z0), (hx + hw, wy + 1.4, z0 + 1.8), (hx + hw, wy, z0 + 1.8)],
                                fill="#5d7c96", stroke="#3a3a3a", stroke_width=0.15))
    # terrasa eshigi
    house.append(A.poly([(5.2, hy, 0), (7.6, hy, 0), (7.6, hy, 2.4), (5.2, hy, 2.4)], fill="#4c6a82", stroke="#3a3a3a", stroke_width=0.15))
    house.append(A.box((hx - 0.2, hy - 0.2, hw + 0.4, hh + 0.4), 7.0, 7.4, "#8f9398", "#cfc8bc", "#c2baad"))
    add(A.depth(hx + hw / 2, hy + hh / 2) - 3, g(house))
    # terrasa va ishkom
    add(A.depth(6, 12) - 1, A.box(TERRACE, 0, 0.3, "#b98657", "#8d6038", "#9c6b42"))
    perg = []
    for xx in (2.15, 4.75, 7.35, 9.85):
        perg.append(A.box((xx - 0.1, 10.55, 0.2, 0.2), 0.3, 3.0, "#333", "#444", "#333"))
    for xx in (2.15, 4.75, 7.35, 9.85):
        perg.append(A.box((xx - 0.06, 10.5, 0.12, 3.5), 2.9, 3.05, "#333", "#444", "#333"))
    perg.append(A.box((2, 10.55, 8, 0.12), 2.95, 3.1, "#333", "#444", "#333"))
    # uzum barglari
    for i in range(14):
        x = 2.4 + (i % 7) * 1.15
        y = 11.0 + (i // 7) * 1.6
        X, Y = A.p(x, y, 3.15)
        perg.append(E("ellipse", cx=X, cy=Y, rx=4.0, ry=2.1, fill="#6f9e3a", fill_opacity=0.82, stroke="#476b24", stroke_width=0.15))
    add(A.depth(6, 11), g(perg))
    # shiypon
    gx, gy, gw, gh = GAZEBO
    gz = [A.box((gx, gy, gw, gh), 0, 0.15, "#b98657", "#8d6038", "#9c6b42")]
    for (px, py) in ((gx, gy), (gx + gw - 0.2, gy), (gx, gy + gh - 0.2), (gx + gw - 0.2, gy + gh - 0.2)):
        gz.append(A.box((px, py, 0.2, 0.2), 0.15, 2.6, "#5a3d24", "#6d4a2c", "#5a3d24"))
    apex = (gx + gw / 2, gy + gh / 2, 4.0)
    c = [(gx - 0.3, gy - 0.3, 2.6), (gx + gw + 0.3, gy - 0.3, 2.6), (gx + gw + 0.3, gy + gh + 0.3, 2.6), (gx - 0.3, gy + gh + 0.3, 2.6)]
    gz.append(A.poly([c[0], c[1], apex], fill="#7b3f2b", stroke="#3a3a3a", stroke_width=0.2))
    gz.append(A.poly([c[1], c[2], apex], fill="#5f2f20", stroke="#3a3a3a", stroke_width=0.2))
    add(A.depth(gx + gw / 2, gy + gh / 2) + 1, g(gz))
    add(A.depth(18.5, 6.7), A.box(BBQ, 0, 1.0, "#7d3a28", "#a2513a", "#8f4532"))
    add(A.depth(18.0, 7.6), A.box((18.2, 6.3, 0.6, 0.6), 1.0, 2.4, "#555", "#777", "#666"))
    # pushtalar
    for b in VEG_BEDS:
        add(A.depth(b[0] + b[2] / 2, b[1] + b[3] / 2), A.box(b, 0, 0.4, "#6b4f32", "#9c6b3e", "#87592f"))
    # bolalar maydonchasi
    sw = [A.box((2.2, 3.5, 0.12, 0.12), 0, 2.2, "#333", "#444", "#333"),
          A.box((4.4, 3.5, 0.12, 0.12), 0, 2.2, "#333", "#444", "#333"),
          A.box((2.2, 3.5, 2.3, 0.12), 2.2, 2.3, "#333", "#444", "#333"),
          A.box((1.3, 1.3, 1.6, 1.6), 0, 0.25, "#f2e5bf", "#a77a52", "#8d6038")]
    add(A.depth(3, 3), g(sw))
    # devor (to'siq) — shaffof
    fence = []
    for seg in (((0, 0), (0, PLOT_H)), ((0, PLOT_H), (PLOT_W, PLOT_H))):
        (x1, y1), (x2, y2) = seg
        fence.append(A.poly([(x1, y1, 0), (x2, y2, 0), (x2, y2, 2.0), (x1, y1, 2.0)], fill="#d8d2c6", fill_opacity=0.35,
                            stroke="#8a8174", stroke_width=0.2))
    # daraxtlar
    for code, x, y in PLANTS:
        name, lat, size, d, kind, price = SPECIES[code]
        fill, stroke = PLANT_STYLE[kind]
        heights = {"1": 5.0, "2": 4.0, "3": 4.5, "4": 3.5, "5": 2.2, "6": 4.0, "7": 3.2, "8": 4.0, "9": 3.4,
                   "11": 2.2, "12": 2.6, "17": 1.6, "18": 0.3}
        h = heights.get(code, 0.6 if kind != "hedge" else 0.4)
        sh = []
        X0, Y0 = A.p(x, y, 0)
        if d >= 2:
            sh.append(E("ellipse", cx=X0 + 1.5, cy=Y0 + 0.5, rx=d / 2 * A.s * 1.0, ry=d / 2 * A.s * 0.5, fill="#000", opacity=0.15))
        if kind == "conifer" and code in ("7", "11", "12"):
            Xt, Yt = A.p(x, y, h)
            w = d / 2 * A.s * (1.0 if code == "7" else 0.9)
            sh.append(E("polygon", points=f"{f(X0 - w)},{f(Y0)} {f(X0 + w)},{f(Y0)} {f(Xt)},{f(Yt)}", fill=fill, stroke=stroke, stroke_width=0.2))
        elif d >= 2:
            Xc, Yc = A.p(x, y, h - d / 4)
            sh.append(line(X0, Y0, Xc, Yc + 1, stroke="#5a3d24", stroke_width=0.9))
            sh.append(E("circle", cx=Xc, cy=Yc, r=d / 2 * A.s * 0.82, fill=fill, fill_opacity=0.92, stroke=stroke, stroke_width=0.25))
            sh.append(E("circle", cx=Xc - 1.2, cy=Yc - 1.2, r=d / 2 * A.s * 0.4, fill="#fff", fill_opacity=0.15))
        else:
            Xc, Yc = A.p(x, y, h / 2)
            sh.append(E("ellipse", cx=Xc, cy=Yc, rx=max(d, 0.35) / 2 * A.s, ry=max(d, 0.35) / 2 * A.s * 0.75 + h * 0.6,
                        fill=fill, stroke=stroke, stroke_width=0.15))
        add(A.depth(x, y), g(sh))
    for dpt, svg in sorted(objs, key=lambda t: t[0]):
        o.append(svg)
    o.insert(1, g(fence))
    # mashina sxemasi
    o.append(T(20 + 10, 18, "AKSONOMETRIK KO'RINISH (shimoli-sharqdan)", size=5, weight="bold"))
    o.append(T(30, 24.5, "Hajmiy-fazoviy yechim. Masshtabsiz, illyustrativ.", size=3, fill="#555"))
    nts, _ = notes(290, 40, "Izoh", [
        "Ko'rinish orqa hovli tomonidan: oldingi planda shiypon va mangal, markazda maysazor va "
        "qadamli toshlar, orqada terrasa ishkomi va uy.",
        "Daraxtlar 5–7 yildan keyingi holatda ko'rsatilgan.",
        "To'siq (devor) shartli ravishda yarim shaffof ko'rsatilgan.",
    ], width_chars=52)
    o.append(nts)
    return sheet("Aksonometriya. Hajmiy-fazoviy yechim", "—", g(o))


def sheet_layout():
    P = Plan(40, 30)
    o = [ghost_plan(P)]
    st = dict(fill="none", stroke="#1d1d1b", stroke_width=0.45)
    for r in (DRIVEWAY, FRONT_PATH, SIDE_PATH, PAD, GRAVEL, TERRACE, KIDS, GAZEBO, BBQ, BACK_LAWN, LAWN_L, LAWN_R,
              ROSE_BED, MIX_BED) + tuple(VEG_BEDS):
        o.append(P.rect(r, **st))
    o.append(P.circle(*ROUND_BED, **st))
    o.append(P.rect(HOUSE, fill="url(#pHatchLight)", stroke="#1d1d1b", stroke_width=0.6))
    # tayanch nuqtasi
    X0, Y0 = P.p(0, 30)
    o.append(E("circle", cx=X0, cy=Y0, r=1.6, fill="#c0392b"))
    o.append(T(X0 - 2, Y0 + 5, "T0 (0,00; 0,00)", size=2.3, fill="#c0392b", weight="bold"))
    # o'lchamlar
    o.append(dim_h(P, 0, 20, 0, off=-6, text="20,00"))
    o.append(dim_h(P, 0, 6, 30, off=7))
    o.append(dim_h(P, 6, 7.5, 30, off=7, text="1,5"))
    o.append(dim_h(P, 7.5, 14.5, 30, off=7))
    o.append(dim_h(P, 14.5, 19, 30, off=7))
    o.append(dim_h(P, 19, 20, 30, off=7, text="1,0"))
    o.append(dim_h(P, 0, 0.8, 0, off=-2, text=""))
    o.append(dim_h(P, 0.8, 4.8, 4.8, off=2.5))
    o.append(dim_h(P, 13.5, 19.5, 0.5, off=-2.5))
    o.append(dim_h(P, 2, 10, 14, off=-3))
    o.append(dim_h(P, 15.6, 19.0, 14.1, off=2.5))
    o.append(dim_v(P, 0, 30, 20, off=12, text="30,00"))
    o.append(dim_v(P, 0.5, 8, 20, off=6))
    o.append(dim_v(P, 8, 18, 20, off=6))
    o.append(dim_v(P, 18, 30, 20, off=6))
    o.append(dim_v(P, 10.5, 14, 0, off=-4))
    o.append(dim_v(P, 0.8, 4.8, 0, off=-4))
    o.append(dim_v(P, 24, 25.5, 0, off=-4, text="1,5"))
    o.append(dim_v(P, 25.5, 30, 0, off=-4))
    # radius
    Xc, Yc = P.p(ROUND_BED[0], ROUND_BED[1])
    o.append(line(Xc, Yc, Xc + ROUND_BED[2] * P.k * 0.707, Yc - ROUND_BED[2] * P.k * 0.707, stroke_width=0.2, marker_end="url(#mArrow)"))
    o.append(T(Xc + 2, Yc - 4.5, "R1,30", size=2.2))
    o.append(E("circle", cx=Xc, cy=Yc, r=0.5, fill="#1d1d1b"))
    # koordinatalar jadvali
    pts = [
        ("1", "Avtoturargoh burchagi", DRIVEWAY[0], DRIVEWAY[1]),
        ("2", "Kirish yo'lagi o'qi", 6.75, 30),
        ("3", "Yon yo'lak boshlanishi", SIDE_PATH[0], SIDE_PATH[1]),
        ("4", "Shiypon maydoni burchagi", PAD[0], PAD[1]),
        ("5", "Shiypon burchagi", GAZEBO[0], GAZEBO[1]),
        ("6", "Mangal burchagi", BBQ[0], BBQ[1]),
        ("7", "Terrasa burchagi", TERRACE[0], TERRACE[1]),
        ("8", "Bolalar maydonchasi burchagi", KIDS[0], KIDS[1]),
        ("9", "Dumaloq gulzor markazi", ROUND_BED[0], ROUND_BED[1]),
        ("10", "Pushtalar burchagi", VEG_BEDS[0][0], VEG_BEDS[0][1]),
        ("11", "Qadamli tosh — boshi", STONES[0][0], STONES[0][1]),
        ("12", "Qadamli tosh — oxiri", STONES[6][0], STONES[6][1]),
    ]
    rows = []
    for n, name, x, y in pts:
        X, Y = P.p(x, y)
        o.append(E("circle", cx=X, cy=Y, r=0.8, fill="#c0392b"))
        o.append(T(X + 1.2, Y - 1.0, n, size=2.3, weight="bold", fill="#c0392b"))
        rows.append((n, name, num(x, 2), num(PLOT_H - y, 2)))
    o.append(T(200, 22, "Rejalashtirish (razbivka) chizmasi", size=4, weight="bold"))
    tb, yb = table(200, 30, [("№", 10, "c"), ("Nuqta", 70, "l"), ("X, m", 22, "r"), ("Y, m", 22, "r")], rows, rh=5.2, size=2.5)
    o.append(T(200, 28, "Asosiy nuqtalar koordinatalari (T0 dan)", size=3, weight="bold"))
    o.append(tb)
    nts, _ = notes(200, yb + 10, "Rejalashtirish bo'yicha ko'rsatmalar", [
        "Koordinatalar boshi T0 — uchastkaning janubi-g'arbiy burchagi (ko'cha va g'arbiy chegara kesishishi). "
        "X o'qi — sharqqa, Y o'qi — shimolga.",
        "Rejalashtirish uy devorlaridan va to'siqdan teodolit/ruletka yordamida bajariladi; to'g'ri burchaklar "
        "3–4–5 usulida tekshiriladi.",
        "Ruxsat etilgan og'ish: qoplamalar chegarasi ±20 mm, KMSh ±10 mm, daraxt ekish joyi ±100 mm.",
        "Yoysimon elementlar (dumaloq gulzor, qadamli toshlar) markaz va radius bo'yicha shnur bilan belgilanadi.",
        "Rejalashtirish nuqtalari ish tugaguncha yog'och qoziqlar bilan mahkamlanadi.",
    ], width_chars=96)
    o.append(nts)
    o.append(north_arrow(185, 30))
    o.append(scale_bar(40, 260, P.k))
    return sheet("Rejalashtirish (razbivka) chizmasi", "1:150", g(o))


def sheet_grading():
    P = Plan(40, 30)
    o = [ghost_plan(P)]
    # loyiha balandliklari
    marks = [
        (2.0, 14.0, "450,75"), (13.0, 14.0, "450,72"), (2.0, 24.0, "450,45"), (13.0, 24.0, "450,42"),
        (0.8, 0.8, "450,70"), (13.0, 0.8, "450,66"), (0.8, 9.7, "450,62"), (13.0, 9.7, "450,58"),
        (2.0, 10.5, "450,90*"), (10.0, 10.5, "450,90*"), (13.5, 0.5, "450,66"), (19.5, 8.0, "450,58"),
        (14.5, 18.0, "450,38"), (19.0, 18.0, "450,36"), (14.5, 29.8, "450,08"), (19.0, 29.8, "450,06"),
        (6.0, 25.5, "450,42"), (7.5, 29.8, "450,12"), (0.6, 29.3, "450,15"), (13.4, 29.3, "450,14"),
        (17.5, 3.0, "450,68*"),
    ]
    for x, y, v in marks:
        X, Y = P.p(x, y)
        o.append(E("polygon", points=f"{f(X)},{f(Y)} {f(X - 1)},{f(Y - 1.6)} {f(X + 1)},{f(Y - 1.6)}", fill="#c0392b"))
        o.append(T(X + 1.4, Y - 1.8, v, size=2.0, fill="#c0392b", weight="bold"))
    # qiyalik strelkalari
    slopes = [((6.5, 3.5), (6.5, 8.0), "8‰"), ((10.5, 2.5), (11.5, 8.5), "10‰"), ((3, 11.5), (3, 9.9), "terrasa"),
              ((16.75, 19.5), (16.75, 28.5), "25‰"), ((6.75, 26.0), (6.75, 29.0), "20‰"),
              ((13.75, 9.0), (13.75, 17.0), "15‰"), ((16.5, 6.8), (16.5, 7.9), "15‰"), ((3.0, 26), (3.0, 28.8), "20‰"),
              ((11, 26), (11, 28.8), "20‰")]
    for (a, b, t) in slopes:
        if t == "terrasa":
            continue
        o.append(P.line(*a, *b, stroke="#2b6cb0", stroke_width=0.45, marker_end="url(#mBlueArrow)"))
        X, Y = P.p((a[0] + b[0]) / 2, (a[1] + b[1]) / 2)
        o.append(T(X + 1.2, Y, t, size=2.1, fill="#2b6cb0", weight="bold"))
    # drenaj
    drains = [[(2.0, 10.3), (10.0, 10.3), (13.0, 10.3)], [(14.5, 29.4), (19.0, 29.4)], [(13.5, 8.1), (19.4, 8.1)]]
    for d in drains:
        o.append(P.poly(d, close=False, fill="none", stroke="#2b6cb0", stroke_width=1.0))
        o.append(P.poly(d, close=False, fill="none", stroke="#fff", stroke_width=0.35, stroke_dasharray="0.6,0.6"))
    pipes = [[(13.0, 10.3), (13.5, 10.3), (13.5, 18.0), (13.6, 23.6)], [(16.5, 8.1), (16.5, 8.6), (14.4, 9.0), (13.5, 10.3)]]
    for pp in pipes:
        o.append(P.poly(pp, close=False, fill="none", stroke="#2b6cb0", stroke_width=0.4, stroke_dasharray="1.6,0.6"))
    for wx, wy in ((13.6, 23.6), (16.75, 29.4)):
        X, Y = P.p(wx, wy)
        o.append(E("circle", cx=X, cy=Y, r=1.8, fill="#fff", stroke="#2b6cb0", stroke_width=0.45))
        o.append(E("circle", cx=X, cy=Y, r=0.7, fill="#2b6cb0"))
    o.append(P.text(13.0, 23.0, "DQ-1", size=2.2, anchor="end", fill="#2b6cb0", weight="bold"))
    o.append(P.text(16.75, 28.6, "DQ-2", size=2.2, anchor="middle", fill="#2b6cb0", weight="bold"))
    o.append(P.text(6.0, 9.9, "Chiziqli lotok L1, 11 m", size=2.1, anchor="middle", fill="#2b6cb0"))
    o.append(P.text(16.5, 7.6, "L2, 6 m", size=2.1, anchor="middle", fill="#2b6cb0"))
    o.append(P.text(16.75, 31.1, "L3 darvoza lotogi, 4,5 m", size=2.1, anchor="middle", fill="#2b6cb0"))
    o.append(north_arrow(185, 30))
    o.append(scale_bar(40, 260, P.k))
    o.append(T(200, 22, "Vertikal rejalashtirish va yomg'ir suvi drenaji", size=4, weight="bold"))
    o.append(legend(200, 30, [
        (lambda X, Y, w, h: g([E("polygon", points=f"{f(X + 3)},{f(Y + 4)} {f(X + 2)},{f(Y + 2.4)} {f(X + 4)},{f(Y + 2.4)}", fill="#c0392b"),
                               T(X + 5, Y + 2.4, "450,58", size=2, fill="#c0392b")]), "Loyiha belgisi (* — qoplama usti)"),
        (lambda X, Y, w, h: line(X, Y + h / 2, X + w, Y + h / 2, stroke="#2b6cb0", stroke_width=0.45, marker_end="url(#mBlueArrow)"), "Nishablik yo'nalishi va qiymati, ‰"),
        (lambda X, Y, w, h: g([line(X, Y + h / 2, X + w, Y + h / 2, stroke="#2b6cb0", stroke_width=1.0),
                               line(X, Y + h / 2, X + w, Y + h / 2, stroke="#fff", stroke_width=0.35, stroke_dasharray="0.6,0.6")]), "Chiziqli lotok DN100, panjarasi bilan"),
        (sw_line("#2b6cb0", "1.6,0.6", 0.4), "PVX quvur Ø110, nishab ≥ 1 %"),
        (lambda X, Y, w, h: g([E("circle", cx=X + w / 2, cy=Y + h / 2, r=1.8, fill="#fff", stroke="#2b6cb0", stroke_width=0.45),
                               E("circle", cx=X + w / 2, cy=Y + h / 2, r=0.7, fill="#2b6cb0")]), "Drenaj (singdiruvchi) qudug'i"),
    ]))
    rows = [("1", "Chiziqli lotok L1 (terrasa orqasi)", "m", "11,0"), ("2", "Chiziqli lotok L2 (shiypon maydoni)", "m", "6,0"),
            ("3", "Darvoza lotogi L3, kuchaytirilgan (C250)", "m", "4,5"),
            ("4", "PVX quvur Ø110 (qizil, kanalizatsiya)", "m", num(polylen(pipes[0]) + polylen(pipes[1]))),
            ("5", "Singdiruvchi quduq Ø1000, H=2,0 m", "dona", "2"), ("6", "Geotekstil 200 g/m²", "m²", "24")]
    tb, yb = table(200, 80, [("№", 9, "c"), ("Element", 105, "l"), ("O'lch.", 15, "c"), ("Miqdor", 20, "r")], rows, rh=5.2)
    o.append(T(200, 78, "Drenaj elementlari", size=3, weight="bold"))
    o.append(tb)
    nts, _ = notes(200, yb + 10, "Ko'rsatmalar", [
        "Uy atrofida sirt suvini qaytarish uchun 1,0 m kenglikda uydan tashqariga kamida 2 % qiyalik beriladi.",
        "Shimoldan oqib keladigan suv terrasa orqasidagi L1 lotok bilan ushlanib, quvur orqali DQ-1 quduqqa "
        "yo'naltiriladi. Darvoza oldidagi suv L3 orqali DQ-2 ga tushadi; ko'chaga chiqarish taqiqlanadi.",
        "Maysazorning nishabligi 0,8–1 %, qattiq qoplamalar 1,5–2,5 %. Teskari nishab va ko'lmaklarga yo'l qo'yilmaydi.",
        "Terrasa ustki sathi uyning ±0,000 belgisidan 0,15 m (bir pog'ona) past; shiypon poli maydon sathidan 0,02 m baland.",
        "Gruntni zichlash K=0,95; unumdor tuproq qatlami maysa ostida 15 sm, gulzor ostida 30–40 sm.",
        "Yer ishlari hajmi (taxminiy): qazish 38 m³, to'kish 22 m³, unumdor tuproq keltirish 31 m³.",
    ], width_chars=96)
    o.append(nts)
    return sheet("Vertikal rejalashtirish. Drenaj", "1:150", g(o))


PAVING = [
    ("P1", "url(#pBrick)", "Beton brusschatka 200×100×80, kulrang (avtoturargoh)", lambda: area(DRIVEWAY)),
    ("P2", "url(#pTile)", "Vibropressli plitka 300×300×60, qum rangi (yo'lkalar)", lambda: PATH_AREA),
    ("P3", "url(#pStone)", "Travertin plita 600×400×30, eskirtirilgan (shiypon maydoni)", lambda: area(PAD)),
    ("P4", "url(#pDeck)", "DPK (WPC) deking taxtasi 150×25 mm, yong'oq rangi (terrasa)", lambda: area(TERRACE)),
    ("P5", "url(#pGravel)", "Dekorativ shag'al 10–20 mm, 50 mm qatlam (pushtalar oralig'i)", lambda: GRAVEL_AREA),
    ("P6", "url(#pRubber)", "Rezina qoplama 20 mm, EPDM (bolalar maydonchasi)", lambda: area(KIDS)),
    ("P7", "#bfb7ab", "Granit, olovli ishlov, 30 mm (kirish zinapoyasi)", lambda: area(PORCH)),
    ("P8", "#cfc6b6", "Qadamli toshlar — qumtosh 600×400×40", lambda: len(STONES)),
]


def sheet_paving():
    P = Plan(40, 30)
    o = [layer_plot(P)]
    o.append(P.rect(HOUSE, fill="url(#pHatchLight)", stroke="#1d1d1b", stroke_width=0.5))
    o.append(g(layer_softscape(P, True), opacity=0.35))
    o.append(layer_hardscape(P, True))
    o.append(layer_house(P, True))
    tags = {"P1": (16.75, 21.0), "P2": (13.75, 13.0), "P3": (16.5, 6.0), "P4": (6.0, 12.3), "P5": (17.2, 14.3),
            "P6": (2.8, 4.2), "P7": (6.75, 24.75), "P8": (11.4, 7.6)}
    for code, (x, y) in tags.items():
        X, Y = P.p(x, y)
        o.append(rect(X - 3.3, Y - 2.4, 6.6, 4.2, fill="#fff", stroke="#1d1d1b", stroke_width=0.3, rx=0.6))
        o.append(T(X, Y + 0.8, code, size=2.6, anchor="middle", weight="bold"))
    # bordyurlar
    for r in (DRIVEWAY,):
        o.append(P.rect(r, fill="none", stroke="#c0392b", stroke_width=0.7))
    for r in (FRONT_PATH, SIDE_PATH, PAD):
        o.append(P.rect(r, fill="none", stroke="#d35400", stroke_width=0.45))
    for r in (ROSE_BED, MIX_BED, TERRACE_BED, STREET_BED_L, STREET_BED_R):
        o.append(P.rect(r, fill="none", stroke="#16a085", stroke_width=0.35, stroke_dasharray="1.2,0.5"))
    o.append(P.circle(*ROUND_BED, fill="none", stroke="#16a085", stroke_width=0.35, stroke_dasharray="1.2,0.5"))
    o.append(north_arrow(185, 30))
    o.append(scale_bar(40, 260, P.k))
    o.append(T(200, 22, "Qoplamalar rejasi va qaydnomasi", size=4, weight="bold"))
    rows = []
    for code, fill, name, q in PAVING:
        rows.append(((lambda c: (lambda X, Y, w, h: rect(X + 2, Y + 0.8, w - 4, h - 1.6, fill=c, stroke="#555", stroke_width=0.2)))(fill),
                    code, name, "dona" if code == "P8" else "m²", num(q()) if code != "P8" else str(q()), "L-09"))
    curb = 2 * DRIVEWAY[3] + DRIVEWAY[2]
    garden = 2 * FRONT_PATH[3] + 2 * SIDE_PATH[3] + 2 * (PAD[2] + PAD[3])
    edge = 2 * sum(r[2] + r[3] for r in (ROSE_BED, MIX_BED, TERRACE_BED, STREET_BED_L, STREET_BED_R)) + 2 * math.pi * ROUND_BED[2]
    blank = lambda c, dash=None, wd=0.6: (lambda X, Y, w, h: line(X + 2, Y + h / 2, X + w - 2, Y + h / 2, stroke=c, stroke_width=wd, stroke_dasharray=dash))
    rows += [(blank("#c0392b", None, 0.8), "B1", "Yo'l bordyuri BR 100.30.15", "m", num(curb), "L-09"),
             (blank("#d35400", None, 0.5), "B2", "Bog' bordyuri BR 100.20.8", "m", num(garden), "L-09"),
             (blank("#16a085", "1.2,0.5", 0.4), "B3", "Po'lat chegaralagich 100×2 mm (gulzor/maysa)", "m", num(edge), "L-09")]
    tb, yb = table(200, 30, [("", 14, "c"), ("Kod", 11, "c"), ("Nomi", 120, "l"), ("O'lch.", 13, "c"), ("Miqdor", 17, "r"),
                             ("Tugun", 15, "c")], rows, rh=6.2, size=2.45)
    o.append(tb)
    nts, _ = notes(200, yb + 10, "Ko'rsatmalar", [
        "Qoplama materiallari namunalari buyurtmachi bilan kelishilgandan so'ng xarid qilinadi; partiya "
        "rangi bir xil bo'lishi uchun bitta partiyadan olinadi (+7 % zaxira).",
        "Brusschatka «yolka» (45°) naqshida, plitka to'g'ri qatorlarda, travertin — «Rim naqshi»da teriladi.",
        "Choklar quruq qum-sement aralashmasi bilan to'ldiriladi, vibroplita bilan zichlanadi.",
        "Deking taxtalari terrasa uzunligi bo'ylab, 5 mm oraliq bilan, yashirin qisqichlarda mahkamlanadi.",
        "Qadamli toshlar orasidagi masofa 0,75 m (o'qlar bo'yicha), maysa sathidan 10 mm past o'rnatiladi.",
    ], width_chars=96)
    o.append(nts)
    return sheet("Qoplamalar rejasi", "1:150", g(o))


def layers_section(x, y, layers, width=70, scale=2.0, title="", note=None):
    """Qatlamli konstruksiya kesimi. layers: [(qalinlik mm, fill, matn)] yuqoridan pastga."""
    o = [T(x, y - 4, title, size=3.0, weight="bold")]
    yy = y
    for th, fill, label in layers:
        h = max(th / 10 * scale * 0.5, 2.0)
        o.append(rect(x, yy, width, h, fill=fill, stroke="#1d1d1b", stroke_width=0.25))
        o.append(line(x + width, yy + h / 2, x + width + 6, yy + h / 2, stroke_width=0.15))
        o.append(T(x + width + 7, yy + h / 2 + 0.9, f"{label}" + (f" — {th} mm" if th else ""), size=2.25))
        yy += h
    o.append(rect(x, yy, width, 5, fill="url(#pEarth)", stroke="none"))
    o.append(line(x, yy, x + width, yy, stroke_width=0.25))
    o.append(T(x + width + 7, yy + 3, "Zichlangan grunt, K≥0,95", size=2.25))
    if note:
        o.append(T(x, yy + 9, note, size=2.1, fill="#555"))
    return g(o)


def sheet_details():
    o = [T(30, 18, "Qoplama konstruksiyalari va tugunlar", size=5, weight="bold")]
    o.append(layers_section(30, 35, [
        (80, "url(#pBrick)", "Beton brusschatka (P1)"), (40, "url(#pSand)", "Qum-sement aralashmasi 1:6"),
        (200, "url(#pCrushed)", "Chaqiq tosh fr. 20–40, qatlamlab zichlash"), (100, "url(#pSand)", "Qum qatlami"),
        (0, "#6d8bb0", "Geotekstil 200 g/m²")], title="Tugun 1. Avtoturargoh qoplamasi (P1)",
        note="Umumiy qalinlik 420 mm. Nishablik 2,5 %, yuklama — yengil avtomobil."))
    o.append(layers_section(30, 105, [
        (60, "url(#pTile)", "Vibropressli plitka (P2)"), (30, "url(#pSand)", "Qum-sement aralashmasi 1:6"),
        (150, "url(#pCrushed)", "Chaqiq tosh fr. 5–20"), (0, "#6d8bb0", "Geotekstil 150 g/m²")],
        title="Tugun 2. Piyodalar yo'lkasi (P2)", note="Umumiy qalinlik 240 mm. Nishablik 1,5–2 %."))
    o.append(layers_section(30, 165, [
        (30, "url(#pStone)", "Travertin plita (P3)"), (20, "#d9d9d9", "Plitka yelimi C2TE S1"),
        (100, "url(#pConcrete)", "Beton B15, Ø5 Bp-I to'r 150×150"), (150, "url(#pCrushed)", "Chaqiq tosh fr. 20–40")],
        title="Tugun 3. Shiypon maydoni (P3)", note="Har 3 m da deformatsiya choki 10 mm, germetik bilan."))
    # Tugun 4 — bordyur, M 1:10 (1 mm = 0.1 mm)
    s = 0.1
    bx, by = 215, 35
    o.append(T(bx, by - 4, "Tugun 4. Bordyur B1 (avto/maysa chegarasi)", size=3.0, weight="bold"))
    gl = by + 14
    cx0 = bx + 45                      # bordyur chap qirrasi
    o.append(rect(bx, gl, 100, 40, fill="url(#pEarth)", stroke="none"))
    # P1 qatlamlari (chapda)
    o.append(rect(bx, gl, 45, 80 * s, fill="url(#pBrick)", stroke="#1d1d1b", stroke_width=0.2))
    o.append(rect(bx, gl + 8, 45, 40 * s, fill="url(#pSand)", stroke="#1d1d1b", stroke_width=0.2))
    o.append(rect(bx, gl + 12, 45, 200 * s, fill="url(#pCrushed)", stroke="#1d1d1b", stroke_width=0.2))
    # beton tovon
    o.append(E("polygon", points=f"{f(cx0 - 8)},{f(gl + 32)} {f(cx0 + 23)},{f(gl + 32)} {f(cx0 + 23)},{f(gl + 14)} "
               f"{f(cx0 + 15)},{f(gl + 14)} {f(cx0 + 15)},{f(gl + 22)} {f(cx0)},{f(gl + 22)} {f(cx0)},{f(gl + 12)} {f(cx0 - 8)},{f(gl + 32)}",
               fill="url(#pConcrete)", stroke="#1d1d1b", stroke_width=0.25))
    # bordyur 150x300
    o.append(rect(cx0, gl - 8, 150 * s, 300 * s, fill="#d4d6d6", stroke="#1d1d1b", stroke_width=0.4))
    # maysa (o'ngda)
    o.append(rect(cx0 + 15, gl - 6, 40, 15 * s * 10 * 0.4, fill="#7a5a3e", stroke="#1d1d1b", stroke_width=0.2))
    o.append(rect(cx0 + 15, gl - 8, 40, 2, fill="#a9d07c", stroke="#1d1d1b", stroke_width=0.2))
    for txt, x_, y_ in (("BR 100.30.15", cx0 + 7.5, gl - 10), ("P1", bx + 2, gl - 1.5), ("Maysa", cx0 + 30, gl - 10)):
        o.append(T(x_, y_, txt, size=2.2, anchor="middle" if txt != "P1" else "start", weight="bold"))
    o.append(line(cx0 + 20, gl + 26, cx0 + 32, gl + 34, stroke_width=0.15))
    o.append(T(cx0 + 33, gl + 35, "Beton B15 «tovon»", size=2.2))
    o.append(line(cx0 + 15, gl - 8, cx0 + 15, gl - 22, stroke_width=0.15))
    o.append(line(cx0 + 15, gl - 22, cx0 + 23, gl - 22, stroke_width=0.15))
    o.append(T(cx0 + 24, gl - 21.3, "+0,00 qoplama bilan bir tekisda", size=2.0))
    o.append(T(bx, gl + 46, "B2 (100×200×80) — xuddi shunday, tovon 100 mm; maysadan 20 mm baland.", size=2.1, fill="#555"))
    # Tugun 5 — chegaralagich
    cx, cy = 330, 35
    o.append(T(cx, cy - 4, "Tugun 5. Po'lat chegaralagich (B3)", size=3.0, weight="bold"))
    gl = cy + 14
    o.append(rect(cx, gl, 70, 30, fill="url(#pEarth)", stroke="none"))
    o.append(rect(cx, gl - 2, 34, 2, fill="#a9d07c", stroke="#1d1d1b", stroke_width=0.2))
    o.append(rect(cx + 35, gl - 5, 35, 5, fill="#7a5a3e", stroke="#1d1d1b", stroke_width=0.2))
    o.append(rect(cx + 34, gl - 4, 1.0, 14, fill="#4d4d4d"))
    o.append(rect(cx + 33.3, gl + 6, 2.4, 14, fill="#777"))
    o.append(T(cx + 2, gl - 4, "Maysa", size=2.2))
    o.append(T(cx + 37, gl - 7, "Mulcha 50 mm", size=2.2))
    o.append(T(cx, gl + 36, "Polosa 100×2 mm, qoziq L=300 har 1 m da.", size=2.1, fill="#555"))
    # Tugun 6 — deking
    dx, dy = 215, 112
    o.append(T(dx, dy - 4, "Tugun 6. Terrasa (P4) — DPK deking", size=3.0, weight="bold"))
    base = dy + 26
    W = 130
    o.append(rect(dx, base, W, 12, fill="url(#pEarth)", stroke="none"))
    o.append(rect(dx, base - 2, W, 2, fill="url(#pCrushed)", stroke="#1d1d1b", stroke_width=0.2))
    for i in range(4):
        px = dx + 12 + i * 35
        o.append(rect(px - 6, base - 2, 12, 10, fill="url(#pConcrete)", stroke="#1d1d1b", stroke_width=0.25))
        o.append(rect(px - 2.5, base - 8, 5, 6, fill="#888", stroke="#1d1d1b", stroke_width=0.2))
    o.append(rect(dx, base - 13, W, 5, fill="#9a9a9a", stroke="#1d1d1b", stroke_width=0.25))
    for i in range(26):
        o.append(rect(dx + i * 5, base - 16.5, 4.6, 3.5, fill="#b98657", stroke="#6b4a2c", stroke_width=0.2))
    for i, (t_, yy) in enumerate((("DPK taxta 150×25", base - 15), ("Lag DPK 50×40, qadam 300", base - 10.5),
                                  ("Rostlanuvchi tayanch", base - 5), ("Beton yostiq 300×300×200", base + 3))):
        o.append(line(dx + W, yy, dx + W + 5, yy, stroke_width=0.15))
        o.append(T(dx + W + 6, yy + 0.8, t_, size=2.1))
    o.append(T(dx, base + 17, "Tayanchlar qadami 600 mm. Lag ostiga 1 % nishab (uydan tashqariga), ventilyatsiya oralig'i ≥ 100 mm.", size=2.1, fill="#555"))
    # Tugun 7 — daraxt ekish
    tx, ty = 215, 172
    o.append(T(tx, ty - 4, "Tugun 7. Daraxt ekish chuquri (kom bilan), M 1:40", size=3.0, weight="bold"))
    gl = ty + 30
    pw = 40
    o.append(rect(tx, gl, 70, 30, fill="url(#pEarth)", stroke="none"))
    o.append(E("path", d=f"M{tx + 15},{gl} L{tx + 17},{gl + 25} L{tx + 53},{gl + 25} L{tx + 55},{gl} Z", fill="#8a6a49", stroke="#1d1d1b", stroke_width=0.25))
    o.append(E("ellipse", cx=tx + 35, cy=gl + 11, rx=10, ry=9, fill="#6b4f32", stroke="#1d1d1b", stroke_width=0.25))
    o.append(rect(tx + 34, gl - 18, 2, 21, fill="#6d4a2c"))
    o.append(E("circle", cx=tx + 35, cy=gl - 22, r=8, fill="#8cc063", fill_opacity=0.75, stroke="#4f7d32", stroke_width=0.25))
    for sx in (tx + 24, tx + 46):
        o.append(rect(sx - 0.7, gl - 16, 1.4, 34, fill="#c8a165", stroke="#8d6038", stroke_width=0.15))
        o.append(line(sx, gl - 12, tx + 35, gl - 10, stroke="#555", stroke_width=0.2))
    o.append(rect(tx + 17, gl - 1.5, 36, 1.5, fill="#a0784f"))
    o.append(E("path", d=f"M{tx + 15},{gl} q3,-3 6,0 M{tx + 49},{gl} q3,-3 6,0", fill="none", stroke="#1d1d1b", stroke_width=0.4))
    labels = [("Ustun-tirgak 2 dona, 50×50, L=2,0 m", gl - 13), ("Sug'orish valigi H=100", gl - 1.5),
              ("Mulcha 70 mm, Ø1,2 m", gl - 0.7), ("Kom — ekishdan oldin namlanadi", gl + 11),
              ("Aralashma 2:1:1 + 5 kg go'ng", gl + 21)]
    for i, (s_, yy) in enumerate(labels):
        ly = ty + 4 + i * 6.5
        o.append(line(tx + 56 if i else tx + 46, yy, tx + 72, ly - 0.8, stroke_width=0.15))
        o.append(T(tx + 73, ly, s_, size=2.1))
    o.append(T(tx, gl + 30, "Chuqur: kom Ø + 0,5 m, chuqurligi kom + 0,15 m; ildiz bo'g'zi yer sathida.", size=2.1, fill="#555"))
    return sheet("Qoplama konstruksiyalari. Tugunlar 1–7", "1:10", g(o))


def sheet_dendro():
    P = Plan(40, 30)
    o = [ghost_plan(P)]
    o.append(layer_plants(P, color=True, label=True, small_labels=True))
    o.append(north_arrow(185, 30))
    o.append(scale_bar(40, 260, P.k))
    o.append(T(200, 22, "Dendroplan. Daraxt va butalar qaydnomasi", size=4, weight="bold"))
    rows = ["Daraxtlar"]
    groups = [("Daraxtlar", ["1", "2", "3", "4", "5", "6", "7", "8", "9"]),
              ("Butalar va ignabarglilar", ["11", "12", "13", "14", "16", "17", "18", "19", "20"]),
              ("Gullar", ["15", "21"])]
    rows = []
    for gname, codes in groups:
        rows.append(gname)
        for c in codes:
            name, lat, size, d, kind, price = SPECIES[c]
            fill, stroke = PLANT_STYLE[kind]
            sym = (lambda fl, st: (lambda X, Y, w, h: E("circle", cx=X + w / 2, cy=Y + h / 2, r=1.7, fill=fl, stroke=st, stroke_width=0.25)))(fill, stroke)
            rows.append((sym, c, name, lat, size, str(plant_count(c))))
    tb, yb = table(200, 30, [("", 8, "c"), ("Kod", 9, "c"), ("Nomi", 34, "l"), ("Lotincha nomi", 72, "l"),
                             ("Ekish materiali", 47, "l"), ("Soni", 15, "r")], rows, rh=4.9, size=2.3)
    o.append(tb)
    nts, _ = notes(200, yb + 7, "Ekish bo'yicha ko'rsatmalar", [
        "Ekish muddatlari: ZKS (ochiq ildizli) ko'chatlar — mart 1–31 yoki oktyabr 20 – noyabr 20; konteynerli "
        "va komli o'simliklar — mart–may, sentyabr–noyabr.",
        "Daraxtlar uydan kamida 4 m, yer osti tarmoqlaridan 2 m, to'siqdan 1,5 m uzoqda; tuya to'sig'i "
        "to'siqdan 0,45 m.",
        "Ekishdan keyin har bir daraxt 40–60 l suv bilan sug'oriladi, tirgakka bog'lanadi, mulchalanadi.",
        "Mavjud o'rik (1) atrofida 3 m radiusda texnika harakati taqiqlanadi; quruq shoxlar kesiladi.",
    ], width_chars=100, size=2.35, lh=3.3)
    o.append(nts)
    return sheet("Dendroplan va assortiment qaydnomasi", "1:150", g(o))


def sheet_flowerbeds():
    o = [T(30, 18, "Gulzorlar sxemalari va maysa", size=5, weight="bold")]
    # 1 — Dumaloq gulzor M 1:25
    s = 40 / 1.3 / 2 * 1.0   # mm per m
    cx, cy = 85, 75
    k = 20.0
    o.append(T(30, 30, "Gulzor G-1 «Dumaloq» (orqa hovli), M 1:50", size=3.2, weight="bold"))
    o.append(E("circle", cx=cx, cy=cy, r=1.3 * k, fill="#9c7b5a", stroke="#6c5034", stroke_width=0.4))
    o.append(E("circle", cx=cx, cy=cy, r=1.3 * k + 0.6, fill="none", stroke="#16a085", stroke_width=0.5))
    for i in range(10):
        a = i * math.pi / 5
        o.append(E("circle", cx=cx + 1.0 * k * math.cos(a), cy=cy + 1.0 * k * math.sin(a), r=0.25 * k, fill="#a687d9", stroke="#5f3f99", stroke_width=0.25))
    for i in range(8):
        a = i * math.pi / 4 + 0.3
        o.append(E("circle", cx=cx + 0.68 * k * math.cos(a), cy=cy + 0.68 * k * math.sin(a), r=0.17 * k, fill="#f2b33d", stroke="#a87410", stroke_width=0.25))
    for a in (0, 2.1, 4.2):
        o.append(E("circle", cx=cx + 0.35 * k * math.cos(a), cy=cy + 0.35 * k * math.sin(a), r=0.3 * k, fill="#e24f5c", stroke="#97222d", stroke_width=0.25))
    o.append(T(cx, cy + 1.3 * k + 6, "Ø 2,60 m · 5,3 m²", size=2.4, anchor="middle"))
    leg1 = [("#e24f5c", "Atirgul 'Gloria Dei' — 3 dona (markaz)"), ("#f2b33d", "Rudbekiya / Exinatseya — 8 dona"),
            ("#a687d9", "Lavanda 'Hidcote' — 10 dona (halqa)")]
    for i, (c, t) in enumerate(leg1):
        o.append(E("circle", cx=128, cy=58 + i * 7, r=2, fill=c))
        o.append(T(132, 59 + i * 7, t, size=2.4))
    o.append(T(126, 84, "Gullash: may–oktyabr. Ranglar: qizil – sariq – binafsha.", size=2.3, fill="#555"))
    # 2 — Miksborder (oldi hovli), 3.1 × 0.9, M 1:25
    x0, y0, k2 = 30, 128, 22
    o.append(T(30, 120, "Gulzor G-2 «Miksborder» (uy oldi, chap), M 1:45", size=3.2, weight="bold"))
    o.append(rect(x0, y0, 3.1 * k2, 0.9 * k2, fill="#9c7b5a", stroke="#16a085", stroke_width=0.5))
    for i in range(6):
        o.append(E("circle", cx=x0 + (0.3 + i * 0.5) * k2, cy=y0 + 0.25 * k2, r=0.24 * k2, fill="#a687d9", stroke="#5f3f99", stroke_width=0.25))
    cols = ["#f2b33d", "#e76f8c", "#f2b33d", "#7c5ccf", "#e76f8c", "#f2b33d", "#7c5ccf"]
    for i in range(7):
        o.append(E("circle", cx=x0 + (0.25 + i * 0.44) * k2, cy=y0 + 0.65 * k2, r=0.2 * k2, fill=cols[i], stroke="#555", stroke_width=0.2))
    o.append(T(x0, y0 + 0.9 * k2 + 5, "3,10 × 0,90 m · 2,8 m²", size=2.4))
    leg2 = [("#a687d9", "Lavanda (old qator) — 6"), ("#f2b33d", "Rudbekiya 'Goldsturm' — 3"),
            ("#e76f8c", "Exinatseya purpurea — 2"), ("#7c5ccf", "Salviya nemoroza — 2"),
            ("#a03030", "+ Lilia (Hemerocallis) — 8, keyingi qatorda")]
    for i, (c, t) in enumerate(leg2):
        o.append(E("circle", cx=110, cy=y0 + 2 + i * 6.5, r=2, fill=c))
        o.append(T(114, y0 + 3 + i * 6.5, t, size=2.4))
    # 3 — atirgulzor
    x0, y0 = 30, 185
    o.append(T(30, 178, "Gulzor G-3 «Atirgulzor» (uy oldi, o'ng), M 1:45", size=3.2, weight="bold"))
    o.append(rect(x0, y0, 4.0 * k2, 0.9 * k2, fill="#9c7b5a", stroke="#16a085", stroke_width=0.5))
    rc = ["#e24f5c", "#f7f0e0", "#f19bb0", "#e24f5c", "#f7f0e0", "#f19bb0"]
    for i in range(6):
        o.append(E("circle", cx=x0 + (0.5 + i * 0.6) * k2, cy=y0 + 0.45 * k2, r=0.28 * k2, fill=rc[i], stroke="#97222d", stroke_width=0.25))
    o.append(T(x0, y0 + 0.9 * k2 + 5, "4,00 × 0,90 m · 3,6 m². Ostiga mulcha — qarag'ay po'stlog'i.", size=2.4))
    leg3 = [("#e24f5c", "'Black Baccara' (to'q qizil) — 2"), ("#f7f0e0", "'Pascali' (oq) — 2"), ("#f19bb0", "'Queen Elizabeth' (pushti) — 2")]
    for i, (c, t) in enumerate(leg3):
        o.append(E("circle", cx=125, cy=y0 + 2 + i * 6.5, r=2, fill=c, stroke="#97222d", stroke_width=0.2))
        o.append(T(129, y0 + 3 + i * 6.5, t, size=2.4))
    # Gullash kalendari
    months = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"]
    bloom = [("Atirgul", "#e24f5c", (5, 10)), ("Lavanda", "#a687d9", (6, 8)), ("Rudbekiya", "#f2b33d", (7, 10)),
             ("Exinatseya", "#e76f8c", (6, 9)), ("Salviya", "#7c5ccf", (5, 9)), ("Lilia", "#d9822b", (6, 8)),
             ("Qizil arg'uvon", "#d67fae", (4, 4)), ("Suriya gulxayrisi", "#b04f6a", (7, 9)),
             ("Spireya", "#f19bb0", (6, 7)), ("Barbaris (barg)", "#8e2a3c", (4, 11)), ("Ko'k qoraqarag'ay", "#3f7656", (1, 12))]
    gx, gy = 215, 30
    o.append(T(gx, gy - 3, "Gullash va dekorativlik kalendari", size=3.2, weight="bold"))
    cw = 12
    for i, m in enumerate(months):
        o.append(rect(gx + 45 + i * cw, gy, cw, 6, fill="#ecebe6", stroke="#1d1d1b", stroke_width=0.2))
        o.append(T(gx + 45 + i * cw + cw / 2, gy + 4.3, m, size=2.4, anchor="middle", weight="bold"))
    for j, (n, c, (a, b)) in enumerate(bloom):
        yy = gy + 6 + j * 6
        o.append(T(gx + 1, yy + 4.2, n, size=2.4))
        o.append(line(gx, yy + 6, gx + 45 + 12 * cw, yy + 6, stroke="#ddd", stroke_width=0.15))
        o.append(rect(gx + 45 + (a - 1) * cw + 1, yy + 1.2, (b - a + 1) * cw - 2, 3.6, fill=c, rx=1.5))
    # Maysa
    my = gy + 6 + len(bloom) * 6 + 14
    o.append(T(gx, my, "Rulonli maysa (M-1)", size=3.2, weight="bold"))
    o.append(layers_section(gx, my + 8, [
        (20, "url(#pLawn)", "Rulonli maysa (sport-dekorativ)"), (150, "#7a5a3e", "Unumdor tuproq + 2–3 kg/m² kompost"),
        (50, "url(#pSand)", "Qum (drenaj qatlami)")], width=60, title=""))
    rows = [("Aralashma", "Lolium perenne 40 %, Festuca rubra 30 %, Poa pratensis 30 %"),
            ("Maydoni", f"{num(LAWN_AREA)} m² (+5 % zaxira = {num(LAWN_AREA * 1.05)} m²)"),
            ("Yotqizish", "tayyorlangan, zichlangan va sug'orilgan yuzaga; choklar «g'isht» usulida"),
            ("Birinchi o'rim", "10–14 kundan keyin, balandligi 8 sm bo'lganda 5 sm gacha"),
            ("Sug'orish", "birinchi 2 hafta har kuni ertalab, keyin 2–3 kunda bir, 20–25 l/m²")]
    tb, _ = table(gx, my + 45, [("Parametr", 30, "l"), ("Qiymat", 160, "l")], rows, rh=5.5, size=2.35)
    o.append(tb)
    return sheet("Gulzorlar sxemalari. Maysa", "1:50", g(o))


def sheet_irrigation():
    P = Plan(40, 30)
    o = [ghost_with_trees(P)]
    zcol = {"Z1": "#2b6cb0", "Z2": "#0f8b8d", "Z3": "#8e44ad", "Z4": "#d35400"}
    # radiuslar
    cov = []
    for (x, y) in SPRAYS:
        cov.append(P.circle(x, y, 3.5, fill="#2b6cb0", fill_opacity=0.06, stroke="#2b6cb0", stroke_width=0.1, stroke_opacity=0.4))
    for (x, y) in ROTORS:
        cov.append(P.circle(x, y, 7.0, fill="#0f8b8d", fill_opacity=0.04, stroke="#0f8b8d", stroke_width=0.1, stroke_opacity=0.35))
    o.append(g(cov, clip_path="url(#cPlot)"))
    o.append(g(layer_plot(P), opacity=1))
    for z, pts in MAIN_LINES.items():
        o.append(P.poly(pts, close=False, fill="none", stroke=zcol[z], stroke_width=0.55))
    o.append(P.poly([WATER_IN, (16.2, 18.4), (14.3, 18.4), VALVE_BOX], close=False, fill="none", stroke="#1d1d1b", stroke_width=0.7))
    for dl in DRIP_LINES:
        z = "Z3" if dl[0][0] in (5.6, 19.55, 0.45, 5.75, 7.75) or (dl[0][1] in (29.6,) ) else "Z4"
        o.append(P.poly(dl, close=False, fill="none", stroke=zcol[z], stroke_width=0.35, stroke_dasharray="0.9,0.5"))
    for code, x, y in PLANTS:
        if SPECIES[code][3] >= 2.5:
            o.append(P.circle(x, y, 0.6, fill="none", stroke=zcol["Z4"], stroke_width=0.3, stroke_dasharray="0.9,0.5"))
    for (x, y) in SPRAYS:
        X, Y = P.p(x, y)
        o.append(E("circle", cx=X, cy=Y, r=1.1, fill="#fff", stroke="#2b6cb0", stroke_width=0.4))
        o.append(E("circle", cx=X, cy=Y, r=0.45, fill="#2b6cb0"))
    for (x, y) in ROTORS:
        X, Y = P.p(x, y)
        o.append(E("rect", x=X - 1.2, y=Y - 1.2, width=2.4, height=2.4, fill="#fff", stroke="#0f8b8d", stroke_width=0.45))
        o.append(E("circle", cx=X, cy=Y, r=0.55, fill="#0f8b8d"))
    X, Y = P.p(*VALVE_BOX)
    o.append(rect(X - 2.2, Y - 1.6, 4.4, 3.2, fill="#ffe08a", stroke="#1d1d1b", stroke_width=0.35))
    o.append(T(X + 3, Y + 4, "KQ — klapanlar qutisi (4 kl.)", size=2.0, weight="bold"))
    X, Y = P.p(*CONTROLLER)
    o.append(rect(X - 3.2, Y - 1.5, 3, 3, fill="#1d1d1b"))
    o.append(T(X - 4, Y + 0.8, "Kontroller", size=2.0, anchor="end", weight="bold"))
    X, Y = P.p(*WATER_IN)
    o.append(E("circle", cx=X, cy=Y, r=1.4, fill="#1d1d1b"))
    o.append(T(X + 2, Y + 4, "Suv kirishi, filtr, reduktor", size=2.0))
    for z, (x, y) in {"Z1": (4.0, 25.0), "Z2": (9.5, 9.5), "Z3": (19.0, 12.5), "Z4": (16.0, 14.8)}.items():
        X, Y = P.p(x, y)
        o.append(rect(X - 3.2, Y - 2.5, 6.4, 3.6, fill=zcol[z], rx=0.8))
        o.append(T(X, Y + 0.3, z, size=2.4, anchor="middle", fill="#fff", weight="bold"))
    o.append(north_arrow(185, 30))
    o.append(scale_bar(40, 260, P.k))
    o.append(T(200, 22, "Avtomatik sug'orish tizimi", size=4, weight="bold"))
    zrows = [
        ("Z1", "Oldi hovli maysasi", f"Purkagich 1800, sopla 12-VAN ({len(SPRAYS)} dona)", "0,8", "06:00", "15"),
        ("Z2", "Orqa hovli maysasi", f"Rotorli 5004, r=7 m ({len(ROTORS)} dona)", "1,2", "05:00", "35"),
        ("Z3", "Jonli to'siqlar", "Tomchilatgich chizig'i 16 mm, 2 l/s, 0,3 m", "0,4", "21:00", "45"),
        ("Z4", "Daraxtlar, gulzor, pushtalar", "Tomchilatgich chizig'i + halqalar", "0,5", "21:45", "40"),
    ]
    tb, yb = table(200, 30, [("Zona", 13, "c"), ("Vazifasi", 42, "l"), ("Jihozlar", 80, "l"), ("m³/s", 14, "r"),
                             ("Start", 15, "c"), ("min", 13, "r")], zrows, rh=5.5, size=2.35)
    o.append(T(200, 28, "Sug'orish zonalari (yoz rejimi)", size=3, weight="bold"))
    o.append(tb)
    leg = legend(200, yb + 8, [
        (lambda X, Y, w, h: g([E("circle", cx=X + w / 2, cy=Y + h / 2, r=1.1, fill="#fff", stroke="#2b6cb0", stroke_width=0.4), E("circle", cx=X + w / 2, cy=Y + h / 2, r=0.45, fill="#2b6cb0")]), "Purkagich (spray), r=3,5 m"),
        (lambda X, Y, w, h: g([rect(X + w / 2 - 1.2, Y + h / 2 - 1.2, 2.4, 2.4, fill="#fff", stroke="#0f8b8d", stroke_width=0.45), E("circle", cx=X + w / 2, cy=Y + h / 2, r=0.55, fill="#0f8b8d")]), "Rotorli purkagich, r=7 m"),
        (sw_line("#1d1d1b", None, 0.7), "Magistral PND Ø32 PN10"),
        (sw_line("#2b6cb0", None, 0.55), "Zona quvuri PND Ø25"),
        (sw_line("#d35400", "0.9,0.5", 0.35), "Tomchilatgich chizig'i Ø16"),
        (lambda X, Y, w, h: rect(X + 2, Y + 0.6, 4.4, 3.2, fill="#ffe08a", stroke="#1d1d1b", stroke_width=0.35), "Klapanlar qutisi (24V elektromagnit)"),
    ], rows_per_col=3, col_w=92)
    o.append(leg)
    nts, _ = notes(200, yb + 36, "Texnik talablar", [
        "Kirishdagi bosim 3,0–4,0 bar, sarf ≥ 1,5 m³/soat. Bosim yetarli bo'lmasa 1 m³ bak va 0,75 kVt nasos o'rnatiladi.",
        "Kontroller 4 zonali, Wi-Fi, yomg'ir datchigi bilan. Yozda har kuni, bahor/kuzda 2–3 kunda bir.",
        "Quvurlar 300–400 mm chuqurlikda, qoplamalar ostidan PVX g'ilof Ø63 ichida o'tkaziladi.",
        "Qishga tayyorlash: noyabr oxirida tizim kompressor bilan puflab bo'shatiladi; mart oxirida ishga tushiriladi.",
        f"Uzunliklar: magistral va zona quvurlari ≈ {num(PIPE_LEN, 0)} m; tomchilatgich chizig'i ≈ {num(DRIP_LEN, 0)} m.",
    ], width_chars=100)
    o.append(nts)
    return sheet("Avtomatik sug'orish tizimi", "1:150", g(o))


def sheet_lighting():
    P = Plan(40, 30)
    o = [ghost_with_trees(P)]
    for c in CABLES:
        o.append(P.poly(c, close=False, fill="none", stroke="#c0392b", stroke_width=0.4, stroke_dasharray="1.8,0.6"))
    o.append(P.poly([(2.0, 10.5), (10.0, 10.5), (10.0, 14.0)], close=False, fill="none", stroke="#f39c12", stroke_width=0.35, stroke_dasharray="0.3,0.6"))
    o.append(P.rect((GAZEBO[0] + 0.3, GAZEBO[1] + 0.3, GAZEBO[2] - 0.6, GAZEBO[3] - 0.6), fill="none", stroke="#f39c12", stroke_width=0.35, stroke_dasharray="0.3,0.6"))
    for (x, y) in BOLLARDS:
        X, Y = P.p(x, y)
        o.append(E("circle", cx=X, cy=Y, r=5, fill="#f7dc6f", fill_opacity=0.25))
        o.append(E("circle", cx=X, cy=Y, r=1.2, fill="#1d1d1b"))
        o.append(E("circle", cx=X, cy=Y, r=0.5, fill="#f7dc6f"))
    for (x, y) in SPOTS:
        X, Y = P.p(x, y)
        o.append(E("path", d=f"M{f(X)},{f(Y)} l6,-3 l0,6 z", fill="#f7dc6f", fill_opacity=0.5))
        o.append(E("polygon", points=f"{f(X - 1.2)},{f(Y + 1)} {f(X + 1.2)},{f(Y + 1)} {f(X)},{f(Y - 1.3)}", fill="#e67e22", stroke="#1d1d1b", stroke_width=0.2))
    for (x, y) in INGROUND:
        X, Y = P.p(x, y)
        o.append(rect(X - 1, Y - 1, 2, 2, fill="#fff", stroke="#1d1d1b", stroke_width=0.3))
        o.append(E("circle", cx=X, cy=Y, r=0.5, fill="#f1c40f"))
    for (x, y) in WALL_LIGHTS:
        X, Y = P.p(x, y)
        o.append(E("path", d=f"M{f(X - 1.2)},{f(Y)} a1.2,1.2 0 0 1 2.4,0 z", fill="#1d1d1b"))
    for (x, y) in DECK_LEDS:
        X, Y = P.p(x, y)
        o.append(E("circle", cx=X, cy=Y, r=0.45, fill="#f39c12"))
    X, Y = P.p(*PANEL)
    o.append(rect(X - 2.4, Y - 1.6, 4.8, 3.2, fill="#c0392b", stroke="#1d1d1b", stroke_width=0.3))
    o.append(T(X - 3, Y + 1, "ShO", size=2.2, anchor="end", weight="bold", fill="#c0392b"))
    X, Y = P.p(16.5, 3.0)
    o.append(E("circle", cx=X, cy=Y, r=1.4, fill="#f39c12", stroke="#1d1d1b", stroke_width=0.3))
    o.append(north_arrow(185, 30))
    o.append(scale_bar(40, 260, P.k))
    o.append(T(200, 22, "Landshaft yoritish", size=4, weight="bold"))
    rows = [
        ((lambda X, Y, w, h: g([E("circle", cx=X + w / 2, cy=Y + h / 2, r=1.2, fill="#1d1d1b"), E("circle", cx=X + w / 2, cy=Y + h / 2, r=0.5, fill="#f7dc6f")])),
         "S1", "Yo'lak ustunchasi H=600, LED 7 W, 3000 K, IP65", str(len(BOLLARDS)), "7"),
        ((lambda X, Y, w, h: E("polygon", points=f"{f(X + w / 2 - 1.2)},{f(Y + h / 2 + 1)} {f(X + w / 2 + 1.2)},{f(Y + h / 2 + 1)} {f(X + w / 2)},{f(Y + h / 2 - 1.3)}", fill="#e67e22")),
         "S2", "Daraxt uchun yo'naltirilgan spot, LED 10 W, 24°, IP67", str(len(SPOTS)), "10"),
        ((lambda X, Y, w, h: rect(X + w / 2 - 1, Y + h / 2 - 1, 2, 2, fill="#fff", stroke="#1d1d1b", stroke_width=0.3)),
         "S3", "Yerga o'rnatiladigan chiroq, LED 5 W, IP67, 2 t yuklama", str(len(INGROUND)), "5"),
        ((lambda X, Y, w, h: E("path", d=f"M{f(X + w / 2 - 1.2)},{f(Y + h / 2 + 0.5)} a1.2,1.2 0 0 1 2.4,0 z", fill="#1d1d1b")),
         "S4", "Devor/ustun chirog'i, LED 9 W, IP54", str(len(WALL_LIGHTS)), "9"),
        ((lambda X, Y, w, h: E("circle", cx=X + w / 2, cy=Y + h / 2, r=0.5, fill="#f39c12")),
         "S5", "Deking zinasi uchun LED nuqta, 1 W, 12 V", str(len(DECK_LEDS)), "1"),
        ((lambda X, Y, w, h: line(X + 2, Y + h / 2, X + w - 2, Y + h / 2, stroke="#f39c12", stroke_width=0.4, stroke_dasharray="0.3,0.6")),
         "S6", "Girlyanda (retro lampalar E27, 2 W, har 0,5 m)", f"{num(STRING_LIGHT_M, 0)} m", "4/m"),
        ((lambda X, Y, w, h: E("circle", cx=X + w / 2, cy=Y + h / 2, r=1.2, fill="#f39c12")),
         "S7", "Shiypon osma chirog'i, LED 12 W", "1", "12"),
    ]
    total_w = (len(BOLLARDS) * 7 + len(SPOTS) * 10 + len(INGROUND) * 5 + len(WALL_LIGHTS) * 9 + len(DECK_LEDS) + STRING_LIGHT_M * 4 + 12)
    tb, yb = table(200, 30, [("", 12, "c"), ("Kod", 11, "c"), ("Chiroq turi", 120, "l"), ("Soni", 17, "r"), ("W", 13, "r")],
                   rows, rh=5.6, size=2.35)
    o.append(T(200, 28, "Chiroqlar qaydnomasi", size=3, weight="bold"))
    o.append(tb)
    o.append(T(200, yb + 5, f"Umumiy o'rnatilgan quvvat ≈ {num(total_w / 1000, 2)} kW. Kabel VVGng-LS 3×2,5 gofra quvurda ≈ {num(CABLE_LEN, 0)} m.",
               size=2.5, weight="bold"))
    leg = legend(200, yb + 13, [
        (sw_line("#c0392b", "1.8,0.6", 0.4), "Kabel liniyasi, chuqurligi 0,5 m, signal lentasi bilan"),
        (lambda X, Y, w, h: rect(X + 2, Y + 0.7, 4.8, 3.2, fill="#c0392b"), "ShO — tashqi yoritish shiti IP65 (uy devorida)"),
    ])
    o.append(leg)
    nts, _ = notes(200, yb + 33, "Boshqarish va xavfsizlik", [
        "Uch guruh: 1 — kirish va avtoturargoh (astro-taymer, kun botishidan 01:00 gacha); 2 — bog' va daraxtlar "
        "(taymer, 23:00 gacha); 3 — terrasa va shiypon (qo'lda/ilova orqali).",
        "Har bir guruh 30 mA differensial avtomat bilan himoyalanadi. Barcha chiroqlar IP65 dan past emas.",
        "Rang harorati yagona — 2700–3000 K (iliq oq); chiroqlar ko'z darajasidan pastda, qamashtirmaydi.",
        "Kabel qoplamalar ostidan PVX quvur Ø50 da o'tadi; ulanishlar faqat germetik qutilarda (IP68).",
    ], width_chars=100)
    o.append(nts)
    return sheet("Landshaft yoritish", "1:150", g(o))


def sheet_maf():
    o = [T(30, 18, "Kichik me'moriy shakllar (KMSh)", size=5, weight="bold")]
    # Shiypon — old fasad, M 1:50 (1 m = 20 mm)
    k = 14
    x0, gy = 40, 105
    o.append(T(30, 30, "KMSh-1. Shiypon 4×4 m — fasad, M 1:75", size=3.2, weight="bold"))
    o.append(line(x0 - 10, gy, x0 + 4 * k + 10, gy, stroke_width=0.5))
    o.append(rect(x0 - 2, gy - 0.15 * k, 4 * k + 4, 0.15 * k, fill="url(#pStone)", stroke="#1d1d1b", stroke_width=0.25))
    for px in (0, 4 - 0.2):
        o.append(rect(x0 + px * k, gy - 2.6 * k, 0.2 * k, 2.45 * k, fill="#6d4a2c", stroke="#1d1d1b", stroke_width=0.25))
    o.append(rect(x0 - 0.3 * k, gy - 2.75 * k, 4.6 * k, 0.2 * k, fill="#5a3d24", stroke="#1d1d1b", stroke_width=0.25))
    o.append(E("polygon", points=f"{f(x0 - 0.5 * k)},{f(gy - 2.6 * k)} {f(x0 + 4.5 * k)},{f(gy - 2.6 * k)} {f(x0 + 2 * k)},{f(gy - 4.0 * k)}",
               fill="#7b3f2b", stroke="#1d1d1b", stroke_width=0.3))
    for i in range(1, 8):
        o.append(line(x0 + 0.2 * k, gy - (0.15 + i * 0.12) * k, x0 + 3.8 * k, gy - (0.15 + i * 0.12) * k, stroke="#8d6038", stroke_width=0.2)) if i < 0 else None
    o.append(rect(x0 + 0.2 * k, gy - 0.9 * k, 3.6 * k, 0.75 * k, fill="none", stroke="#8d6038", stroke_width=0.3))
    for i in range(1, 12):
        o.append(line(x0 + (0.2 + i * 0.3) * k, gy - 0.9 * k, x0 + (0.2 + i * 0.3) * k, gy - 0.15 * k, stroke="#8d6038", stroke_width=0.2))
    o.append(T(x0 + 2 * k, gy + 6, "4000", size=2.2, anchor="middle"))
    o.append(line(x0, gy + 3, x0 + 4 * k, gy + 3, stroke_width=0.2, marker_start="url(#mTick)", marker_end="url(#mTick)"))
    o.append(line(x0 + 4.8 * k, gy, x0 + 4.8 * k, gy - 4.0 * k, stroke_width=0.2, marker_start="url(#mTick)", marker_end="url(#mTick)"))
    o.append(T(x0 + 4.8 * k + 1.5, gy - 2 * k, "H=4000", size=2.2))
    spec = ["Karkas: po'lat profil quvur 100×100×4, kukun bo'yoq RAL 8017",
            "Tom: yog'och tom yopmasi + yumshoq cherepitsa, rangi terrakota",
            "Panjara: qarag'ay brus 40×40, antiseptik + lak, H=0,75 m",
            "Fundament: 4 ta ustunsimon, beton B20, 400×400×800",
            "Ichida: stol 1,8×0,9 m, 6–8 o'rindiq, LED osma chiroq",
            "Elektr: 2 ta rozetka IP44 (alohida guruh)"]
    for i, s_ in enumerate(spec):
        o.append(T(115, 46 + i * 5.2, "• " + s_, size=2.35))
    # Mangal
    o.append(T(30, 128, "KMSh-2. Mangal kompleksi 1,8×1,1 m — fasad, M 1:50", size=3.2, weight="bold"))
    k2 = 20
    x0, gy = 40, 192
    o.append(line(x0 - 6, gy, x0 + 1.8 * k2 + 6, gy, stroke_width=0.5))
    o.append(rect(x0, gy - 0.9 * k2, 1.8 * k2, 0.9 * k2, fill="#b5583e", stroke="#1d1d1b", stroke_width=0.3))
    for r_ in range(9):
        yy = gy - (r_ + 1) * 0.1 * k2
        o.append(line(x0, yy, x0 + 1.8 * k2, yy, stroke="#7d3a28", stroke_width=0.15))
    o.append(rect(x0 + 0.15 * k2, gy - 0.6 * k2, 0.7 * k2, 0.35 * k2, fill="#3a2a22", stroke="#1d1d1b", stroke_width=0.2))
    o.append(rect(x0 - 0.05 * k2, gy - 0.95 * k2, 1.9 * k2, 0.06 * k2, fill="#888", stroke="#1d1d1b", stroke_width=0.2))
    o.append(rect(x0 + 0.95 * k2, gy - 0.9 * k2, 0.75 * k2, 0.1 * k2, fill="#666"))
    o.append(rect(x0 + 0.6 * k2, gy - 2.4 * k2, 0.6 * k2, 1.45 * k2, fill="#b5583e", stroke="#1d1d1b", stroke_width=0.3))
    o.append(rect(x0 + 0.55 * k2, gy - 2.5 * k2, 0.7 * k2, 0.1 * k2, fill="#666"))
    for i, s_ in enumerate(["Material: o'tga chidamli g'isht ShB-8, shamot qorishmasi",
                            "Mangal qutisi: po'lat 4 mm, 800×300×200 (shampur 10 ta)",
                            "Stoleshnitsa: granit 30 mm, ish sathi H=900",
                            "Mo'ri: g'isht, H=2,4 m, uchida qopqoq",
                            "O'tin uchun joy: 700×350 mm",
                            "Asos: monolit plita B20, 150 mm, to'r Ø8 A-III"]):
        o.append(T(115, 145 + i * 5.2, "• " + s_, size=2.35))
    # Ishkom va pushta
    x0 = 215
    o.append(T(x0, 30, "KMSh-3. Uzum ishkomi (terrasa ustida) — kesim, M 1:75", size=3.2, weight="bold"))
    k3 = 12
    gy = 95
    o.append(line(x0, gy, x0 + 120, gy, stroke_width=0.5))
    o.append(rect(x0 + 10, gy - 0.3 * k3, 3.5 * k3, 0.3 * k3, fill="url(#pDeck)", stroke="#1d1d1b", stroke_width=0.25))
    o.append(rect(x0 + 10 + 3.5 * k3, gy - 7.0 * k3 * 0.75, 6, 7.0 * k3 * 0.75, fill="url(#pHatchLight)", stroke="#1d1d1b", stroke_width=0.3))
    o.append(T(x0 + 10 + 3.5 * k3 + 8, gy - 30, "uy devori", size=2.2))
    o.append(rect(x0 + 10, gy - 3.0 * k3, 0.15 * k3, 2.7 * k3, fill="#333"))
    o.append(rect(x0 + 8, gy - 3.1 * k3, 3.7 * k3, 0.12 * k3, fill="#333"))
    for i in range(6):
        o.append(E("ellipse", cx=x0 + 14 + i * 7, cy=gy - 3.25 * k3, rx=5, ry=2.4, fill="#6f9e3a", fill_opacity=0.85, stroke="#476b24", stroke_width=0.2))
    o.append(E("path", d=f"M{f(x0 + 9)},{f(gy)} q-2,-15 1,-{f(3.0 * k3)}", fill="none", stroke="#6d4a2c", stroke_width=0.8))
    for i, s_ in enumerate(["Ustunlar: po'lat quvur 100×100, qadam 2,6 m, H=3,0 m",
                            "To'sinlar: 120×60 profil, oraliq troslar Ø4 mm, qadam 0,4 m",
                            "Uzum: 3 tup 'Husayni', ustunlar tagida ekiladi"]):
        o.append(T(x0, 104 + i * 5.2, "• " + s_, size=2.35))
    o.append(T(x0, 130, "KMSh-4. Ko'tarilgan pushta 3,4×1,1×0,4 m — kesim, M 1:25", size=3.2, weight="bold"))
    k4 = 30
    gy = 165
    o.append(line(x0, gy, x0 + 60, gy, stroke_width=0.5))
    o.append(rect(x0 + 10, gy - 0.4 * k4, 1.1 * k4, 0.4 * k4, fill="url(#pSoil)", stroke="none"))
    o.append(rect(x0 + 10, gy - 0.4 * k4, 0.05 * k4, 0.4 * k4, fill="#9c6b3e", stroke="#1d1d1b", stroke_width=0.2))
    o.append(rect(x0 + 10 + 1.05 * k4, gy - 0.4 * k4, 0.05 * k4, 0.4 * k4, fill="#9c6b3e", stroke="#1d1d1b", stroke_width=0.2))
    o.append(rect(x0 + 10, gy - 0.02 * k4, 1.1 * k4, 1.2, fill="#888"))
    for i, s_ in enumerate(["Bort: termoishlangan taxta 150×40 (2 qator), burchak ustunchalari 50×50",
                            "Ichida: tuproq aralashmasi + kompost, pastida kemiruvchilardan to'r",
                            "Tomchilatib sug'orish: 2 chiziq (Z4)"]):
        o.append(T(x0 + 60, gy - 10 + i * 5.2, "• " + s_, size=2.35))
    o.append(T(x0, 185, "KMSh-5. Bog' o'rindig'i (2 dona)", size=3.2, weight="bold"))
    o.append(rect(x0 + 10, 198, 48, 3, fill="#8d6038", stroke="#1d1d1b", stroke_width=0.2))
    o.append(rect(x0 + 12, 201, 4, 14, fill="#555"))
    o.append(rect(x0 + 52, 201, 4, 14, fill="#555"))
    o.append(rect(x0 + 10, 186.5, 48, 2.5, fill="#8d6038", stroke="#1d1d1b", stroke_width=0.2))
    o.append(line(x0 + 14, 189, x0 + 14, 198, stroke="#555", stroke_width=1))
    o.append(line(x0 + 54, 189, x0 + 54, 198, stroke="#555", stroke_width=1))
    o.append(T(x0 + 64, 195, "L=1600, H=450 (o'rindiq), cho'yan oyoqlar,", size=2.35))
    o.append(T(x0 + 64, 200, "akatsiya taxtasi, ankerlar bilan beton asosga.", size=2.35))
    return sheet("Kichik me'moriy shakllar", "1:50; 1:75", g(o))


def sheet_sections():
    o = [T(30, 18, "Uchastka kesimlari", size=5, weight="bold")]
    k = 10   # 1:100
    # A-A: x = 7, y 0..30 (chapda shimol)
    x0, gl = 45, 132
    o.append(T(30, 30, "Kesim A–A (shimoldan janubga, X = 7,0 m), M 1:100", size=3.2, weight="bold"))

    def ground(y):
        return 0.70 - (y / 30) * 0.60

    pts = " ".join(f"{f(x0 + y * k)},{f(gl - ground(y) * k * 3)}" for y in [i * 0.5 for i in range(61)])
    o.append(E("polyline", points=pts, fill="none", stroke="#1d1d1b", stroke_width=0.6))
    o.append(E("polygon", points=pts + f" {f(x0 + 30 * k)},{f(gl + 12)} {f(x0)},{f(gl + 12)}", fill="url(#pEarth)", stroke="none", opacity=0.6))

    def Y(y, z):
        return gl - ground(y) * k * 3 - z * k

    # to'siq
    o.append(rect(x0 - 1, Y(0, 2.0), 2, 2.0 * k, fill="#9a9a9a", stroke="#1d1d1b", stroke_width=0.2))
    o.append(rect(x0 + 30 * k - 1, Y(30, 2.0), 2, 2.0 * k, fill="#9a9a9a", stroke="#1d1d1b", stroke_width=0.2))
    # o'rik
    o.append(line(x0 + 2.3 * k, Y(2.3, 0), x0 + 2.3 * k, Y(2.3, 2.6), stroke="#5a3d24", stroke_width=1.2))
    o.append(E("ellipse", cx=x0 + 2.3 * k, cy=Y(2.3, 3.6), rx=2.5 * k, ry=1.6 * k, fill="#8cc063", fill_opacity=0.85, stroke="#4f7d32", stroke_width=0.3))
    # tuya
    o.append(E("polygon", points=f"{f(x0 + 0.1 * k)},{f(Y(0.45, 0))} {f(x0 + 0.8 * k)},{f(Y(0.45, 0))} {f(x0 + 0.45 * k)},{f(Y(0.45, 2.2))}", fill="#3f7656"))
    # gulzor
    for dy in (-0.7, 0, 0.7):
        o.append(E("circle", cx=x0 + (6 + dy) * k, cy=Y(6, 0.35), r=3, fill="#e24f5c" if dy == 0 else "#a687d9"))
    # terrasa va ishkom
    o.append(rect(x0 + 10.5 * k, Y(12, 0.15) - 0.2, 3.5 * k, 0.3 * k, fill="#b98657", stroke="#1d1d1b", stroke_width=0.25))
    o.append(rect(x0 + 10.5 * k, Y(10.5, 3.0), 1.5, 2.85 * k, fill="#333"))
    o.append(rect(x0 + 10.4 * k, Y(12, 3.15), 3.6 * k, 1.2, fill="#333"))
    for i in range(6):
        o.append(E("ellipse", cx=x0 + (10.7 + i * 0.6) * k, cy=Y(12, 3.35), rx=4.5, ry=2.2, fill="#6f9e3a", fill_opacity=0.9))
    o.append(rect(x0 + 10.3 * k - 1, Y(10.3, 0.05), 2, 1.5, fill="#2b6cb0"))
    # uy
    o.append(rect(x0 + 14 * k, Y(14, 7.4) + 1, 10 * k, 7.4 * k, fill="url(#pHatchLight)", stroke="#1d1d1b", stroke_width=0.5))
    o.append(T(x0 + 19 * k, Y(19, 3.5), "Uy (kesimdan tashqarida)", size=2.6, anchor="middle"))
    o.append(line(x0 + 14 * k, Y(14, 3.5) + 4, x0 + 24 * k, Y(24, 3.5) - 2, stroke="#999", stroke_width=0.2))
    # zinapoya va yo'lka
    o.append(rect(x0 + 24 * k, Y(24.75, 0.3), 1.5 * k, 0.3 * k, fill="#bfb7ab", stroke="#1d1d1b", stroke_width=0.25))
    for yy in [25.7 + i * 0.6 for i in range(6)]:
        o.append(E("circle", cx=x0 + yy * k - 9, cy=Y(yy, 0.25), r=1.4, fill="#4f8a3f"))
    # darvoza
    o.append(line(x0 + 30 * k, Y(30, 0), x0 + 30 * k, Y(30, 2.2), stroke="#1d1d1b", stroke_width=0.6))
    o.append(T(x0 + 31 * k, gl + 3, "Ko'cha", size=2.4))
    # belgilar
    for y_, lab in ((0, "Sh"), (30, "J")):
        o.append(T(x0 + y_ * k, gl + 18, lab, size=3, anchor="middle", weight="bold"))
    for y_, v in ((0.8, "450,70"), (9.7, "450,62"), (10.5, "450,75"), (14, "450,90"), (24, "450,45"), (29.8, "450,10")):
        X = x0 + y_ * k
        o.append(line(X, Y(y_, 0), X, gl + 8, stroke="#999", stroke_width=0.15, stroke_dasharray="0.8,0.6"))
        o.append(T(X, gl + 12, v, size=2.1, anchor="middle"))
    labels = [(2.3, 5.8, "O'rik (mavjud)"), (6, 2.0, "Gulzor G-1"), (8.5, 1.0, "Maysa"), (12.2, 4.4, "Terrasa + ishkom"),
              (10.3, 1.3, "L1"), (27.5, 1.6, "Kirish yo'lagi")]
    for y_, z, s_ in labels:
        o.append(T(x0 + y_ * k, Y(y_, z), s_, size=2.3, anchor="middle", weight="bold"))
    o.append(T(x0 + 34 * k, gl - 30, "Vertikal masshtab", size=2.2))
    o.append(T(x0 + 34 * k, gl - 26, "relyef uchun ×3", size=2.2))
    # B-B: y = 4, x 0..20
    x0, gl = 32, 236
    o.append(T(30, 168, "Kesim B–B (g'arbdan sharqqa, Y = 26,0 m), M 1:100", size=3.2, weight="bold"))

    def ground2(x):
        return 0.70 - x * 0.002

    def Y2(x, z):
        return gl - ground2(x) * k * 3 - z * k

    pts = " ".join(f"{f(x0 + x * k)},{f(Y2(x, 0))}" for x in [i * 0.5 for i in range(41)])
    o.append(E("polyline", points=pts, fill="none", stroke="#1d1d1b", stroke_width=0.6))
    o.append(E("polygon", points=pts + f" {f(x0 + 20 * k)},{f(gl + 12)} {f(x0)},{f(gl + 12)}", fill="url(#pEarth)", stroke="none", opacity=0.6))
    o.append(rect(x0 - 1, Y2(0, 2.0), 2, 2.0 * k, fill="#9a9a9a"))
    o.append(rect(x0 + 20 * k - 1, Y2(20, 2.0), 2, 2.0 * k, fill="#9a9a9a"))
    # bolalar maydonchasi
    o.append(rect(x0 + 0.8 * k, Y2(0.8, 0.02), 4 * k, 0.3 * 3, fill="#e9a37a"))
    o.append(line(x0 + 2.2 * k, Y2(2.2, 0), x0 + 2.2 * k, Y2(2.2, 2.2), stroke="#333", stroke_width=0.8))
    o.append(line(x0 + 4.5 * k, Y2(4.5, 0), x0 + 4.5 * k, Y2(4.5, 2.2), stroke="#333", stroke_width=0.8))
    o.append(line(x0 + 2.2 * k, Y2(2.2, 2.2), x0 + 4.5 * k, Y2(4.5, 2.2), stroke="#333", stroke_width=0.8))
    o.append(line(x0 + 3.3 * k, Y2(3.3, 2.2), x0 + 3.3 * k, Y2(3.3, 0.5), stroke="#333", stroke_width=0.25))
    # qadamli tosh, katalpa
    o.append(line(x0 + 9.6 * k, Y2(9.6, 0), x0 + 9.6 * k, Y2(9.6, 2.2), stroke="#5a3d24", stroke_width=1))
    o.append(E("circle", cx=x0 + 9.6 * k, cy=Y2(9.6, 2.9), r=1.4 * k, fill="#6ea85a", fill_opacity=0.9, stroke="#3a6b2c", stroke_width=0.3))
    o.append(E("circle", cx=x0 + 6.5 * k, cy=Y2(6.5, 0.4), r=4, fill="#a687d9"))
    # shiypon
    gx = x0 + 14.5 * k
    o.append(rect(x0 + 13.5 * k, Y2(13.5, 0.05), 6 * k, 0.3 * 3, fill="#e3dbcc", stroke="#1d1d1b", stroke_width=0.2))
    o.append(rect(gx, Y2(14.5, 2.6), 2, 2.6 * k, fill="#6d4a2c"))
    o.append(rect(gx + 4 * k - 2, Y2(18.5, 2.6), 2, 2.6 * k, fill="#6d4a2c"))
    o.append(E("polygon", points=f"{f(gx - 0.4 * k)},{f(Y2(14.5, 2.6))} {f(gx + 4.4 * k)},{f(Y2(18.5, 2.6))} {f(gx + 2 * k)},{f(Y2(16.5, 4.0))}", fill="#7b3f2b", stroke="#1d1d1b", stroke_width=0.3))
    o.append(rect(gx + 1 * k, Y2(15.5, 0.75), 2 * k, 1.2, fill="#8d6038"))
    o.append(line(gx + 1.2 * k, Y2(15.7, 0.75), gx + 1.2 * k, Y2(15.7, 0), stroke="#555", stroke_width=0.6))
    o.append(line(gx + 2.8 * k, Y2(17.3, 0.75), gx + 2.8 * k, Y2(17.3, 0), stroke="#555", stroke_width=0.6))
    o.append(E("polygon", points=f"{f(x0 + 19.2 * k)},{f(Y2(19.5, 0))} {f(x0 + 19.9 * k)},{f(Y2(19.5, 0))} {f(x0 + 19.55 * k)},{f(Y2(19.5, 2.2))}", fill="#3f7656"))
    for x_, z, s_ in ((2.8, 2.8, "Bolalar maydonchasi"), (9.6, 4.6, "Katalpa"), (16.5, 4.5, "Shiypon"), (7, 1.0, "Maysa")):
        o.append(T(x0 + x_ * k, Y2(x_, z), s_, size=2.3, anchor="middle", weight="bold"))
    o.append(T(x0 + 3, gl - 26, "G'", size=3, anchor="start", weight="bold"))
    o.append(T(x0 + 20 * k - 3, gl - 26, "Shq", size=3, anchor="end", weight="bold"))
    o.append(T(245, 190, "Eslatma: B–B kesimi orqa hovli bo'ylab (Y = 26,0 m shimoldan,", size=2.3, fill="#555"))
    o.append(T(245, 194, "rejada y = 4,0 m) o'tkazilgan. Daraxtlar 7 yillik holatda.", size=2.3, fill="#555"))
    return sheet("Uchastka kesimlari A–A, B–B", "1:100", g(o))


def estimate_rows():
    rows = []
    groups = []

    def grp(name):
        groups.append([name, []])

    def it(name, unit, qty, price):
        groups[-1][1].append((name, unit, qty, price))

    grp("I. Tayyorlov ishlari")
    it("Eski omborxonani buzish, chiqindini olib chiqish", "kompl", 1, 4_500_000)
    it("Qurigan tut daraxtini kesish, to'nkani qo'porish", "dona", 1, 1_200_000)
    it("Eski beton qoplamani demontaj qilish", "m²", 30, 65_000)
    it("Maydonni chiqindidan tozalash va olib chiqish", "m²", PLOT_W * PLOT_H - area(HOUSE), 8_000)
    grp("II. Yer ishlari va drenaj")
    it("Mexanizatsiyalashgan planirovka, zichlash", "m²", PLOT_W * PLOT_H - area(HOUSE), 12_000)
    it("Unumdor tuproq aralashmasi (keltirish, yoyish)", "m³", 31, 260_000)
    it("Chiziqli lotok DN100 (L1, L2) panjarasi bilan", "m", 17, 420_000)
    it("Darvoza lotogi C250 (L3)", "m", 4.5, 650_000)
    it("Drenaj quvuri PVX Ø110", "m", 22, 85_000)
    it("Singdiruvchi quduq Ø1000, H=2 m", "dona", 2, 2_400_000)
    grp("III. Qoplamalar")
    it("P1 Beton brusschatka 80 mm (asos bilan)", "m²", area(DRIVEWAY), 380_000)
    it("P2 Vibropressli plitka 60 mm (asos bilan)", "m²", PATH_AREA, 320_000)
    it("P3 Travertin 30 mm, beton asosda", "m²", area(PAD), 560_000)
    it("P4 DPK deking terrasa (karkas bilan)", "m²", area(TERRACE), 950_000)
    it("P5 Dekorativ shag'al, geotekstil bilan", "m²", GRAVEL_AREA, 140_000)
    it("P6 Rezina qoplama EPDM 20 mm", "m²", area(KIDS), 450_000)
    it("P7 Granit zinapoya (kirish)", "m²", area(PORCH), 1_100_000)
    it("P8 Qadamli toshlar, qumtosh", "dona", len(STONES), 160_000)
    it("B1 Yo'l bordyuri BR 100.30.15", "m", 2 * DRIVEWAY[3] + DRIVEWAY[2], 140_000)
    it("B2 Bog' bordyuri BR 100.20.8", "m", 2 * FRONT_PATH[3] + 2 * SIDE_PATH[3] + 2 * (PAD[2] + PAD[3]), 85_000)
    it("B3 Po'lat chegaralagich 100×2", "m", 2 * sum(r[2] + r[3] for r in (ROSE_BED, MIX_BED, TERRACE_BED, STREET_BED_L, STREET_BED_R)) + 2 * math.pi * ROUND_BED[2], 95_000)
    grp("IV. Kichik me'moriy shakllar")
    it("KMSh-1 Shiypon 4×4 m (fundament, tom bilan)", "kompl", 1, 48_000_000)
    it("KMSh-2 Mangal kompleksi", "kompl", 1, 15_000_000)
    it("KMSh-3 Uzum ishkomi (pergola) 8×3,5 m", "kompl", 1, 14_000_000)
    it("KMSh-4 Ko'tarilgan pushta 3,4×1,1 m", "dona", 3, 2_200_000)
    it("KMSh-5 Bog' o'rindig'i", "dona", 2, 2_600_000)
    it("Bolalar arg'imchog'i va qumdon", "kompl", 1, 9_000_000)
    grp("V. Ko'kalamzorlashtirish (ekish bilan)")
    for c, sp in SPECIES.items():
        if sp[5] == 0:
            continue
        it(f"{c}. {sp[0]} ({sp[2]})", "dona", plant_count(c), round(sp[5] * 1.25, -3))
    it("Mulcha (qarag'ay po'stlog'i), 50–70 mm", "m³", 3.5, 650_000)
    it("Rulonli maysa (tayyorlash va yotqizish bilan)", "m²", LAWN_AREA * 1.05, 95_000)
    grp("VI. Avtomatik sug'orish")
    it("Kontroller 4 zonali Wi-Fi + yomg'ir datchigi", "kompl", 1, 4_400_000)
    it("Elektromagnit klapan 1\" (24V) + quti", "dona", 4, 820_000)
    it("Purkagich 1800 + sopla", "dona", len(SPRAYS), 210_000)
    it("Rotorli purkagich 5004", "dona", len(ROTORS), 390_000)
    it("Quvur PND Ø32/Ø25 (fitinglar bilan)", "m", PIPE_LEN, 26_000)
    it("Tomchilatgich chizig'i Ø16", "m", DRIP_LEN, 9_500)
    it("Filtr, reduktor, ventillar uzeli", "kompl", 1, 2_300_000)
    it("Montaj va sozlash ishlari", "kompl", 1, 6_500_000)
    grp("VII. Landshaft yoritish")
    it("S1 Yo'lak ustunchasi LED", "dona", len(BOLLARDS), 780_000)
    it("S2 Daraxt spoti LED", "dona", len(SPOTS), 520_000)
    it("S3 Yerga o'rnatiladigan chiroq", "dona", len(INGROUND), 610_000)
    it("S4 Devor/ustun chirog'i", "dona", len(WALL_LIGHTS), 450_000)
    it("S5 Deking LED nuqtalari (komplekt)", "dona", len(DECK_LEDS), 160_000)
    it("S6 Girlyanda retro", "m", STRING_LIGHT_M, 65_000)
    it("S7 Shiypon osma chirog'i", "dona", 1, 900_000)
    it("Kabel VVGng-LS 3×2,5 gofra quvurda", "m", CABLE_LEN, 32_000)
    it("Tashqi shit IP65 (avtomatlar, UZO, astro-taymer)", "kompl", 1, 3_800_000)
    it("Elektr montaj ishlari", "kompl", 1, 5_500_000)
    return groups


def sheet_estimate():
    groups = estimate_rows()
    o = [T(30, 18, "Taxminiy smeta (yig'ma hisob-kitob)", size=5, weight="bold"),
         T(30, 24, "Narxlar 2026-yil oktyabr holatiga Toshkent bozori bo'yicha taxminiy, QQS bilan, so'mda. Yakuniy narx tender/kelishuv asosida aniqlanadi.",
           size=2.5, fill="#555")]
    cols = [("№", 8, "c"), ("Ish / material nomi", 92, "l"), ("O'lch.", 12, "c"), ("Miqdor", 16, "r"),
            ("Narx", 22, "r"), ("Summa", 28, "r")]
    flat = []
    totals = []
    n = 0
    for name, items in groups:
        s = sum(round(q, 1) * p for _, _, q, p in items)
        totals.append((name, s))
        flat.append(f"{name} — {money(s)} so'm")
        for nm, u, q, p in items:
            n += 1
            qty = num(q, 0) if u in ("dona", "kompl") else num(q, 1)
            flat.append((str(n), nm, u, qty, money(p), money(round(q, 1) * p)))
    heads = [i for i, r in enumerate(flat) if isinstance(r, str)]
    half = min(heads, key=lambda i: abs(i - len(flat) / 2) + (100 if i > len(flat) * 0.5 else 0))
    tb1, yl = table(25, 30, cols, flat[:half], rh=3.9, size=2.05, head_h=5)
    tb2, _ = table(222, 30, cols, flat[half:], rh=3.9, size=2.05, head_h=5)
    o += [tb1, tb2]
    sub = sum(s for _, s in totals)
    design = 0.06 * sub
    cont = 0.08 * sub
    total = sub + design + cont
    sum_rows = [(nm, money(s)) for nm, s in totals]
    sum_rows += [("Jami ishlar va materiallar", money(sub)),
                 ("Mualliflik nazorati va loyihalash (6 %)", money(design)),
                 ("Kutilmagan xarajatlar (8 %)", money(cont)),
                 ("HAMMASI", money(total))]
    o.append(T(25, yl + 7, "Yig'ma hisob", size=3, weight="bold"))
    tb3, ys = table(25, yl + 9, [("Bo'lim", 120, "l"), ("Summa, so'm", 58, "r")], sum_rows, rh=3.7, size=2.25, head_h=4.6, bold_last=True)
    o.append(tb3)
    o.append(rect(25, ys + 4, 178, 16, fill="#22392c", rx=1.5))
    o.append(T(30, ys + 13.5, "JAMI (taxminiy):", size=3.6, fill="#c9d8b6", weight="bold"))
    o.append(T(198, ys + 14, f"≈ {money(round(total / 1e6, 0))} mln so'm", size=6, weight="bold", fill="#fff", anchor="end"))
    o.append(T(25, ys + 25, f"≈ {money(round(total / 12_600 / 100) * 100)} AQSh dollari (1 $ ≈ 12 600 so'm). O'simliklar narxiga ekish ishlari (+25 %) kiritilgan.", size=2.4, fill="#555"))
    return sheet("Taxminiy smeta", "—", g(o)), total


def sheet_schedule():
    start = date(2027, 3, 1)
    tasks = [
        ("1", "Loyihani tasdiqlash, materiallar buyurtmasi", 0, 2, "#7f8c8d"),
        ("2", "Tayyorlov: buzish, tozalash, rejalashtirish", 2, 1, "#c0392b"),
        ("3", "Yer ishlari, vertikal rejalashtirish, drenaj", 3, 1.5, "#a0784f"),
        ("4", "Tarmoqlar: sug'orish magistrali, kabel transheyalari", 4, 1.5, "#2b6cb0"),
        ("5", "KMSh fundamentlari, shiypon va mangal", 4.5, 3, "#8e44ad"),
        ("6", "Bordyurlar, qoplamalar (P1–P3, P6, P7)", 5.5, 3, "#7d7461"),
        ("7", "Terrasa deking va uzum ishkomi", 7, 1.5, "#b98657"),
        ("8", "Unumdor tuproq, ekish joylarini tayyorlash", 8, 1, "#6c5034"),
        ("9", "Daraxt va butalarni ekish", 8.5, 1, "#3f7656"),
        ("10", "Gulzorlar, pushtalar, mulchalash", 9.5, 1, "#a687d9"),
        ("11", "Sug'orish jihozlarini o'rnatish, sozlash", 9, 1.5, "#0f8b8d"),
        ("12", "Yoritishni o'rnatish va ulash", 9.5, 1.5, "#f39c12"),
        ("13", "Rulonli maysa yotqizish", 10.5, 0.5, "#86b85a"),
        ("14", "Yakuniy tozalash, topshirish-qabul qilish", 11, 0.5, "#22392c"),
        ("15", "Kafolatli parvarish (ekinlar tutishi)", 11.5, 8, "#a9d07c"),
    ]
    weeks = 20
    x0, y0, lw, cw, rh = 30, 40, 105, 12.5, 9
    o = [T(30, 18, "Ishlarni bajarish kalendar grafigi", size=5, weight="bold"),
         T(30, 25, f"Boshlanishi: {start.strftime('%d.%m.%Y')} · Asosiy ishlar davomiyligi: 11,5 hafta · Brigada: 4–6 kishi + mutaxassislar",
           size=2.8, fill="#555")]
    o.append(rect(x0, y0 - 10, lw, 10, fill="#ecebe6", stroke="#1d1d1b", stroke_width=0.3))
    o.append(T(x0 + 2, y0 - 3.5, "Ish turi", size=2.8, weight="bold"))
    months_uz = ["yan", "fev", "mar", "apr", "may", "iyun", "iyul", "avg", "sen", "okt", "noy", "dek"]
    for w in range(weeks):
        d = start + timedelta(weeks=w)
        X = x0 + lw + w * cw
        o.append(rect(X, y0 - 10, cw, 10, fill="#ecebe6", stroke="#1d1d1b", stroke_width=0.2))
        o.append(T(X + cw / 2, y0 - 5.8, f"{w + 1}-h", size=2.3, anchor="middle", weight="bold"))
        o.append(T(X + cw / 2, y0 - 2.2, f"{d.day} {months_uz[d.month - 1]}", size=2.0, anchor="middle", fill="#555"))
    for i, (n, name, s, dur, col) in enumerate(tasks):
        Y = y0 + i * rh
        if i % 2:
            o.append(rect(x0, Y, lw + weeks * cw, rh, fill="#f7f6f2"))
        o.append(T(x0 + 2, Y + rh * 0.65, f"{n}. {name}", size=2.5))
        o.append(rect(x0 + lw + s * cw, Y + 2, min(dur, weeks - s) * cw, rh - 4, fill=col, rx=1.2))
        if i < 14:
            o.append(T(x0 + lw + (s + dur) * cw + 1.5, Y + rh * 0.65, f"{num(dur * 7, 0)} kun", size=2.1, fill="#555"))
    H_ = len(tasks) * rh
    for w in range(weeks + 1):
        o.append(line(x0 + lw + w * cw, y0, x0 + lw + w * cw, y0 + H_, stroke="#ccc", stroke_width=0.15))
    o.append(rect(x0, y0 - 10, lw + weeks * cw, H_ + 10, fill="none", stroke="#1d1d1b", stroke_width=0.35))
    o.append(line(x0 + lw, y0 - 10, x0 + lw, y0 + H_, stroke_width=0.3))
    # nazorat nuqtalari
    for wk, lab in ((2, "Ish boshlash"), (8.5, "Qattiq qoplamalar tayyor"), (11.5, "Ob'ekt topshirildi")):
        X = x0 + lw + wk * cw
        o.append(line(X, y0 - 10, X, y0 + H_ + 4, stroke="#c0392b", stroke_width=0.4, stroke_dasharray="1.2,0.8"))
        o.append(E("polygon", points=f"{f(X)},{f(y0 + H_ + 3)} {f(X - 2)},{f(y0 + H_ + 6)} {f(X)},{f(y0 + H_ + 9)} {f(X + 2)},{f(y0 + H_ + 6)}", fill="#c0392b"))
        o.append(T(X + 3, y0 + H_ + 7, lab, size=2.4, fill="#c0392b", weight="bold"))
    nts, _ = notes(30, y0 + H_ + 20, "Tashkiliy ko'rsatmalar", [
        "Ekish ishlari bahorgi mavsumga (aprel oxiri – may) to'g'ri keladi; ochiq ildizli mevali ko'chatlar "
        "alohida, 2–3-haftada (mart) ekilishi mumkin.",
        "Og'ir texnika (ekskavator, samosval) faqat avtoturargoh zonasi orqali kiradi; o'rik atrofi himoyalanadi.",
        "Har bosqich yakunida yashirin ishlar dalolatnomasi tuziladi (asoslar, drenaj, kabel, quvurlar).",
        "Kafolat: ekinlar — 1 mavsum (tutmaganlari almashtiriladi), qoplamalar va KMSh — 2 yil, jihozlar — ishlab chiqaruvchi kafolati.",
    ], width_chars=150)
    o.append(nts)
    return sheet("Ishlarni bajarish kalendar grafigi", "—", g(o))


def sheet_care():
    months = ["Yan", "Fev", "Mar", "Apr", "May", "Iyun", "Iyul", "Avg", "Sen", "Okt", "Noy", "Dek"]
    tasks = [
        ("Maysa", "O'rish (5–6 sm)", [4, 5, 6, 7, 8, 9, 10], "har 7–10 kunda"),
        ("Maysa", "Aeratsiya, skarifikatsiya", [4, 9], "yiliga 2 marta"),
        ("Maysa", "O'g'itlash (NPK)", [4, 6, 9], "25–30 g/m²"),
        ("Maysa", "Siyrak joylarni ekish", [4, 9], "zarurat bo'yicha"),
        ("Daraxtlar", "Sanitar va shakl beruvchi butash", [2, 3, 11], "tinim davrida"),
        ("Daraxtlar", "Zararkunandalarga qarshi ishlov", [3, 4, 5, 6], "bargi chiqqanda"),
        ("Daraxtlar", "Tanani oqlash", [3, 11], "ohak + mis kuporosi"),
        ("Daraxtlar", "O'g'itlash (go'ng, kompost)", [3, 10], "5–10 kg/daraxt"),
        ("Tuya, shamshod", "Qirqish (shakl berish)", [5, 8], "yiliga 2 marta"),
        ("Tuya, shamshod", "Qishki quyoshdan himoya (to'r)", [1, 2, 12], "fevral oxirigacha"),
        ("Atirgul, gullar", "Qurigan gullarni olib tashlash", [5, 6, 7, 8, 9, 10], "doimiy"),
        ("Atirgul, gullar", "Butash / qishga yopish", [3, 11], "mart / noyabr"),
        ("Atirgul, gullar", "Bo'linish, qayta ekish", [9], "3–4 yilda bir"),
        ("Uzum", "Kesish va ishkomga bog'lash", [3, 6, 7], "yashil operatsiyalar"),
        ("Sug'orish", "Ishga tushirish / tekshirish", [3, 4], "bosim, soplalar"),
        ("Sug'orish", "Mavsumiy rejim (yoz)", [5, 6, 7, 8, 9], "kontroller orqali"),
        ("Sug'orish", "Qishga tayyorlash (puflash)", [11], "+5 °C dan oldin"),
        ("Mulcha", "Yangilash", [4], "qatlam 50–70 mm"),
        ("Qoplamalar", "Choklarni tozalash, deking moyi", [4, 10], "yiliga 2 marta"),
        ("Yoritish", "Chiroqlar va ulanishlarni tekshirish", [3, 10], "IP germetiklik"),
    ]
    x0, y0, cw, rh = 30, 40, 13.5, 8.6
    o = [T(30, 18, "Parvarish bo'yicha yillik kalendar (foydalanish yo'riqnomasi)", size=5, weight="bold")]
    cols_x = [x0, x0 + 30, x0 + 95]
    o.append(rect(x0, y0 - 8, 95 + 12 * cw + 38, 8, fill="#ecebe6", stroke="#1d1d1b", stroke_width=0.3))
    o.append(T(x0 + 2, y0 - 2.6, "Ob'ekt", size=2.7, weight="bold"))
    o.append(T(x0 + 32, y0 - 2.6, "Ish", size=2.7, weight="bold"))
    for i, m in enumerate(months):
        o.append(T(x0 + 95 + i * cw + cw / 2, y0 - 2.6, m, size=2.6, anchor="middle", weight="bold"))
    o.append(T(x0 + 95 + 12 * cw + 2, y0 - 2.6, "Izoh", size=2.7, weight="bold"))
    season = {12: "#e8f0f8", 1: "#e8f0f8", 2: "#e8f0f8", 3: "#eef6e6", 4: "#eef6e6", 5: "#eef6e6", 6: "#fdf3e1", 7: "#fdf3e1", 8: "#fdf3e1"}
    for i in range(12):
        c = season.get(i + 1, "#f8ecdf")
        o.append(rect(x0 + 95 + i * cw, y0, cw, len(tasks) * rh, fill=c))
    prev = None
    colors = {"Maysa": "#86b85a", "Daraxtlar": "#4f7d32", "Tuya, shamshod": "#3f7656", "Atirgul, gullar": "#e24f5c",
              "Uzum": "#7aa33d", "Sug'orish": "#2b6cb0", "Mulcha": "#9c7b5a", "Qoplamalar": "#7d7461", "Yoritish": "#f39c12"}
    for j, (obj, task, ms, note) in enumerate(tasks):
        Y = y0 + j * rh
        if obj != prev:
            o.append(line(x0, Y, x0 + 95 + 12 * cw + 38, Y, stroke_width=0.3))
            o.append(T(x0 + 2, Y + rh * 0.65, obj, size=2.5, weight="bold", fill=colors[obj]))
            prev = obj
        else:
            o.append(line(x0 + 30, Y, x0 + 95 + 12 * cw + 38, Y, stroke="#ddd", stroke_width=0.15))
        o.append(T(x0 + 32, Y + rh * 0.65, task, size=2.45))
        for m in ms:
            o.append(rect(x0 + 95 + (m - 1) * cw + 1.2, Y + 1.8, cw - 2.4, rh - 3.6, fill=colors[obj], rx=1.5))
        o.append(T(x0 + 95 + 12 * cw + 2, Y + rh * 0.65, note, size=2.2, fill="#555"))
    Ht = len(tasks) * rh
    o.append(rect(x0, y0 - 8, 95 + 12 * cw + 38, Ht + 8, fill="none", stroke="#1d1d1b", stroke_width=0.35))
    for xx in (x0 + 30, x0 + 95, x0 + 95 + 12 * cw):
        o.append(line(xx, y0 - 8, xx, y0 + Ht, stroke_width=0.2))
    o.append(T(30, y0 + Ht + 6, "Fon ranglari: ko'k — qish, yashil — bahor, sariq — yoz, to'q sariq — kuz. "
               "Sug'orish me'yori yozda: maysa 25–30 l/m² haftasiga 3–4 marta, daraxtlar 40–60 l har 5–7 kunda.",
               size=2.4, fill="#555"))
    return sheet("Parvarish kalendari", "—", g(o))


# ----------------------------------------------------------------------------
# Yig'ish
# ----------------------------------------------------------------------------

def build():
    SHEETS.append(("L-01", "Umumiy ma'lumotlar. Mundarija. TIK", "—"))
    builders = [sheet_existing, sheet_master, sheet_zoning, sheet_axo, sheet_layout, sheet_grading,
                sheet_paving, sheet_details, sheet_dendro, sheet_flowerbeds, sheet_irrigation, sheet_lighting,
                sheet_maf, sheet_sections]
    rest = [b()[1] for b in builders]
    (_, est), total = sheet_estimate()
    rest += [est, sheet_schedule()[1], sheet_care()[1]]
    general = sheet_general([(c, n, sc) for c, n, sc in SHEETS])[1]
    return [cover(), general] + rest, len(SHEETS), total


def main():
    pages, total_sheets, total = build()
    html_pages = []
    for parts in pages:
        svg = "".join(parts).replace("{TOTAL}", str(total_sheets))
        html_pages.append(
            f'<section class="sheet"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {PAGE_W} {PAGE_H}" '
            f'font-family="{FONT}">{svg}</svg></section>')
    body = "\n".join(html_pages)
    doc = f"""<!doctype html>
<html lang="uz">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Landshaft loyiha albomi</title>
<style>
  :root {{ --bg: #e9e6df; }}
  @page {{ size: 420mm 297mm; margin: 0; }}
  html, body {{ margin: 0; background: var(--bg); }}
  .sheet {{ width: min(100vw - 32px, 1600px); margin: 16px auto; box-shadow: 0 2px 14px rgba(0,0,0,.18); background: #fff; }}
  .sheet svg {{ display: block; width: 100%; height: auto; }}
  @media print {{
    html, body {{ background: #fff; }}
    .sheet {{ width: 420mm; height: 297mm; margin: 0; box-shadow: none; page-break-after: always; break-after: page; }}
    .sheet svg {{ width: 420mm; height: 297mm; }}
  }}
</style>
</head>
<body>
{DEFS}
{body}
</body>
</html>
"""
    OUT.write_text(doc, encoding="utf-8")
    print(f"{OUT} — {len(pages)} sahifa, {total_sheets} varaq, smeta ≈ {total / 1e6:.0f} mln so'm")


if __name__ == "__main__":
    main()
