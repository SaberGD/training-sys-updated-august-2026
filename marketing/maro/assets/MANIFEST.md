# MARO Launch Video Assets - Manifest

Prepared for the SABER GROUP / SG-MARO launch video. All final files were exported at the exact requested dimensions. Typography, logos, readable UI, and watermarks were excluded from generated scenes. The only intentional text is the `MARO` chest wordmark on the robot.

## Reference Inputs

- Official MARO turnaround sheet and four supplied MARO campaign posters were used as character, material, and lighting references.
- The supplied `vezeeta_family_campaign_package.zip` was used as the identity, wardrobe, lighting, and continuity reference for the family.
- Image generation was performed with the built-in ImageGen workflow. Final dimensions were normalized after generation without changing composition.

## V1 Reverse Prompt

**55 words, English:**

> Studio-style healthcare campaign portrait of a warm Egyptian multigenerational family arranged together against a saturated Vezeeta-blue background. The father sits centrally while mother, grandparents, boy and girl gather close, smiling. Pink and cyan floor lighting, polished commercial realism, balanced group composition, realistic skin and wardrobe detail, clean upper space, premium advertising finish.

## MARO Assets

### `maro/M1_maro_standing_front.png`

- Dimensions: 2048 x 2048 PNG
- Background: transparent alpha
- Notes: Full body; front-facing neutral pose; blank black visor.
- Prompt:

```text
Use case: stylized-concept
Asset type: transparent character cut-out for a premium launch video
Primary request: Generate MARO standing full body, facing camera, in a neutral friendly stance with both arms relaxed. Preserve the exact official character identity from the supplied reference images.
Input images: Image 1 is the official MARO turnaround/reference sheet and is the primary identity and proportion reference. Images 2-3 are official campaign posters for materials, lighting, shell color, neon intensity, and rendering style.
Subject: cute chibi red robot mascot, oversized round helmet head, compact body, glossy candy-red shell, black mechanical joints, articulated black robotic fingers, round headphone-style ear pods with small upward fin antennas, orange neon strips on helmet rim, ears, chest, hands and feet, MARO chest wordmark and short glowing dash beneath it.
Composition/framing: perfectly centered full-body front view, all limbs and feet fully visible, generous transparent margin, square canvas.
Lighting/mood: warm red key light, bright orange rim light, studio-clean, premium cinematic 3D render.
Critical face requirement: the visor is completely blank glossy deep black glass with only a soft subtle reflection highlight. No eyes, no flames, no timer, no logo, no icons, no facial marks.
Background: genuine transparent alpha, no floor, no ground shadow.
Constraints: preserve exact MARO design; five fingers on each hand; no extra limbs; no text anywhere except the small MARO chest wordmark; no logos; no watermark; clean cutout edges; no halo.
```

### Shared MARO constraints appended verbatim to M2-M5

```text
Preserve the exact official MARO identity from the supplied references: cute chibi proportions, oversized round helmet head, compact body, glossy candy-red shell, black mechanical joints, articulated black robotic fingers, round headphone-style ear pods with small upward fin antennas, orange neon strips on the helmet rim, ears, chest, hands and feet, and the small MARO chest wordmark with a short glowing dash below it. Premium cinematic 3D rendering, warm red key light with orange rim light. The visor must be completely blank glossy deep black glass with only a subtle reflection: absolutely no eyes, flames, timer, icons, logo, or facial marks. Genuine transparent alpha background, no floor, no ground shadow, no halo. Five fingers per hand, no extra limbs, no text except MARO on chest, no logos or watermark. Square canvas with generous margins.
```

### `maro/M2_maro_waving.png`

- Dimensions: 2048 x 2048 PNG
- Background: transparent alpha
- Notes: Friendly right-hand wave; blank black visor.
- Prompt prefix before the shared MARO constraints:

```text
Use case: stylized-concept. Asset type: transparent character cut-out for launch video. Generate MARO full body or knees-up, facing camera, with his right hand raised in a friendly wave, matching the energetic waving pose in the official flame-eyes poster while keeping the visor blank.
```

### `maro/M3_maro_thinking.png`

- Dimensions: 2048 x 2048 PNG
- Background: transparent alpha
- Notes: Thinking pose; hand at chin area; blank black visor.
- Prompt prefix before the shared MARO constraints:

```text
Use case: stylized-concept. Asset type: transparent character cut-out for launch video. Generate MARO full body in a thoughtful brainstorming pose: one articulated hand gently touching the chin/lower helmet area, head tilted slightly, other arm relaxed. Keep the pose readable and friendly, with the blank visor centered.
```

### `maro/M4_maro_presenting.png`

