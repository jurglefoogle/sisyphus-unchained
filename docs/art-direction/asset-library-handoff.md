# Pottery library v1 — first-pass handoff

Updated renderer coverage, additional layers, animation recipes, and blocked artwork are documented in [renderer-asset-coverage.md](renderer-asset-coverage.md). The original delivery below was 131 assets; the expanded library now has 156 files and 170 registry entries. Use `delivery.json` for current scene geometry and clips.

The library is in `public/assets/pottery-v1/`. Open its `index.html` directly or serve `public/` and visit `/assets/pottery-v1/`. The catalog includes category filtering, name search, light/dark preview grounds, downloads, and audio playback.

## Delivered scope

- 31 generated PNG source assets: six chapter backgrounds, six chapter stones, Sisyphus pushing, a shade attendant, flywheel rotor, capstan, seven mythic installations, and eight mythological portraits.
- 77 original SVG assets: 24 interface symbols, six relic emblems, eight Insight upgrade symbols, 24 achievement stamps, three targets, nine geometric props, and three terrain profiles.
- 23 original synthesized WAV studies: 20 sound-effect families and three 24-second ambient music loops.
- Machine-readable manifest with stable IDs, file hashes, source provenance, measured dimensions, transparency, and suggested pivots.
- Motion and audio integration contract; this is a plan, not a finished animation library.

No game simulation, renderer, economy, package configuration, or other agent-owned code was changed by this asset task.

## Integration

Use the manifest's `url` fields through the game's normal asset loader. Site `sceneId` and `stoneAssetId` values match the economy catalog directly. Work, relic, upgrade, and target asset IDs prefix their content IDs with `work_`, `relic_`, `upgrade_`, and `target_` respectively. Achievement IDs use `achievement_` plus the specification's stable achievement ID.

Load only the selected chapter and shared sprites initially. These are high-resolution source PNGs, not a memory-optimized atlas. Keep the PNGs as source masters until actual displayed sizes and renderer texture budgets are established. Do not eagerly load every portrait and background into GPU memory.

Pivots are normalized against the full canvas, including padding. `visibleAlphaBounds` measures alpha at 128 or greater; `alphaBounds` includes faint fringe pixels. Both are informational and do not alter images. Suggested pivots require scene calibration, especially feet, rope handles, and wheel hubs.

Environment plates are opaque and independent of the deterministic terrain profiles. The three terrain kits provide exact route geometry studies; they are not finished illustrated terrain. Put scene controls and economic text in DOM elements, not in the art.

The capstan and work installations are flattened. Rotate only the separate `flywheel_rotor` now. Do not rotate an entire work image, including its stand, to simulate its machinery. Separate the fixed frame, actor, moving mechanism, belt and water before animating the installations.

Audio is mono PCM, 16-bit, 22.05 kHz. Music uses a 24-second loop with wrapped note tails. It is an original synthesized prototype score, not final instrument recording or mastered Foley. Listen and mix before acceptance. Do not play repeated impacts from background sites. Keep separate music, effects, and interface sliders.

## Remaining production work

1. Approve the visual family at actual desktop and phone scale. Simplify texture and incision detail where it becomes noisy. Harmonize the red-figure and black-figure character treatments if needed.
2. Build reusable cutout rigs: Sisyphus rest, push, strain, summit reaction, step-aside, and manual assist; shade pull, idle, and purchase reaction. Only one source pose each is delivered here.
3. Split and animate the seven work installations; separate the capstan crank/drum from its frame.
4. Finish the three landscape kits as layered art, calibrate six routes and installation anchors, and compose level 10/25/50 growth states.
5. Clean faint alpha fringes, add uniform packing gutters, select runtime sizes, and build atlases. Keep source images intact.
6. Replace or refine the synthesized Foley and music after listening; add pitch variants and final loudness mixing. Voice acting is outside the specified launch scope.
7. Choose and package licensed title/body fonts. This library embeds no font files and the catalog uses system fonts.
8. Complete moving-scene readability, reduced-motion behavior, and performance acceptance in the actual game.

## Sources and reproducibility

Images were made with the built-in image-generation tool. Exact prompts are in `asset-generation-v1.json`; the images are retained in the project. Vector and audio source is `tools/assets/build_library.py`. There are no downloaded stock assets, sampled recordings, or copied compositions in this library.

Run `python tools/assets/build_library.py`, then `python tools/assets/validate_library.py`. Validation checks file integrity, catalog coverage, transparency, SVG syntax, audio clipping, and loop boundary jumps. The resulting `validation.json` does not certify final visual quality, animation, accessibility, or musical quality.
