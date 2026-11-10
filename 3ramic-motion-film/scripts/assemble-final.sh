#!/usr/bin/env bash
# Assembles the deliverables from a chunked render (see scripts/render-chunks.sh):
# every out/parts/part-*.mp4 in order, plus the audio mix in out/parts/audio.wav.
set -euo pipefail
cd "$(dirname "$0")/.."

: > out/parts/list.txt
for f in $(ls out/parts/part-*.mp4 | sort); do printf "file '%s'\n" "$(basename "$f")" >> out/parts/list.txt; done
ffmpeg -y -loglevel error -f concat -safe 0 -i out/parts/list.txt -c copy out/parts/video.mp4

# Final: x264 (~10 Mbps cap — plenty for Reels, keeps the file small), mix loudness-normalised
# for social (-15 LUFS, -1.5 dBTP)
ffmpeg -y -loglevel error -i out/parts/video.mp4 -i out/parts/audio.wav \
  -map 0:v:0 -map 1:a:0 -c:v libx264 -preset slow -crf 19 -maxrate 10M -bufsize 20M -pix_fmt yuv420p \
  -profile:v high -level 4.2 -r 30 \
  -af "loudnorm=I=-15:TP=-1.5:LRA=11" -c:a aac -b:a 256k -ar 48000 \
  -shortest -movflags +faststart out/3ramic-final.mp4

# Lower-resolution preview (540x960, full length)
ffmpeg -y -loglevel error -i out/3ramic-final.mp4 -vf "scale=540:960:flags=lanczos" \
  -c:v libx264 -crf 25 -preset medium -pix_fmt yuv420p -c:a aac -b:a 128k -movflags +faststart out/3ramic-preview.mp4

# Short 10 s teaser: the 03:17 hook and the drop (0-6.5 s) + the end card (36.5-40 s)
ffmpeg -y -loglevel error -i out/3ramic-final.mp4 -filter_complex \
  "[0:v]trim=0:6.5,setpts=PTS-STARTPTS,scale=540:960:flags=lanczos[v0];[0:a]atrim=0:6.5,asetpts=PTS-STARTPTS,afade=t=out:st=6.3:d=0.2[a0]; \
   [0:v]trim=36.5:40,setpts=PTS-STARTPTS,scale=540:960:flags=lanczos[v1];[0:a]atrim=36.5:40,asetpts=PTS-STARTPTS,afade=t=in:st=0:d=0.05[a1]; \
   [v0][a0][v1][a1]concat=n=2:v=1:a=1[v][a]" \
  -map "[v]" -map "[a]" -c:v libx264 -crf 25 -preset medium -pix_fmt yuv420p -c:a aac -b:a 128k -movflags +faststart out/3ramic-preview-short.mp4

for f in out/3ramic-final.mp4 out/3ramic-preview.mp4 out/3ramic-preview-short.mp4; do
  echo "$f: $(ffprobe -v error -show_entries format=duration,size -of csv=p=0 "$f")"
done
