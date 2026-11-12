#!/usr/bin/env bash
# Assemble a rendered PNG sequence and the synthesized wav into the MP4.
#
#   scripts/film-assemble.sh /tmp/last-bus-frames /tmp/last-bus.wav film/last-bus/out/last-bus.mp4
#
# Two-pass loudnorm to about -14 LUFS integrated, H.264 yuv420p, AAC, faststart.
# The PNG sequence must be 0000.png ... and 30fps, matching film/last-bus/timing.js.

set -euo pipefail

FRAMES="${1:?png directory}"
WAV="${2:?wav}"
OUT="${3:?mp4}"
mkdir -p "$(dirname "$OUT")"

MEASURE="$(mktemp)"
ffmpeg -hide_banner -i "$WAV" \
  -af loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json \
  -f null - 2>"$MEASURE"

python3 - "$MEASURE" <<'PY' > /tmp/last-bus-loudnorm.txt
import json, sys
text = open(sys.argv[1], encoding="utf-8", errors="replace").read()
start = text.rfind("{")
end = text.rfind("}")
data = json.loads(text[start:end + 1])
keys = {
    "measured_I": data["input_i"],
    "measured_TP": data["input_tp"],
    "measured_LRA": data["input_lra"],
    "measured_thresh": data["input_thresh"],
    "offset": data["target_offset"],
}
print(":".join(f"{k}={v}" for k, v in keys.items()))
print(json.dumps(data, indent=2), file=sys.stderr)
PY

NORM="$(python3 -c 'print(open("/tmp/last-bus-loudnorm.txt").readline().strip())')"

ffmpeg -y -hide_banner \
  -framerate 30 -i "$FRAMES/%04d.png" \
  -i "$WAV" \
  -filter:a "loudnorm=I=-14:TP=-1.5:LRA=11:${NORM}:linear=true,aresample=48000" \
  -c:v libx264 -pix_fmt yuv420p -crf 20 -preset medium \
  -c:a aac -ar 48000 -b:a 192k \
  -movflags +faststart \
  -shortest \
  "$OUT"

echo "wrote $OUT"
ffprobe -hide_banner -show_streams -show_format "$OUT"
