"""AZIZ FLORAN - perspective sweep title (kino uslubi).

Yozuv yondan tez chiqadi (3D perspektiva, motion blur), biroz qimirlab turadi,
keyin teskari tomonga tez kirib ketadi. Odamning orqasidan o'tishi mumkin (alpha).

Ishlatish:
  python3 persp_sweep.py FON(rasm|video) OUT.mp4 [--alpha alpha.png|alpha.npy] [--t0 0.3] [--hold 2.2]
Boshqa skriptlardan:  layer = sweep_layer(t, LINES, W, H)  -> BGRA premultiplied float32
"""
import argparse, math, subprocess
import cv2, numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter

FONTS = {'black': '/usr/share/fonts/opentype/inter/InterDisplay-Black.otf',
         'blacki': '/usr/share/fonts/opentype/inter/InterDisplay-BlackItalic.otf'}
WHITE, RED = (255, 255, 255), (222, 32, 38)

# Har bir qator: matn, markaz (x, y kadr ulushida), shrift o'lchami (kadr enining ulushi), rang, kechikish (s)
LINES = [dict(text='AZIZ', x=0.50, y=0.24, size=0.34, font='black', color=WHITE, delay=0.00),
         dict(text='FLORAN', x=0.53, y=0.41, size=0.25, font='black', color=WHITE, delay=0.07)]

STYLE = dict(t0=0.3,        # kirish boshlanishi
             d_in=0.55,     # kirish davomiyligi
             hold=2.2,      # turib qolish
             d_out=0.45,    # chiqish
             ry=-42,        # perspektiva burchagi (chap tomoni yaqin, o'ngi uzoqda)
             rz=-4,         # biroz qiyalik
             side=-1,       # -1: chapdan kiradi, o'ngga chiqadi; 1: teskari
             behind=True)   # odamning orqasidan o'tadi


def ease_out(x): x = min(max(x, 0), 1); return 1 - (1 - x) ** 4
def ease_in(x): x = min(max(x, 0), 1); return x ** 3
def ease_back(x, s=1.1):
    x = min(max(x, 0), 1) - 1; return x * x * ((s + 1) * x + s) + 1


_cache = {}
def sprite(text, font, size, color):
    key = (text, font, size, color)
    if key in _cache: return _cache[key]
    f = ImageFont.truetype(FONTS[font], size)
    bb = f.getbbox(text); pad = int(size * 0.3)
    im = Image.new('RGBA', (bb[2] - bb[0] + 2 * pad, bb[3] - bb[1] + 2 * pad), (0, 0, 0, 0))
    ImageDraw.Draw(im).text((pad - bb[0], pad - bb[1]), text, font=f, fill=color + (255,))
    a = im.split()[3].filter(ImageFilter.GaussianBlur(size * 0.06))
    sh = Image.new('RGBA', im.size, (0, 0, 0, 0)); sh.putalpha(a.point(lambda v: int(v * 0.35)))
    arr = np.array(Image.alpha_composite(sh, im)).astype(np.float32)[..., [2, 1, 0, 3]] / 255
    arr[..., :3] *= arr[..., 3:4]
    _cache[key] = arr
    return arr


def place(layer, spr, cx, cy, scale, rz, ry, op):
    """Sprite'ni 3D (Y va Z aylanish) bilan premultiplied BGRA qatlamga qo'yadi."""
    if op <= 0.003: return
    H, W = layer.shape[:2]; h, w = spr.shape[:2]
    pts = np.array([[-w / 2, -h / 2, 0], [w / 2, -h / 2, 0], [w / 2, h / 2, 0], [-w / 2, h / 2, 0]]) * scale
    ry, rz = math.radians(ry), math.radians(rz)
    Ry = np.array([[math.cos(ry), 0, math.sin(ry)], [0, 1, 0], [-math.sin(ry), 0, math.cos(ry)]])
    Rz = np.array([[math.cos(rz), -math.sin(rz), 0], [math.sin(rz), math.cos(rz), 0], [0, 0, 1]])
    p = pts @ (Rz @ Ry).T
    fz = 1.6 * W; z = np.maximum(p[:, 2] + fz, 50)
    dst = np.stack([cx + p[:, 0] * fz / z, cy + p[:, 1] * fz / z], 1).astype(np.float32)
    x0, y0 = np.maximum(np.floor(dst.min(0)).astype(int) - 2, 0)
    x1, y1 = np.minimum(np.ceil(dst.max(0)).astype(int) + 2, [W, H])
    if x1 <= x0 or y1 <= y0: return
    M = cv2.getPerspectiveTransform(np.float32([[0, 0], [w, 0], [w, h], [0, h]]), (dst - [x0, y0]).astype(np.float32))
    out = cv2.warpPerspective(spr, M, (x1 - x0, y1 - y0), flags=cv2.INTER_LINEAR) * op
    reg = layer[y0:y1, x0:x1]
    reg[:] = out + reg * (1 - out[..., 3:4])


