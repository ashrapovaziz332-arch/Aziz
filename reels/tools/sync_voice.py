#!/usr/bin/env python3
"""Tayyor diktor ovozini (bitta fayl, 14 qator) videoga moslaydi.

Ovozdagi eng uzun 13 pauza bo'yicha 14 qatorga bo'ladi, ozgina tezlashtiradi,
har sahna uzunligini o'z qatoriga moslab timing.js yozadi va ovoz trekini yig'adi.

    python3 tools/sync_voice.py ovoz.mp3 [--tez 1.15]
    node tools/render.js video.mp4 30 4
    ffmpeg -i video.mp4 -i build/voice.m4a -map 0:v -map 1:a -c copy reels-ovozli.mp4
"""
import argparse, json, os, re, subprocess

ap = argparse.ArgumentParser()
ap.add_argument('audio')
ap.add_argument('--tez', type=float, default=1.15, help='ovoz tezligi (1.0 — o\'zgarishsiz)')
a = ap.parse_args()
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.makedirs(os.path.join(root, 'build'), exist_ok=True)

dur = float(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', a.audio], capture_output=True, text=True).stdout)
log = subprocess.run(['ffmpeg', '-i', a.audio, '-af', 'silencedetect=n=-35dB:d=0.2', '-f', 'null', '-'], capture_output=True, text=True).stderr
starts = [float(x) for x in re.findall(r'silence_start: ([\d.]+)', log)]
ends = [float(x) for x in re.findall(r'silence_end: ([\d.]+)', log)]
gaps = [(s, e) for s, e in zip(starts, ends)]
head = gaps[0][1] if gaps and gaps[0][0] < .05 else 0.0
tail = starts[-1] if len(starts) > len(ends) else dur
inner = [g for g in gaps if g[0] > .05]
cut = sorted(sorted(inner, key=lambda g: g[1] - g[0], reverse=True)[:13])
if len(cut) != 13:
    raise SystemExit(f'14 ta qator topilmadi (pauzalar: {len(inner)})')
segs, s0 = [], head
for s, e in cut:
    segs.append((s0, s)); s0 = e
segs.append((s0, tail))

T = a.tez
lens = [(e - s) / T for s, e in segs]
LEAD = .3
hook = max(4.0, LEAD + lens[0] + .45)
scenes = [round(max(5.0, LEAD + l + .55), 2) for l in lens[1:13]]
finale = max(8.0, LEAD + lens[13] + 1.4)
timing = {'hook': round(hook, 2), 'scenes': scenes, 'finale': round(finale, 2)}
with open(os.path.join(root, 'timing.js'), 'w') as f:
    f.write('// tools/sync_voice.py yaratgan: sahna uzunliklari diktor ovoziga moslangan\nwindow.REEL_TIMING = ' + json.dumps(timing) + ';\n')

starts_at = [LEAD]; acc = hook
for d in scenes:
    starts_at.append(acc + LEAD); acc += d
starts_at.append(acc + LEAD)
total = acc + finale
flt, labels = [], []
for i, ((s, e), at) in enumerate(zip(segs, starts_at)):
    flt.append(f'[0:a]atrim={s:.3f}:{e:.3f},asetpts=PTS-STARTPTS,atempo={T},adelay={int(at * 1000)}:all=1[s{i}]')
    labels.append(f'[s{i}]')
flt.append(''.join(labels) + f'amix=inputs=14:normalize=0,apad,atrim=0:{total:.3f}[out]')
out = os.path.join(root, 'build', 'voice.m4a')
subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', a.audio, '-filter_complex', ';'.join(flt), '-map', '[out]', '-c:a', 'aac', '-b:a', '192k', out], check=True)
names = ['Kirish'] + [f'Uslub {i}' for i in range(1, 13)] + ['Yakun']
for n, (s, e), at, l in zip(names, segs, starts_at, lens):
    print(f'{n:9s} ovozda {s:6.2f}–{e:6.2f}s  →  videoda {at:6.2f}s dan, {l:4.2f}s')
print(f'Video uzunligi: {total:.1f} s  |  {out}')
