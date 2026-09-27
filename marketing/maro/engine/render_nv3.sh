#!/bin/bash
cd "$(dirname "$0")"
for i in 0 1 2 3; do f0=$((2700+i*225)); f1=$((2700+(i+1)*225))
  PAGE='launchNV.html?v' node mrender_nv.js video 60 nv_s3_$i.mp4 $f0 $f1 > nv_log3_$i.txt 2>&1 &
done; wait
printf "file 'nv_seg0.mp4'\nfile 'nv_seg1.mp4'\nfile 'nv_seg2.mp4'\nfile 'nv_s3_0.mp4'\nfile 'nv_s3_1.mp4'\nfile 'nv_s3_2.mp4'\nfile 'nv_s3_3.mp4'\n" > nv_list.txt
ffmpeg -y -loglevel error -f concat -safe 0 -i nv_list.txt -c copy nv_video.mp4
ffmpeg -y -loglevel error -i nv_video.mp4 -i launch_audio.wav -map 0:v -map 1:a -c:v copy -c:a aac -b:a 192k -shortest -movflags +faststart maro-launch-60s-vertical-native.mp4
echo DONE; ls -la maro-launch-60s-vertical-native.mp4
