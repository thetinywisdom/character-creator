#!/usr/bin/env bash
# Assemble a rendered PNG sequence and the synthesized wav into the MP4.
#
#   scripts/film-assemble.sh /tmp/last-bus-frames /tmp/last-bus.wav film/last-bus/out/last-bus.mp4
#
# H.264 yuv420p, AAC 48 kHz, faststart. The wav is already leveled in
# film/last-bus/audio.js (splash is the peak, about -14 LUFS, true peak
# under -1 dBTP). A second loudnorm pass was pulling that hit back down.
# The PNG sequence must be 0000.png ... and 30fps, matching film/last-bus/timing.js.

set -euo pipefail

FRAMES="${1:?png directory}"
WAV="${2:?wav}"
OUT="${3:?mp4}"
mkdir -p "$(dirname "$OUT")"

ffmpeg -y -hide_banner \
  -framerate 30 -i "$FRAMES/%04d.png" \
  -i "$WAV" \
  -filter:a "aresample=48000" \
  -c:v libx264 -pix_fmt yuv420p -crf 20 -preset medium \
  -c:a aac -ar 48000 -b:a 192k \
  -movflags +faststart \
  -shortest \
  "$OUT"

echo "wrote $OUT"
ffprobe -hide_banner -show_streams -show_format "$OUT"
