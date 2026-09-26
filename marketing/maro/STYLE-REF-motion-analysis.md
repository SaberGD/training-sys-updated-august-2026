# Motion Style Reference: "Project Organization System" (analysis)

Reference: a 22.6s, 1280×720 / **60fps** Arabic tutorial intro (boim studio, «ترتيب المشاريع / نظام التسمية»).
Goal: **reuse its motion language, not its assets**. We rebuild everything with SABER GROUP and MARO visuals and colours.

## 1. Timeline breakdown

| Time | What happens | Technique |
|---|---|---|
| 0.0–0.8 | Full-screen mint wall. A **jagged zig-zag black slit** tears open vertically and reveals the scene | Shape-mask "tear" reveal |
| 0.5–1.9 | «السلام عليكم» in **3D extruded text** (hollow outlined front face and solid extrusion sides) swings in with a perspective rotation, holds, then exits with heavy **directional motion blur** | Fake-3D extrusion, Y-rotation, motion blur |
| 1.9–3.2 | Single words replace each other centre-screen («مشاكل» → «تنظيم» → «الملفات»). Each starts as **blinking cursor bars ‖** that resolve into the word | Cursor/glitch type-on, VO-synced |
| 2.2–3.4 | A glossy **3D folder icon** with an embossed logo and a label pill slides in from the right, trailing a thin circular orbit line | Hero-icon entrance plus arc line |
| 3.4–4.0 | Words re-appear **arranged around the icon** (mind-map), with a **rack focus**: blurred, then sharp | Depth-of-field pull |
| 4.0–5.2 | The folder **multiplies**. Clones burst out with an over-exposed **bloom flash and light rays**, then settle into a rotating ring | Clone burst, bloom, god-rays |
| 5.2–6.8 | The ring rotates. **Counters 3 → 4 → 5** punch in (centre, then outside) with motion blur | Count-up numbers |
| 6.8–8.4 | Camera trucks along a **tilted 3D panel** (file-tree UI) in perspective | 3D card, camera dolly |
| 8.4–10.0 | Glowing **node dot**, thin **curved spline connectors**, and a list of file names typing in line by line. Background copies are blurred (**depth layers**) | Network lines, typewriter list, DOF |
| 10.0–11.6 | «ففي هذه الحلقة» in 3D text, blur-in and blur-out | Same 3D-text system |
| 11.6–13.0 | Dark **macOS-style window mock-up** slides in, then the camera pushes in and it dissolves to black | UI mock-up plus push-in |
| 13.0–17.2 | An endless **grid of folders** rises from darkness with a radial falloff (bright centre, fading edges). A **glowing ball** travels between folders and each one lifts and brightens as it passes. The camera pans to follow | Grid plus light-ball tracking |
| 17.2–19.3 | «تابعوا معي الحلقة» in 3D text, blur-in | Same |
| 19.3–22.6 | An **end card** (rounded thumbnail) slides up from the bottom and **morphs to full-screen**: logo, eyebrow text, title and credit, with a mouse cursor moving over it | Card-to-fullscreen morph, end screen |

## 2. The style DNA (what makes it feel premium)
1. **One hero colour only.** Mint `#20F5BD` on deep navy-black (`#05121F` / `#010E17`). Every element is the same hue at different brightness and opacity.
2. **Corner gradient glows** (`#257260`) in the bottom-left and top-right corners that slowly drift and breathe. They are never flat.
3. **A giant, very dim brand watermark** (their flame logo) sits behind everything with slow parallax.
4. **Nothing is static.** The camera always drifts (push, rotate or truck). Transitions are camera moves and blur, almost never hard cuts.
5. **Heavy motion blur** on every fast move, plus **depth of field** (foreground sharp, background soft) and **bloom** on bright shapes.
6. **Strong ease-out** (expo-like): fast in, long soft settle, very little overshoot.
7. **Captions are the narration.** On-screen words match the spoken voice-over. The audio is ~70% voice-band activity over a soft bed with whooshes.
8. **60fps**, which is why it feels so smooth.

## 3. Translation to SABER GROUP / MARO

| Reference element | Our version |
|---|---|
| Mint `#20F5BD` hero colour | Ember orange `#FF7B20` (key word or pill `#FD9905`) |
| Navy-black background | Red-black `#120403` → `#2C0203` |
| Teal corner glows | Rust-red glows `#C4321F` / `#651C17` |
| Flame watermark | Huge dim **MARO helmet silhouette** or the SABER GROUP wordmark |
| Mint wall with zig-zag tear | Orange wall that tears open (or MARO's visor "boots" open) |
| 3D extruded words | Same, in white with orange extrusion, in Cairo / heavy Arabic display |
| Folder hero icon | **MARO's head / visor** or AI tool tiles (Ps, Ai, Id, AI) |
| Clone ring and bloom | Ring of generated **designs/posters** bursting out of MARO's visor |
| File-tree 3D panel | **Chat panel with MARO** (prompt, then answer) tilted in 3D |
| Node network plus file list | AI workflow: prompt → model → outputs (typed list of results) |
| Folder grid plus light ball | Grid of student works/posters. MARO's orange light-ball picks the best |
| End card morph | CTA card: MARO, «جرّب مارو مجانًا», `ai.sabergroupacademy.com` |

## 4. Build notes (engine)
- Render at **60fps** to match the smoothness (1800 frames for 30s).
- **Motion blur** comes from sub-frame accumulation: render 4–8 sub-frames per frame and average them.
- **DOF / rack focus** uses per-layer `filter: blur()` driven by a focus value. **Bloom** uses a blurred copy with a `lighter` blend.
- **3D text**: stacked offset copies for the extrusion, with an outlined front face and a perspective skew/scale for rotation. Tilted UI panels use CSS 3D transforms or a projected quad.
- **Voice-over:** the reference is narration-driven. Decide whether we record VO (or use captions only) before locking the timing.
