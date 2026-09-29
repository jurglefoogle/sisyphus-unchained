# Asset needs

Everything the game needs to ship, in one place: what the library delivers,
what the art pipeline has queued, and what remains outside the pipeline.
Reviewed 2026-09-28 against runtime references, cutscene data,
`public/assets/pottery-v1/manifest.json` (159 source files), the generated
delivery contract, Electron packaging configuration, and
`docs/art-direction/asset-generation-queue-v1.json`.

The art pipeline owns the library, queue, and contract files. Add production
requests to the queue rather than dropping files into
`public/assets/pottery-v1/` by hand.

**Style for new game art:** black-figure and red-figure Greek pottery, with
flat fills, incised line, and authored texture rather than simple vector
geometry. Palette: ink `#211B17`, clay `#B65D35`, pale clay `#D99C6C`,
parchment `#EBDCC0`, bronze `#A57B3B`, ivory `#F6ECDC`. Characters face right
in profile. Cutouts need real alpha; earlier exports arrived with a painted
checkerboard and needed `tools/assets/extract_generated_cutout.py`.

## Summary

| Group | Have | Queued | Still to request |
|---|---|---|---|
| World and characters | 159 source files, 69 of 85 required states | 26 image tasks: 16 blocked states, 9 wrapped-feet variants, and 1 pull-loop enhancement | none |
| Cutscenes and archive | Every asset referenced by all 10 cutscenes and the archive | none | none required; 6 optional embellishments |
| Audio | 20 effects, 3 music loops | none | none required; 3 optional additions |
| Desktop packaging | none; the browser uses a grey-circle data favicon | none | app icon set, favicon, optional installer art |
| Steam store and library | none | none | 10 required presentation images, screenshots, 48 achievement icons, optional page background, and trailer |
| Brand | none | none | the Sisyphus: Unchained wordmark |

The most urgent packaging gap is the **app icon**. `package.json` points
electron-builder at `desktop/resources`, which does not exist, so the installer
and taskbar currently use default Electron identity. The most visible in-game
gaps are the five later-hill mountain layers and the blocked character states.

The source audit found no broken runtime art reference. `tests/scenes.test.ts`
verifies every non-voice actor, background, prop, and pose used by the
cutscenes against the manifest. The important gap was in the contract itself:
the renderer requests six `<scene>_mountain` textures, but coverage did not
track them. They are now in `REQUIRED_ASSETS`, with the five missing files
reported as pending instead of being hidden behind the painted-slope fallback.

## 1. Delivered

All 159 source files are listed at `/assets/pottery-v1/` on the dev server, and
animated states are shown at `/assets/pottery-v1/states.html`. Every art ID
currently named by gameplay, UI, cutscene, and archive code resolves.

| Category | Count | Contents |
|---|---:|---|
| Scene paintings | 6 | one per hill |
| Scene layers | 14 | hill and foreground per hill, the First Hill mountain, route footholds |
| Terrain kits | 3 | clay, underworld, celestial |
| Stones | 6 | limestone, basalt, marble, bronze, star, decree |
| Characters | 4 | Sisyphus push, rest, push recoil; shade attendant |
| Portraits | 8 | Hermes, Daedalus, Ixion, the Danaids, Talos, Atlas, Zeus, Thanatos |
| Works | 7 | one per mythic work, including the Charter |
| Machines and world components | 14 | flywheel, drum, frames, belt, marker, and shared effects |
| Props | 9 | scaffold, supports, machine pieces, chips, drops, sparks |
| Targets | 3 | debris, coin amphora, gilded offering |
| Relics | 6 | all six relics |
| Insight upgrades | 8 | all eight |
| Achievements | 24 | all 24 |
| Interface icons | 24 | every `ui_*` icon currently used |
| Effects audio | 16 | the full specification budget |
| Interface audio | 4 | buy, open, close, unavailable |
| Music | 3 | early labor, underworld enterprise, approach to Olympus |

