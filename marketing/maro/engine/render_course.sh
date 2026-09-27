#!/bin/bash
# usage: render_course.sh <vid> <dur> <H|V>
vid=$1; dur=$2; o=$3
q="course.html?vid=$vid"; [ "$o" = V ] && q="$q&v"
PAGE="$q" node mrender.js video $dur cv_${vid}_$o.mp4 > cv_${vid}_$o.log 2>&1
ffmpeg -y -loglevel error -i cv_${vid}_$o.mp4 -i course_$vid.wav -c:v copy -c:a aac -b:a 192k -shortest -movflags +faststart final_${vid}_$o.mp4
echo "done $vid $o" >> cv_done.txt
