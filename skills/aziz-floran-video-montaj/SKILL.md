---
name: "aziz-floran-video-montaj"
description: "Edit a vertical talking/plant video in the Aziz Floran kinetic style: 3D/ring text passing behind person or trees, wall entrances, sketches, natural vivid colour. Use for 'videoni montaj qil' requests."
---

# Aziz Floran video montaj uslubi

The user (Uzbek, runs the plant nursery **Aziz Floran**) sends raw vertical phone videos (him talking to camera + rear-camera shots of trees). The goal is a dynamic kinetic-typography edit, like a reference reel (JOHNBUCOG-style). Reply to the user in Uzbek (Latin script), briefly.

## User's standing preferences (learned, MUST follow)
- **Only the user's own texts.** Use exactly the phrases he gives, at the moment he says them. Never invent filler words (no "mana", "mukammal", "OBUNA bo'ling", etc.). If he hasn't given texts, ask for them (or for the key phrases + price) before rendering; ASR of his Uzbek is unreliable.
- **Letter replacements in all on-screen text:** o' -> ö, ch -> ç, sh -> ş (e.g. "yölagida", "Muçagara", "şaklda", "Landşaft", "söm", "yaşil", "bölib").
- **Colour:** keep the original look, only more vivid & natural (`"natural": true`). No dark cinematic grade, no white border, almost no grain.
- **Very dynamic:** zoom punch on every word, jump-zoom levels changing on beats, smooth handheld shake, whip / zoom-blur / glitch transitions, flash on section changes.
- **Text passing behind the head/body must be smooth** (crossfade depth ~0.2 s with slight push-back) and the head/body must never disappear (clean, hole-filled, temporally smoothed matte).
- **Ring text:** red, semi-transparent (op ~0.75) text orbiting in 3D around the person's head or around the tree; back half goes behind head / foliage. Used for brand name ("AZIZ FLORAN •"), variety name ("ILEKS MUÇAGARA •"), price ("27.720.000 SÖM •").
- **Entrances not only head-on:** words come out of a "wall" (from left/right/top/bottom with a hinge rotation and a glowing edge line), letter-by-letter drops/flips, falls from the top, big perspective words sweeping in from the side ("NARXI").
- **"4 ta fasl ham yaşil bölib turadi"-type moments:** frame shrinks onto a white card, title animates on top (letters drop), more words on the card.
- **Explanatory sketches (chizma):** animated line drawings that draw themselves (e.g. multi-stem tree shape for "multiştamb şaklda"; path with trees on both sides + red arrows for "kirish yölagida 2 tarafga ekiladi").
- Price format: `27.720.000 söm`.

Last approved edit (template, see `gen.py` below): Assalomu aleykum (falls from top, passes behind head) -> AZIZ FLORAN ring around head -> "Narxi bilan!" letters -> ILEKS MUÇAGARA ring around tree -> "multiştamb şaklda" + multistem sketch -> white card "4 TA FASL / ham / YAŞIL / bölib turadi" -> "kirish yölagida / 2 TARAFGA / ekiladi" + entrance sketch -> NARXI (perspective) + 27.720.000 SÖM ring around tree -> LANDŞAFT daraxt -> AZIZ FLORAN ring. User said: "yaxshi, lekin yana ustida ishlaymiz" — keep improving.

## Environment notes (cloud workspace)
- pypi / huggingface are blocked; GitHub **release assets** work. onnxruntime, opencv, PIL, ffmpeg are preinstalled. CPU only (2 cores).
- Models (download to /home/claude/models):
  - Person matte: `https://github.com/PeterL1n/RobustVideoMatting/releases/download/v1.0.0/rvm_mobilenetv3_fp32.onnx` (~4 min per 30 s video)
  - ASR: `https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/sherpa-onnx-whisper-medium.tar.bz2` (1.9 GB, slow to extract; Uzbek recognition is rough — use only for timing)
  - (ISNet `https://github.com/danielgatis/rembg/releases/download/v0.0.0/isnet-general-use.onnx` segments only pot+trunk, not the crown — not used; foliage occlusion is done by sky-colour mask instead.)
- Fonts: Inter Display Black / Black Italic / Bold at /usr/share/fonts/opentype/inter/ (support ö ç ş).

## Workflow
1. Copy the video to `work/src.mp4` (vertical 720x1280 @30 fps; if different, scale/convert first with ffmpeg). Make a per-second contact sheet to find person segments vs tree segments.
2. Start the matte in background: `python3 matte.py` -> `alpha.npy`. Check mean alpha per frame to get exact `person` windows.
3. `ffmpeg -i src.mp4 -ac 1 -ar 16000 audio16.wav`; run `asr.py uz` (rough text + times) and the onset script (syllable beats). Map the user's phrases onto times.
4. Write `gen.py` (copy the template, change texts/times/positions), run it -> `timeline.json`.
5. Test-render short ranges: `python3 render.py START END q.mp4`, make contact sheets, check: text fits width, behind-head passes are smooth, head never cut, ring letters readable (front arc reads left->right).
6. Full render (~4-5 min), mux audio: `ffmpeg -i out_v.mp4 -i src.mp4 -map 0:v -map 1:a -c:v copy -c:a aac -b:a 192k -shortest final.mp4`, check a 4 fps contact sheet, send with SendUserFile.

Layout hints (720x1280): head top ~y 490-520, face centre ~y 600, so behind-head words at y ~550-590, ring around head center (372, 610) r~255. Tree crown ring center ~ (360, 450-520) r~320. Top captions y 200-440, bottom captions y 960-1100, sketches in a dark rounded panel at bottom.

## matte.py
```python
import cv2, numpy as np, onnxruntime as ort
so = ort.SessionOptions(); so.intra_op_num_threads = 2
s = ort.InferenceSession('/home/claude/models/rvm.onnx', so)
cap = cv2.VideoCapture('src.mp4'); W, H = 720, 1280
N = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
out = np.lib.format.open_memmap('alpha.npy', mode='w+', dtype=np.uint8, shape=(N, H, W))
rec = [np.zeros((1, 1, 1, 1), np.float32)] * 4; dsr = np.array([0.4], np.float32); i = 0
while True:
    ok, f = cap.read()
    if not ok or i >= N: break
    x = cv2.cvtColor(f, cv2.COLOR_BGR2RGB).astype(np.float32).transpose(2, 0, 1)[None] / 255
    fgr, pha, *rec = s.run(None, {'src': x, 'r1i': rec[0], 'r2i': rec[1], 'r3i': rec[2], 'r4i': rec[3], 'downsample_ratio': dsr})
    out[i] = (pha[0, 0] * 255).clip(0, 255).astype(np.uint8); i += 1
out.flush(); print('done', i)
```

## Onsets (word beats)
```python
import numpy as np, wave
w = wave.open('audio16.wav'); a = np.frombuffer(w.readframes(w.getnframes()), np.int16).astype(np.float32)
e = np.array([np.sqrt((a[i:i+400]**2).mean()) for i in range(0, len(a)-400, 160)])
e = np.convolve(e, np.ones(5)/5, 'same'); d = np.maximum(np.diff(e, prepend=e[0]), 0)
thr = np.percentile(d, 92); on = []
for i in range(2, len(d)-2):
    if d[i] > thr and d[i] == d[i-2:i+3].max() and (not on or i-on[-1] > 18): on.append(i)
print(' '.join(f'{i*0.01:.2f}' for i in on))
```

