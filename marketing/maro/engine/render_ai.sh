#!/bin/bash
# renders the 46.5s AI reel (9:16 native), 4 chunks in parallel, then muxes voice + score
cd "$(dirname "$0")"
for i in 0 1 2 3; do f0=$((i*698)); f1=$(((i+1)*698)); [ $i = 3 ] && f1=2790
  PAGE='aireel.html?v' node mrender_nv.js video 46.5 ai_V_$i.mp4 $f0 $f1 > ai_log_$i.txt 2>&1 &
done; wait
printf "file 'ai_V_0.mp4'\nfile 'ai_V_1.mp4'\nfile 'ai_V_2.mp4'\nfile 'ai_V_3.mp4'\n" > ai_list.txt
ffmpeg -y -loglevel error -f concat -safe 0 -i ai_list.txt -c copy ai_video.mp4
ffmpeg -y -loglevel error -i ai_video.mp4 -i ai_audio.wav -map 0:v -map 1:a -r 60 -c:v libx264 -preset slow -crf 20 -pix_fmt yuv420p -c:a aac -b:a 192k -shortest -movflags +faststart ai-reel-46s-9x16.mp4
echo DONE