"Delivered" is technical availability, not final approval. The handoff still
calls for alpha cleanup, phone-scale review, terrain polish, internal work
animation, and in-game scale review.

The validator currently reports 22 tight-edge warnings: four later stones
(`stone_basalt`, `stone_marble`, `stone_star`, `stone_decree`), both base
character cutouts, `flywheel_rotor`, `capstan`, all seven works, and seven of
the eight portraits. These are concrete crop/animation risks and need a padded
re-export or a documented visual acceptance before release.

## 2. Queued in the art pipeline

The queue contains 29 tasks: 3 delivered and 26 pending. Until pending work
arrives, the renderer uses its explicit fallback for each blocked state.

**Sisyphus poses** (transparent PNG cutouts matching `sisyphus_push`):

- `sisyphus_strain`
- `sisyphus_summit`
- `sisyphus_step_aside`
- `sisyphus_walk_strip`
- `sisyphus_slip_strip`
- `sisyphus_get_up_strip`

**Shade attendant:** `shade_idle`, `shade_pull_recoil`,
`shade_purchase_reaction`, and `shade_walk_strip`. `shade_pull_recoil` improves
the available single-pose pull loop; it is not a blocked contract state.

**Prelude stone:** `stone_limestone_rough` and `stone_limestone_chipped`.

**Wrapped-feet variants:** nine variants covering push, rest, push recoil, and
the six queued Sisyphus states. The runtime rig already draws wraps, so these
are polish and cutscene assets rather than gameplay blockers.

**Later-hill mountains:**

- `scene_tartarus_rim_mountain`
- `scene_leaking_heights_mountain`
- `scene_bronze_pass_mountain`
- `scene_skyward_escarpment_mountain`
- `scene_olympian_approach_mountain`

The renderer asks for `<scene>_mountain` on every hill in `paintHill`. Only the
First Hill currently has one. The five new queue briefs require the same
1600 x 900 stage, exact route geometry from `src/world/geometry.ts`, real alpha,
and a distinct authored material treatment for each hill.

## 3. Cutscenes and archive: complete for launch

All 10 cutscenes stage from delivered scene paintings, portraits, Sisyphus
poses, stones, and works. Hades is deliberately an offstage voice represented
by a glow, as documented in `ACTORS`; a Hades portrait is not a missing file.
The archive UI has no archive-plate field, so plates for Ichor and vase
painting would require a feature change before they could appear.

These are optional art-direction upgrades:

| ID | Kind | Use |
|---|---|---|
| `portrait_hades` | portrait bust | only if Hades becomes visible instead of remaining an offstage voice |
| `portrait_hephaestus` | portrait bust | optional art for his archive entry; he never appears on stage |
| `scene_olympus_court` | 16:9 scene painting, no figures | bespoke court setting for The Sentence and Charter |
| `scene_lethe` | 16:9 scene painting, no figures | bespoke setting for Waters of Lethe |
| `archive_ichor` | square archive plate | optional after archive-plate UI support exists |
| `archive_vase_painting` | square archive plate | optional after archive-plate UI support exists |

A Sisyphus signing pose for the Charter and a Persephone portrait are also
possible future additions, but no current scene requires either one.

## 4. Audio: complete for the specification budget

The 20 effects and 3 music loops meet the specification. Optional additions:

- a short reed-and-frame-drum cutscene sting under 2 seconds;
- a water loop for the Leaking Heights;
- a bronze footfall accent for Talos.

Cutscenes currently use `sfx_decree`, `sfx_charter`, and
`sfx_impact_pottery`. `sfx_ui_open` and `sfx_ui_close` now play for the empire
and operation drawer. `sfx_ui_unavailable` is delivered but is not yet wired to
a rejected purchase or locked action; that is a code task.

## 5. Brand

**`logo_wordmark`:** professionally set Sisyphus: Unchained vector lettering
plus transparent raster exports. Use the game's display face, a meander rule,
and a small stone. Do not use generated lettering or auto-traced text. The
store capsules and library presentation depend on this asset.

