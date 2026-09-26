# SABER GROUP — 30s AI Design Showreel

A 30-second, 30fps promo in two formats (16:9 1920×1080 and 9:16 1080×1920 for Reels/TikTok) for the SABER GROUP AI Assistant (`ai.sabergroupacademy.com`).
Everything, visuals and audio, is generated from code, so it's fully editable.

| File | What it does |
|---|---|
| `reel.html` | Canvas motion-graphics engine. `renderFrame(f)` draws frame `f` deterministically. Open with `?v` for the vertical layout. |
| `audio.py` | Synthesized 120 BPM score + SFX (whooshes, impacts, glitches, typing, chimes), synced to the cuts. |
| `render.js` | Playwright renderer that pipes 900 frames into ffmpeg (H.264). |
| `saber-group-showreel.mp4` | Final 16:9 video. |
| `saber-group-showreel-vertical.mp4` | Final 9:16 video for Reels / TikTok / Shorts. |

## Storyboard (cuts land on the beat)

| Time | Scene |
|---|---|
| 0–3s | Ember particles spiral in, then the logo slams in with a shockwave |
| 3–7s | Kinetic type: «صمّم · بعقل · الذكاء الاصطناعي» then «من الصفر للاحتراف» |
| 7–12.5s | AI prompt is typed and "توليد" pressed, then a poster resolves from pixels (generate / edit / replace / composite) |
| 12.5–17s | Ps · Ai · Id tiles plus the AI tile, skill marquees, «مدرب معتمد دوليًا من Adobe» |
| 17–22s | Proof: 22K+ followers, 50+ training hours, 3 programs + AI, then **Ads of the World** |
| 22–26s | Two tracks: Level 01 / PRO, with online or Tanta, recorded sessions, interest-free installments, certificate |
| 26–30s | CTA: try the assistant free, 400 EGP coupon valid for 24h with a live countdown, URL, WhatsApp |

## Re-render

```bash
npm i playwright@1.56.1 && pip install numpy scipy imageio-ffmpeg
node render.js video            # -> video.mp4 (silent)
python3 audio.py                # -> audio.wav
ffmpeg -i video.mp4 -i audio.wav -c:v copy -c:a aac -b:a 192k -shortest saber-group-showreel.mp4
node render.js stills 4.3 11.9  # preview single frames into stills/

# vertical 9:16 (same timeline + soundtrack)
VERTICAL=1 node render.js video  # -> video-vertical.mp4
ffmpeg -i video-vertical.mp4 -i audio.wav -c:v copy -c:a aac -b:a 192k -shortest saber-group-showreel-vertical.mp4
```

Edit copy, prices or timings in `reel.html` (scene functions) and the matching event times in `audio.py`.

The vertical layout keeps key content between y≈300 and y≈1600, clear of the Reels/TikTok caption and button overlays.
