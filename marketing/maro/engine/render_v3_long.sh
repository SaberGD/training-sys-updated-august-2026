#!/bin/bash
# V3 voice-over cut with the opening stretched to 5.6 s (?tm=5.6): re-render new 0-8.6 s, splice onto the master from old 7.0 s, mux V3 audio
cd "$(dirname "$0")"
PAGE='launch.html?tm=5.6' node mrender_nv.js video 60 tmH_0.mp4 0 258 > tm_log_H0.txt 2>&1 &
PAGE='launch.html?tm=5.6' node mrender_nv.js video 60 tmH_1.mp4 258 516 > tm_log_H1.txt 2>&1 &
PAGE='launchNV.html?v&tm=5.6' node mrender_nv.js video 60 tmV_0.mp4 0 258 > tm_log_V0.txt 2>&1 &
PAGE='launchNV.html?v&tm=5.6' node mrender_nv.js video 60 tmV_1.mp4 258 516 > tm_log_V1.txt 2>&1 &
wait
O=/home/user/training-sys-updated-august-2026/downloads/SABER-GROUP-VIDEOS/06-Voice-Over-Trial
for f in H V; do
  printf "file 'tm${f}_0.mp4'\nfile 'tm${f}_1.mp4'\n" > tm_list_$f.txt
  ffmpeg -y -loglevel error -f concat -safe 0 -i tm_list_$f.txt -c copy tmintro_$f.mp4
  SRC=master_$f.mp4
  ffmpeg -y -loglevel error -i tmintro_$f.mp4 -i $SRC -i ../vo/v3mix_mix.wav -filter_complex "[1:v]fps=60,trim=start_frame=420,setpts=PTS-STARTPTS[b];[0:v]fps=60[a0];[a0][b]concat=n=2:v=1:a=0,fps=60[v]" -map "[v]" -map 2:a -r 60 -c:v libx264 -preset slow -crf 21 -pix_fmt yuv420p -c:a aac -b:a 192k -shortest -movflags +faststart v3long_$f.mp4
done
cp v3long_H.mp4 $O/maro-voiceover-V3-61s-16x9.mp4; cp v3long_V.mp4 $O/maro-voiceover-V3-61s-9x16-reels.mp4
echo ALLDONE