## asr.py (sherpa whisper-medium int8 via onnxruntime, timestamps)
```python
import numpy as np, onnxruntime as ort, wave, sys, base64, json
D = '/home/claude/models/sherpa-onnx-whisper-medium'; pref = 'medium'
LANG = sys.argv[1] if len(sys.argv) > 1 else 'uz'
so = ort.SessionOptions(); so.intra_op_num_threads = 2
enc = ort.InferenceSession(f'{D}/{pref}-encoder.int8.onnx', so)
dec = ort.InferenceSession(f'{D}/{pref}-decoder.int8.onnx', so)
meta = enc.get_modelmeta().custom_metadata_map
toks = {}
for line in open(f'{D}/{pref}-tokens.txt'):
    p = line.split()
    if len(p) == 2: toks[int(p[1])] = base64.b64decode(p[0])
sot = int(meta['sot']); eot = int(meta['eot']); transcribe = int(meta['transcribe'])
no_ts = int(meta['no_timestamps']); n_mels = int(meta.get('n_mels', 80))
langs = meta['all_language_codes'].split(','); ltoks = [int(x) for x in meta['all_language_tokens'].split(',')]
ts_begin = no_ts + 1
def hz2mel(f):
    f = np.asarray(f, float); m = f / (200 / 3)
    return np.where(f >= 1000, 15 + np.log(np.maximum(f, 1e-9) / 1000) / (np.log(6.4) / 27), m)
def mel2hz(m):
    m = np.asarray(m, float); return np.where(m >= 15, 1000 * np.exp((np.log(6.4) / 27) * (m - 15)), m * 200 / 3)
def melfb(sr=16000, n_fft=400, n_mels=80):
    fft_f = np.linspace(0, sr / 2, n_fft // 2 + 1)
    mel_f = mel2hz(np.linspace(hz2mel(0), hz2mel(sr / 2), n_mels + 2))
    fdiff = np.diff(mel_f); ramps = mel_f[:, None] - fft_f[None]; w = np.zeros((n_mels, len(fft_f)))
    for i in range(n_mels): w[i] = np.maximum(0, np.minimum(-ramps[i] / fdiff[i], ramps[i + 2] / fdiff[i + 1]))
    w *= (2.0 / (mel_f[2:n_mels + 2] - mel_f[:n_mels]))[:, None]; return w
FB = melfb(n_mels=n_mels)
def logmel(a):
    a = np.pad(a, (200, 200), mode='reflect'); win = np.hanning(401)[:-1]
    n = 1 + (len(a) - 400) // 160
    fr = np.stack([a[i * 160:i * 160 + 400] * win for i in range(n)])
    mag = (np.abs(np.fft.rfft(fr, axis=1)) ** 2)[:-1]
    l = np.log10(np.maximum(FB @ mag.T, 1e-10)); l = np.maximum(l, l.max() - 8); return (l + 4) / 4
w = wave.open('audio16.wav'); audio = np.frombuffer(w.readframes(w.getnframes()), np.int16).astype(np.float32) / 32768
def run(chunk, offset_s):
    mel = logmel(chunk); T = mel.shape[1]
    mel = (np.pad(mel, ((0, 0), (0, 3000 - T))) if T < 3000 else mel[:, :3000])[None].astype(np.float32)
    ck, cv = enc.run(None, {'mel': mel})
    sk = np.zeros((ck.shape[0], 1, 448, ck.shape[-1]), np.float32); sv = np.zeros_like(sk)
    tokens = np.array([[sot, ltoks[langs.index(LANG)], transcribe]], np.int64); off = np.array([0], np.int64); out = []
    for step in range(220):
        logits, sk, sv = dec.run(None, {'tokens': tokens, 'in_n_layer_self_k_cache': sk, 'in_n_layer_self_v_cache': sv,
                                        'n_layer_cross_k': ck, 'n_layer_cross_v': cv, 'offset': off})
        off = off + tokens.shape[1]; lg = logits[0, -1].copy()
        if len(out) == 0: lg[:ts_begin] = -np.inf
        if out and out[-1] >= ts_begin:
            if len(out) < 2 or out[-2] >= ts_begin: lg[ts_begin:] = -np.inf
            else: lg[:eot] = -np.inf
        lastts = max([t for t in out if t >= ts_begin], default=ts_begin); lg[ts_begin:lastts] = -np.inf
        t = int(np.argmax(lg))
        if t == eot: break
        out.append(t); tokens = np.array([[t]], np.int64)
    segs = []; cur = []; st = None
    for t in out:
        if t >= ts_begin:
            tt = (t - ts_begin) * 0.02 + offset_s
            if st is None: st = tt
            elif cur: segs.append([st, tt, b''.join(toks[x] for x in cur).decode('utf8', 'ignore').strip()]); cur = []; st = None
            else: st = tt
        elif t < eot: cur.append(t)
    if cur: segs.append([st or offset_s, offset_s + len(chunk) / 16000, b''.join(toks[x] for x in cur).decode('utf8', 'ignore').strip()])
    return segs
# short ~5 s chunks give better results than 30 s windows
for a, b in [(0, 5.3), (5, 11), (10.5, 16.5), (16, 23), (22.5, 27), (26.5, 32.2)]:
    print(a, b, ' | '.join(s[2] for s in run(audio[int(a*16000):int(b*16000)], a)), flush=True)
```

