#!/bin/bash
cd "$(dirname "$0")"
while [ "$(wc -l < cv_done.txt 2>/dev/null || echo 0)" -lt 10 ]; do sleep 30; done
for i in 0 1 2 3; do VERTICAL=1 PAGE=launchV.html node mrender.js video 60 lv$i.mp4 $((i*900)) $(((i+1)*900)) > lv$i.log 2>&1 & done; wait
printf "file 'lv%d.mp4'\n" 0 1 2 3 > lvlist.txt
ffmpeg -y -loglevel error -f concat -i lvlist.txt -c copy lv60.mp4
ffmpeg -y -loglevel error -i lv60.mp4 -i launch_audio.wav -c:v copy -c:a aac -b:a 192k -shortest -movflags +faststart maro-launch-60s-vertical.mp4
echo LV_DONE > lv_done.txt
