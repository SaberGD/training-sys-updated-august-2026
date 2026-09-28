#!/bin/bash
# renders the 15s reel in both formats, 4 chunks each in parallel, then muxes the soundtrack
cd "$(dirname "$0")"
for fmt in H V; do
  PG='typo15.html'; [ $fmt = V ] && PG='typo15.html?v'
  for i in 0 1 2 3; do f0=$((i*225)); f1=$(((i+1)*225))
    PAGE="$PG" node mrender_nv.js video 15 t15_${fmt}_$i.mp4 $f0 $f1 > t15_log_${fmt}_$i.txt 2>&1 &
  done; wait
  printf "file 't15_${fmt}_0.mp4'\nfile 't15_${fmt}_1.mp4'\nfile 't15_${fmt}_2.mp4'\nfile 't15_${fmt}_3.mp4'\n" > t15_list_$fmt.txt
  ffmpeg -y -loglevel error -f concat -safe 0 -i t15_list_$fmt.txt -c copy t15_video_$fmt.mp4
  ffmpeg -y -loglevel error -i t15_video_$fmt.mp4 -i typo15_audio.wav -map 0:v -map 1:a -c:v libx264 -preset slow -crf 20 -pix_fmt yuv420p -c:a aac -b:a 192k -shortest -movflags +faststart typo-reel-15s-$fmt.mp4
done
echo DONE