## render.py (compositor)
```python
import cv2, numpy as np, json, sys, subprocess, math
from PIL import Image, ImageDraw, ImageFont, ImageFilter

W, H, FPS = 720, 1280, 30
SRC = 'src.mp4'
alpha_all = np.load('alpha.npy', mmap_mode='r')
NF = alpha_all.shape[0]
cfg = json.load(open('timeline.json'))
FONTS = {'black': '/usr/share/fonts/opentype/inter/InterDisplay-Black.otf',
         'blacki': '/usr/share/fonts/opentype/inter/InterDisplay-BlackItalic.otf',
         'bold': '/usr/share/fonts/opentype/inter/InterDisplay-Bold.otf',
         'semi': '/usr/share/fonts/opentype/inter/InterDisplay-SemiBold.otf'}

def ease_out(x): x = min(max(x, 0), 1); return 1 - (1 - x) ** 3
def ease_io(x): x = min(max(x, 0), 1); return x * x * (3 - 2 * x)
def ease_back(x, s=1.4):
    x = min(max(x, 0), 1); x -= 1; return x * x * ((s + 1) * x + s) + 1
def lerp(a, b, t): return a + (b - a) * t

_cache = {}
def sprite(text, font, size, color, squeeze=1.0, stroke=0, shadow=True):
    key = (text, font, size, tuple(color), squeeze, shadow)
    if key in _cache: return _cache[key]
    f = ImageFont.truetype(FONTS[font], size)
    bb = f.getbbox(text); pad = int(size * 0.35)
    w, h = bb[2] - bb[0] + 2 * pad, bb[3] - bb[1] + 2 * pad
    im = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    ImageDraw.Draw(im).text((pad - bb[0], pad - bb[1]), text, font=f, fill=tuple(color) + (255,))
    if shadow:
        a = im.split()[3].filter(ImageFilter.GaussianBlur(size * 0.08))
        sh = Image.new('RGBA', im.size, (0, 0, 0, 0)); sh.putalpha(a.point(lambda v: int(v * 0.55)))
        im = Image.alpha_composite(sh, im)
    arr = np.array(im).astype(np.float32)[..., [2, 1, 0, 3]] / 255.0  # RGBA -> BGRA
    if squeeze != 1.0:
        arr = cv2.resize(arr, (max(1, int(w * squeeze)), h), interpolation=cv2.INTER_AREA)
    maxw = 650 + 2 * pad * squeeze  # auto-fit to frame width
    if arr.shape[1] > maxw:
        r = maxw / arr.shape[1]
        arr = cv2.resize(arr, (int(arr.shape[1] * r), int(arr.shape[0] * r)), interpolation=cv2.INTER_AREA)
    arr[..., :3] *= arr[..., 3:4]  # premultiply
    _cache[key] = arr
    return arr

def place(layer, spr, cx, cy, scale=1.0, rot_z=0.0, rot_y=0.0, rot_x=0.0, opacity=1.0, blur=0.0):
    if opacity <= 0.003 or scale <= 0.01: return
    h, w = spr.shape[:2]
    pts = np.array([[-w / 2, -h / 2, 0], [w / 2, -h / 2, 0], [w / 2, h / 2, 0], [-w / 2, h / 2, 0]], np.float64) * scale
    ry, rx, rz = map(math.radians, (rot_y, rot_x, rot_z))
    Ry = np.array([[math.cos(ry), 0, math.sin(ry)], [0, 1, 0], [-math.sin(ry), 0, math.cos(ry)]])
    Rx = np.array([[1, 0, 0], [0, math.cos(rx), -math.sin(rx)], [0, math.sin(rx), math.cos(rx)]])
    Rz = np.array([[math.cos(rz), -math.sin(rz), 0], [math.sin(rz), math.cos(rz), 0], [0, 0, 1]])
    p = pts @ (Rz @ Rx @ Ry).T
    fz = 1400.0; z = p[:, 2] + fz
    dst = np.stack([cx + p[:, 0] * fz / z, cy + p[:, 1] * fz / z], 1).astype(np.float32)
    src = np.array([[0, 0], [w, 0], [w, h], [0, h]], np.float32)
    M = cv2.getPerspectiveTransform(src, dst)
    x0, y0 = np.floor(dst.min(0)).astype(int) - 2; x1, y1 = np.ceil(dst.max(0)).astype(int) + 2
    x0c, y0c, x1c, y1c = max(x0, 0), max(y0, 0), min(x1, W), min(y1, H)
    if x1c <= x0c or y1c <= y0c: return
    T = np.array([[1, 0, -x0c], [0, 1, -y0c], [0, 0, 1]], np.float64) @ M
    out = cv2.warpPerspective(spr, T, (x1c - x0c, y1c - y0c), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT, borderValue=0)
    if blur > 0.5:
        k = int(blur) | 1; out = cv2.GaussianBlur(out, (k, k), 0)
    out *= opacity
    reg = layer[y0c:y1c, x0c:x1c]
    reg[:] = out + reg * (1 - out[..., 3:4])

# ---------- grading ----------
lut_x = np.arange(256) / 255.0
def build_lut():
    c = lut_x
    s = 1 / (1 + np.exp(-(c - 0.5) * 7.5)); s = (s - s.min()) / (s.max() - s.min())
    base = 0.03 + (0.68 * s + 0.32 * c) * 0.90
    r = np.clip(base * 1.03 + 0.012 * (c > 0.5), 0, 1); g = np.clip(base * 0.995, 0, 1)
    b = np.clip(base * 0.96 + 0.05 * (1 - c) ** 2, 0, 1)
    return [(np.stack([b, g, r], 1) * 255).astype(np.uint8)]
LUT_B, LUT_G, LUT_R = [build_lut()[0][:, i] for i in range(3)]
yy, xx = np.mgrid[0:H, 0:W]
VIG = (1 - 0.55 * (((xx - W / 2) / (W * 0.75)) ** 2 + ((yy - H / 2) / (H * 0.72)) ** 2)).clip(0.35, 1).astype(np.float32)[..., None]
_nl = np.arange(256) / 255.0
_ncurve = (np.clip(_nl + 0.06 * (np.tanh((_nl - 0.5) * 3) / np.tanh(1.5) * 0.5 + 0.5 - _nl), 0, 1) * 255).astype(np.uint8)
def natural(f):  # USER PREFERS THIS: original look, vivid natural colours
    f = cv2.LUT(f, _ncurve)
    hsv = cv2.cvtColor(f, cv2.COLOR_BGR2HSV).astype(np.float32)
    s = hsv[..., 1] / 255.0
    hsv[..., 1] = np.clip(255 * (s + (1 - s) * s * 0.55 + s * 0.12), 0, 255)
    return np.clip(cv2.cvtColor(hsv.astype(np.uint8), cv2.COLOR_HSV2BGR).astype(np.float32) / 255, 0, 1)
def grade(f, dark=0.82, sat=0.82):  # dark cinematic (user rejected as default)
    f = cv2.merge([cv2.LUT(f[..., 0], LUT_B), cv2.LUT(f[..., 1], LUT_G), cv2.LUT(f[..., 2], LUT_R)]).astype(np.float32) / 255
    gray = f.mean(2, keepdims=True); f = gray + (f - gray) * sat; lum = gray[..., 0]
    f[..., 0] += 0.045 * (1 - lum) ** 2; f[..., 1] += 0.015 * (1 - lum) ** 2; f[..., 2] += 0.035 * lum ** 2
    return np.clip(f * dark * VIG, 0, 1)

# ---------- camera ----------
def keyed(keys, t):
    if t <= keys[0][0]: return keys[0][1]
    for (t0, v0, *_), (t1, v1, *e) in zip(keys, keys[1:]):
        if t <= t1:
            x = (t - t0) / max(t1 - t0, 1e-6); mode = e[0] if e else 'io'
            x = ease_out(x) if mode == 'out' else ease_io(x) if mode == 'io' else x
            return lerp(v0, v1, x)
    return keys[-1][1]

def cam_matrix(t):
    z = keyed(cfg['zoom'], t)
    cx = keyed(cfg['camx'], t) if 'camx' in cfg else 0.5
    cy = keyed(cfg['camy'], t) if 'camy' in cfg else 0.5
    ang = keyed(cfg['camrot'], t) if 'camrot' in cfg else 0.0
    for p in cfg.get('punches', []):  # zoom/rotation kick per word, smooth decay
        dt = t - p[0]
        if -0.05 <= dt <= 0.6:
            k = (dt + 0.05) / 0.05 if dt < 0 else math.exp(-dt / 0.11)
            z *= 1 + p[1] * k; ang += p[2] * k if len(p) > 2 else 0
    sh = cfg.get('shake', 0)
    if sh:
        cx += sh * (math.sin(t * 7.1) * 0.6 + math.sin(t * 13.7 + 1) * 0.4) / W
        cy += sh * (math.sin(t * 6.3 + 2) * 0.6 + math.sin(t * 11.9) * 0.4) / H
        ang += sh * 0.05 * math.sin(t * 5.3 + 0.5)
    M = cv2.getRotationMatrix2D((W * cx, H * cy), ang, z)
    M[0, 2] += W / 2 - W * cx; M[1, 2] += H / 2 - H * cy
    return M

# ---------- matte cleanup (head/body never vanish) ----------
_prev_a = [None]
def cfg_has_person(t): return any(s <= t <= e for s, e in cfg['person'])
def clean_alpha(a_u8, idx):
    a = a_u8.astype(np.float32) / 255
    if cfg_has_person(idx / FPS):
        m = (a > 0.5).astype(np.uint8)
        n, lab, st, _ = cv2.connectedComponentsWithStats(m, 8)
        if n > 1:
            keep = np.zeros(n, bool); big = st[1:, cv2.CC_STAT_AREA]
            keep[1:] = big > max(1500, big.max() * 0.08); m2 = keep[lab]
            a = np.where(m2 | (a < 0.5), a, 0) * 1.0
            a = a * (cv2.dilate(m2.astype(np.uint8), np.ones((25, 25), np.uint8)) > 0)
        solid = cv2.morphologyEx((a > 0.5).astype(np.uint8), cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (31, 31)))
        ff = solid.copy(); hmask = np.zeros((H + 2, W + 2), np.uint8); cv2.floodFill(ff, hmask, (0, 0), 1)
        a = np.maximum(a, (ff == 0) * 1.0)
        a = np.maximum(a, cv2.erode(solid, np.ones((5, 5), np.uint8)).astype(np.float32))
        a = cv2.GaussianBlur(a, (5, 5), 0)
    else:
        a = np.zeros_like(a)
    if _prev_a[0] is not None: a = 0.65 * a + 0.35 * _prev_a[0]
    _prev_a[0] = a
    return a

_prev_fol = [None]
def foliage_mask(f):  # non-sky = occluder in tree shots (ring passes behind trees)
    hsv = cv2.cvtColor(f, cv2.COLOR_BGR2HSV)
    h, sa, v = [hsv[..., i].astype(np.int16) for i in range(3)]
    sky = (((h >= 88) & (h <= 135) & (sa > 25) & (v > 100)) | ((sa < 50) & (v > 150))).astype(np.uint8)
    sky = cv2.morphologyEx(sky, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
    n, lab, st, _ = cv2.connectedComponentsWithStats(sky, 4)
    keep = np.zeros(n, bool); keep[np.unique(lab[:12][sky[:12] > 0])] = True; keep[0] = False
    fol = cv2.GaussianBlur(1 - keep[lab].astype(np.float32), (5, 5), 0)
    if _prev_fol[0] is not None: fol = 0.6 * fol + 0.4 * _prev_fol[0]
    _prev_fol[0] = fol
    return fol

# ---------- text items ----------
def item_state(it, t):
    t0, t1 = it['t0'], it['t1']
    if t < t0 - 0.001 or t > t1 + it.get('out_d', cfg.get('out_d', 0.25)): return None
    d_in = it.get('in_d', cfg.get('in_d', 0.28)); d_out = it.get('out_d', cfg.get('out_d', 0.22))
    pin = (t - t0) / d_in; pout = (t - t1) / d_out
    s = dict(x=it['x'], y=it['y'], scale=1.0, rz=it.get('rz', 0), ry=0.0, rx=0.0, op=1.0, blur=0.0)
    anim = it.get('anim', 'pop')
    if anim == 'fall':
        k = ease_back(pin, 1.2); s['y'] -= (1 - k) * it.get('dy', 650); s['rz'] += (1 - k) * it.get('wob', 12); s['op'] = min(1, pin * 3); s['blur'] = (1 - ease_out(pin)) * 10
    elif anim == 'persp':
        k = ease_out(pin); s['x'] += (1 - k) * it.get('dx', -600); s['ry'] = it.get('ry_hold', 38) + (1 - k) * 45; s['op'] = min(1, pin * 2.5); s['blur'] = (1 - k) * 10
    elif anim == 'pop':
        k = ease_back(pin); s['scale'] = lerp(0.55, 1, k); s['op'] = min(1, pin * 2.5); s['blur'] = (1 - ease_out(pin)) * 9
    elif anim == 'rise':
        k = ease_out(pin); s['y'] += (1 - k) * 70; s['op'] = min(1, pin * 2); s['blur'] = (1 - k) * 7
    elif anim == 'roty':
        k = ease_out(pin); s['ry'] = (1 - k) * it.get('from', -80); s['op'] = min(1, pin * 2.5)
    elif anim == 'rotx':
        k = ease_out(pin); s['rx'] = (1 - k) * it.get('from', 85); s['op'] = min(1, pin * 2.5)
    elif anim == 'slam':
        k = ease_out(pin); s['scale'] = lerp(2.4, 1, k); s['op'] = min(1, pin * 3); s['blur'] = (1 - k) * 12
    elif anim in ('wall_l', 'wall_r'):
        k = ease_out(pin); sgn = -1 if anim == 'wall_l' else 1
        s['x'] += sgn * (1 - k) * it.get('dx', 520); s['ry'] = sgn * (1 - k) * 55
    elif anim in ('wall_t', 'wall_b'):
        k = ease_out(pin); sgn = -1 if anim == 'wall_t' else 1
        s['y'] += sgn * (1 - k) * it.get('dy', 260); s['rx'] = -sgn * (1 - k) * 60
    elif anim == 'slide':
        k = ease_out(pin); s['x'] += (1 - k) * it.get('dx', 300); s['op'] = min(1, pin * 2.5); s['blur'] = (1 - k) * 10
    life = t - t0
    s['ry'] += it.get('spin_y', 0) * life; s['rz'] += it.get('spin_z', 0) * life
    s['scale'] *= 1 + it.get('grow', 0.02) * life
    s['x'] += it.get('vx', 0) * life; s['y'] += it.get('vy', 0) * life
    if pout > 0:
        k = ease_io(pout); out = it.get('out', 'fade')
        if out == 'fade': s['op'] *= 1 - k; s['blur'] += k * 8
        elif out == 'up': s['op'] *= 1 - k; s['y'] -= k * 60; s['blur'] += k * 8
        elif out == 'rot': s['op'] *= 1 - k; s['ry'] += k * 80
        elif out == 'cut': s['op'] = 0
        elif out == 'fly': s['scale'] *= 1 + 2.2 * k * k; s['op'] *= 1 - k; s['blur'] += k * 14
        elif out == 'drop': s['y'] += k * k * 500; s['rz'] += k * 25; s['op'] *= 1 - k * 0.8
        elif out == 'spin': s['rx'] += k * 90; s['op'] *= 1 - k
    dk = it.get('depth', 1.0)  # 1 = in front, 0 = behind subject
    if isinstance(dk, list): dk = keyed(dk, t)
    s['depth'] = dk
    if isinstance(it.get('depth'), list): s['scale'] *= 1 - 0.07 * (1 - dk)  # push back while passing behind
    return s

def ring_draw(it, t, front, back):
    t0, t1 = it['t0'], it['t1']
    if t < t0 or t > t1 + 0.35: return
    pin = ease_out((t - t0) / 0.45); pout = ease_io((t - t1) / 0.35) if t > t1 else 0
    R = it.get('r', 300) * lerp(0.35, 1, pin) * (1 + 0.6 * pout)
    op = it.get('op', 0.72) * min(1, (t - t0) / 0.25) * (1 - pout)
    tilt = math.radians(it.get('tilt', 14))
    spin = it.get('spin', 70) * (t - t0) + 260 * (1 - pin) * (1 if it.get('spin', 70) > 0 else -1)
    size = it.get('size', 66); f = ImageFont.truetype(FONTS[it.get('font', 'blacki')], size)
    reps = max(1, int(2 * math.pi * it.get('r', 300) // f.getlength(it['text'])))
    chars = list(it['text'] * reps); widths = [f.getlength(c) for c in chars]; tot = sum(widths); acc = 0
    for c, w in zip(chars, widths):
        th = 2 * math.pi * (acc + w / 2) / tot + math.radians(spin); acc += w
        if c == ' ': continue
        X = -R * math.sin(th); Z = R * math.cos(th)
        Y = Z * math.sin(tilt); Zt = Z * math.cos(tilt)
        sc = 1400.0 / (1400.0 + Zt)
        spr = sprite(c, it.get('font', 'blacki'), size, it.get('color', [218, 30, 34]), 1.0, shadow=False)
        dep = 1 - ease_io((Zt / R + 0.18) / 0.36)  # smooth front/back crossfade at the sides
        ry = 180 - math.degrees(th)  # front arc faces camera, reads left->right
        x = it['x'] + X * sc; y = it['y'] - Y * sc
        if dep > 0.001: place(front, spr, x, y, sc, it.get('rz', 0), ry, 0, op * dep)
        if dep < 0.999: place(back, spr, x, y, sc, it.get('rz', 0), ry, 0, op * (1 - dep))

def letters_draw(it, t, front, back):
    t0, t1 = it['t0'], it['t1']
    if t < t0 or t > t1 + 0.3: return
    f = ImageFont.truetype(FONTS[it.get('font', 'black')], it.get('size', 90))
    txt = it['text']; sq = it.get('squeeze', 1.0)
    widths = [f.getlength(c) * sq for c in txt]
    x = it['x'] - sum(widths) / 2; stag = it.get('stagger', 0.045)
    for j, (c, w) in enumerate(zip(txt, widths)):
        cx = x + w / 2; x += w
        if c == ' ': continue
        p = (t - t0 - j * stag) / 0.3
        if p <= 0: continue
        k = ease_back(min(p, 1), 1.8)
        po = ease_io((t - t1 - j * 0.02) / 0.25) if t > t1 else 0
        spr = sprite(c, it.get('font', 'black'), it.get('size', 90), it.get('color', [255, 255, 255]), sq)
        if it.get('mode', 'flip') == 'flip':
            place(front, spr, cx, it['y'] - (1 - k) * 60 + po * 80, 1, it.get('rz', 0), 0, (1 - k) * 95 - po * 90, min(1, p * 2) * (1 - po))
        else:  # drop from above with spin
            place(front, spr, cx, it['y'] - (1 - k) * 260 - po * 120, lerp(1.6, 1, k), (1 - k) * (25 if j % 2 else -25), 0, 0, min(1, p * 2) * (1 - po), (1 - min(p, 1)) * 8)

def _poly_len(p): return float(np.sum(np.linalg.norm(np.diff(p, axis=0), axis=1))) if len(p) > 1 else 0.0
def sketch_draw(it, t, front):  # self-drawing line sketch (chizma)
    t0, t1 = it['t0'], it['t1']
    if t < t0 or t > t1 + 0.3: return
    bx, by, bw, bh = it['box']
    op = min(1, (t - t0) / 0.15) * (1 - (ease_io((t - t1) / 0.3) if t > t1 else 0))
    shapes = [(np.array(p, np.float64) * [bw, bh] + [bx, by], col, th) for p, col, th in it['shapes']]
    lens = [_poly_len(p) for p, _, _ in shapes]
    budget = ease_io((t - t0) / it.get('draw', 1.2)) * (sum(lens) + 1e-6)
    lay = np.zeros((H, W, 3), np.float32); am = np.zeros((H, W), np.float32)
    if it.get('panel'):
        pad = 22; x0, y0, x1, y1 = int(bx - pad), int(by - pad), int(bx + bw + pad), int(by + bh + pad)
        pm = np.zeros((H, W), np.float32)
        cv2.rectangle(pm, (x0 + 20, y0), (x1 - 20, y1), 1, -1); cv2.rectangle(pm, (x0, y0 + 20), (x1, y1 - 20), 1, -1)
        for c_ in ((x0 + 20, y0 + 20), (x1 - 20, y0 + 20), (x0 + 20, y1 - 20), (x1 - 20, y1 - 20)): cv2.circle(pm, c_, 20, 1, -1)
        pm = cv2.GaussianBlur(pm, (7, 7), 0) * 0.42 * op
        front[..., :3] *= (1 - pm[..., None]); front[..., 3] = front[..., 3] * (1 - pm) + pm
    for (p, col, th), L in zip(shapes, lens):
        if budget <= 0: break
        if budget < L:
            seg = np.linalg.norm(np.diff(p, axis=0), axis=1); cum = np.concatenate([[0], np.cumsum(seg)])
            j = max(0, min(np.searchsorted(cum, budget) - 1, len(seg) - 1))
            p = np.vstack([p[:j + 1], p[j] + (p[j + 1] - p[j]) * (budget - cum[j]) / max(seg[j], 1e-6)])
        budget -= L
        pts = (p * 4).astype(np.int32).reshape(-1, 1, 2)
        cv2.polylines(lay, [pts], False, [col[2] / 255, col[1] / 255, col[0] / 255], th, cv2.LINE_AA, shift=2)
        cv2.polylines(am, [pts], False, 1.0, th, cv2.LINE_AA, shift=2)
    a = np.clip(am, 0, 1) * op
    sh = cv2.GaussianBlur(am, (0, 0), 3) * 0.6 * op
    front[..., :3] *= (1 - sh[..., None]); front[..., 3] = front[..., 3] * (1 - sh) + sh
    front[..., :3] = lay * a[..., None] + front[..., :3] * (1 - a[..., None]); front[..., 3] = a + front[..., 3] * (1 - a)

def draw_items(t, front, back):
    for it in cfg['items']:
        if it.get('type') == 'ring': ring_draw(it, t, front, back); continue
        if it.get('type') == 'letters': letters_draw(it, t, front, back); continue
        if it.get('type') == 'sketch': sketch_draw(it, t, front); continue
        st = item_state(it, t)
        if st is None: continue
        spr = sprite(it['text'], it.get('font', 'black'), it.get('size', 90), it.get('color', [255, 255, 255]), it.get('squeeze', 1.0))
        if it.get('wall') is not None:  # comes out from behind a wall line
            tmp = np.zeros_like(front)
            place(tmp, spr, st['x'], st['y'], st['scale'], st['rz'], st['ry'], st['rx'], st['op'], st['blur'])
            wl = it['wall']; an = it['anim']
            if an == 'wall_l': tmp[:, :max(0, wl)] = 0
            elif an == 'wall_r': tmp[:, min(W, wl):] = 0
            elif an == 'wall_t': tmp[:max(0, wl)] = 0
            elif an == 'wall_b': tmp[min(H, wl):] = 0
            if t - it['t0'] < it.get('in_d', 0.35) + 0.15:  # glowing wall edge
                gk = 1 - (t - it['t0']) / (it.get('in_d', 0.35) + 0.15)
                if an in ('wall_l', 'wall_r'):
                    y0 = int(st['y'] - it.get('size', 90) * 0.8); y1 = int(st['y'] + it.get('size', 90) * 0.8)
                    tmp[max(0, y0):max(0, y1), max(0, wl - 2):wl + 2] = gk
                else:
                    tmp[max(0, wl - 2):wl + 2, max(0, int(st['x'] - 330)):max(0, int(st['x'] + 330))] = gk
            front[:] = tmp + front * (1 - tmp[..., 3:4]); continue
        dep = st['depth']
        if dep > 0.001: place(front, spr, st['x'], st['y'], st['scale'], st['rz'], st['ry'], st['rx'], st['op'] * dep, st['blur'])
        if dep < 0.999: place(back, spr, st['x'], st['y'], st['scale'], st['rz'], st['ry'], st['rx'], st['op'] * (1 - dep), st['blur'])

def over(dst, layer): return layer[..., :3] + dst * (1 - layer[..., 3:4])

# ---------- transitions ----------
def white_card(img, t, tr):
    t0, t1 = tr['t0'], tr['t1']
    if not (t0 <= t <= t1): return img
    p = (t - t0) / (t1 - t0)
    k = ease_io(min(p / 0.3, 1)) if p < 0.5 else ease_io(min((1 - p) / 0.3, 1))
    sc = lerp(1.0, tr.get('scale', 0.62), k); bg = np.ones_like(img)
    small = cv2.resize(img, (int(W * sc), int(H * sc)), interpolation=cv2.INTER_AREA)
    y = int(H / 2 - small.shape[0] / 2 + k * tr.get('dy', 140)); x = int(W / 2 - small.shape[1] / 2)
    bg[y:y + small.shape[0], x:x + small.shape[1]] = small
    return bg

def glitch(img, t, g):
    if not (g['t0'] <= t <= g['t1']): return img
    amp = math.sin((t - g['t0']) / (g['t1'] - g['t0']) * math.pi)
    rng = np.random.default_rng(int(t * 1000)); out = img.copy(); bs = int(4 + 22 * amp)
    if bs > 5:
        pix = cv2.resize(cv2.resize(img, (W // bs, H // bs), interpolation=cv2.INTER_AREA), (W, H), interpolation=cv2.INTER_NEAREST)
        for _ in range(int(10 * amp) + 2):
            y = rng.integers(0, H - 60); h = rng.integers(20, 160); out[y:y + h] = pix[y:y + h]
    sh = int(14 * amp)
    if sh: out[..., 2] = np.roll(out[..., 2], sh, 1); out[..., 0] = np.roll(out[..., 0], -sh, 1)
    return out

def whip_blur(img, t, wb):
    if not (wb['t0'] <= t <= wb['t1']): return img
    k = int(math.sin((t - wb['t0']) / (wb['t1'] - wb['t0']) * math.pi) * wb.get('k', 60)) | 1
    if k < 3: return img
    ker = np.zeros((k, k), np.float32)
    if wb.get('dir', 'h') == 'h': ker[k // 2, :] = 1 / k
    else: ker[:, k // 2] = 1 / k
    return cv2.filter2D(img, -1, ker)

def zoom_blur(img, t, zb):
    if not (zb['t0'] <= t <= zb['t1']): return img
    amp = math.sin((t - zb['t0']) / (zb['t1'] - zb['t0']) * math.pi) * zb.get('a', 0.12)
    acc = img.copy(); n = 6
    for j in range(1, n):
        acc += cv2.warpAffine(img, cv2.getRotationMatrix2D((W / 2, H / 2), 0, 1 + amp * j / n), (W, H), borderMode=cv2.BORDER_REFLECT)
    return acc / n

def main():
    start = int(sys.argv[1]) if len(sys.argv) > 1 else 0
    end = int(sys.argv[2]) if len(sys.argv) > 2 else NF
    outp = sys.argv[3] if len(sys.argv) > 3 else 'out_v.mp4'
    cap = cv2.VideoCapture(SRC); cap.set(cv2.CAP_PROP_POS_FRAMES, start)
    ff = subprocess.Popen(['ffmpeg', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'bgr24', '-s', f'{W}x{H}', '-r', str(FPS), '-i', '-',
                           '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '16', '-pix_fmt', 'yuv420p', outp], stdin=subprocess.PIPE)
    rng = np.random.default_rng(1)
    grain = [rng.standard_normal((H // 2, W // 2)).astype(np.float32) for _ in range(6)]
    for i in range(start, end):
        ok, f = cap.read()
        if not ok: break
        t = i / FPS
        M = cam_matrix(t)
        f = cv2.warpAffine(f, M, (W, H), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REFLECT)
        a = cv2.warpAffine(clean_alpha(alpha_all[i], i), M, (W, H), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT)
        if any(s0 <= t <= s1 for s0, s1 in cfg.get('foliage', [])): a = np.maximum(a, foliage_mask(f))
        a = a[..., None]
        f = cv2.addWeighted(f, 1.45, cv2.GaussianBlur(f, (0, 0), 1.6), -0.45, 0)  # detail
        img = natural(f) if cfg.get('natural') else grade(f, dark=keyed(cfg['dark'], t) if 'dark' in cfg else 0.85, sat=0.9)
        front = np.zeros((H, W, 4), np.float32); back = np.zeros((H, W, 4), np.float32)
        draw_items(t, front, back)
        comp = over(img, back)              # text behind
        comp = comp * (1 - a) + img * a     # person / foliage on top
        comp = over(comp, front)            # text in front
        for wb in cfg.get('whips', []): comp = whip_blur(comp, t, wb)
        for zb in cfg.get('zoomblurs', []): comp = zoom_blur(comp, t, zb)
        for g in cfg.get('glitches', []): comp = glitch(comp, t, g)
        for tr in cfg.get('cards', []): comp = white_card(comp, t, tr)
        if any(tr['t0'] <= t <= tr['t1'] for tr in cfg.get('cards', [])):
            lay = np.zeros((H, W, 4), np.float32)
            for it in cfg.get('card_items', []):
                if it.get('type') == 'letters': letters_draw(it, t, lay, lay); continue
                st = item_state(it, t)
                if st is None: continue
                spr = sprite(it['text'], it.get('font', 'black'), it.get('size', 60), it.get('color', [15, 15, 15]), it.get('squeeze', 1.0), shadow=False)
                place(lay, spr, st['x'], st['y'], st['scale'], st['rz'], st['ry'], st['rx'], st['op'], st['blur'])
            comp = over(comp, lay)
        for fl in cfg.get('flashes', []):
            if fl[0] <= t <= fl[0] + fl[1]: comp = comp + (1 - comp) * (1 - (t - fl[0]) / fl[1]) * 0.85
        if 'fade' in cfg:
            fi, fo = cfg['fade']
            if t < fi: comp *= t / fi
            if t > NF / FPS - fo: comp *= max(0, (NF / FPS - t) / fo)
        comp = np.clip(comp + cv2.resize(grain[i % 6], (W, H))[..., None] * (0.004 if cfg.get('natural') else 0.009), 0, 1)
        if cfg.get('border'):
            bw = cfg['border']; comp[:bw] = 1; comp[-bw:] = 1; comp[:, :bw] = 1; comp[:, -bw:] = 1
        ff.stdin.write((comp * 255 + 0.5).astype(np.uint8).tobytes())
        if i % 60 == 0: print(i, flush=True)
    ff.stdin.close(); ff.wait()

if __name__ == '__main__':
    main()
```

