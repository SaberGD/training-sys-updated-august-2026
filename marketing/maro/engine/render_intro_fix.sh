#!/bin/bash
# re-renders the first 7 s (new laptop screen + softer hand-off into MARO) for both formats, 2 chunks each
cd "$(dirname "$0")"
PAGE='launch.html' node mrender_nv.js video 60 fixH_0.mp4 0 210 > fix_log_H0.txt 2>&1 &
PAGE='launch.html' node mrender_nv.js video 60 fixH_1.mp4 210 420 > fix_log_H1.txt 2>&1 &
PAGE='launchNV.html?v' node mrender_nv.js video 60 fixV_0.mp4 0 210 > fix_log_V0.txt 2>&1 &
PAGE='launchNV.html?v' node mrender_nv.js video 60 fixV_1.mp4 210 420 > fix_log_V1.txt 2>&1 &
wait; echo DONE
