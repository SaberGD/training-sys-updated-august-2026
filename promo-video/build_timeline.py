"""Builds timeline.json from the per-scene voice-over clips.

Each scene lasts LEAD + vo + TAIL (+ any extra visual time), and subtitles are
split on punctuation and timed proportionally to their character count.
"""
import json
import re
import subprocess

LEAD = 0.5
TAIL = 0.9
# extra seconds of pure visuals per scene (logo reveal, certificate, end card)
EXTRA = {3: 0.8, 9: 1.2, 10: 3.0}

lines = json.load(open("vo.json", encoding="utf-8"))
scenes = []
t = 0.0
for i, text in enumerate(lines, start=1):
    vo = float(subprocess.check_output([
        "ffprobe", "-v", "error", "-show_entries", "format=duration",
        "-of", "csv=p=0", f"vo/s{i}.wav"]))
    dur = LEAD + vo + TAIL + EXTRA.get(i, 0)
    # subtitle chunks: split after sentence/clause punctuation
    parts = [p.strip() for p in re.split(r"(?<=[،.؟…:])\s+", text) if p.strip()]
    # merge very short parts with the next one
    merged = []
    for p in parts:
        if merged and len(merged[-1]) < 14:
            merged[-1] += " " + p
        else:
            merged.append(p)
    total_chars = sum(len(p) for p in merged)
    subs = []
    st = t + LEAD
    for p in merged:
        d = vo * len(p) / total_chars
        subs.append({"start": round(st, 3), "end": round(st + d, 3), "text": p})
        st += d
    scenes.append({"id": i, "start": round(t, 3), "dur": round(dur, 3),
                   "voStart": round(t + LEAD, 3), "voDur": round(vo, 3), "subs": subs})
    t += dur

json.dump({"total": round(t, 3), "scenes": scenes}, open("timeline.json", "w", encoding="utf-8"),
          ensure_ascii=False, indent=1)
print("total", round(t, 2))
for s in scenes:
    print(s["id"], s["start"], s["dur"])

with open("timeline.js", "w", encoding="utf-8") as f:
    f.write("window.TIMELINE = " + json.dumps(json.load(open("timeline.json", encoding="utf-8")), ensure_ascii=False) + ";\n")
