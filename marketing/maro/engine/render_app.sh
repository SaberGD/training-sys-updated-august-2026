#!/bin/bash
# renders the 32s MARO app promo in both formats, 4 chunks each in parallel, then muxes the soundtrack
cd "$(dirname "$0")"
for fmt in H V; do
  PG='appreel.html'; [ $fmt = V ] && PG='appreel.html?v'
  for i in 0 1 2 3; do f0=$((i*480)); f1=$(((i+1)*480))
    PAGE="$PG" node mrender_nv.js video 32 app_${fmt}_$i.mp4 $f0 $f1 > app_log_${fmt}_$i.txt 2>&1 &
  done; wait
  printf "file 'app_${fmt}_0.mp4'\nfile 'app_${fmt}_1.mp4'\nfile 'app_${fmt}_2.mp4'\nfile 'app_${fmt}_3.mp4'\n" > app_list_$fmt.txt
  ffmpeg -y -loglevel error -f concat -safe 0 -i app_list_$fmt.txt -c copy app_video_$fmt.mp4
  ffmpeg -y -loglevel error -i app_video_$fmt.mp4 -i app_audio.wav -map 0:v -map 1:a -r 60 -c:v libx264 -preset slow -crf 20 -pix_fmt yuv420p -c:a aac -b:a 192k -shortest -movflags +faststart maro-app-promo-32s-$fmt.mp4
done
echo DONE
