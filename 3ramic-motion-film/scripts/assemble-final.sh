#!/usr/bin/env bash
# Assembles the deliverables from a chunked render (useful on CPU-only machines,
# where WebGL runs through SwiftShader and a full render takes a while):
#
#   npx remotion render ThreeRamicFilm out/parts/part-a.mp4 --frames=0-599    --muted --crf=18
#   npx remotion render ThreeRamicFilm out/parts/part-b.mp4 --frames=600-1199 --muted --crf=18
#   npx remotion render ThreeRamicFilm out/parts/audio.wav  --codec=wav
#   bash scripts/assemble-final.sh
#
# On a fast machine `npm run render` produces out/3ramic-final.mp4 in one go instead.
set -euo pipefail
cd "$(dirname "$0")/.."

printf "file 'part-a.mp4'\nfile 'part-b.mp4'\n" > out/parts/list.txt
ffmpeg -y -loglevel error -f concat -safe 0 -i out/parts/list.txt -c copy out/parts/video.mp4

# Final: picture stream-copied, mix loudness-normalised for social (-15 LUFS, -1.5 dBTP)
ffmpeg -y -loglevel error -i out/parts/video.mp4 -i out/parts/audio.wav \
  -map 0:v:0 -map 1:a:0 -c:v copy \
  -af "loudnorm=I=-15:TP=-1.5:LRA=11" -c:a aac -b:a 256k -ar 48000 \
  -shortest -movflags +faststart out/3ramic-final.mp4

# Lower-resolution preview (540x960, full length)
ffmpeg -y -loglevel error -i out/3ramic-final.mp4 -vf "scale=540:960:flags=lanczos" \
  -c:v libx264 -crf 25 -preset medium -pix_fmt yuv420p -c:a aac -b:a 128k -movflags +faststart out/3ramic-preview.mp4

# Short 10 s teaser: the 03:17 hook (0-6 s) + the brand end card (36-40 s)
ffmpeg -y -loglevel error -i out/3ramic-final.mp4 -filter_complex \
  "[0:v]trim=0:6,setpts=PTS-STARTPTS,scale=540:960:flags=lanczos[v0];[0:a]atrim=0:6,asetpts=PTS-STARTPTS,afade=t=out:st=5.7:d=0.3[a0]; \
   [0:v]trim=36:40,setpts=PTS-STARTPTS,scale=540:960:flags=lanczos[v1];[0:a]atrim=36:40,asetpts=PTS-STARTPTS,afade=t=in:st=0:d=0.2[a1]; \
   [v0][a0][v1][a1]concat=n=2:v=1:a=1[v][a]" \
  -map "[v]" -map "[a]" -c:v libx264 -crf 25 -preset medium -pix_fmt yuv420p -c:a aac -b:a 128k -movflags +faststart out/3ramic-preview-short.mp4

for f in out/3ramic-final.mp4 out/3ramic-preview.mp4 out/3ramic-preview-short.mp4; do
  echo "$f: $(ffprobe -v error -show_entries format=duration,size -of csv=p=0 "$f")"
done
