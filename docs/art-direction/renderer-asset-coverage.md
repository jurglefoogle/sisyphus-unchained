# Renderer asset coverage

`src/world/assets.ts` is the complete registry. `REQUIRED_ASSETS` preserves the renderer's requested IDs, states, pivot descriptions, and prelude additions. `ASSET_MANIFEST` adds the entire source library without duplicate IDs. Adding a source through the library builder automatically registers it here.

## Current delivery

The library has 159 physical assets, including the original 131, 25 new vector components/layers, two new Sisyphus poses, and the authored First Hill mountain layer. The registry has 173 entries because logical world assets such as `flywheel` compose several source files.

There are 37 required world assets and 79 required states. 68 have available definitions. Eleven states and the wrapped-feet variant still require artwork. `public/assets/pottery-v1/coverage.json` is the machine-readable report; rerun the builder and contract tests after changes.

New delivered material includes twelve hill/foreground scene layers, route footholds, an independent wheel stand and upgrade rim, separate drum frame and rotor, milestone scaffold and bronze frame, belt, height-marker pole, dust puff, coin disc, relic rays, and a decree seal. Their geometry follows the current `src/world/geometry.ts`, with a test to catch route changes.

State recipes include flywheel visibility/charge/turn/upgrade, drum rotation, target shatters, work entrances and held idle poses, milestone running machinery, coin/relic/decree effects, marker movement, slip dust, tossed obols, and the first-summit burst. Work idle states hold their illustration; they do not yet animate the internal machinery.

Sisyphus and the shade attendant now share an eleven-bone procedural vector skeleton. Runtime clips articulate the head, torso, paired arms, and paired legs for push, pull, walking, idle, step-aside, and fall motion. Reduced-motion mode samples stable authored poses. The generated PNGs remain reference/source art and delivery fallbacks rather than being warped at runtime.

## Blocked artwork

- Sisyphus: strain accent, summit reaction, step aside, walk, slip/knockdown, and get up.
- Shade: idle, purchase reaction, and walk.
- Prelude limestone: rough and chipped illustrations.
- Sisyphus wrapped-feet variant across all states.

The image tool is available again. The resting pose and push-recovery pose have been delivered; the remaining planned prompts stay in `asset-generation-states-v1.json` and `asset-generation-prelude-v1.json`. Blocked states contain no layers and identify the needed assets. They must continue to use the renderer's explicit fallback, not an unrelated illustration relabeled as complete.

`asset-generation-queue-v1.json` consolidates 24 explicit image tasks in dependency order: the First Hill mountain, 14 base poses, strips, and stones, plus nine matching wrapped-feet exports. Three are now delivered. Step aside has its own pose. The validator checks prompt coverage, unique IDs, output paths, and reference availability.

## Consumption

Call `getAssetState(id, state)` and check `status`. Each available visual state has independent layers with a source URL, dimensions, normalized pivot, render size, and transform keyframes. `sampleAssetState` returns transforms at an absolute elapsed clip time. Rotors move independently of their supports. The `uninstalled` wheel intentionally has no visible layers.

Transforms use stage pixels and radians. `frame.pivot` is normalized within the full source canvas; translate the image by minus its pivot times its render size inside the animated layer container. Scene layers use a top-left pivot and the 1600×900 stage size. The scene recipes in `delivery.json` supersede the older draft route in `motion-contract.json`.

Reduced-motion sampling uses a stable designated poster time, so disappearing bursts remain invisible and persistent stamps remain visible. Sampling never grants rewards, changes the game clock, or advances simulation phases. Load sources lazily; this registry is metadata, not a preload request. URLs in the manifest are rooted at `/assets/pottery-v1/`; deployment beneath a subpath must prefix the configured base URL.

Open `/assets/pottery-v1/states.html` to inspect animations and missing states, or `/assets/pottery-v1/` for every individual source file.

## Verification

Run:

```
python tools/assets/build_library.py
python tools/assets/validate_library.py
npx vitest run tests/asset-contract.test.ts
```

The contract tests check source coverage, state coverage, geometry alignment, independent rotor motion, deterministic sampling, reduced motion, and expired effects. Available does not mean final art approval: alpha cleanup, illustrated terrain polish, articulated rigs, internal work animation, and in-game scale review remain production work.
