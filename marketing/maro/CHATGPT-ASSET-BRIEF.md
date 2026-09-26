# Image Asset Brief: MARO Launch Video (for ChatGPT)

> **Read this whole file before generating anything.** It is the single source of truth for this job.
> You are producing **image assets only**. A separate motion designer (Claude) will animate them, add every piece of text and typography, and assemble the final video in code.

---

## 0. Attachments that come with this brief
1. **This file.**
2. **5 MARO posters** (the official MARO character renders): countdown/assembly, assembled in lab, F1 close-up, F1 wide, flame-eyes waving.
3. **`vezeeta_family_campaign_package.zip`**: the Vezeeta family campaign we already built together. Its `docs/VEZEETA_FAMILY_CAMPAIGN_CONTEXT.md` remains the source of truth for the family cast, wardrobe, lighting and the phone-as-healthcare-gateway idea.

---

## 1. Context: who we are and what this video is

**SABER GROUP Courses Academy** is a graphic design and AI-in-design academy in Egypt (Photoshop, Illustrator, InDesign, AI workflows, advertising campaigns).

**MARO (مارو)** is the academy's AI assistant (`ai.sabergroupacademy.com`), shown as a cute red robot mascot. It is the **only** place that gives every student a personal AI assistant that follows them **24/7**, reviews, fixes and improves their work, and stays with them during the course and after it.

**The video:** a ~60s launch promo (plus 30s cut, 16:9 and 9:16). There's no voice-over: only on-screen text, music and SFX. The motion style is premium: 3D-feeling text, a constantly moving camera, motion blur, depth of field and glow, all in the SABER GROUP palette (red-black `#120403`, neon orange `#FF7B20`, highlight orange `#FD9905`).

**The story:** we follow a student who is designing the **Vezeeta family healthcare campaign**. Each stage of their project reveals one MARO feature:

| Stage | MARO feature | Your assets used here |
|---|---|---|
| Hook, "3 AM, deadline in the morning, no idea" | n/a | S1 |
| MARO appears for the first time | intro | M1, M2, M5 |
| 01 Brainstorm (عصف ذهني) | ideas for the Vezeeta campaign | M3 |
| 02 Generate Brief | a campaign brief is generated | n/a (built in code) |
| 03 Image To Prompt, then Prompt Generator, then Image Generation | AI image tools | V1, V2, V3 |
| 04 Rate my design (قيّملي تصميمي) | before and after poster critique | V2b (I build the posters) |
| 05 Analyze a design and learn (حلل تصميم وتعلم منه) | a pro ad is broken into lessons | V4 |
| 06 24/7: tech problem and course question | chat montage | M5 |
| 07 Coach MARO (المدرب مارو) | graduation project review | V5, V6, V7 |
| USP and offer (400 EGP off, 48 hours) | CTA | M2, M4 |

**Colour logic (intentional):** the video world is SABER GROUP red and orange. The student's work inside it (Vezeeta) stays **Vezeeta blue and turquoise**. That contrast is intended, so don't shift the Vezeeta images toward red.

---

## 2. Global rules (apply to every image)
1. **No text, letters, numbers, logos, UI labels or watermarks** inside any image. All typography is added later in code. (This avoids broken Arabic text.)
2. **No real brand logos.** Don't draw the Vezeeta logo or any Adobe logos. Phone screens should show an **abstract, clean blue/turquoise UI glow** with no readable text.
3. **Continuity comes first.** MARO must match the attached posters exactly. The Vezeeta family must match the zip references (faces, wardrobe, proportions).
4. Anatomy: correct hands (5 fingers), no extra limbs, no warped faces, realistic skin texture, crisp detail.
5. Export **PNG**, at the exact sizes listed. Use the **exact file names** below.
6. If a transparent background isn't possible in your tool, use a **flat pure green `#00FF00`** background with no green spill on the character. Never use a black or red background for cut-outs.

---

## 3. Part A: MARO assets

### MARO design lock (must match the posters)
Chibi proportions: an oversized round helmet head and a compact body. **Glossy candy-red shell** with black mechanical joints. **Orange neon light strips** on the helmet rim, ears, chest, hands and feet. Round headphone-style **ear pods with small upward fin/horn antennas**. An orange **"MARO" wordmark on the chest** with a short glowing dash under it. This is the ONLY text allowed anywhere, because it's part of the character. Articulated black robotic fingers.

### 🔴 The critical requirement: a BLANK VISOR
The face visor must be **completely blank: glossy deep black glass** with only a soft, subtle reflection highlight. **No eyes, no flames, no logo, no timer, no icons.** We animate every facial expression on this screen in code. That's how MARO "acts" in the video.

**Lighting for all MARO cut-outs:** warm red key light with an orange rim light, matching the posters. The neon strips should be lit and glowing. Studio-clean, no ground shadow.

| File name | Size | Description |
|---|---|---|
| `M1_maro_standing_front.png` | 2048×2048, transparent | Full body, standing, facing camera, neutral friendly stance, arms relaxed. Blank visor. |
| `M2_maro_waving.png` | 2048×2048, transparent | Full body (or knees up), right hand raised waving, same pose energy as the flame-eyes poster. Blank visor. |
| `M3_maro_thinking.png` | 2048×2048, transparent | Full body, one hand on the chin area of the helmet, head tilted slightly (thinking/brainstorming). Blank visor. |
| `M4_maro_presenting.png` | 2048×2048, transparent | Full body, turned slightly, one arm extended with open palm toward the **right side of the frame**, as if presenting a screen next to him. Blank visor. |
| `M5_maro_head_closeup.png` | 2048×2048, transparent | Head and shoulders only, perfectly front-facing, visor centred and large (used for the "boot-up" moment). Blank visor. |

