#!/bin/bash
# Collects every final render into downloads/SABER-GROUP-VIDEOS with a clear structure.
set -e
REPO=/home/user/training-sys-updated-august-2026
SC=/tmp/claude-0/-home-user-training-sys-updated-august-2026/bc584552-c104-5a12-9dfd-13e347b59b5b/scratchpad
M=$SC/maro2; RL=$SC/reel
OUT=$REPO/downloads/SABER-GROUP-VIDEOS
mkdir -p "$OUT"/{01-Showreel-Academy,02-MARO-Launch,03-Courses-With-Prices,04-Courses-No-Prices-Soft-Transitions,05-Music-Alternatives/{trap,house,audio-tracks}}
cd "$REPO"
mvg(){ [ -f "$1" ] && git mv -f "$1" "$2" 2>/dev/null || { [ -f "$1" ] && mv -f "$1" "$2"; } || true; }

# 01 showreel
cp -f marketing/showreel/saber-group-showreel.mp4 "$OUT/01-Showreel-Academy/showreel-30s-16x9.mp4"
cp -f marketing/showreel/saber-group-showreel-vertical.mp4 "$OUT/01-Showreel-Academy/showreel-30s-9x16-reels.mp4"
cp -f $RL/saber-group-showreel-fast.mp4 "$OUT/01-Showreel-Academy/showreel-fast-24s-16x9.mp4"
cp -f $RL/saber-group-showreel-vertical-fast.mp4 "$OUT/01-Showreel-Academy/showreel-fast-24s-9x16-reels.mp4"
mvg downloads/saber-group-showreel-16x9.mp4 /tmp/_dup1.mp4; mvg downloads/saber-group-showreel-9x16-reels-tiktok.mp4 /tmp/_dup2.mp4

# 02 MARO launch
mvg downloads/maro-launch-60s-16x9.mp4 "$OUT/02-MARO-Launch/maro-launch-60s-16x9.mp4"
ffmpeg -y -loglevel error -i $M/maro-launch-60s-vertical.mp4 -c:v libx264 -preset slow -crf 21 -pix_fmt yuv420p -c:a copy -movflags +faststart "$OUT/02-MARO-Launch/maro-launch-60s-9x16-reels.mp4"
fastv(){ ffmpeg -y -loglevel error -i "$1" -i "$2" -filter_complex "[0:v]setpts=PTS/1.25,fps=60[v]" -map "[v]" -map 1:a -c:v libx264 -preset slow -crf 21 -pix_fmt yuv420p -c:a aac -b:a 192k -shortest -movflags +faststart "$3"; }
cp -f $M/maro-launch-fast-16x9.mp4 "$OUT/02-MARO-Launch/maro-launch-fast-48s-16x9.mp4"
fastv $M/maro-launch-60s-vertical.mp4 $M/launch_audio_fast.wav "$OUT/02-MARO-Launch/maro-launch-fast-48s-9x16-reels.mp4"
mvg downloads/maro-style-test-8s.mp4 "$OUT/02-MARO-Launch/maro-style-test-8s-16x9.mp4"
cp -f marketing/maro/MARO-visor-expressions.png "$OUT/02-MARO-Launch/maro-visor-expressions.png"

# 03 courses with prices
for v in overview beginner mastery modules alumni; do
  mvg downloads/courses/$v-16x9.mp4 "$OUT/03-Courses-With-Prices/$v-16x9.mp4"
  mvg downloads/courses/$v-9x16-reels.mp4 "$OUT/03-Courses-With-Prices/$v-9x16-reels.mp4"
done

# 04 no-price, soft transitions
for v in beginner mastery; do
  cp -f $M/final_${v}2_H.mp4 "$OUT/04-Courses-No-Prices-Soft-Transitions/$v-no-price-16x9.mp4"
  cp -f $M/final_${v}2_V.mp4 "$OUT/04-Courses-No-Prices-Soft-Transitions/$v-no-price-9x16-reels.mp4"
done

# 05 music alternatives: remux (video untouched) with the trap / house soundtracks
remux(){ ffmpeg -y -loglevel error -i "$1" -i "$2" -map 0:v -map 1:a -c:v copy -c:a aac -b:a 192k -shortest -movflags +faststart "$3"; }
for m in trap house; do
  D="$OUT/05-Music-Alternatives/$m"
  remux "$OUT/01-Showreel-Academy/showreel-fast-24s-16x9.mp4" $RL/audio_${m}_fast.wav "$D/showreel-fast-16x9-$m.mp4"
  remux "$OUT/01-Showreel-Academy/showreel-fast-24s-9x16-reels.mp4" $RL/audio_${m}_fast.wav "$D/showreel-fast-9x16-reels-$m.mp4"
  remux "$OUT/02-MARO-Launch/maro-launch-60s-16x9.mp4" $M/launch_audio_$m.wav "$D/maro-launch-16x9-$m.mp4"
  remux "$OUT/02-MARO-Launch/maro-launch-60s-9x16-reels.mp4" $M/launch_audio_$m.wav "$D/maro-launch-9x16-reels-$m.mp4"
  remux "$OUT/02-MARO-Launch/maro-launch-fast-48s-16x9.mp4" $M/launch_audio_${m}_fast.wav "$D/maro-launch-fast-16x9-$m.mp4"
  remux "$OUT/02-MARO-Launch/maro-launch-fast-48s-9x16-reels.mp4" $M/launch_audio_${m}_fast.wav "$D/maro-launch-fast-9x16-reels-$m.mp4"
  for v in beginner mastery; do
    remux "$OUT/04-Courses-No-Prices-Soft-Transitions/$v-no-price-16x9.mp4" $M/course_${v}2_$m.wav "$D/$v-no-price-16x9-$m.mp4"
    remux "$OUT/04-Courses-No-Prices-Soft-Transitions/$v-no-price-9x16-reels.mp4" $M/course_${v}2_$m.wav "$D/$v-no-price-9x16-reels-$m.mp4"
  done
done
# every soundtrack as mp3 (original + trap + house) so any video can be re-scored in an editor
A="$OUT/05-Music-Alternatives/audio-tracks"
mp3(){ ffmpeg -y -loglevel error -i "$1" -c:a libmp3lame -b:a 192k "$2"; }
for m in "" _trap _house; do n=${m#_}; n=${n:-original}
  mp3 $RL/audio${m}.wav "$A/showreel-30s-$n.mp3"
  mp3 $M/launch_audio${m}.wav "$A/maro-launch-60s-$n.mp3"
  for v in overview beginner mastery modules alumni beginner2 mastery2; do mp3 $M/course_$v${m}.wav "$A/course-$v-$n.mp3"; done
done
rm -f /tmp/_dup1.mp4 /tmp/_dup2.mp4
rmdir downloads/courses 2>/dev/null || true
echo organized; du -sh "$OUT"/*
