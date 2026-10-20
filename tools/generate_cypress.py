"""Generate a real-scale (1:1) Italian cypress model for 3ds Max from a reference photo.

The silhouette (radius profile and lean) is measured directly from the reference
image alpha, so the 3D model matches the picture. Output: OBJ + MTL + textures
in ../cypress_3dsmax. Units are meters, Y-up (3ds Max OBJ importer flips to Z-up).

Usage: python3 tools/generate_cypress.py [height_in_meters]
"""
import math
import os
import sys

import numpy as np
from PIL import Image, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REF = os.path.join(ROOT, "tools", "cypress_reference.png")
OUT = os.path.join(ROOT, "cypress_3dsmax")
TEX = os.path.join(OUT, "textures")

HEIGHT = float(sys.argv[1]) if len(sys.argv) > 1 else 10.0  # meters
RNG = np.random.default_rng(7)


# ---------------------------------------------------------------- profile
def measure_profile(alpha):
    """Return (z_m, radius_m, center_offset_m) per image row, base at z=0."""
    mask = alpha > 128
    rows = np.where(mask.sum(1) > 3)[0]
    top, base = rows.min(), rows.max()
    px = HEIGHT / (base - top)
    left = np.zeros(alpha.shape[0])
    right = np.zeros(alpha.shape[0])
    for y in range(top, base + 1):
        xs = np.where(mask[y])[0]
        if len(xs) < 3:
            left[y] = right[y] = left[y - 1] if y > top else 512
            continue
        left[y], right[y] = np.percentile(xs, 2), np.percentile(xs, 98)
    k = np.ones(21) / 21
    ys = np.arange(top, base + 1)
    l = np.convolve(np.pad(left[ys], 10, mode="edge"), k, "valid")
    r = np.convolve(np.pad(right[ys], 10, mode="edge"), k, "valid")
    z = (base - ys) * px
    radius = (r - l) / 2 * px
    center = (r + l) / 2
    center = (center - center[-1]) * px  # trunk base at x=0
    order = np.argsort(z)
    return z[order], radius[order], center[order], px, top, base


# ---------------------------------------------------------------- textures
def lum(rgb):
    return rgb[..., 0] * 0.3 + rgb[..., 1] * 0.59 + rgb[..., 2] * 0.11


