# Evaluation, 29 September 2026

A full review of the game after the hill workshops plan (Phases 1 to 10). It
covers where development stands against the specification's milestones, what
is missing, and what to do next. It draws on:
- play in the browser from generated day‑4 and day‑16 saves;
- a comparison of the code with `specification.md`, `hill-workshops-plan.md`,
  `asset-needs.md` and `release-checklist.md`;
- the production build, the type checks and the tests.

## Summary

The game is **mechanically complete, and past the specification's scope**.
What is missing is mostly presentation, explanation, and evidence from real
players. In the specification's terms that is **alpha**: systems done, art and
sound about half done, and none of the human playtest gates run.

**Asset generation is underway** in the art pipeline (29 September). The art
items below are listed so they can be checked against that work, not
requested twice.

## Scale

| | |
|---|---|
| Source | about 26,400 lines of TypeScript and Svelte |
| Tests | 26 files, 221 tests; type checks and Svelte checks clean |
| Save schema | version 12, with a migration and fixture path from version 1 |
| Build | works; one 1 MB script bundle (296 KB gzipped) |
| Content | six hills, six machines, 48 tablets plus 24 Appeal tablets, six visitors, whispers, five Edicts, ten Appeal twists, ten cutscenes, 24 achievements, six relics |

## Against the specification's milestones (§06)

| Milestone | State |
|---|---|
| 1 Core loop | Done |
| 2 Automation proof | Built. The 5 to 8 person first‑hill playtest has not happened |
| 3 First complete run | Done |
| 4 Campaign | Done, and extended: six machines, sealed tablets, stewards, trials, Insight memory, ten Appeals. The exit condition "campaign playtest completed" is not met |
| 5 Art and sound | About half. The First Hill is at production quality; the later hills and every new machine are not |
| 6 Shipping | Partly. The installer builds, the smoke test exists and save recovery works. No app icon, no store assets, and none of the manual release checks ticked |

## Fixed during the review

**The Tartarus Rim crashed the interface.** In any save past the first
purchases, opening the Tartarus Rim threw on every frame. The scroll priced the
Impact track, which the rim does not have because Ixion's Wheel replaces it.
The fix is in `src/app/view.ts`. `tests/gauge.test.ts` now builds the view for
every hill of a late campaign; it fails without the fix and passes with it.

## What is missing, most important first

### 1. The machines are invisible in the world

Heat, the jar, the pour, the sky and the backlog appear only in the scroll and
the tablet gauge. Nothing erupts, fills, pours or turns on screen. The world
still shows only the original installs (the flywheel, the works).

`asset-needs.md` (reviewed 28 September) requests no art for any of it:
- the six machines;
- the 72 tablets;
- the visitors Persephone, Poseidon, Hephaestus, Helios and Nemesis;
- the stewards.

Check these against the generation now underway.

### 2. Five hills are placeholder shapes

The painted backdrops are in, but the Leaking Heights and Tartarus Rim hills
are flat vector triangles. So are the Bronze Pass, Skyward Escarpment and
Olympian Approach hills, whose five `<scene>_mountain` layers are pending.
Next to the First Hill they read as unfinished. There are also 16 blocked
character states, and 22 tight‑crop warnings from the asset validator.

### 3. No onboarding for six new mechanics

The Archive's Guide covers only the original systems: improving, the
flywheel, the Foreman, decrees, works, relics, Begin Again and goals. There is
nothing for:
- the counterweight, furnace, jar, foundry, sky or Paperwork Mill;
- seals, the Codex, visitors and bargains;
- stewards and standing orders;
- per‑hill currencies;
- decree trials;
- Remembrances and files;
- Appeals and laurels.

The only explanation is the text on each scroll row. Each machine needs a
Guide entry and a short first‑visit card that names its one decision (when to
vent, how full to hold the jar, and so on).

**Done (29 September):** each machine now has a first‑visit card that names
its one decision, with Show me (opens the scroll) and Got it. The Guide gained
entries for the six machines, each hill's money, trials, stewards, seals and
the Codex, visitors, spending Insight, and Appeals.

### 4. Scope against the original constraint

The specification's first user constraint is "simple empire idle play", with
one ordinary spending currency. The game now has six currencies, six distinct
machines, randomly dealt tablets, bargains, Edicts and Appeals. That may play
well, but nobody outside development has played it. This is the largest open
question, and only a playtest answers it.

### 5. No sound for the new events

The audio layer handles the original events only. Eruptions, device reveals,
visitor arrivals, Edicts, stewards hired, Appeals filed and laurels won are
silent. The existing 20 effects could cover most of them.

**Done (29 September):** eruptions, seals breaking, visitors, stewards,
rumours, Edicts, Appeals and laurels now play pitched variants of the
delivered effects.

### 6. Playtest telemetry cannot see the machines

The consent‑based local log records the original funnel: milestones, sites,
works, relics, Begin Again and the Charter. It records none of the new
decisions (vents, drilling, pours, sky turns, clerks, seals broken, bargains,
stewards, trials, Appeals). A playtest could not tell whether anyone uses them.

