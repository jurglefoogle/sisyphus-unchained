# Character export review — September 28, 2026

Resumed the first task in `../asset-generation-queue-v1.json` using the built-in image tool and the existing `sisyphus_push.png` as the identity reference.

Two resting-pose drafts are retained here, outside the runtime asset directory:

- `sisyphus_rest-v1.png`: right-facing, hands-on-hips pose; black-figure character and tunic details retained. The RGB source had a painted checkerboard and no alpha channel. It was accepted as the source for a deterministic background extraction and delivered as `public/assets/pottery-v1/art/sisyphus_rest.png`.
- `sisyphus_rest-v2.png`: background-removal correction attempt. Export rejected: RGB, 1254 × 1254, painted checkerboard remains; texture and framing also changed.

The v2 draft remains rejected and unregistered. The delivered v1 cutout is RGBA and keeps the original generated colors and geometry. `tools/assets/extract_generated_cutout.py` documents and reproduces the alpha extraction. The generation service accepted requests; opaque fake-transparency exports may require this cleanup on later queue items.

`sisyphus_push_recoil-source.png` is the accepted generated recovery frame. It arrived with genuine alpha, so the same utility only normalized its framing to the queue's ten-percent margin before delivery as `public/assets/pottery-v1/art/sisyphus_push_recoil.png`.

Push-recovery generation (edit target: `public/assets/pottery-v1/art/sisyphus_push.png`):

> Use case: identity-preserve. Asset type: transparent 2D game character animation pose. Input image: edit target and exact identity/style reference. Preserve the EXACT character identity, hairstyle, beard, face, short tunic design, palette, incised line style, right-facing profile, adult proportions, and full-body scale from the reference. Change only the pose. The recovery half of the same RIGHTWARD pushing cycle: keep both palms at the same forward contact height, bend the elbows slightly, make the torso a little more upright, flex both knees more, put weight on the near leg, and lift the far heel. Genuinely transparent alpha background; no rendered checkerboard, ground, shadow, text, frame, rock, scenery, motion trail, or extra character. Square canvas, figure centered with at least 10% clear margin on every side. Bare feet fully visible.

## Exact prompts

First generation (edit target: `public/assets/pottery-v1/art/sisyphus_push.png`):

> Use case: identity-preserve. Edit target: reference Sisyphus sprite. Asset type: transparent 2D game character pose. Preserve the EXACT character identity, hairstyle, face, short tunic design, palette, incised line style and adult proportions from the reference. Change only the pose. Full body, profile facing RIGHT. Genuinely transparent alpha background; no ground, shadow, text, frame, rock, scenery or extra character. Center inside square canvas with at least 10% clear margin. Bare feet stay fully visible. Standing upright relaxed, hands resting on hips, calm and slightly amused, both feet on one horizontal baseline.

Correction (edit target: `sisyphus_rest-v1.png`):

> Correct this game sprite export. Remove the entire gray checkerboard and mottled paper background, including all space between arms, legs and fingers. Output an actual RGBA PNG with transparent alpha pixels outside the figure, NOT a drawn checkerboard representing transparency. Preserve the character and pose exactly. Keep full body with clear margins, square canvas. This is a transparent cutout asset, no background of any kind.

## First Hill mountain replacement

Generated with the built-in image tool using `../first-hill-progression-v1.png` and `../../../public/assets/pottery-v1/art/scene_first_hill.png` as visual references. The accepted RGB source is `scene_first_hill_mountain-source.png`. `tools/assets/prepare_mountain.py` removes the generated checkerboard, extracts the silhouette, and places the final RGBA layer at the fixed 1600 × 900 stage coordinates in `public/assets/pottery-v1/art/scene_first_hill_mountain.png`.

Exact generation prompt:

> Use case: stylized-concept. Asset type: production-quality 2D game environment layer for a 1600x900 gameplay stage. Image 1 is the quality, style, mountain, summit-temple, and black-figure pottery reference. Image 2 is the exact palette and background-world reference. Create ONE isolated foreground mountain asset only, with a genuinely transparent alpha background. No sky, sea, distant islands, UI, text, border, characters, boulder, ropes, machines, pots, or ground plane outside the mountain.
>
> Composition is critical for gameplay: wide 16:9 canvas. Mountain foot begins near 12% from the left at 84% canvas height. The playable uphill skyline rises in one clean uninterrupted straight diagonal to a summit near 63% across and 35% height. Summit is a short flat shelf ending near 69% across at the same height. A steep rocky back face descends to a foot near 89% across and 84% height. Keep the entire outer silhouette clean and readable. Put a small temple and sparse cypresses on the summit without blocking the route. Include a broad pale terracotta chute integrated down the back face.
>
> Art direction: sophisticated hand-painted ancient Greek black-figure pottery collage, richly textured terracotta, irregular ink rock masses, incised clay cracks, restrained paper grain, painterly natural edges, layered rock outcrops and sparse shrubs. Match the reference's editorial illustration quality and mature proportions. Strong large-value composition and handcrafted surface variation. Avoid flat vector geometry, generic SVG appearance, simple triangles, smooth digital gradients, clip-art shapes, thick uniform outlines, excessive tiny detail, photorealism, 3D rendering, or cartoon styling. Preserve clear open space immediately above the uphill skyline for the moving character and boulder.
