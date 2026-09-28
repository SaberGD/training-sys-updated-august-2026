#!/bin/bash
# re-render the opening with the Vezeeta hero, splice + rebuild all MARO deliverables, then the V3 voice-over
cd "$(dirname "$0")"
./render_intro_fix.sh && ./apply_intro_fix.sh || exit 1
D=/home/user/training-sys-updated-august-2026/downloads/SABER-GROUP-VIDEOS; O=$D/06-Voice-Over-Trial
for f in 9x16-reels 16x9; do
  ffmpeg -y -loglevel error -i $D/02-MARO-Launch/maro-launch-60s-$f.mp4 -i ../vo/v3mix_mix.wav -map 0:v -map 1:a -c:v copy -c:a aac -b:a 192k -t 60 -movflags +faststart $O/maro-voiceover-V3-60s-$f.mp4
  ffmpeg -y -loglevel error -i $O/maro-voiceover-V3-60s-$f.mp4 -c:v libx264 -preset medium -crf 24 -pix_fmt yuv420p -c:a copy -movflags +faststart ../maro-V3-$f.mp4
done
ffmpeg -y -loglevel error -i ../vo/v3mix_mix.wav -c:a libmp3lame -b:a 192k $O/maro-voiceover-V3-audio.mp3
echo ALLDONE
