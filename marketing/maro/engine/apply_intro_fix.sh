#!/bin/bash
# Splices the re-rendered first 7 s (fixH_*/fixV_*) into both MARO masters, then rebuilds every deliverable that uses them.
set -e
cd "$(dirname "$0")"
VO=../vo
D=/home/user/training-sys-updated-august-2026/downloads/SABER-GROUP-VIDEOS
enc(){ ffmpeg -y -loglevel error "$@"; }
for f in H V; do
  printf "file 'fix${f}_0.mp4'\nfile 'fix${f}_1.mp4'\n" > fix_list_$f.txt
  enc -f concat -safe 0 -i fix_list_$f.txt -c copy intro_$f.mp4
  printf "file 'cr${f}_0.mp4'\nfile 'cr${f}_1.mp4'\n" > cr_list_$f.txt; enc -f concat -safe 0 -i cr_list_$f.txt -c copy cr_$f.mp4
done
# new masters: new intro (frames 0-419) + old master from frame 420, re-encoded once at master quality
enc -i intro_H.mp4 -i maro-launch-60s_before_intro_fix.mp4 -i cr_H.mp4 -i launch_audio.wav -filter_complex "[1:v]fps=60,split[b1][b2];[b1]trim=start_frame=420:end_frame=1560,setpts=PTS-STARTPTS[m1];[b2]trim=start_frame=2010,setpts=PTS-STARTPTS[m2];[0:v]fps=60[a0];[2:v]fps=60[c];[a0][m1][c][m2]concat=n=4:v=1:a=0,fps=60[v]" -map "[v]" -map 3:a -r 60 -c:v libx264 -preset slow -crf 17 -pix_fmt yuv420p -c:a aac -b:a 192k -shortest -movflags +faststart master_H.mp4
enc -i intro_V.mp4 -i maro-launch-60s-vertical-native_before_intro_fix.mp4 -i cr_V.mp4 -i launch_audio.wav -filter_complex "[1:v]fps=60,split[b1][b2];[b1]trim=start_frame=420:end_frame=1560,setpts=PTS-STARTPTS[m1];[b2]trim=start_frame=2010,setpts=PTS-STARTPTS[m2];[0:v]fps=60[a0];[2:v]fps=60[c];[a0][m1][c][m2]concat=n=4:v=1:a=0,fps=60[v]" -map "[v]" -map 3:a -r 60 -c:v libx264 -preset slow -crf 17 -pix_fmt yuv420p -c:a aac -b:a 192k -shortest -movflags +faststart master_V.mp4
cp master_H.mp4 maro-launch-60s.mp4; cp master_V.mp4 maro-launch-60s-vertical-native.mp4
# 02 · 60s + fast 48s
enc -i master_H.mp4 -c:v libx264 -preset slow -crf 21 -pix_fmt yuv420p -c:a copy -movflags +faststart $D/02-MARO-Launch/maro-launch-60s-16x9.mp4
enc -i master_V.mp4 -c:v libx264 -preset slow -crf 21 -pix_fmt yuv420p -c:a copy -movflags +faststart $D/02-MARO-Launch/maro-launch-60s-9x16-reels.mp4
fastv(){ enc -i "$1" -i "$2" -filter_complex "[0:v]setpts=PTS/1.25,fps=60[v]" -map "[v]" -map 1:a -c:v libx264 -preset slow -crf 21 -pix_fmt yuv420p -c:a aac -b:a 192k -shortest -movflags +faststart "$3"; }
fastv master_H.mp4 launch_audio_fast.wav $D/02-MARO-Launch/maro-launch-fast-48s-16x9.mp4
fastv master_V.mp4 launch_audio_fast.wav $D/02-MARO-Launch/maro-launch-fast-48s-9x16-reels.mp4
# everything else is the same picture with another soundtrack: stream-copy the new video
remux(){ enc -i "$1" -i "$2" -map 0:v -map 1:a -c:v copy -c:a aac -b:a 192k -t "${4:-60}" -movflags +faststart "$3"; }
H60=$D/02-MARO-Launch/maro-launch-60s-16x9.mp4; V60=$D/02-MARO-Launch/maro-launch-60s-9x16-reels.mp4
HF=$D/02-MARO-Launch/maro-launch-fast-48s-16x9.mp4; VF=$D/02-MARO-Launch/maro-launch-fast-48s-9x16-reels.mp4
for m in trap house; do M=$D/05-Music-Alternatives/$m
  remux $H60 launch_audio_$m.wav $M/maro-launch-16x9-$m.mp4; remux $V60 launch_audio_$m.wav $M/maro-launch-9x16-reels-$m.mp4
  remux $HF launch_audio_${m}_fast.wav $M/maro-launch-fast-16x9-$m.mp4 48; remux $VF launch_audio_${m}_fast.wav $M/maro-launch-fast-9x16-reels-$m.mp4 48
done
O=$D/06-Voice-Over-Trial
remux $H60 $VO/mix_60.wav $O/maro-voiceover-60s-16x9.mp4; remux $V60 $VO/mix_60.wav $O/maro-voiceover-60s-9x16-reels.mp4
for m in trap house; do remux $H60 $VO/mix_60_$m.wav $O/maro-voiceover-60s-16x9-$m.mp4; remux $V60 $VO/mix_60_$m.wav $O/maro-voiceover-60s-9x16-reels-$m.mp4; done
remux $H60 $VO/final_fixed.wav $O/maro-voiceover-FINAL-60s-16x9.mp4; remux $V60 $VO/final_fixed.wav $O/maro-voiceover-FINAL-60s-9x16-reels.mp4
remux $H60 $VO/user_mix_mix.wav $O/maro-voiceover-V2-60s-16x9.mp4; remux $V60 $VO/user_mix_mix.wav $O/maro-voiceover-V2-60s-9x16-reels.mp4
echo APPLIED
