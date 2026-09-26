# MARO motion engine

Canvas engine for the MARO launch video. It renders at 60fps with motion blur (sub-frame accumulation) and a visor-expression system.

```bash
npm i playwright@1.56.1 && pip install numpy scipy pillow imageio-ffmpeg
python3 prep.py                      # builds opaque sprites + visor masks from ../assets/maro
node mrender.js sheet                # out/expressions.png (visor expression sheet)
node mrender.js stills 2.1 4.5       # preview single frames
python3 maro_test_audio.py           # test_audio.wav
node mrender.js video 8 test_video.mp4
ffmpeg -i test_video.mp4 -i test_audio.wav -c:v copy -c:a aac -b:a 192k -shortest maro_style_test.mp4
```

- Expressions: `happy`, `happyB` (auto-blink), `blink`, `wink`, `think`, `wow`, `fire`, `check`, `love`, `scan`, `boot`, `collapse`, `power`, `off`.
- `drawMaro(pose, x, y, scale, {expr, et, t, thrust, rot})`, where pose is `M1`–`M5` and `thrust` turns on the flight jets.
- MARO's signature sounds (`maro_chirp`, `power_on`, `thruster`) are in `maro_test_audio.py`.

## Launch video (60s)

`launch.html` + `launch.js` (scenes) share `core.js` with the style test. The images come from `../assets` (copy `scene/` + `vezeeta/` next to the page, plus `logo.png` from `/public/icon-512.png`).

```bash
python3 launch_audio.py                                   # launch_audio.wav
# render in 4 parallel chunks (frames 0-900, 900-1800, ...)
for i in 0 1 2 3; do PAGE=launch.html node mrender.js video 60 seg$i.mp4 $((i*900)) $(((i+1)*900)) & done; wait
printf "file 'seg%d.mp4'\n" 0 1 2 3 > list.txt && ffmpeg -f concat -i list.txt -c copy video.mp4
ffmpeg -i video.mp4 -i launch_audio.wav -c:v copy -c:a aac -b:a 192k -shortest maro-launch-60s.mp4
```

The timeline is in `SHOTS` in `launch.js`: hook, boot, hello, then chapters 01–07, USP, and CTA with the end card.