## gen.py (timeline template = last approved video; edit texts/times per video)
```python
import json, math
RED = [222, 32, 38]; WHITE = [255, 255, 255]; GREEN = [40, 160, 70]
items = []
def add(t0, t1, out='fly', **k):
    d = dict(t0=t0, t1=t1, out=out); d.update(k); items.append(d); return d
def ring(t0, t1, text, x, y, r=290, tilt=14, spin=75, size=74, op=0.75, color=RED):
    return add(t0, t1, type='ring', text=text, x=x, y=y, r=r, tilt=tilt, spin=spin, size=size, op=op, color=color)
def letters(t0, t1, text, x, y, size=120, font='black', color=None, mode='flip', squeeze=1.0, stagger=0.045, lst=None):
    d = dict(t0=t0, t1=t1, type='letters', text=text, x=x, y=y, size=size, font=font, mode=mode, squeeze=squeeze, stagger=stagger)
    if color: d['color'] = color
    (lst if lst is not None else items).append(d); return d
def wall(t0, t1, text, x, y, side, wallpos, size=90, font='black', color=None, out='fly', **k):
    d = add(t0, t1, out, text=text, x=x, y=y, size=size, font=font, anim='wall_' + side, wall=wallpos, in_d=0.38, **k)
    if color: d['color'] = color
    return d
def behind(d, t0, a=0.25, b=0.45):  # in front first, then smoothly behind the head
    d['depth'] = [[t0, 1], [t0 + a, 1], [t0 + b, 0]]; return d

def multistem():  # sketch: multi-stem tree in pot
    sh = [[[(0.30, 0.80), (0.70, 0.80), (0.65, 1.0), (0.35, 1.0), (0.30, 0.80)], WHITE, 5], [[(0.28, 0.80), (0.72, 0.80)], WHITE, 5]]
    for x0, x1, bend in ((0.43, 0.24, -0.05), (0.47, 0.42, 0.02), (0.53, 0.60, -0.02), (0.57, 0.77, 0.05)):
        sh.append([[(x0 + (x1 - x0) * (i / 20) + bend * math.sin(i / 20 * math.pi), 0.80 - i / 20 * 0.40) for i in range(21)], WHITE, 6])
    crown = []
    for i in range(121):
        a = 2 * math.pi * i / 120; r = 1 + 0.07 * math.sin(9 * a) + 0.03 * math.sin(4 * a)
        crown.append((0.5 + 0.47 * r * math.cos(a), 0.27 + 0.25 * r * math.sin(a)))
    sh.append([crown, GREEN, 6])
    sh.append([[(0.24, 0.42), (0.06, 0.60), (0.06, 0.74)], RED, 4]); sh.append([[(0.77, 0.44), (0.95, 0.60), (0.95, 0.74)], RED, 4])
    return sh

def entrance():  # sketch: path with trees planted on both sides + arrows
    sh = [[[(0.28, 1.0), (0.47, 0.05)], WHITE, 5], [[(0.72, 1.0), (0.53, 0.05)], WHITE, 5]]
    for k in range(6):
        v0 = 0.95 - k * 0.16; sh.append([[(0.5, v0), (0.5, v0 - 0.08)], WHITE, 3])
    for d in (0.88, 0.62, 0.38, 0.18):
        sc = 0.35 + 0.65 * d; y = 0.05 + 0.95 * d
        for side in (-1, 1):
            x = 0.5 + side * (0.03 + 0.22 * d) + side * 0.07 * sc
            sh.append([[(x, y), (x, y - 0.16 * sc)], WHITE, max(2, int(5 * sc))])
            sh.append([[(x + 0.06 * sc * math.cos(2 * math.pi * i / 40), y - 0.27 * sc + 0.11 * sc * math.sin(2 * math.pi * i / 40)) for i in range(41)], GREEN, max(3, int(6 * sc))])
    sh += [[[(0.12, 0.93), (0.40, 0.93)], RED, 5], [[(0.17, 0.89), (0.12, 0.93), (0.17, 0.97)], RED, 5],
           [[(0.60, 0.93), (0.88, 0.93)], RED, 5], [[(0.83, 0.89), (0.88, 0.93), (0.83, 0.97)], RED, 5]]
    return sh

behind(add(0.25, 1.85, 'fly', text='Assalomu', x=330, y=470, size=118, font='black', anim='fall', in_d=0.42, wob=-10), 0.25, 0.42, 0.62)
behind(add(0.55, 1.85, 'fly', text='aleykum', x=400, y=585, size=150, font='blacki', color=RED, anim='fall', in_d=0.42, wob=12, grow=0.04), 0.55, 0.42, 0.62)
ring(1.85, 3.85, 'AZIZ FLORAN • ', 372, 610, r=255, tilt=15, spin=95, size=78)
letters(3.94, 4.85, 'Narxi bilan!', 360, 980, 112, 'blacki', RED, mode='drop', stagger=0.035)
ring(5.95, 7.95, 'ILEKS MUÇAGARA • ', 360, 470, r=320, tilt=13, spin=65, size=84)
wall(6.25, 7.95, 'Ileks Muçagara', 360, 215, 'l', 60, size=72, out='up')
wall(7.97, 9.9, 'multiştamb', 360, 205, 'r', 690, size=104, font='blacki', color=RED)
wall(8.25, 9.9, 'şaklda', 360, 310, 'l', 120, size=80)
add(8.0, 9.9, type='sketch', box=[390, 760, 300, 400], shapes=multistem(), draw=1.3, panel=True)
wall(16.9, 21.6, 'kirish yölagida', 360, 215, 'l', 60, size=78, out='up')
letters(17.6, 21.6, '2 TARAFGA', 360, 330, 120, 'blacki', RED, mode='drop', squeeze=0.9)
wall(18.4, 21.6, 'ekiladi', 360, 440, 'r', 640, size=96)
add(17.3, 21.6, type='sketch', box=[110, 760, 500, 380], shapes=entrance(), draw=2.4, panel=True)
add(23.0, 25.85, 'fly', text='NARXI', x=330, y=250, size=230, font='blacki', color=RED, anim='persp', in_d=0.4, dx=-650, ry_hold=34, grow=0.02)
ring(23.5, 25.85, '27.720.000 SÖM • ', 360, 520, r=320, tilt=14, spin=70, size=86, op=0.82)
wall(24.0, 25.85, '27.720.000 söm', 360, 1060, 'b', 1120, size=92)
letters(26.9, 28.6, 'LANDŞAFT', 360, 330, 150, 'black', mode='drop', squeeze=0.85, stagger=0.05)
behind(add(27.3, 28.6, 'fly', text='daraxt', x=380, y=560, size=170, font='blacki', color=RED, anim='slam', grow=0.05), 27.3)
ring(28.7, 31.3, 'AZIZ FLORAN • ', 372, 610, r=255, tilt=-15, spin=-90, size=80)

card_items = []
letters(10.97, 14.6, '4 TA FASL', 360, 165, 118, 'blacki', RED, mode='drop', stagger=0.06, lst=card_items)
card_items.append({'text': 'ham', 't0': 12.17, 't1': 14.6, 'x': 360, 'y': 262, 'size': 56, 'font': 'bold', 'color': [15, 15, 15], 'anim': 'rotx', 'from': 80, 'out': 'fly', 'in_d': 0.2})
letters(12.38, 14.6, 'YAŞIL', 360, 350, 112, 'black', [30, 140, 60], mode='flip', stagger=0.05, lst=card_items)
card_items.append({'text': 'bölib turadi', 't0': 13.97, 't1': 14.6, 'x': 360, 'y': 1215, 'size': 54, 'font': 'black', 'color': [15, 15, 15], 'anim': 'rise', 'out': 'fly', 'in_d': 0.2})

punches = []
for n, i in enumerate(sorted(items + card_items, key=lambda d: d['t0'])):
    big = i.get('size', 0) >= 110 or i.get('type') == 'ring'
    punches.append([i['t0'], 0.08 if big else 0.035, (1.5 if n % 2 else -1.5) if big else 0])
# jump-zoom levels switching on beats (eased), slow push while holding
jumps = [(0, 1.22), (0.6, 1.08), (1.85, 1.16), (2.92, 1.06), (3.94, 1.14), (4.30, 1.04), (5.6, 1.2), (6.25, 1.06), (7.97, 1.16), (8.95, 1.06),
         (15.2, 1.15), (16.5, 1.05), (17.6, 1.16), (18.9, 1.06), (20.07, 1.14), (21.7, 1.06), (23.0, 1.2), (24.0, 1.08), (25.2, 1.14),
         (26.7, 1.06), (27.3, 1.14), (28.7, 1.05), (29.8, 1.12), (30.6, 1.05), (31.4, 1.15)]
DUR = 32.2
zoom = []
for k, (t, z) in enumerate(jumps):
    nxt = jumps[k + 1][0] if k + 1 < len(jumps) else DUR
    zoom.append([t, z, 'out']); zoom.append([max(t + 0.1, nxt - 0.1), z * 1.035, 'lin'])
zoom[0] = [0, 1.22]

cfg = {
 'natural': True, 'person': [[0, 5.25], [26.6, 31.4]], 'foliage': [[5.5, 26.0]],
 'fade': [0.15, 0.35], 'border': 0, 'shake': 6, 'in_d': 0.2, 'out_d': 0.2, 'zoom': zoom,
 'camrot': [[0, -3.0], [0.5, 0, 'out'], [4.9, 0], [5.1, 4.0], [5.5, 0, 'out'], [9.9, 0], [10.2, -3], [10.5, 0, 'out'], [21.6, 0], [21.8, 3], [22.1, 0, 'out'], [26.3, -4], [26.8, 0, 'out']],
 'punches': punches,
 'whips': [{'t0': 4.85, 't1': 5.45, 'k': 80, 'dir': 'h'}, {'t0': 25.9, 't1': 26.75, 'k': 90, 'dir': 'h'}],
 'zoomblurs': [{'t0': 9.85, 't1': 10.35, 'a': 0.18}, {'t0': 14.85, 't1': 15.3, 'a': 0.2}, {'t0': 22.8, 't1': 23.15, 'a': 0.16}, {'t0': 1.7, 't1': 2.0, 'a': 0.08}, {'t0': 16.6, 't1': 16.9, 'a': 0.1}],
 'glitches': [{'t0': 16.0, 't1': 16.4}, {'t0': 21.65, 't1': 22.0}],
 'flashes': [[5.15, 0.14], [26.6, 0.12], [10.3, 0.1]],
 'cards': [{'t0': 10.35, 't1': 15.0, 'scale': 0.56, 'dy': 190}],
 'card_items': card_items, 'items': items,
}
json.dump(cfg, open('timeline.json', 'w'), indent=1, ensure_ascii=False)
```