def line_state(ln, t, st, W):
    """Bitta qatorning t paytdagi holati: x siljish, ry, masshtab, shaffoflik."""
    s = st['side']; t_in = st['t0'] + ln['delay']; t_out = st['t0'] + st['d_in'] + st['hold'] + ln['delay']
    if t < t_in or t > t_out + st['d_out']: return None
    dx, ry, sc, op = 0.0, st['ry'], 1.0, 1.0
    if t < t_in + st['d_in']:                       # kirish: yondan uchib keladi, burilib to'g'rilanadi
        p = (t - t_in) / st['d_in']
        k = ease_out(p) * 0.15 + ease_back(p) * 0.85
        dx = s * (1 - k) * 1.25 * W; ry += s * (1 - k) * 50; sc = 1 + (1 - k) * 0.25; op = min(1, p * 4)
    life = t - t_in                                  # turish: sekin suzib, nafas oladi
    dx += -s * 0.018 * W * life + 0.004 * W * math.sin(life * 2.3)
    ry += 1.6 * math.sin(life * 1.7 + ln['delay'] * 9)
    sc *= 1 + 0.025 * life
    if t > t_out:                                    # chiqish: teskari tomonga tezlashib, chuqurlikka
        k = ease_in((t - t_out) / st['d_out'])
        dx += -s * k * 1.4 * W; ry += -s * k * 55; sc *= 1 - 0.25 * k; op *= 1 - max(0, k - 0.7) / 0.3
    return dx, ry, sc, op


def sweep_layer(t, W, H, lines=LINES, st=STYLE, samples=7, shutter=0.6, fps=30):
    """Motion blur bilan qatlam: kadr ichida bir necha vaqt nuqtasini o'rtachalaydi."""
    acc = np.zeros((H, W, 4), np.float32); n = 0
    for j in range(samples):
        ts = t + (j / (samples - 1) - 0.5) * shutter / fps
        lay = np.zeros((H, W, 4), np.float32); any_ = False
        for ln in lines:
            s = line_state(ln, ts, st, W)
            if s is None: continue
            dx, ry, sc, op = s; any_ = True
            spr = sprite(ln['text'], ln['font'], int(ln['size'] * W), ln['color'])
            place(lay, spr, ln['x'] * W + dx, ln['y'] * H, sc, st['rz'], ry, op)
        if any_: acc += lay
        n += 1
    return acc / n


def active_speed(t, lines=LINES, st=STYLE):
    """Kirish/chiqish paytida 0..1 (kamera zarbasi uchun)."""
    v = 0.0
    for ln in lines:
        a = st['t0'] + ln['delay']; b = a + st['d_in'] + st['hold']
        if a <= t <= a + st['d_in']: v = max(v, 1 - (t - a) / st['d_in'])
        if b <= t <= b + st['d_out']: v = max(v, (t - b) / st['d_out'])
    return v


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('bg'); ap.add_argument('out')
    ap.add_argument('--alpha'); ap.add_argument('--t0', type=float, default=STYLE['t0'])
    ap.add_argument('--hold', type=float, default=STYLE['hold']); ap.add_argument('--dur', type=float, default=0)
    ap.add_argument('--fps', type=int, default=30)
    a = ap.parse_args(); STYLE.update(t0=a.t0, hold=a.hold)
    is_img = a.bg.lower().endswith(('.png', '.jpg', '.jpeg', '.webp'))
    cap = None if is_img else cv2.VideoCapture(a.bg)
    still = cv2.imread(a.bg) if is_img else None
    H, W = still.shape[:2] if is_img else (int(cap.get(4)), int(cap.get(3)))
    end = STYLE['t0'] + STYLE['d_in'] + STYLE['hold'] + STYLE['d_out'] + max(l['delay'] for l in LINES)
    dur = a.dur or (end + 0.6 if is_img else cap.get(7) / a.fps)
    al = None
    if a.alpha:
        al = np.load(a.alpha, mmap_mode='r') if a.alpha.endswith('.npy') else cv2.imread(a.alpha, 0)
    ff = subprocess.Popen(['ffmpeg', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'bgr24', '-s', f'{W}x{H}', '-r', str(a.fps),
                           '-i', '-', '-c:v', 'libx264', '-preset', 'medium', '-crf', '16', '-pix_fmt', 'yuv420p', a.out], stdin=subprocess.PIPE)
    for i in range(int(dur * a.fps)):
        t = i / a.fps
        if is_img: f = still
        else:
            ok, f = cap.read()
            if not ok: break
        m = al if (al is None or al.ndim == 2) else al[min(i, len(al) - 1)]
        # kamera: sekin push-in + yengil silkinish + matn uchganda zarba
        v = active_speed(t)
        z = 1.06 + 0.035 * t / max(dur, 1) + 0.03 * v
        ang = 0.35 * math.sin(t * 3.1) + STYLE['side'] * 1.2 * v
        cx, cy = W / 2 + 3 * math.sin(t * 7.3), H / 2 + 3 * math.sin(t * 6.1 + 1)
        M = cv2.getRotationMatrix2D((cx, cy), ang, z)
        img = cv2.warpAffine(f, M, (W, H), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REFLECT).astype(np.float32) / 255
        k = int(v * 22) | 1
        if k > 3:                                    # whip blur kirish/chiqishda
            ker = np.zeros((k, k), np.float32); ker[k // 2] = 1 / k; img = cv2.filter2D(img, -1, ker)
        lay = sweep_layer(t, W, H, fps=a.fps)
        comp = lay[..., :3] + img * (1 - lay[..., 3:4])
        if m is not None and STYLE['behind']:        # odam matn ustida
            mm = cv2.warpAffine(m.astype(np.float32) / 255, M, (W, H))[..., None]
            comp = comp * (1 - mm) + img * mm
        ff.stdin.write((np.clip(comp, 0, 1) * 255 + 0.5).astype(np.uint8).tobytes())
    ff.stdin.close(); ff.wait()


if __name__ == '__main__':
    main()
