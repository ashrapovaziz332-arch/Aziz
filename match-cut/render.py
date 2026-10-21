"""Sketch-to-render match cut: blueprint pencil pass -> photoreal reveal -> iris into an inset.

Usage: python3 render.py   (writes frames to ./frames and match-cut.mp4 via ffmpeg)
"""
import os, shutil, subprocess
import numpy as np
from PIL import Image, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
FPS, DUR = 30, 8.0
OUT_W, OUT_H = 720, 960

photo = Image.open(os.path.join(HERE, "source.jpg")).convert("RGB")
W, H = photo.size
P = np.asarray(photo, dtype=np.float32)

# Pencil-sketch pass: colour-dodge of grayscale over its blurred inverse.
gray = np.asarray(photo.convert("L"), dtype=np.float32)
blur = np.asarray(Image.fromarray((255 - gray).astype(np.uint8)).filter(ImageFilter.GaussianBlur(10)), dtype=np.float32)
sketch = np.clip(gray * 255.0 / np.maximum(255.0 - blur, 1.0), 0, 255)
sketch = 255 - (255 - sketch) * 1.35                      # darken the lines
paper = np.array([244, 242, 236], dtype=np.float32)       # warm paper tone
S = np.clip(sketch[..., None] / 255.0 * paper, 0, 255)

yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
BUILDING = (390, 560)               # centre of the lit townhouse
INSET = (615, 868, 60)              # bottom-right circular inset (cx, cy, r)
d_building = np.hypot(xx - BUILDING[0], yy - BUILDING[1])
d_inset = np.hypot(xx - INSET[0], yy - INSET[1])

def ease(x):
    x = min(max(x, 0.0), 1.0)
    return x * x * (3 - 2 * x)

def seg(t, a, b):
    return ease((t - a) / (b - a))

def lerp(a, b, k):
    return a + (b - a) * k

def frame(t):
    # 1) sketch -> photo radial "develop" from the building outward
    radius = lerp(-80, 950, seg(t, 2.2, 3.8))
    m = np.clip((radius - d_building) / 120.0, 0, 1)[..., None]
    img = S * (1 - m) + P * m

    # 2) iris: everything outside the inset fades to paper
    iris = seg(t, 5.0, 6.4)
    if iris > 0:
        edge = np.clip((d_inset - INSET[2]) / 6.0, 0, 1)[..., None] * iris
        img = img * (1 - edge) + paper * edge

    # 3) camera: slow push, drift to the inset, punch through it
    z_fill = H / (2 * INSET[2]) * 0.92
    if t < 3.8:
        z, cx, cy = lerp(1.0, 1.06, t / 3.8), W / 2, H / 2
    elif t < 5.0:
        k = seg(t, 3.8, 5.0)
        z, cx, cy = lerp(1.06, 1.8, k), lerp(W / 2, INSET[0], k), lerp(H / 2, INSET[1], k)
    else:
        z, cx, cy = lerp(1.8, z_fill, seg(t, 5.0, 6.6)), INSET[0], INSET[1]
    ch = H / z
    cw = ch * OUT_W / OUT_H
    cx = min(max(cx, cw / 2), W - cw / 2)
    cy = min(max(cy, ch / 2), H - ch / 2)
    box = (cx - cw / 2, cy - ch / 2, cx + cw / 2, cy + ch / 2)
    out = Image.fromarray(img.astype(np.uint8)).resize((OUT_W, OUT_H), Image.LANCZOS, box=box)

    # 4) wash to paper, then back to the full sketch so the clip loops
    wash = seg(t, 6.6, 7.1) * (1 - seg(t, 7.3, 8.0))
    if t >= 7.3:
        base = Image.fromarray(S.astype(np.uint8)).resize((OUT_W, OUT_H), Image.LANCZOS, box=(W / 2 - 366, 0, W / 2 + 366, H))
        out = base
    if wash > 0:
        o = np.asarray(out, dtype=np.float32)
        out = Image.fromarray((o * (1 - wash) + paper * wash).astype(np.uint8))
    return out

if __name__ == "__main__":
    fdir = os.path.join(HERE, "frames")
    shutil.rmtree(fdir, ignore_errors=True)
    os.makedirs(fdir)
    n = int(FPS * DUR)
    for i in range(n):
        frame(i / FPS).save(os.path.join(fdir, f"{i:04d}.png"))
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-framerate", str(FPS), "-i", os.path.join(fdir, "%04d.png"),
                    "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "18", "-movflags", "+faststart",
                    os.path.join(HERE, "match-cut.mp4")], check=True)
    shutil.rmtree(fdir)
    print("wrote match-cut.mp4")
