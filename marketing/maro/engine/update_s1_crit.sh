#!/bin/bash
# new opening photo (user's Photoshop still) + balanced 'after' state in the critique shot: re-render the touched ranges, splice, rebuild everything
cd "$(dirname "$0")"
[ -f master_H_before_s1v2.mp4 ] || { cp master_H.mp4 master_H_before_s1v2.mp4; cp master_V.mp4 master_V_before_s1v2.mp4; }
cat > s1v2_jobs.txt <<J
launch.html fixH_0.mp4 0 210
launch.html fixH_1.mp4 210 420
launchNV.html?v fixV_0.mp4 0 210
launchNV.html?v fixV_1.mp4 210 420
launch.html crH_0.mp4 1560 1785
launch.html crH_1.mp4 1785 2010
launchNV.html?v crV_0.mp4 1560 1785
launchNV.html?v crV_1.mp4 1785 2010
launch.html?tm=5.6 tmH_0.mp4 0 258
launch.html?tm=5.6 tmH_1.mp4 258 516
launchNV.html?v&tm=5.6 tmV_0.mp4 0 258
launchNV.html?v&tm=5.6 tmV_1.mp4 258 516
J
xargs -P4 -L1 sh -c '[ -s "$1" ] && exit 0; PAGE="$0" node mrender_nv.js video 60 "$1" "$2" "$3" > "s1v2_$1.log" 2>&1' < s1v2_jobs.txt
for f in fixH_0 fixH_1 fixV_0 fixV_1 crH_0 crH_1 crV_0 crV_1 tmH_0 tmH_1 tmV_0 tmV_1; do [ -s $f.mp4 ] || { echo "MISSING $f"; exit 1; }; done
./apply_intro_fix.sh || exit 1
D=/home/user/training-sys-updated-august-2026/downloads/SABER-GROUP-VIDEOS; O=$D/06-Voice-Over-Trial
for f in 9x16-reels 16x9; do
  ffmpeg -y -loglevel error -i $D/02-MARO-Launch/maro-launch-60s-$f.mp4 -i ../vo/v3mix_mix.wav -map 0:v -map 1:a -c:v copy -c:a aac -b:a 192k -t 60 -movflags +faststart $O/maro-voiceover-V3-60s-$f.mp4
done
# V3 61.6 s cut: stretched opening + new master from 7.0 s
for f in H V; do
  printf "file 'tm${f}_0.mp4'\nfile 'tm${f}_1.mp4'\n" > tm_list_$f.txt
  ffmpeg -y -loglevel error -f concat -safe 0 -i tm_list_$f.txt -c copy tmintro_$f.mp4
  ffmpeg -y -loglevel error -i tmintro_$f.mp4 -i master_$f.mp4 -i ../vo/v3mix_mix.wav -filter_complex "[1:v]fps=60,trim=start_frame=420,setpts=PTS-STARTPTS[b];[0:v]fps=60[a0];[a0][b]concat=n=2:v=1:a=0,fps=60[v]" -map "[v]" -map 2:a -r 60 -c:v libx264 -preset slow -crf 21 -pix_fmt yuv420p -c:a aac -b:a 192k -shortest -movflags +faststart v3long_$f.mp4
done
cp v3long_H.mp4 $O/maro-voiceover-V3-61s-16x9.mp4; cp v3long_V.mp4 $O/maro-voiceover-V3-61s-9x16-reels.mp4
echo ALLDONE