**Done (29 September):** every machine and system choice is logged as a
`decision` with its arguments (for example `SetTrim trim=3`), alongside
eruptions, reveals, visitors, stewards, rumours, Edicts, Appeals and laurels.

### 7. Smaller interface issues

- **The "Now" goal is cut off** exactly where it states the trial, for example
  "…300 climbs with the jar at least 80% full: The…". The trial is the new
  information, so it should come first or wrap.
- **Empire cards** show level and income but not purse, steward or standing
  order, which plan §8 called for.
- **Mixed vocabulary:** operation, site, hill and chapter all mean the same
  thing in different places ("3 operations" on the title screen, "choosing a
  site" in the Empire).
- **The chisel stamp** (a Roman numeral on the hill face) reads as a stray
  interface box at a glance.
- **Header height** changes between hills when the purse text wraps.

**Done (29 September):** the "Now" line leads with the trial and its count;
Empire cards show the purse and the steward's standing order; player‑facing
text says "hill" throughout (the Improve Operation track keeps its name).

### 8. Shipping gaps

- No app icon: `desktop/resources`, which electron‑builder points at, does not
  exist.
- No wordmark, store capsules, screenshots, trailer or achievement icons for
  Steam.
- The manual release checklist is entirely unticked (offline start, forced
  termination, 24‑hour soak, input methods, reference devices, Steam overlay).
- A single 1 MB script bundle, with no code splitting.

  **Done (29 September):** an app icon (the stone on a black‑figure slope) in
  `desktop/resources`, also used as the web favicon; the renderer and vendor
  code now ship as their own cached files. Store art and the manual checks
  remain.
- A console error after importing a save and switching hills: a destroyed
  texture used by a plaque (PixiJS `alphaMode` of null). This is in the world
  layer, which another agent is editing.

### 9. Balance past the Charter is unproven

The daily bot reaches the hills on days 1.3, 3.9, 6.9, 14.3 and 16.3, and the
Charter on day 30.9, all within plan §9's targets. After that:
- **The last hill runs about two weeks** on four resets, where the plan hoped
  for six to eight.
- **Appeals 1 to 3 take 16.3, 25.3 and 53.3 days.** Appeals 4 to 10 have never
  been measured.
- **The bot never uses Insight spends** (Remembrances, Keep on File, Unseal,
  summons), and never resets inside an Appeal, so real players will likely be
  faster than it.

## What works well

- **The opening.** The title screen, the Sentence cutscene, the prelude and the
  First Hill are at production quality, and the first part of play is
  rewarding (first playtest impression, 29 September).
- **The economy is exact.** Every machine settles offline by exact stepping,
  with tests that online frames equal offline batches. Saves migrate from
  version 1.
- **The length model.** A daily player reaches the Charter in about a month,
  and no single absence moves the story more than one decree.
- **The return screen.** It now says what each machine did while away, and the
  Archive keeps a run clock and fastest Charter per Appeal.

## Playtest feedback, 29 September

The first part of the game is rewarding, but Sisyphus did not talk enough, and
the dead deserved some jokes of their own. Addressed the same day:
- **Earlier and more often.** Banter starts at the first summit, and comes
  every 45 seconds until the Foreman (90 after). Summit and level barks fire
  more often early.
- **More Sisyphus.** Twelve new First Hill lines (founding Corinth, skipping
  his own funeral, Heracles's twelve labours), and new summit, purchase and
  idle quips.
- **The dead are dim.** A new pool of sixteen lines about his colleagues,
  heard on every hill.
- **The dead talk.** Fifteen short exchanges shown a line at a time with the
  speaker's name. Eight are shades heckling from the sidelines; seven need the
  Foreman, when the crew and the foreman bicker with Sisyphus.
- **Boredom and eternity.** Twenty‑four lines, heard on every hill. Some are
  Sisyphus on boredom; others are on how the immortals cope with forever
  (Hestia at the hearth, Tithonus, the Graeae's one eye, Hades sorting the dead).
  There are also five more exchanges on the same theme.

The content test checks every new line against the 80‑character caption
limit, the jargon limit and repeats.

## Recommended order

1. **Onboarding:** a Guide entry and a first‑visit card per machine.
2. **Machines in the world:** simple stand‑ins in the world layer until the art
   lands, coordinated with whoever owns `src/world/`. Confirm that machine,
   tablet, visitor and steward art is in the generation queue.
3. **Sound and telemetry:** wire existing effects to the new events, and add
   the new decisions to the playtest log.
4. **Run the 5 to 8 person playtest** (specification §06), including two
   return sessions after several hours away. Tune only what it shows.
5. **Interface fixes:** the "Now" line, the Empire cards, one word for
   "hill".
6. **Shipping:** app icon, store assets, the manual release checklist, and
   code splitting.

Screenshots from the review are in `.playwright-mcp/eval/`.