- Dimensions: 2048 x 2048 PNG
- Background: transparent alpha
- Notes: Presenting palm opens toward frame-right; blank black visor.
- Prompt prefix before the shared MARO constraints:

```text
Use case: stylized-concept. Asset type: transparent character cut-out for launch video. Generate MARO full body, body turned slightly three-quarter toward camera, one arm extended with an open palm presenting toward the RIGHT side of the frame, leaving visual space to his right for a screen. Keep the blank visor facing the viewer.
```

### `maro/M5_maro_head_closeup.png`

- Dimensions: 2048 x 2048 PNG
- Background: transparent alpha
- Notes: Symmetrical boot-up close-up; large blank visor.
- Prompt prefix before the shared MARO constraints:

```text
Use case: stylized-concept. Asset type: transparent character cut-out for launch video. Generate a perfectly front-facing head-and-shoulders close-up of MARO. The visor must be centered, large, and completely blank black glass for a boot-up animation. Symmetrical helmet, visible ear pods and fin antennas, upper chest edge visible.
```

## Scene Asset

### `scene/S1_scene_3am_desk.png`

- Dimensions: 1920 x 1080 PNG
- Notes: Laptop screen is fully visible, bright, blank, and ready for compositing.
- Prompt:

```text
Use case: ads-marketing. Asset type: 16:9 launch-video establishing scene. Cinematic night scene: a young design student seen from behind over the shoulder, face not visible, sitting at a desk in a dark room at 3 AM, lit mainly by a laptop. The laptop screen is fully visible, large in frame, plain soft bright glow with absolutely no content. Half-empty coffee mug, sketches, sticky notes, tired posture with one hand on the head. Deep red-black ambience, warm orange practical light from a small desk lamp, moody shallow depth of field, subtle film grain, premium commercial realism. Composition must be 16:9 with the laptop screen unobstructed for later compositing. No text, letters, numbers, logos, readable UI, or watermark.
```

## Vezeeta Campaign Assets

### `vezeeta/V1_image_to_prompt_source.jpg`

- Dimensions: 1920 x 1080 JPG
- Source: copied unchanged from `generated/family_compositions/family_studio_composition_01.jpg` in the supplied family package.
- Generation prompt: none; existing source asset.
- Reverse prompt: see the V1 Reverse Prompt section above.

### Shared V2/V3 base prompt

```text
Cinematic realistic advertising photograph for a healthcare booking app. A warm, sunlit Egyptian family living room. A smartphone lies flat on the rug in the foreground, and a miniature, fully detailed doctor's clinic rises out of its glowing screen like a living diorama. A tiny friendly doctor holds up a medical report while the father, sitting cross-legged beside the phone, leans in and talks with him. Around them the family lives a normal happy day: the mother and grandmother on the sofa, the grandfather in his armchair, the boy and girl playing with a doll. Soft blue and turquoise glow from the screen mixed with warm window light, shallow depth of field, clean negative space in the upper third, ultra-detailed, realistic skin and fabric texture.
```

### Shared V2/V3 continuity constraints appended verbatim

```text
Use the supplied family reference images as identity and wardrobe locks. Keep the father, mother, boy, girl, grandfather, and grandmother recognizable and consistent. No text, letters, numbers, logos, UI labels, watermarks, or readable marks. The phone screen contains only abstract blue/turquoise glow. Correct hands and faces, realistic skin, no extra people besides the tiny doctor and six family members.
```

### `vezeeta/V2a_prompt_result_16x9.png`

- Dimensions: 1920 x 1080 PNG
- Notes: Hero result; phone and miniature clinic read immediately; clear upper-third negative space.
- Prompt: shared V2/V3 base prompt + shared continuity constraints, preceded and followed by:

```text
Use case: ads-marketing. Asset type: 16:9 hero result.
The phone and miniature clinic must read instantly. Wide cinematic 16:9 composition, the upper third remains clean and uncluttered.
```

### `vezeeta/V2b_prompt_result_4x5.png`

- Dimensions: 1080 x 1350 PNG
- Notes: Vertical reframe with generous top space for code-added headline.
- Prompt: shared V2/V3 base prompt + shared continuity constraints, preceded and followed by:

```text
Use case: ads-marketing. Asset type: vertical 4:5 social poster.
Reframe the same scene vertically in 4:5. Keep generous clean empty space across the entire top quarter for a headline added later. Keep the phone and clinic fully visible and immediately readable in the lower half.
```

### `vezeeta/V3_prompt_result_variation.png`

- Dimensions: 1920 x 1080 PNG
- Notes: Low rug-level alternate angle with large phone/clinic foreground.
- Prompt: shared V2/V3 base prompt + shared continuity constraints, preceded and followed by:

