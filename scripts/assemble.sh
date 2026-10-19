#!/usr/bin/env bash
# Video Editor: motion render + musiqa → Instagram uchun yakuniy eksport.
# Foydalanish: scripts/assemble.sh 001 [musiqa_fayli]
set -euo pipefail
ID="${1:?Loyiha raqami kerak, masalan 001}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DIR="$(ls -d "$ROOT"/projects/"$ID"-* | head -1)"
VIDEO="$(ls "$DIR"/04-motion/renders/*.mp4 | head -1)"
MUSIC="${2:-$(ls "$DIR"/assets/music/* 2>/dev/null | head -1 || true)}"
OUT="$DIR/05-edit/exports/${ID}_final.mp4"
DUR="$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$VIDEO")"

VF="format=yuv420p"
COMMON=(-c:v libx264 -profile:v high -preset slow -crf 18 -r 30 -movflags +faststart)
if [[ -n "${MUSIC}" ]]; then
  FADE_OUT_START="$(awk -v d="$DUR" 'BEGIN{printf "%.2f", d-1.5}')"
  ffmpeg -y -i "$VIDEO" -i "$MUSIC" \
    -filter_complex "[0:v]${VF}[v];[1:a]atrim=0:${DUR},afade=t=in:d=1,afade=t=out:st=${FADE_OUT_START}:d=1.5,loudnorm=I=-14:TP=-1.5:LRA=11,aresample=48000[a]" \
    -map "[v]" -map "[a]" "${COMMON[@]}" -c:a aac -b:a 192k -shortest "$OUT"
else
  echo "⚠ Musiqa topilmadi ($DIR/assets/music/) — ovozsiz eksport qilinadi."
  ffmpeg -y -i "$VIDEO" -vf "$VF" "${COMMON[@]}" -an "$OUT"
fi
echo "✔ $OUT"