def smooth_noise(h, w, scale, seed):
    r = np.random.default_rng(seed)
    small = r.random((max(2, h // scale), max(2, w // scale)))
    img = Image.fromarray((small * 255).astype(np.uint8)).resize((w, h), Image.BICUBIC)
    return np.asarray(img) / 255.0


def interior_crops(img, size, count, seed):
    """Random square crops fully inside the foliage (opaque alpha)."""
    r = np.random.default_rng(seed)
    a = img[..., 3]
    crops = []
    tries = 0
    while len(crops) < count and tries < 20000:
        tries += 1
        x = r.integers(330, 700 - size)
        y = r.integers(150, 1420 - size)
        if a[y:y + size, x:x + size].min() >= 235:
            crops.append(img[y:y + size, x:x + size, :3])
    return crops


def make_atlas(img):
    """4x4 atlas of foliage sprays with leafy cut-out alpha."""
    cell, n = 256, 4
    rgb_atlas = np.zeros((cell * n, cell * n, 3), np.uint8)
    a_atlas = np.zeros((cell * n, cell * n), np.uint8)
    crops = interior_crops(img, 110, n * n, 3)
    yy, xx = np.mgrid[0:cell, 0:cell]
    for i, crop in enumerate(crops):
        c = np.asarray(Image.fromarray(crop).resize((cell, cell), Image.LANCZOS)).astype(float)
        L = lum(c)
        t0, t1 = np.percentile(L, 30), np.percentile(L, 55)
        leaf = np.clip((L - t0) / (t1 - t0 + 1e-6), 0, 1)
        # soft, ragged spray outline: wider at top (fronds point up)
        nx = (xx - cell / 2) / (cell / 2)
        ny = (yy - cell / 2) / (cell / 2)
        d = np.sqrt((nx * (1.15 + 0.25 * ny)) ** 2 + (ny * 0.95) ** 2)
        ragged = d + (smooth_noise(cell, cell, 24, 100 + i) - 0.5) * 0.55
        shape = np.clip((0.92 - ragged) / 0.12, 0, 1)
        alpha = leaf * shape
        gy, gx = divmod(i, n)
        rgb_atlas[gy * cell:(gy + 1) * cell, gx * cell:(gx + 1) * cell] = c.astype(np.uint8)
        a_atlas[gy * cell:(gy + 1) * cell, gx * cell:(gx + 1) * cell] = (alpha * 255).astype(np.uint8)
    # bleed colour into transparent area to avoid dark fringes when mip-mapping
    rgba = np.dstack([rgb_atlas, a_atlas])
    Image.fromarray(rgba, "RGBA").save(os.path.join(TEX, "cypress_foliage_atlas.png"))
    Image.fromarray(rgb_atlas).save(os.path.join(TEX, "cypress_foliage_atlas_diffuse.jpg"), quality=92)
    Image.fromarray(a_atlas).save(os.path.join(TEX, "cypress_foliage_atlas_opacity.png"))


def make_core_tile(img):
    """Seamless foliage tile for the inner crown volume (darker, self-shadowed)."""
    crops = interior_crops(img, 160, 6, 11)
    tile = np.zeros((512, 512, 3))
    for i, c in enumerate(crops):
        c = np.asarray(Image.fromarray(c).resize((512, 512), Image.LANCZOS)).astype(float)
        tile += c
    tile /= len(crops)
    # make seamless: blend with half-offset copy using a cross-fade mask
    shifted = np.roll(np.roll(tile, 256, 0), 256, 1)
    ramp = np.abs(np.linspace(-1, 1, 512))
    m = np.maximum.outer(ramp, ramp)[..., None]
    tile = tile * (1 - m) + shifted * m
    tile *= 0.72  # inner crown sits in shadow
    Image.fromarray(np.clip(tile, 0, 255).astype(np.uint8)).save(
        os.path.join(TEX, "cypress_foliage_core.jpg"), quality=92)


def make_bark():
    h, w = 1024, 256
    base = np.array([92, 78, 64], float)
    streak = smooth_noise(h, w, 4, 21)[:, :]
    streak = np.asarray(Image.fromarray((streak * 255).astype(np.uint8)).resize((w // 8, h)).resize((w, h), Image.BICUBIC)) / 255
    fine = smooth_noise(h, w, 2, 22)
    v = 0.55 + 0.45 * streak * 0.8 + 0.2 * fine
    bark = base[None, None, :] * v[..., None]
    bark[..., 0] += 10 * (fine - 0.5)
    Image.fromarray(np.clip(bark, 0, 255).astype(np.uint8)).filter(ImageFilter.SHARPEN).save(
        os.path.join(TEX, "cypress_bark.jpg"), quality=90)


# ---------------------------------------------------------------- geometry
class Obj:
    def __init__(self):
        self.v, self.vt, self.vn, self.groups = [], [], [], []

    def add_v(self, p):
        self.v.append(p)
        return len(self.v)

    def add_vt(self, t):
        self.vt.append(t)
        return len(self.vt)

    def add_vn(self, n):
        n = np.asarray(n, float)
        n = n / (np.linalg.norm(n) + 1e-9)
        self.vn.append(n)
        return len(self.vn)

    def write(self, path, mtl):
        with open(path, "w") as f:
            f.write("# Italian cypress (Cupressus sempervirens), real scale 1:1, units = meters, Y-up\n")
            f.write(f"# Height {HEIGHT:.2f} m\nmtllib {mtl}\n")
            for p in self.v:
                f.write("v %.4f %.4f %.4f\n" % tuple(p))
            for t in self.vt:
                f.write("vt %.4f %.4f\n" % tuple(t))
            for n in self.vn:
                f.write("vn %.4f %.4f %.4f\n" % tuple(n))
            for name, mat, faces in self.groups:
                f.write(f"o {name}\ng {name}\nusemtl {mat}\ns 1\n")
                for face in faces:
                    f.write("f " + " ".join("%d/%d/%d" % c for c in face) + "\n")


def profile_at(zs, rs, cs, z):
    return float(np.interp(z, zs, rs)), float(np.interp(z, zs, cs))


def build_trunk(obj, zs, rs, cs):
    seg, rings = 12, 24
    top = HEIGHT * 0.78
    idx = []
    for j in range(rings + 1):
        t = j / rings
        z = top * t
        _, cx = profile_at(zs, rs, cs, z)
        rad = 0.16 * (1 - t) ** 1.3 + 0.025
        row = []
        for i in range(seg + 1):
            a = 2 * math.pi * i / seg
            n = (math.cos(a), 0.0, math.sin(a))
            wob = 1 + 0.08 * math.sin(3 * a + z * 4)
            vi = obj.add_v((cx + n[0] * rad * wob, z, n[2] * rad * wob))
            ti = obj.add_vt((i / seg, z / 1.5))
            ni = obj.add_vn(n)
            row.append((vi, ti, ni))
        idx.append(row)
    faces = []
    for j in range(rings):
        for i in range(seg):
            a, b, c, d = idx[j][i], idx[j][i + 1], idx[j + 1][i + 1], idx[j + 1][i]
            faces.append((a, d, c, b))
    obj.groups.append(("Cypress_Trunk", "Cypress_Bark", faces))


def crown_noise(a, z):
    return (0.10 * math.sin(5 * a + z * 2.1) + 0.07 * math.sin(11 * a - z * 3.7 + 1.3)
            + 0.05 * math.sin(17 * a + z * 6.3 + 0.4) + 0.06 * math.sin(z * 1.3 + 2 * a))


def build_core(obj, zs, rs, cs):
    seg = 48
    z0, z1 = 0.25, HEIGHT
    rings = int((z1 - z0) / 0.08)
    idx = []
    for j in range(rings + 1):
        z = z0 + (z1 - z0) * j / rings
        r, cx = profile_at(zs, rs, cs, z)
        r *= 0.80
        if j == rings:
            r = 0.0
        row = []
        for i in range(seg + 1):
            a = 2 * math.pi * i / seg
            rr = r * (1 + crown_noise(a % (2 * math.pi), z))
            vi = obj.add_v((cx + math.cos(a) * rr, z, math.sin(a) * rr))
            ti = obj.add_vt((4 * i / seg, z / 1.2))
            ni = obj.add_vn((math.cos(a), 0.25, math.sin(a)))
            row.append((vi, ti, ni))
        idx.append(row)
    # bottom cap
    cz = z0
    _, ccx = profile_at(zs, rs, cs, cz)
    cv = obj.add_v((ccx, cz, 0.0))
    ct = obj.add_vt((0.5, 0.0))
    cn = obj.add_vn((0, -1, 0))
    faces = []
    for j in range(rings):
        for i in range(seg):
            a, b, c, d = idx[j][i], idx[j][i + 1], idx[j + 1][i + 1], idx[j + 1][i]
            faces.append((a, d, c, b))
    for i in range(seg):
        a, b = idx[0][i], idx[0][i + 1]
        faces.append(((cv, ct, cn), (a[0], a[1], cn), (b[0], b[1], cn)))
    obj.groups.append(("Cypress_CrownCore", "Cypress_FoliageCore", faces))


def build_cards(obj, zs, rs, cs, count):
    # sample heights proportional to crown surface (radius)
    zg = np.linspace(0.3, HEIGHT * 0.995, 2000)
    w = np.array([profile_at(zs, rs, cs, z)[0] for z in zg]) + 0.05
    w /= w.sum()
    uv_cells = []
    for k in range(16):
        gy, gx = divmod(k, 4)
        u0, u1 = gx / 4 + 0.002, (gx + 1) / 4 - 0.002
        v1, v0 = 1 - gy / 4 - 0.002, 1 - (gy + 1) / 4 + 0.002
        uv_cells.append([obj.add_vt((u0, v0)), obj.add_vt((u1, v0)),
                         obj.add_vt((u1, v1)), obj.add_vt((u0, v1))])
    faces = []
    up = np.array([0.0, 1.0, 0.0])
    for _ in range(count):
        z = RNG.choice(zg, p=w) + RNG.normal(0, 0.02)
        r, cx = profile_at(zs, rs, cs, z)
        a = RNG.uniform(0, 2 * math.pi)
        out = np.array([math.cos(a), 0.0, math.sin(a)])
        depth = RNG.uniform(0.62, 0.98)
        rr = r * depth * (1 + crown_noise(a, z) * 0.6)
        size = float(np.clip(RNG.uniform(0.32, 0.6) * min(1.0, 0.35 + r), 0.12, 0.6))
        hgt = size * RNG.uniform(1.1, 1.45)  # sprays are taller than wide
        # orientation: face outward, tilted randomly, axis leaning up the trunk
        n = out + RNG.normal(0, 0.3, 3) * np.array([1, 0.3, 1])
        n /= np.linalg.norm(n)
        vaxis = up * 1.0 + out * RNG.uniform(0.05, 0.35) + RNG.normal(0, 0.15, 3)
        vaxis -= n * vaxis.dot(n)
        vaxis /= np.linalg.norm(vaxis)
        haxis = np.cross(vaxis, n)
        c = np.array([cx, z, 0.0]) + out * rr + vaxis * hgt * 0.15
        p0 = c - haxis * size / 2 - vaxis * hgt / 2
        p1 = c + haxis * size / 2 - vaxis * hgt / 2
        p2 = c + haxis * size / 2 + vaxis * hgt / 2
        p3 = c - haxis * size / 2 + vaxis * hgt / 2
        ni = obj.add_vn(n + up * 0.3)
        cell = uv_cells[RNG.integers(16)]
        if RNG.random() < 0.5:  # mirror for variety
            cell = [cell[1], cell[0], cell[3], cell[2]]
        vs = [obj.add_v(p) for p in (p0, p1, p2, p3)]
        faces.append(tuple((vs[k], cell[k], ni) for k in range(4)))
    obj.groups.append(("Cypress_FoliageCards", "Cypress_FoliageCards", faces))


def build_billboard(path, px, top, base, img_w, img_h):
    """Low-poly LOD: three crossed alpha planes using the original photo."""
    obj = Obj()
    W = img_w * px
    H = img_h * px
    y_off = -(img_h - 1 - base) * px  # put tree base on the ground
    # centre the trunk: column of trunk base in image
    faces = []
    for k in range(3):
        a = math.pi * k / 3
        d = np.array([math.cos(a), 0, math.sin(a)])
        n = np.array([-math.sin(a), 0, math.cos(a)])
        x0 = -BILL_CX * px
        x1 = (img_w - BILL_CX) * px
        ps = [d * x0 + [0, y_off, 0], d * x1 + [0, y_off, 0],
              d * x1 + [0, y_off + H, 0], d * x0 + [0, y_off + H, 0]]
        vs = [obj.add_v(p) for p in ps]
        ts = [obj.add_vt(t) for t in ((0, 0), (1, 0), (1, 1), (0, 1))]
        ni = obj.add_vn(n)
        faces.append(tuple((vs[i], ts[i], ni) for i in range(4)))
    obj.groups.append(("Cypress_Billboard", "Cypress_Billboard", faces))
    obj.write(path, "cypress_billboard.mtl")


MTL = """# Materials for cypress.obj (textures relative to this file)
newmtl Cypress_Bark
Kd 1.0 1.0 1.0
Ks 0.02 0.02 0.02
Ns 8
map_Kd textures/cypress_bark.jpg

newmtl Cypress_FoliageCore
Kd 1.0 1.0 1.0
Ks 0.03 0.03 0.03
Ns 10
map_Kd textures/cypress_foliage_core.jpg

newmtl Cypress_FoliageCards
Kd 1.0 1.0 1.0
Ks 0.05 0.05 0.05
Ns 12
map_Kd textures/cypress_foliage_atlas_diffuse.jpg
map_d textures/cypress_foliage_atlas_opacity.png
"""

BILL_MTL = """newmtl Cypress_Billboard
Kd 1.0 1.0 1.0
Ks 0.0 0.0 0.0
map_Kd textures/cypress_billboard.png
map_d textures/cypress_billboard_opacity.png
"""


def main():
    global BILL_CX
    os.makedirs(TEX, exist_ok=True)
    img = np.asarray(Image.open(REF).convert("RGBA"))
    zs, rs, cs, px, top, base = measure_profile(img[..., 3])
    print(f"height {HEIGHT} m, max crown diameter {2 * rs.max():.2f} m, scale {px * 1000:.2f} mm/px")

    make_atlas(img)
    make_core_tile(img)
    make_bark()
    Image.fromarray(img, "RGBA").save(os.path.join(TEX, "cypress_billboard.png"))
    Image.fromarray(img[..., 3]).save(os.path.join(TEX, "cypress_billboard_opacity.png"))

    obj = Obj()
    build_trunk(obj, zs, rs, cs)
    build_core(obj, zs, rs, cs)
    build_cards(obj, zs, rs, cs, 3200)
    obj.write(os.path.join(OUT, "cypress.obj"), "cypress.mtl")
    with open(os.path.join(OUT, "cypress.mtl"), "w") as f:
        f.write(MTL)

    xs = np.where(img[base - 5, :, 3] > 128)[0]
    BILL_CX = float(xs.mean())
    build_billboard(os.path.join(OUT, "cypress_billboard.obj"), px, top, base, img.shape[1], img.shape[0])
    with open(os.path.join(OUT, "cypress_billboard.mtl"), "w") as f:
        f.write(BILL_MTL)
    print("faces:", sum(len(g[2]) for g in obj.groups), "verts:", len(obj.v))


BILL_CX = 512.0

if __name__ == "__main__":
    main()