```text
Use case: ads-marketing. Asset type: 16:9 alternate result.
Create a clearly different camera angle: low angle from rug level, the phone and miniature clinic feel huge in the foreground, while the family is softly behind it. Maintain clean upper-third negative space and premium cinematic realism.
```

### `vezeeta/V4_pro_ad_hologram_doctors.png`

- Dimensions: 1080 x 1350 PNG
- Notes: Final corrected version; all six family members stand; four cyan hologram doctors remain secondary; clean top quarter.
- Prompt:

```text
Use case: ads-marketing. Asset type: professional award-style 4:5 key visual. Show the exact six-person Egyptian family from the supplied identity references, all six standing upright together in a warm confident group portrait; nobody is sitting and no chairs are present. Full bodies are visible in the lower two-thirds. Behind them, three or four translucent blue/cyan hologram doctors appear as softly glowing semi-realistic guardian figures, secondary to the family and never covering faces. Strong rule-of-thirds composition, Vezeeta-blue studio backdrop with subtle pink and cyan floor accents, premium cinematic advertising lighting. Leave a generous clean empty top quarter. Keep identities and wardrobes locked to the references. No text, letters, numbers, logos, readable UI, or watermark. Correct hands, faces and anatomy.
```

### `vezeeta/V5_series_dental.png`

- Dimensions: 1080 x 1350 PNG
- Notes: Final corrected version; unrelated female dentist is visually distinct from both parents.
- Prompt:

```text
Use case: ads-marketing. Asset type: 4:5 graduation campaign dental poster. Show only the exact mother, boy and girl from the supplied family references plus one unrelated female dentist with a clearly distinct face and appearance; do not include the father or grandparents. A bright friendly dental clinic emerges through a large unmistakable glowing smartphone frame used as a portal doorway. The boy sits smiling in the dental chair while the female dentist gives a thumbs-up. The girl stands nearby holding her doll and the mother supports them. Blue/turquoise portal light, premium realistic healthcare advertising, consistent family wardrobe and identity. Generous clean empty top quarter for a headline. No text, letters, numbers, logos, readable UI or watermark. Correct hands and anatomy.
```

### `vezeeta/V6_series_orthopedics.png`

- Dimensions: 1080 x 1350 PNG
- Notes: Final corrected version; unrelated female orthopedic doctor is visually distinct from the family.
- Prompt:

```text
Use case: ads-marketing. Asset type: 4:5 graduation campaign orthopedics poster. Show the exact grandmother from the supplied references holding her cane, accompanied by one unrelated female orthopedic doctor with a clearly distinct identity, uncovered short dark hair, and professional white coat; she must not resemble any family member. The doctor explains a knee X-ray on a glowing lightbox inside a warm clinic emerging through a large unmistakable glowing smartphone portal doorway. Both smile naturally; dignified and reassuring. Blue/turquoise portal light, premium realistic healthcare advertising. Generous clean empty top quarter. The X-ray may show an abstract knee image but no letters or numbers. No text, logos, readable UI or watermark. Correct hands and anatomy.
```

### `vezeeta/V7_series_cardiology.png`

- Dimensions: 1080 x 1350 PNG
- Notes: Grandfather and father in a reassuring consultation; abstract heartbeat line only.
- Prompt:

```text
Use case: ads-marketing. Asset type: graduation campaign series, cardiology poster. The grandfather from the references is in a calm heart-care consultation, with the father beside him in a supportive posture. A friendly doctor shows a simple abstract heartbeat line on a tablet, with no text or numbers. They are inside the same large smartphone portal clinic look, with blue/turquoise glow. Reassuring, premium, natural smiles. Use the supplied images as strict identity and wardrobe references. Premium cinematic realistic advertising photography, realistic skin and fabric, correct anatomy and hands. No text, letters, numbers, brand logos, readable UI, or watermark. Phone surfaces/screens show only abstract clean blue/turquoise glow. Vertical 4:5 poster composition with a generous clean empty upper quarter reserved for a later headline.
```

## QA Summary

- All five MARO assets use transparent PNG backgrounds and blank glossy black visors.
- MARO shell color, black joints, orange neon, ear fins, proportions, and chest mark were checked against the supplied references.
- S1 laptop screen is blank and fully visible.
- Vezeeta family identity and wardrobe were carried from the supplied family package.
- Vezeeta scenes stay blue/turquoise and are not shifted toward the SABER GROUP red palette.
- Generated scenes contain no intentional typography, logos, readable UI, or watermarks.
- File names and final dimensions match the brief.
