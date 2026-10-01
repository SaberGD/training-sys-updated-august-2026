#!/bin/bash
# overlay PNGs for every footage frame (4 parallel ranges per F segment), then the python compositor
cd "$(dirname "$0")"
python3 - <<'P' > ov_jobs.txt
EDL=[('A',0,3.55),('F',3.55,7.4),('A',7.4,9.24),('F',9.24,11.3),('A',11.3,16.36),('F',16.36,18.2),('A',18.2,20.1),('F',20.1,21.4),('A',21.4,22.8),('F',22.8,23.5),('A',23.5,25.2),('F',25.2,28.9),('A',28.9,32.05),('F',32.05,34.2),('A',34.2,37.75),('F',37.75,39.3),('A',39.3,40.85),('F',40.85,45.2)]
fr=[f for s in EDL if s[0]=='F' for f in range(int(s[1]*60),int(s[2]*60)+1)]
n=len(fr);q=(n+3)//4
for i in range(4):
    part=fr[i*q:(i+1)*q]
    # contiguous runs
    runs=[];a=part[0];p=a
    for f in part[1:]:
        if f!=p+1:runs.append((a,p+1));a=f
        p=f
    runs.append((a,p+1));print(' '.join(f'{x}:{y}' for x,y in runs))
P
i=0; while read -r line; do (for r in $line; do node ovrender.js 'montage_ov.html?v' ovl ${r%%:*} ${r##*:} >> ov_log_$i.txt 2>&1; done) & i=$((i+1)); done < ov_jobs.txt; wait
ls ovl | wc -l
python3 montage.py
