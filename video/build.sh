#!/usr/bin/env bash
# Builds video/Glassbox-Demo-2min.mp4 from app screenshots + macOS TTS voiceover (vo/NN.aiff).
set -euo pipefail
cd "$(dirname "$0")"
P=../slides/png
IMGS=("$P/slide-01.png" "$P/slide-02.png" "shots/03-home.png" "shots/04-trace.png" "shots/05-tall.png" "shots/05-tall.png" "shots/07-receipt.png" "shots/08-ledger.png" "shots/09-tamper.png" "shots/10-drills.png" "shots/11-stack.png" "$P/slide-10.png")
CROPS=("" "" "" "" "crop=1310:737:262:1262," "crop=700:394:874:553," "" "" "" "" "" "")
mkdir -p seg
for i in $(seq 0 11); do
  n=$(printf %02d $((i+1)))
  A="vo/${n}.aiff"
  D=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$A")
  T=$(python3 -c "print(round(${D}+0.7,2))")
  F=$(python3 -c "print(int((${D}+0.7)*30))")
  ffmpeg -y -loglevel error -loop 1 -i "${IMGS[$i]}" -i "$A" -filter_complex \
    "[0:v]${CROPS[$i]}scale=3200:1800,zoompan=z='min(zoom+0.0005,1.08)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${F}:s=1600x900:fps=30,format=yuv420p[v];[1:a]apad=pad_dur=0.7,aformat=sample_rates=44100:channel_layouts=stereo[a]" \
    -map "[v]" -map "[a]" -t "$T" -c:v libx264 -preset veryfast -crf 21 -c:a aac -b:a 160k "seg/${n}.mp4" &
done
wait
for f in seg/*.mp4; do echo "file '$f'"; done > list.txt
ffmpeg -y -loglevel error -f concat -safe 0 -i list.txt -c copy Glassbox-Demo-2min.mp4
ffprobe -v error -show_entries format=duration -of csv=p=0 Glassbox-Demo-2min.mp4
