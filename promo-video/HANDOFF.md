# Promo video — work status (for resuming in a new session)

Goal: motion promo video "مش هتمشي لوحدك" explaining how SABER GROUP follows up trainees + the student portal.
Script: SCRIPT.md. CTA: sabergroupacademy.com.

Pipeline (run from promo-video/):
1. `python3 tts.py <voice> <text> <out> <rate>` — edge-tts with proxy CA (voice ar-EG-ShakirNeural, +8%). VO lines in vo.json → vo/s1..s10.wav (silence-trimmed).
2. `python3 build_timeline.py` → timeline.json + timeline.js (scene timings from VO lengths).
3. `index.html` — deterministic motion page, `render(t)` draws frame at time t (1920x1080).
4. `node render.mjs stills 3 9 17` → stills/ ; `node render.mjs video 30` → out/video_silent.mp4
5. `python3 make_audio.py` → out/audio.wav (VO + music), then mux → out/saber-promo.mp4

Status: see checklist below.
- [x] VO generated
- [x] timeline + motion page written
- [x] review stills & fix layout
- [x] full render + audio mix (out/saber-promo.mp4, not committed)
- [ ] 9:16 version

Mux command: `ffmpeg -i out/video_silent.mp4 -i out/audio.wav -c:v copy -c:a aac -b:a 192k -shortest out/saber-promo.mp4`
