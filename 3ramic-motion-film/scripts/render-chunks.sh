#!/usr/bin/env bash
# Full-quality render in resumable chunks — for CPU-only machines, where WebGL runs
# through SwiftShader and one uninterrupted 1200-frame render is long and fragile.
#
#   bash scripts/render-chunks.sh          # render what is missing, then assemble
#   CHUNK=300 CONC=2 bash scripts/render-chunks.sh
#
# Each chunk is written to out/parts/part-NN.mp4 and marked with a .done file, so a
# stopped run picks up where it left off. Delete out/parts and out/bundle to start clean
# (do that whenever the source changes).
# On a fast machine `npm run render` produces out/3ramic-final.mp4 in one go instead.
set -euo pipefail
cd "$(dirname "$0")/.."

CHUNK=${CHUNK:-150}
CONC=${CONC:-4}
TOTAL=1200
mkdir -p out/parts

if [ ! -f out/bundle/.stamp ]; then
  rm -rf out/bundle
  npx remotion bundle --out-dir=out/bundle --log=error
  touch out/bundle/.stamp
fi

i=0
for ((s = 0; s < TOTAL; s += CHUNK)); do
  e=$((s + CHUNK - 1))
  f=out/parts/part-$(printf "%02d" "$i").mp4
  if [ ! -f "$f.done" ]; then
    echo "[$(date +%H:%M:%S)] frames $s-$e -> $f"
    npx remotion render out/bundle ThreeRamicFilm "$f" --frames="$s-$e" --muted --crf=18 --concurrency="$CONC" --log=error
    touch "$f.done"
  fi
  i=$((i + 1))
done

if [ ! -f out/parts/audio.wav.done ]; then
  echo "[$(date +%H:%M:%S)] audio mix -> out/parts/audio.wav"
  npx remotion render out/bundle ThreeRamicFilm out/parts/audio.wav --codec=wav --log=error
  touch out/parts/audio.wav.done
fi

bash scripts/assemble-final.sh
echo "[$(date +%H:%M:%S)] done"