## AZIZ FLORAN perspective sweep title (approved by user — use in videos)
User approved this brand title and asked to remember it and use it in his videos ("shu yozuvni eslab qol, videolarda ishlatamiz").
Reference: car/bike-poster style — huge white 2-line title in strong 3D perspective (left side near/big, right side recedes, ry≈-42°, rz≈-4°), passing behind the person.
- Lines: "AZIZ" (size 0.34·W) over "FLORAN" (0.25·W), Inter Display Black, white (red variant allowed), second line 0.07 s later.
- In (0.55 s): flies in fast from the side with overshoot, rotating into place, temporal motion blur (7 sub-samples), camera punch + horizontal whip blur.
- Hold (~2 s): slow drift, slight wobble of ry, slow grow.
- Out (0.45 s): accelerates to the OPPOSITE side and into depth, motion blur, whip.
- Text goes behind the person via the matte (alpha.npy). Place it over a person segment (e.g. intro or outro), y≈0.24/0.41·H for 4:5; for 720x1280 move lines so they sit just above / behind the head (y ≈ 0.38–0.48·H).
- Repo copy: github ashrapovaziz332-arch/Aziz, `kinetic/persp_sweep.py` (demo `kinetic/aziz_floran_demo.mp4`).
- Integration with render.py: `from persp_sweep import sweep_layer, STYLE; STYLE.update(t0=..., hold=...)`; in main(): `lay = sweep_layer(t, W, H)`; add `lay` into `back` (behind person) — `back[:] = lay + back * (1 - lay[..., 3:4])` — and the camera punch/whip at in/out (use `active_speed(t)`).
- Standalone: `python3 persp_sweep.py src.mp4 out.mp4 --alpha alpha.npy --t0 1.0 --hold 2.0`

### persp_sweep.py
```python
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
```

## Checks before sending
- Contact sheet at 3-4 fps over the whole video + full-res crops around the head at each behind-pass and ring.
- No word wider than the frame; front arc of rings readable; no text ghosting over the face for more than ~6 frames.
- All on-screen words come from the user's list, with ö/ç/ş replacements.
- Audio muxed; duration matches source.