---

## 4. Part B: scene asset

| File name | Size | Prompt |
|---|---|---|
| `S1_scene_3am_desk.png` | 1920×1080 | Cinematic night scene. A young design student seen **from behind, over the shoulder** (face not visible), sitting at a desk in a dark room at 3 AM, lit only by a laptop screen. The screen glow is plain, soft and bright with no content. A half-empty coffee mug, sketches and sticky notes, a tired posture with a hand on the head. Deep red-black ambience with warm orange practical light from a small lamp. Moody, shallow depth of field, film grain, 16:9. Keep the **laptop screen fully visible and large in frame** (we composite MARO appearing on it). No text anywhere. |

---

## 5. Part C: Vezeeta campaign assets
Use the zip's family references for every person. Keep all wardrobe locked exactly as written in the context doc.

### V1: Image To Prompt source (no generation needed)
Use the existing `generated/family_compositions/family_studio_composition_01.jpg`. Rename the copy to `V1_image_to_prompt_source.jpg`.
In the manifest, **also write a detailed reverse prompt for this image** (≤ 60 words, English). This is the text MARO will "extract" from it on screen, so it should read like a real, well-crafted prompt.

### V2: the Prompt Generator result (the most important image)
In the video, the student types this idea in Arabic:
> «موبايل نايم على أرض الصالة وطالع منه عيادة صغيرة.. والعيلة حواليه في يوم عادي»

MARO turns it into the English prompt below. **Generate with this prompt exactly** (plus the zip references for identity), because the video shows this prompt producing this image:

```text
Cinematic realistic advertising photograph for a healthcare booking app. A warm, sunlit Egyptian family living room. A smartphone lies flat on the rug in the foreground, and a miniature, fully detailed doctor's clinic rises out of its glowing screen like a living diorama. A tiny friendly doctor holds up a medical report while the father, sitting cross-legged beside the phone, leans in and talks with him. Around them the family lives a normal happy day: the mother and grandmother on the sofa, the grandfather in his armchair, the boy and girl playing with a doll. Soft blue and turquoise glow from the screen mixed with warm window light, shallow depth of field, clean negative space in the upper third, ultra-detailed, realistic skin and fabric texture.
```

| File name | Size | Notes |
|---|---|---|
| `V2a_prompt_result_16x9.png` | 1920×1080 | The hero result. The phone and mini clinic must read instantly. |
| `V2b_prompt_result_4x5.png` | 1080×1350 | The same scene reframed vertically for a social poster. Keep **generous empty space at the top** (for the headline added later). |
| `V3_prompt_result_variation.png` | 1920×1080 | A second variation of the same prompt: different camera angle (e.g. low angle from the rug, the phone clinic huge in the foreground, the family soft behind). Used to show "multiple results". |

### V4: the "professional ad" MARO analyzes
A strong, award-style key visual that the student admires. It gets broken into composition, colour, hierarchy and idea on screen.

| File name | Size | Prompt |
|---|---|---|
| `V4_pro_ad_hologram_doctors.png` | 1080×1350 | The full family from the studio references, standing together, warm and confident. Behind them, **translucent blue/cyan hologram doctors** (3–4, softly glowing, semi-realistic) watch over them like guardians. A bold, clear composition: the family in the lower two-thirds, strong rule-of-thirds structure, a **clean empty area at the top** for a headline. Vezeeta-blue studio background with pink/cyan floor accents as in the references. Cinematic, premium, no text. |

### V5–V7: the graduation project (a campaign series with 3 specialties)
Three matching posters from one campaign. Same lighting, same framing logic and same phone-gateway cue, so together they read as one professional series.

| File name | Size | Prompt |
|---|---|---|
| `V5_series_dental.png` | 1080×1350 | Mother with the boy and girl in a bright, friendly dental clinic that **emerges from a large glowing smartphone frame** (a phone-as-portal doorway). The boy sits in the dental chair smiling while a kind dentist gives a thumbs-up. The girl holds her doll. Empty top area for a headline. |
| `V6_series_orthopedics.png` | 1080×1350 | The grandmother (with her cane) with a **female orthopedic doctor** explaining her knee X-ray on a lightbox, inside a warm clinic emerging from the same phone portal. Reassuring, dignified, smiling. Empty top area. |
| `V7_series_cardiology.png` | 1080×1350 | The grandfather in a calm heart-care consultation. The doctor shows a gentle heartbeat line on a tablet, with the father beside him supportive, inside the same phone-portal clinic look. Empty top area. |

---

## 6. Delivery
Send back **one ZIP: `maro_video_assets.zip`**
```
/maro      M1–M5
/scene     S1
/vezeeta   V1, V2a, V2b, V3, V4, V5, V6, V7
MANIFEST.md
```
`MANIFEST.md` should list each file with its dimensions, the exact prompt used, and any notes. It must also include the **V1 reverse prompt**.

## 7. QA checklist before you export
- [ ] MARO matches the posters (shell colour, neon strips, fin ears, chest wordmark) in all 5 poses.
- [ ] **Every MARO visor is blank black glass.**
- [ ] Cut-outs have clean alpha (or flat `#00FF00`), with no halo or ground shadow.
- [ ] The family's faces and wardrobe match the zip references in every Vezeeta image.
- [ ] No text, no logos and no readable UI anywhere (except "MARO" on the robot's chest).
- [ ] Hands, fingers and faces are anatomically correct.
- [ ] Exact sizes and file names.
