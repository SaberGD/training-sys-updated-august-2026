# MARO (مارو): Character & Campaign Bible

MARO is the official mascot and face of the **SABER GROUP AI Assistant** (`ai.sabergroupacademy.com`).
This character design is **final**. All future videos and posts must stay consistent with it.
Reference renders are in `reference/`.

## 1. Character design (keep consistent)

| Part | Spec |
|---|---|
| Build | Chibi / cute proportions: oversized round helmet head, compact body, short legs |
| Shell | Glossy candy-red panels (highlight ≈ `#B63D34`, shadow ≈ `#4D0A06`) with black mechanical joints |
| Face | Black glass visor. It's a **screen**, so the face is whatever it displays |
| Lights | Orange neon strips (≈ `#FF7B20`) on the helmet rim, ears, chest, hands and feet |
| Ears | Headphone-style round ear pods with small upward fin/horn antennas |
| Chest | `MARO` wordmark in orange with a short glowing dash under it |
| Hands | Articulated black robotic fingers. Can wave and grip a steering wheel |

### Visor expressions (the character's "acting")
- **Happy**: two glowing orange arcs `^ ^` (smiling eyes). Default friendly state.
- **Fired up / ready**: flame icons as eyes 🔥🔥. Used for urgency ("مفيش وقت للكلام").
- **Countdown**: digital timer `00:12:30` + "ASSEMBLY IN PROGRESS" + progress bar.
- **Boot / brand**: glitching SABER GROUP logo on the visor (power-on moment).

## 2. Worlds & story beats already established
1. **Assembly lab**: robot arms building MARO on a platform, holographic blueprints, orange hourglass orbs. Theme: *the countdown has started*.
2. **Reveal**: MARO fully assembled on a stand with cables, logo on the visor, side timer `00:09:47`.
3. **F1 race car**: MARO drives a red F1 car (`MARO` / `SPEED` livery). Theme: *your work gets done faster*.
4. **Close-up wave**: flame eyes and a waving hand. Theme: *no time to talk, we're ready*.

Campaign arc = **teaser countdown, then build, then speed benefit, then "ready" launch**.

## 3. Copy used so far (Egyptian colloquial, short and punchy)
- «العد التنازلي بدأ»، «خليك جاهز»
- «شغلك يخلص أسرع بضغطة زرار!» (with a mouse-cursor icon and a hand-drawn squiggle)
- «مفيش وقت للكلام»، «جاهزيـــن»

Tone: urgency plus speed plus confidence. Short lines, one idea per frame.

## 4. Visual system (posts are 1080×1350, 4:5)
- **Palette**: near-black red background `#120403` to `#2C0203`, glossy reds, neon orange `#FF7B20`, highlight orange `#FD9905`, white type.
- **Type**: heavy Arabic display face, white. Long **kashida** stretches (أســـرع، جاهزيـــن). One key word sits in an **orange pill** (`#FD9905`), e.g. «العد», «جاهز», «شغلك».
- **Logo**: SABER GROUP white wordmark, top-left.
- **Badge**: Adobe Certified Instructor (Design & Layout), top-right (on some posts).
- **Footer**: Facebook, Instagram and Behance icons plus `SABERGROUPEG`, centered at the bottom.
- **Grid**: thin guide lines with small dots at intersections (a design-studio feel).
- **Depth**: blurred orange bokeh orbs or hourglass orbs in corners, a blurred checkered-flag hint bottom-left, red fog and sparks.

## 5. Notes for animating MARO in video
- The best source material is **transparent PNG cut-outs** of MARO in each pose (happy, flame, countdown, waving, driving), plus clean backgrounds without text. These can be layered and animated (parallax, float, visor-expression swaps, light flicker).
- The visor is a screen, so expressions, timers and logos can be animated **in code** on top of a blank-visor render. That keeps MARO's acting fully controllable.
- Motion language: mechanical snaps and servo sounds for assembly, speed lines and engine whooshes for F1, glitch and power-up for the visor boot.
