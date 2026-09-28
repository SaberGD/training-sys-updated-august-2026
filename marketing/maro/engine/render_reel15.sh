#!/bin/bash
# renders the 15s reel in both formats, 4 chunks each in parallel, then muxes the soundtrack
cd "$(dirname "$0")"
for fmt in H V; do
  PG='reel15.html'; [ $fmt = V ] && PG='reel15.html?v'
  for i in 0 1 2 3; do f0=$((i*225)); f1=$(((i+1)*225))
    PAGE="$PG" node mrender_nv.js video 15 r15_${fmt}_$i.mp4 $f0 $f1 > r15_log_${fmt}_$i.txt 2>&1 &
  done; wait
  printf "file 'r15_${fmt}_0.mp4'\nfile 'r15_${fmt}_1.mp4'\nfile 'r15_${fmt}_2.mp4'\nfile 'r15_${fmt}_3.mp4'\n" > r15_list_$fmt.txt
  ffmpeg -y -loglevel error -f concat -safe 0 -i r15_list_$fmt.txt -c copy r15_video_$fmt.mp4
  ffmpeg -y -loglevel error -i r15_video_$fmt.mp4 -i reel15_audio.wav -map 0:v -map 1:a -c:v libx264 -preset slow -crf 20 -pix_fmt yuv420p -c:a aac -b:a 192k -shortest -movflags +faststart beginner-reel-15s-$fmt.mp4
done
echo DONE