## 6. Desktop packaging

| File | Size | Notes |
|---|---:|---|
| `desktop/resources/icon.png` | 1024 x 1024 | master: stone on a slope in a clay roundel, readable at 16 px |
| `desktop/resources/icon.ico` | 16-256 multi-size | Windows installer and taskbar |
| `desktop/resources/icon.icns` | standard icon set | macOS DMG |
| `desktop/resources/icons/512x512.png` | 512 x 512 | Linux AppImage |
| `public/favicon.svg` | scalable | replaces the grey-circle data URI in `index.html` |
| NSIS sidebar and header | 164 x 314 and 150 x 57 BMP | optional; default installer art is acceptable |

Creating `desktop/resources/` and wiring the favicon are code tasks after the
master icon is approved.

## 7. Steam store and library

Sizes were checked against official Steamworks guidance on 2026-09-28. Recheck
the downloadable templates at final export because Valve can revise them. All
capsules need a readable wordmark; the library hero must contain no text.

| Asset | Size |
|---|---:|
| Header capsule | 920 x 430 |
| Small capsule | 462 x 174 |
| Main capsule | 1232 x 706 |
| Vertical capsule | 748 x 896 |
| Page background | 1438 x 810, optional |
| Library capsule | 600 x 900 |
| Library header | 920 x 430 |
| Library hero | 3840 x 1240, no text |
| Library logo | up to 1280 wide or 720 tall, transparent |
| Steam shortcut icon | 256 x 256 ICO or PNG |
| Steam app icon | 184 x 184 JPG |
| Screenshots | at least 5, minimum 1920 x 1080 and 16:9, captured from the game |
| Trailer | 30-60 seconds, captured from the game |

Official references: [Steam graphical assets overview](https://partner.steamgames.com/doc/store/assets),
[store assets](https://partner.steamgames.com/doc/store/assets/standard),
[library assets](https://partner.steamgames.com/doc/store/assets/libraryassets),
and [graphical asset rules](https://partner.steamgames.com/doc/store/assets/rules).

**Achievement icons:** 24 achieved plus 24 unachieved files. Render the
existing `achievement_*.svg` in color for achieved and in a clearly distinct
dim treatment for unachieved. Use the dimensions accepted by the Steamworks
achievement uploader at export time; the public documentation requires both
icons but does not publish a stable pixel size. API names are `ACH_<ID>`.

Useful screenshot beats:

- the First Hill prelude slip;
- a charged flywheel with the foreman;
- the empire view with all six hills;
- a cutscene with Zeus and the decree stone;
- the Talos work;
- the Charter credits.

## Priority

1. Queued Sisyphus and shade poses, because six Sisyphus states and three shade states still use the procedural rig.
2. Five queued mountain layers, the largest environment gap during play.
3. App icon and favicon, because packaged builds still use default identity.
4. Wordmark, which unblocks the store and library presentation.
5. Steam capsules, client icons, screenshots, achievement exports, and trailer before the store page goes live.
6. Optional cutscene backgrounds, portraits, archive plates, and audio only after the launch set passes in-game review.

## Quality and acceptance gates

An entry in the manifest means the file exists; it does not mean the art is
release quality. Before an asset moves from delivered to approved:

- inspect it at actual desktop and narrow-screen game scale with the full UI;
- reject painted checkerboards, clipped limbs, inconsistent character identity,
  mismatched baselines, obvious generated text, and generic vector geometry;
- compare every mountain to the authoritative route and test the character,
  stone, works, and marker over it;
- review the seven flattened work illustrations in motion; entrance transforms
  exist, but internal machine animation remains an art-polish task;
- review code-authored icons at 16, 24, and 32 px and replace any that still read
  as placeholder geometry;
- capture store screenshots only from the release candidate, never from a
  generated mockup or concept board.
