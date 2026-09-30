#!/bin/bash
# renders the 54s MARO product film (Google Flow style) in both formats, 4 chunks each in parallel, then muxes the score
cd "$(dirname "$0")"
for fmt in H V; do
  PG='flow.html'; [ $fmt = V ] && PG='flow.html?v'
  for i in 0 1 2 3; do f0=$((i*810)); f1=$(((i+1)*810))
    PAGE="$PG" node mrender_nv.js video 54 flow_${fmt}_$i.mp4 $f0 $f1 > flow_log_${fmt}_$i.txt 2>&1 &
  done; wait
  printf "file 'flow_${fmt}_0.mp4'\nfile 'flow_${fmt}_1.mp4'\nfile 'flow_${fmt}_2.mp4'\nfile 'flow_${fmt}_3.mp4'\n" > flow_list_$fmt.txt
  ffmpeg -y -loglevel error -f concat -safe 0 -i flow_list_$fmt.txt -c copy flow_video_$fmt.mp4
  ffmpeg -y -loglevel error -i flow_video_$fmt.mp4 -i flow_audio.wav -map 0:v -map 1:a -r 60 -c:v libx264 -preset slow -crf 20 -pix_fmt yuv420p -c:a aac -b:a 192k -shortest -movflags +faststart maro-flow-film-54s-$fmt.mp4
done
echo DONE
