#!/bin/bash
cd "$(dirname "$0")"
while [ ! -f lv_done.txt ]; do sleep 30; done
printf "beginner2 38.4 H\nbeginner2 38.4 V\nmastery2 38.8 H\nmastery2 38.8 V\n" | HTML=course2.html xargs -P 4 -L 1 ./render_course.sh
echo V2_DONE > v2_done.txt
