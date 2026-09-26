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
