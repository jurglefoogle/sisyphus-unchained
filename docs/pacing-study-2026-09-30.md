# Pace and scaling study, 30 September 2026

How fast Sisyphus – Unchained grows, where it stalls, and how that compares
with the idle games players already love. The study has two parts:
- **Research:** Kongregate's published idle-game maths (Anthony Pecorella, who
  produced AdVenture Capitalist), the Cookie Clicker, AdVenture Capitalist and
  Antimatter Dimensions wikis, two academic studies of idle-game players, and
  player complaints on Steam.
- **Measurement:** the balance bots, watched at every glance
  (`tests/pacing-study.test.ts`).

Reddit could not be read directly (it blocks automated access), so the Steam
discussions and reviews stand in for it; they voice the same complaints.

## Summary

The first twenty minutes are excellent, and the machines, hills and stewards
give the middle of the game real texture. But the length model rests on a
bot that plays unlike a real player, and the shape of the growth has problems.

1. **The length model is measured with the wrong player.** The balance bot
   stops buying levels on a hill while it saves for that hill's goal. A
   player who keeps buying levels that pay for themselves signs the Charter on
   **day 17**, not day 30, and finishes all ten Appeals by **day 43**, not day
   231. The length targets and the 30 September Appeal timings both assume
   the hoarding player. Day 17 sits inside the new target of two to three
   weeks (see [Pacing targets](#pacing-targets)); the Appeals are too short.
2. **The Appeals do not scale the hills' own prices.** Pay rises ×20 each
   Appeal, but levels, tablets and machines keep their prices. An efficient
   player therefore caps every level in the first session of an Appeal (236
   purchases), then has nothing to buy until the next gate.
3. **The first day has a nine‑hour wall.** After about 40 minutes of play,
   income stays flat for nine hours (×1.6 in all) and purchases come one
   every 20–30 minutes. The second hill costs about ten hours of first‑hill
   income. A daily player sleeps through this wall, but a new player on a
   long first evening meets it head on.
4. **Begin Again recovers slowly.** A new run needs 50–80 percent of the
   previous run's time to get back to the old peak; the genre aims for a
   fast early run. There are only four resets in the whole campaign, and none
   after day 10.
5. **There is a mid-campaign lull and the numbers are hard to read.** No
   new hill arrives for seven days (the Bronze Pass to the Skyward
   Escarpment). Numbers past a trillion switch to scientific notation, where
   the genre gives them names.

The fixes are about **shape more than speed.** Every lever tried here also
shortens the campaign, whose Charter is already on target. So each
smoothing change needs gates retuned alongside it, measured with a realistic
bot.

## What the genre does

### Costs, production and walls

The standard model, from Cookie Clicker onward, is that each generator costs
`base × rate^owned`, while production grows only linearly with the number
owned ([Pecorella, *The Math of Idle Games, Part I*](https://www.gamedeveloper.com/design/the-math-of-idle-games-part-i)).
Exponential cost always overtakes linear production, and that is the wall.

Multipliers are what push production back ahead of cost "and provide bumps
and local victories" ([GDC talk](https://media.gdcvault.com/gdceurope2016/presentations/Pecorella_Anthony_Quest%20for%20Progress.pdf)).

| Game | Cost growth per purchase | Milestone multipliers |
|---|---|---|
| AdVenture Capitalist | 1.07 (Lemonade Stand) to 1.15 | Speed ×2 at 25, 50, 100, 200, 300, 400 of each business, and again when every business reaches them ([wiki](https://adventure-capitalist.fandom.com/wiki/Unlocks_(Earth))); cash upgrades on top |
| Cookie Clicker | 1.15 for every building ([Wikipedia](https://en.wikipedia.org/wiki/Cookie_Clicker)) | Tiered upgrades per building, kitten upgrades, golden cookies |
| Clicker Heroes | — | ×4 for every 25 of a hero ([GDC talk](https://media.gdcvault.com/gdceurope2016/presentations/Pecorella_Anthony_Quest%20for%20Progress.pdf)) |
| **Sisyphus** | **1.17** for production levels, capped at 200 | **×2 at 10, 25, 50, 100, 150, 200** (×64 per hill); strength 1.45, impact 2.4 |

These games also have many generators, often ten to twenty, so one expensive
generator never leaves the player with nothing to buy. Sisyphus has one
level track that matters per hill, and one to six hills.

### Prestige

From [Part III](https://www.gamedeveloper.com/design/the-math-of-idle-games-part-iii):

| Game | Prestige currency from earnings | To double it, earn |
|---|---|---|
| AdVenture Capitalist | 150 × √(lifetime / 10¹⁵); each angel +2% profit | ~4× |
| Realm Grinder | triangular root of max earnings | 4× |
| Cookie Clicker | ∛(lifetime / 10¹²); each level +1% | 8× |
| Egg, Inc. | (earnings since reset / 10⁶)^0.14 | 128× |
| **Sisyphus** | 10 × (1 + orders above 10⁸)²; the factor is 1 + 0.75 × (1 + orders) | **the factor gains +0.75 per ×10 of the record** |

The prestige bonus in Sisyphus is linear in *orders of magnitude*, which is
a logarithm of earnings. The others use a root. At the Charter's record
(10²¹) that gives ×11.5, about Cookie Clicker's +1% per level at the same
earnings, where AdVenture Capitalist would give about ×3,000.

Guidance from the same author:
- **When to reset.** "Reset when you would gain somewhere in the range of
  +50% to +200% prestige currency." The next run's early part should be
  quick: "This is an important feeling of growth of power."
- **Faster or slower cycles.** Cycles can get faster, slower or vary.
  "Slower: could get tiresome, must have a meta prestige too."
- **Offline limits.** Egg, Inc.'s two‑hour offline cap was "a mistake, I
  churned out myself largely because of this". Sisyphus's 12 hours (18 with
  Eternal Shift) is on the right side of that.

### Layers of play

Antimatter Dimensions, a much-loved incremental, reaches its first reset
layer (Infinity, at 1.8×10³⁰⁸) in "a few hours to a couple days"
([wiki](https://antimatterdimensions.wiki.gg/wiki/Infinity)), and further
layers follow, each longer than the last. The numbers are absurd within the
first days, and the long game is carried by new layers rather than by one
long wait.

### What players say

- **Cookie Clicker** ([Steam](https://steamcommunity.com/app/1454400/discussions/0/3044984779780834201/)):
  "I have to wait literally like half an hour at least just to buy one single
  building." An ascension that gave "only 2%" felt worthless.
- **Realm Grinder** ([negative reviews](https://steamcommunity.com/app/610080/negativereviews/?l=english&p=1&browsefilter=toprated)):
  - "a slog through near-identical reincarnations"
  - "almost every unlock is a simple time gate"
  - spell tiers "take days for each one"
  - late on there is only "one new goal to chase" per reset.
- **Idle Champions** ([Steam](https://steamcommunity.com/app/627690/discussions/0/2270321250027580638/)):
  "the game changed from idle to 24x7 babysitting."
- **Studies of players:**
  - Hwang's 2025 study ([UC Santa Cruz](https://escholarship.org/uc/item/0b07v51w)):
    players expect exponential growth, and want new features "graphically
    visible" as rewards. Without them they lose motivation even while the
    money stacks up. One participant was "severely disappointed by how few
    rewards I got" when checking in.
  - [Cutting et al., 2019](https://eprints.whiterose.ac.uk/id/eprint/135461/1/BusyDoingNothingWhatDoPlayersDoInIdleGames.pdf):
    idle sessions are short, often seconds, and checking frequency is part
    of engagement.
  - Quantic Foundry's survey of idle players found their top motivators are
    completion and power (quoted in the GDC talk).

The common thread is that players leave when progress feels flat, which
comes from long waits for one purchase, resets that feel like repetition,
and time gates. They stay when something new or bigger arrives often and
visibly.

### How long the games last

Added after a playtest, in which the designer reached the Tartarus Rim by day 2,
found the time to automation right, and set the Charter at two to three
weeks.

| Game | First prestige | Main goal or ending | Everything |
|---|---|---|---|
| Universal Paperclips | none | 4–6 hours in one or two sittings; first runs 8–12 hours ([Cool Idle Games](https://coolidlegames.com/games/universal-paperclips)) | — |
| Cookie Clicker | first ascension at 365–440 prestige levels ([wiki](https://cookieclicker.wiki.gg/wiki/Ascension_guide)): an evening to several days | no ending; "4–5 hours" for the basics ([TrueAchievements](https://www.trueachievements.com/game/Cookie-Clicker/completiontime)) | 200–300 hours; players speak of "1–3 years" ([Steam](https://steamcommunity.com/app/1454400/discussions/0/3092275748060223504/)) |
| Trimps | first portal in "a few hours" ([Cool Idle Games](https://coolidlegames.com/games/trimps)) | — | — |
| Antimatter Dimensions | Infinity in a few hours to a couple of days | Eternity in days to a week, Reality in a week to a month, the End in one to three months ([TV Tropes](https://tvtropes.org/pmwiki/pmwiki.php/VideoGame/AntimatterDimensions)) | 200+ hours ([TrueSteamAchievements](https://truesteamachievements.com/game/Antimatter-Dimensions/completiontime)) |
| Realm Grinder | "usually about 1 week" ([Steam](https://steamcommunity.com/app/610080/discussions/0/1489987634000397190/)); the second run takes half as long or less | R15 in under three days with a guide | hundreds of resets |
| Kittens Game | first reset after days to weeks ([Steam](https://steamcommunity.com/app/1097410/discussions/0/766312101614464290/)) | — | — |
| Melvor Idle | none | Volcanic Dungeon in 7–14 days ([wiki](https://wiki.melvoridle.com/w/What_to_level_first)) | 200+ hours |
| NGU Idle | minutes | about 90 hours to beat ([GameFAQs](https://gamefaqs.gamespot.com/pc/272287-ngu-idle/answers/1-how-long-does-it-take-to-beat-this-game)) | 200+ hours |
| AdVenture Capitalist | angels within the first hours | the Moon after 10³³ and a seven-day mission; then "weeks" to "5–6 months" on the Moon ([Steam](https://steamcommunity.com/app/346900/discussions/0/458606877315633869/)) | — |
| **Sisyphus (payback saver)** | **Begin Again on day 1.5** | **the Charter on day 17** | **ten Appeals by day 43** |

What the community rewards and punishes:
- **Layers that lengthen gently.** Antimatter Dimensions is the most
  praised structure. Each layer takes roughly three to five times as long as
  the last (hours, then days, a week, a month), and each brings new rules.
  Players accept a month for a layer when it is new.
- **One long stage without new things is the classic failure.** AdVenture
  Capitalist's Moon ("5–6 months", "gave up on Adv Cap for about 3–4
  months") and Realm Grinder's first reincarnation ("30 hours" for "a LITTLE
  BIT faster", [Steam](https://steamcommunity.com/app/610080/discussions/0/1749021365357509111/))
  are the complaints most often repeated.
- **The second run must be much faster.** Designers aim for a 2–4× speed‑up
  on the second run, visible "within the first 30 seconds"
  ([dev.to](https://dev.to/aguier/i-built-7-idle-games-in-30-days-what-i-learned-about-incremental-design-5d3f)),
  and Realm Grinder's second run takes half as long or less.
- **Reachable endings are welcome.** Players of short incrementals praise a
  real ending over the mobile habit of endless play
  ([itch.io](https://itch.io/post/6764560)), while games with no ending run
  on as an idle background for years.
- **Engagement decays, so the pace should too.** A first session is 15–60
  minutes of active play. Players then check in hourly, a few times a day,
  and finally about once a week, and the best designs set their long timers
  to match: 20 minutes, 5 hours and 2 days in one example
  ([Guan](https://ericguan.substack.com/p/idle-game-design-principles)).
- **Few players reach week three.** A good mobile game keeps about 35% of
  players on day 1, 15% on day 7 and 5% on day 30; idle games do better than
  most genres at day 7 and day 30 ([Playio](https://blog.playio.co/d1-d7-d30-retention-benchmarks-2026)).
  A Charter in weeks 2–3 is the goal for committed players, so the first
  week has to carry the game on its own beats.

A Charter at two to three weeks sits where the genre puts a major layer:
Antimatter Dimensions' Reality (a week to a month), Melvor's Volcanic
Dungeon (7–14 days) and Realm Grinder's first reincarnations. Paperclips'
single evening is the exception, a story game rather than an idle one.

## How Sisyphus scales

- **Within a hill.** A production level costs `base × 1.17^(level − 1)`,
  and pay is linear in level with ×2 at each milestone. Between levels 50 and
  100 the price rises ×2,600 while pay rises only ×4, so the time to afford
  a level grows about ×650. Late levels on a hill are walls by construction;
  the next hill is the relief.
- **Between hills.** Each hill's currency is appraised at a higher rate, ×25
  for the Tartarus Rim up to ×3×10⁹ for the Olympian Approach. That is where
  the big jumps in Defiance come from.
- **Across runs.** The Insight factor is +0.75 per order of magnitude of the
  best record: ×2.1 after the first reset and ×7.8 after the fourth.
- **Across Appeals** (as of 30 September): gates and works ×40ⁿ, every
  crew's pay ×20ⁿ, and laurels ×2 each, compounding. Levels, tablets,
  machines, clerks and drills keep their prices.

## Measurements

**Method.** The bots from `tests/bot.ts` were watched at every glance.
- **The daily player** plays three sessions a day, about an hour in all, and
  is away the rest.
- **The binge player** is always present.
- **Two ways of saving:**
  - The *patient saver* is the existing bot. While a goal is on offer on a
    hill (the next hill, or a work), it buys nothing else there.
  - The *payback saver* is new (`setPayback`). It also buys a production
    level whenever the level pays for itself before the goal would be
    reached, which always brings the goal nearer.
- **Common to both:** neither pushes by hand after the Foreman, uses active
  play, or breaks seals on hills that have a steward. Both reset when Begin
  Again would raise the Insight factor ×1.5.

Reproduce with:

```
STUDY=out.txt STUDY_APPEALS=1 [STUDY_PATIENT=1] npx vitest run tests/pacing-study.test.ts
```

### The first session

A scripted player that holds Push (`PACING=1`, `tests/pacing.test.ts`):

| Time | Event |
|---|---|
| 0:03–1:09 | Four grips; the stone gets higher each try |
| 1:20 | First summit |
| 1:43 | Level 10 (×2) |
| 3:34 | Flywheel; level 25 (×2) |
| 5:10 | Foreman hired |
| 5:13 | Hermes' work |
| 11:10 | Level 50 (×2) |

This matches the genre's best openings: a purchase every few seconds, then a
new system every one to three minutes.

### The first day, played straight through

Binge player (the patient and payback savers are identical here):

| Hours | Purchases | Longest wait | Income (log₁₀/s) |
|---|---|---|---|
| 0–0.17 | 81 | 1.3 min | 3.2 |
| 0.17–0.5 | 17 | 2.2 min | 3.3 |
| 0.5–1 | 7 | 5.3 min | 3.4 |
| 1–2 | 6 | 10 min | 3.4 |
| 2–5.5 | 7 | 28 min | 3.4 |
| 5.5–10 | 1 | 30 min+ | 3.5 |

After ten hours the player is still on one hill. The Tartarus Rim's decree
needs 6×10⁷ gross on the First Hill and then 4.5×10⁷ to open, about ten
hours of income at level 90. The daily player opens it on the first return,
day 1.3, so the length tests never see this wall.

### The daily campaign

Per phase of the campaign.

**Patient saver** (the current bot):

| Days | Purchases per session | Bought on return | Idle tail of a session | Income per day |
|---|---|---|---|---|
| 0–1 | 89 | — | 0 min | — |
| 1–2 | 104 | 28 | 0.5 min | ×258 |
| 2–4 | 90 | 12 | 5 min | ×326 |
| 4–7 | 42 | 14 | 4.5 min | ×155 |
| 7–11 | 6 | 6 | 20 min | flat |
| 11–15 | 34 | 15 | 15 min | ×15 |
| 15–20 | 3 | 3 | 20 min | ×2 |
| 20–25 | 2 | 2 | 20 min | ×1 |
| 25–31 | 1 | 1 | 20 min | ×1.8 |

Hills open on days 1.3, 3.9, 6.9, 14.3 and 16.3, and the Charter is signed
on **day 30.3**. From day 16 to day 30 income is flat at 10¹⁴·⁹ while the bot
saves for the Charter, buying nothing else on the last hill.

**Payback saver:**

| Days | Purchases per session | Bought on return | Idle tail | Income per day |
|---|---|---|---|---|
| 0–1 | 89 | — | 0 min | — |
| 1–2 | 105 | 28 | 0 min | ×77 |
| 2–4 | 43 | 33 | 7.5 min | ×1.9 |
| 4–7 | 90 | 22 | 6 min | ×10 |
| 7–11 | 11 | 9 | 15 min | ×0.35 (reset) |
| 11–15 | 19 | 12 | 15 min | ×5.5 |
| 15–17 | 11 | 11 | 15 min | ×33 |

Hills open on days 1.3, 4.3, 6.9, 13.9 and 15.5, and the Charter is signed
on **day 17.3** (16 hours played, four resets).

**The mid-campaign lull.** From the Bronze Pass on day 6.9 to the Skyward
Escarpment on day 13.9, there is no new hill for seven days. Sessions buy
about ten things, and income stays flat until the fourth Begin Again.

### Begin Again

Payback saver; the patient saver is similar.

| Day | Run length | Record | Factor | Time to regain the old record |
|---|---|---|---|---|
| 1.5 | 1.5 d | 10⁸·⁸ | 1.00 → 2.34 | 0.8 d (51%) |
| 2.5 | 1.0 d | 10¹⁰·⁴ | 2.34 → 3.54 | 0.8 d (79%) |
| 4.9 | 2.3 d | 10¹²·⁸ | 3.54 → 5.34 | 1.5 d (63%) |
| 10.3 | 5.5 d | 10¹⁶·⁴ | 5.34 → 8.05 | 3.0 d (55%) |

After the first, every reset raises income only about ×1.5, but a run climbs through many orders of
magnitude, so a new run replays most of the old one at nearly the old speed.
After day 10 the next ×1.5 would need about five more orders of magnitude,
so the bot never resets again before the Charter.

### The Appeals

| | Patient saver | Payback saver |
|---|---|---|
| Ten Appeals won by | day 231 | day 43 |
| Days per Appeal | 20, 18.5, 40, 19, 19, 18, 9, 11, 28, 18.5 | about 5, 4, 2, 3, 2, 2, 2, 2, 2, 2 |
| Purchases per session | 0–2 | 236 in the first session, then 0–35 |
| Time to next purchase, late Appeals | — | never: every level is capped |

Under the payback saver, from Appeal 5 on, the player caps both open hills'
levels in the first session. They then wait two days for the gate with
nothing to buy. The Appeals multiply pay but not the hills' own prices.

## Experiments

These use the payback saver, changing one value each (`STUDY_TUNE`).

| Change | Charter day | Resets | Time to regain the old record | Binge player, first 10 h |
|---|---|---|---|---|
| None | 17.3 | 4 | 51–79% | 1 hill, no reset |
| Milestones every 25 levels (9 doublings) | 12.9 | 4 | 43–100% | first reset at 5.8 h |
| Production growth 1.15 (from 1.17) | 16.3 | 4 | 49–76% | first reset at 7.4 h |
| Insight factor +1.5 per order of magnitude (from +0.75) | 13.9 | 5 | 22–83% | 1 hill, no reset |

Each lever speeds the whole campaign up, and none on its own fixes the
first-day wall or the slow catch‑up. Smoothing has to be paired with higher
gates, or it simply makes the game shorter.

## Pacing targets

These are set by the playtest and the genre research, and measured with the
payback saver playing daily (half an hour on each return).

| Beat | Target | Now | Source |
|---|---|---|---|
| First automation (Foreman) | 5 minutes | 5:10 | playtest: right |
| First session | 15–60 minutes with a purchase at least every few minutes | a purchase every 1–9 minutes; one wait of about 20 minutes before the Rim | Guan |
| Tartarus Rim, daily player | by day 2 | day 1.3 | playtest: right |
| Tartarus Rim, binge player | first evening (3 hours or less) | 1.0 hours | "an evening" for a first layer |
| First Begin Again | day 1–2 | day 1.5 | genre: an evening to a week |
| Second run | 2–4× faster, catch‑up a third to a half of the previous run | 51–79% | Pecorella, dev.to, Realm Grinder |
| Something new (hill, work, steward, trial) | every 3 days or less | hills on days 1.3, 3.9, 5.9, 8.3, 12.5; longest gap 4.8 days | Guan's 2‑day timer; the Moon's failure |
| **The Charter** | **days 14–21** | **day 17.3** | playtest; the genre's major layer |
| Each Appeal | 4–7 days, never shorter than the one before by much | 3–11.5 days, most about 5 | Antimatter Dimensions' lengthening layers |
| All ten Appeals | days 60–90 | day 77 | Antimatter Dimensions' End at 1–3 months |

The Charter already lands on target for a realistic player. So the tuning
work is about **shape rather than speed**: smooth the first evening, the
lull and the resets, holding the Charter between days 14 and 21, and give
the Appeals a steady length.

## Recommendations

In priority order.

1. **Measure with a realistic player.**
   - Make the payback saver the reference bot.
   - Re‑baseline `length.test.ts` to the Charter on days 14–21 (from the
     25–40-day target), and the Appeals to the targets above.
   - Every later tuning decision depends on this one.
2. **Scale the whole economy in an Appeal, and make the numbers absurd.**
   - Multiply every price in a hill's own currency by the same factor as
     pay: levels, tablets, counterweights, flywheels, clerks and drills.
     Each Appeal then replays the campaign at a bigger scale instead of
     collapsing into capped hills.
   - With that in place the numbers can grow freely: ×1000 per Appeal (a
     new "‑illion" each time) costs nothing in pacing.
   - The pace then comes only from the gap between gates and pay, and from
     the laurels; tune that gap with the realistic bot.
3. **Open the second hill within the first evening of play.**
   - Lower the Tartarus Rim's gate and opening price, perhaps tenfold,
     aiming at three hours or less for a player who stays.
   - The daily player still opens it on their first return, so their
     schedule barely moves.
   - A player who stays on the first evening gets the second machine and
     currency while still engaged, instead of nine flat hours.
4. **Break the mid-campaign lull.**
   - Bring the Skyward Escarpment's decree forward, or give the Bronze Pass
     an intermediate unlock (its second work, or a steward earlier), so the
     gap between new things stays under three days.
5. **Make Begin Again feel like power.**
   - Make the Insight factor multiplicative, for example ×1.25 per order of
     magnitude of the record, so it stacks with laurels as a multiplier.
   - Target a catch‑up of a third or less of the previous run.
   - Pair it with higher late gates so the campaign keeps its length. Resets
     then become a sprint back through familiar hills, and the player has a
     reason to reset more than four times.
6. **More frequent doublings.**
   - Milestones every 25 levels keep a big moment on screen, answering
     "half an hour to buy one building".
   - Retune costs with it; the experiment shows it also speeds things up.
7. **Name the big numbers.**
   - Show quadrillion, quintillion and so on (short forms Qa, Qi, Sx, Sp,
     Oc, No, Dc), with scientific notation as a setting. Absurd numbers are
     more fun when they have absurd names.
8. **Keep pacing under test.** Add assertions for the realistic player:
   - the longest wait between purchases in the first two hours;
   - the hour the second hill opens for a binge player;
   - the catch‑up share after each reset;
   - the longest stretch without a new hill.

## Limits of this study

- The bots never push by hand after the Foreman. Pushing gives ×1.5 speed,
  so an active real player is somewhat faster than the binge bot.
- They never break seals on hills with a steward.
- They buy by fixed rules, and a real player's choices vary more.
- The research on players is thin: one 55‑page thesis with small samples,
  one survey of a single game, and forum posts. The design maths is the
  firmer ground.
- Only a playtest shows how the pace feels.

## Changes since the study

- **30 September.** The payback saver is the balance bot's default, and
  `length.test.ts` holds the Charter to days 14–21 (day 17.3).
- **30 September.** Every price in a hill's own coin (levels, tablets,
  machines, clerks, stewards) now rises with the pay in an Appeal. Each
  Appeal multiplies pay and those prices ×1000 and gates and works ×2200,
  with laurels ×2. The ten Appeals take 8.0, 10.0, 8.2, 8.0, 6.8, 5.5, 5.5,
  4.0, 5.0 and 3.0 days, all by day 81, and the run gross reaches 1e54.
  With prices and pay moving together, the ratio of gates to pay sets the
  pace alone: ×2 finished the Appeals by day 65, ×2.4 by day 98, ×2.8 by
  day 167.
- **30 September.** Big numbers are named (Qa, Qi, Sx … up to 1e303), with
  scientific notation as a setting.
- **30 September.** Gates reshaped for the level-buying player:
  - Tartarus Rim opening 6e6 and gate 8e6 (from 4.5e7 and 6e7). The binge
    player opens it at 1.7 hours instead of after ten; the longest wait
    between purchases in the first ten hours falls from 30 to 16 minutes.
    The daily player still opens it on day 1.3.
  - Skyward Escarpment 8e10 and 1.1e11 (from 1.6e11 and 2.125e11): it
    opens on day 9.3, not 13.9, ending the seven-day lull.
  - Olympian Approach 2.6e11 and 3.6e11 (from 1.6e11 and 2.24e11), and the
    Charter 4e11 (from 2.5e11), to hold the Charter at day 16.9.
  - New hills now arrive on days 1.3, 4.3, 6.9, 9.3 and 13.9, with the
    Charter on day 16.9: no gap longer than 4.6 days. The ten Appeals end
    by day 85. `length.test.ts` asserts the Rim within three hours for a
    binge player and no gap over five days.
- **Begin Again's catch-up is the player's choice, not the formula's.**
  Stronger Insight curves were tried (a flat share per Insight, as in
  AdVenture Capitalist, and a ¾ power). They changed how often the bot
  reset and moved the Charter between day 12 and day 48, but the catch-up
  share stayed at 30–85 percent. The bot resets as soon as its factor would
  grow ×1.5, and a run that starts ×1.5 faster needs about two thirds of the
  time to return. A player who waits for ×2–3 gets the fast second run. The
  square root stays; `insightFactorExponent` is now a tuning parameter.
- **30 September. Scorn, the Insight sink.** Once the Charter is signed,
  Insight buys ranks of Scorn: each doubles every crew's pay in every run and
  costs twice the last (400, 800, 1600 …). Before it, a player held about
  19,000 Insight by the last Appeal with nothing to buy. Scorn is strong, so
  the Appeals' gates and works now rise ×3600 each (from ×2200). The bot buys
  a rank about every Appeal early on and five in all. Appeals take 4.0–7.5
  days each, all ten by day 71. At ×100 base price Scorn collapsed the
  Appeals to 1–3 days; ×4400 gates with a 250 base made them lengthen to 13.5.
- **30 September. A doubling every 25 levels.** Milestones now fall at 10,
  25, 50, 75 … 200 (nine doublings, from six), so a big moment is never more
  than 25 levels away. Level prices rise ×1.18 a level (from ×1.17) to hold
  the extra power. The gates move with it:
  - Tartarus Rim 2.5e6 and 3.5e6 (from 6e6 and 8e6). A binge player opens
    it at 1.0 hours. The longest wait without a purchase in the first two
    hours falls from 43 to about 20 minutes, and `length.test.ts` holds it
    under 25.
  - Skyward Escarpment 1.6e11 and 2.2e11, Olympian Approach 3.6e11 and 5e11,
    and the Charter 1.6e12 (from 8e10/1.1e11, 2.6e11/3.6e11 and 4e11).
  - The daily player opens hills on days 1.3, 3.9, 5.9, 8.3 and 12.5 and
    signs the Charter on day 17.3.
  - Appeal gates and works rise ×4000 each (from ×3600). The ten Appeals take
    5.5, 8.7, 4.8, 11.5, 4.5, 5.0, 5.0, 3.0, 5.0 and 6.6 days, all by day 77.
    The Appeals are very sensitive to this factor: ×3600 ends them on day 63,
    ×4400 on day 99, ×5000 on day 135, and ×7000 leaves two unwon after a
    year.
