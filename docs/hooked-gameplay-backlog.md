# Hooked gameplay backlog

This backlog applies the Hooked sequence -- trigger, action, variable reward,
investment -- to Sisyphus: Unchained. It aims for clear anticipation,
satisfying consequences, and voluntary return. The game is a finite premium
campaign, so this does not include streak loss, daily obligations, artificial
scarcity, paid acceleration, notification pressure, or progress that depends
on a rare drop.

## Implementation status

The gameplay implementation pass is complete for the systems that can be
validated in the repository. The full opening remains intact and now hands
directly to a highlighted Push control. Prelude falls explain their payout,
the main screen presents Now / Next / Beyond goals, offline recaps link to the
relevant decision, relics have an honest anticipation panel, Begin Again ends
with a retained-memory summary, and the Archive now presents completion and
record views. Consent-based local telemetry covers the complete funnel listed
in item 18.

The existing purchase, milestone, flywheel, foreman, target, and story systems
already supply the core feedback described below; this pass connects them to
the goal, return, completion, and measurement layers. Items 14 and 17 remain
partly dependent on the authored mountain and character asset queue, and the
fastest-Charter record needs a run timer before it can be shown honestly. Item
19 requires observed sessions with people and should happen before changing
prices or pacing.

Validation: 113 automated tests pass, Svelte reports no errors or warnings,
and the production bundle completes successfully with Vite's native config
loader.

## What already forms the loop

| Trigger | Action | Reward | Investment |
|---|---|---|---|
| The stone is close to a new height | Hold Push | Higher fall, Obols, stronger impact | Buy the next grip or operation improvement |
| A milestone is close | Choose an upgrade or keep saving | Faster motion, larger payout, visual transformation | Build a more capable operation |
| A decree silhouette appears | Reach Defiance and open the operation | New hill, stone, character, story scene | Add another permanent income source to the empire |
| The player returns | Open the saved game | Offline recap and several affordable choices | Spend toward a remembered goal before leaving again |
| Insight becomes worthwhile | Review Begin Again | Faster replay and permanent convenience | Preserve knowledge, relics, records, and upgrades |

The core design is already suitable. Most work should improve communication,
timing, and consequence rather than add more currencies or systems.

## P0: make the first session irresistible to continue

### 1. Make the opening scene teach anticipation before the first Push

**Hook phase:** trigger and action.

Keep the full Sentence scene before the first push. Use its staging to establish
the stone, the hill, the endless return, Sisyphus's attitude, and the player's
immediate role. The final beats should hand directly into a single highlighted
Push control with no competing purchase choices. Keep Skip visible, preserve
the full scene in the Archive, and make the transition from dialogue to control
feel intentional rather than like the interface suddenly appearing.

**Evidence:** whether a new player can state the premise, identify the stone as
their task, and use Push without additional explanation. Record scene skip and
advance behavior to find individual lines that drag, not to impose an arbitrary
time-to-input target.

### 2. Make the first failed climb feel like progress

**Hook phase:** reward and investment.

At every prelude fall, emphasize the new best-height marker, Obols earned from
the fall, and the single next grip purchase. Show one compact causal sentence:
"You reached farther; the fall paid for better footing." Avoid opening the
full purchase drawer until the player has something meaningful to buy.

**Evidence:** players understand that the failure paid for progress and buy the
next grip without searching the screen.

### 3. Strengthen the summit-impact cadence

**Hook phase:** trigger and reward.

Treat each cycle as anticipation, release, and consequence: a restrained cue
near the summit, a brief summit hold, accelerating descent, a readable impact,
then the payout reaching the purse. The summit and impact amounts must remain
visually distinct so the 70/30 payout is understandable without a tutorial.

**Evidence:** players look toward the summit before release and can identify
when income is granted.

### 4. Show one immediate goal and one larger discovery

**Hook phase:** trigger.

Give the normal play screen a small goal stack:

- **Now:** nearest affordable useful purchase and estimated wait.
- **Next:** next production milestone or unlock.
- **Beyond:** next decree silhouette and Defiance progress.

Do not show a wall of future locks. Let the player open the drawer for the full
comparison.

**Evidence:** after ten seconds of observation, players can name what they are
saving for and what larger reveal follows it.

### 5. Make every purchase prove its value

**Hook phase:** investment and reward.

For production, strength, impact, works, flywheels, and Insight upgrades, show
the exact before/after effect before purchase. After purchase, animate the
changed number and the affected world element together. Keep the feedback
short enough that buying ten levels does not stall play.

**Evidence:** players can explain what their last purchase changed and choose
between immediate output and saving for a milestone.

### 6. Make the flywheel the first unforgettable breakthrough

**Hook phase:** variable reward and investment.

Before ownership, let one clearly wasted descent establish the problem. On the
first descent after purchase, trace motion from stone to wheel to rope drum,
then show the faster ascent. Follow later cycles with quieter feedback. The
wheel should look and sound meaningfully different when uncharged, charging,
and turning.

**Evidence:** after one charged cycle, players explain that the falling stone
helps the next climb without reading the Archive.

### 7. Give automation a visible emotional payoff

**Hook phase:** reward.

When the foreman is hired, have the shade take the load while Sisyphus steps
aside, reacts, and watches the system complete a cycle. Then point to the first
choice that automation enables. Avoid a long modal; the simulation should keep
running.

**Evidence:** players understand that production continues without holding Push
and voluntarily make another purchase after automation.

## P1: improve anticipation and variation

### 8. Give bonus targets a readable reveal sequence

**Hook phase:** variable reward.

Reveal the selected descent target early enough to create anticipation, then
give debris, amphora, and gilded offering distinct silhouettes, impact sounds,
and payout flights. Keep published odds in the Archive and keep ordinary
income independent of luck.

**Evidence:** players notice the target before impact and recognize the rare
result without mistaking it for required progression.

### 9. Tease relics without turning them into a grind

**Hook phase:** variable reward and investment.

Show one silhouette for the current chapter's undiscovered relic, its permanent
benefit category, the published 1-in-80 chance, and the guarantee. On discovery,
pause presentation briefly, reveal its joke and multiplier, then place it in
the Archive. Do not expose or sell changes to the hidden sampled countdown.

**Evidence:** players regard relics as welcome discoveries and understand they
cannot miss one by progressing.

### 10. Add authored reaction variation at major thresholds

**Hook phase:** variable reward.

Create small pools of reactions for first purchase, level 10/25/50, first work,
new site, and unusually large impact. Vary animation, sound accent, and one-line
comment while keeping the underlying payout fixed. Do not fire reactions on
every routine purchase.

**Evidence:** repeated cycles remain readable and milestones feel authored
without delaying rapid buying.

### 11. Make narrative interruptions feel like earned rewards

**Hook phase:** reward and trigger.

Keep the major story interruptions: they establish character, explain new
systems, and make progression feel authored. Stage each scene at the moment its
trigger becomes meaningful, use the scene to teach the newly unlocked idea,
let the simulation continue underneath, preserve Skip, and remember watched
scenes across prestige. If two events occur together, present the clearest
causal order so the player understands which achievement provoked the gods.

**Evidence:** players can explain why the scene appeared and what changed after
it, while players who skip can still find the transcript and understand the
new mechanic from the interface.

### 12. Turn offline return into a decision, not a collection chore

**Hook phase:** trigger and action.

The recap should answer four questions in one view: time counted, Obols earned,
discoveries made, and what is now affordable. Offer direct navigation to one or
two relevant purchases, but grant everything before the recap and allow it to
be dismissed immediately.

**Evidence:** returning players make a meaningful choice quickly and do not
believe they must press a claim button to receive earnings.

## P2: deepen player investment

### 13. Let the player pin one goal

**Hook phase:** investment and internal trigger.

Allow one purchase, milestone, work, decree, or Insight upgrade to be pinned.
Show its progress unobtrusively on the main screen and preserve it across
sessions when still valid. Clear or replace it explicitly when completed.

**Evidence:** returning players remember why they came back and can resume
without reopening several menus.

### 14. Make ownership visible in the world

**Hook phase:** investment.

Complete the authored mountain layers and character states, then ensure level
10, 25, and 50 transformations are obvious at gameplay scale. Works must add a
recognizable moving installation rather than only a multiplier row. Later
levels may use stamps and effects as specified.

**Evidence:** screenshots of the same hill at levels 1, 10, 25, and 50 are
visibly different without UI labels.

### 15. Make Begin Again feel like retained mastery

**Hook phase:** investment and reward.

Keep the exact preview of what resets and remains. After confirmation, show a
brief memory map: retained relics, permanent multiplier, starting conveniences,
and the first accelerated milestone. The next run should reach a familiar
breakthrough noticeably faster without replaying full dialogue.

**Evidence:** players can predict the reset, accept it voluntarily, and describe
what made the second run faster.

### 16. Give the Archive meaningful completion signals

**Hook phase:** investment.

Add completion counts for myths, relics, decrees, scenes, stones, and stamps.
Use silhouettes only for discoveries the player can reasonably anticipate.
Archive completion grants no production advantage; it records the campaign the
player built.

**Evidence:** completion-oriented players can identify missing discoveries
without consulting an external guide.

### 17. Give the completed campaign a satisfying record chase

**Hook phase:** internal trigger and investment.

After the Charter, surface a compact record board: fastest Charter, highest
Defiance run, highest operation levels, total climbs, and completed Archive
sets. Keep continued play optional and finite; do not introduce a second
prestige currency until playtests show a specific need.

**Evidence:** players understand that the story is complete and can choose
whether a better record is personally interesting.

## P3: measure the loop before expanding it

### 18. Complete the consent-based playtest funnel

The local telemetry already records first Push, first summit, purchases,
flywheel, foreman, sites, works, relics, and prestige. Add:

- session start, return interval, and session end or visibility loss;
- opening-scene advance and skip position;
- first prelude upgrade and each prelude fall;
- milestone reached and first bonus-target result;
- prestige preview opened, dismissed, and confirmed;
- pinned-goal set, completed, replaced, or abandoned;
- Charter reached and credits skipped or completed.

Continue storing data locally only after opt-in, with manual export and no
device identifier.

### 19. Run five focused playtests before changing balance

1. A new player who reads every line.
2. A new player who skips story and buys immediately.
3. A player who saves for milestones instead of buying whenever possible.
4. A returning player after a short and a capped offline interval.
5. A player completing Begin Again and replaying the opening.

Ask each player what they think is happening, what they want next, and what
their last purchase changed. Observation and recall matter more than session
length by itself.

### 20. Use decision gates for every new retention idea

Before adding a feature, require evidence that it fixes a named failure:

- If players do not know what to do, improve triggers and goal presentation.
- If an action feels tedious, shorten or automate it.
- If rewards feel flat, strengthen consequence and authored variation.
- If players do not care about returning, strengthen persistent ownership and
  remembered goals.
- If the campaign ends too soon for satisfied players, validate demand before
  designing more systems.

Do not respond to weak retention by adding daily rewards, energy timers,
missable content, random required drops, fake urgency, or notification spam.

## Recommended work order

1. Polish the full opening scene and its direct handoff into the first Push tutorial.
2. Polish the prelude fall, best-height, and first-purchase feedback.
3. Add the Now / Next / Beyond goal stack.
4. Finish the flywheel and foreman payoff sequences.
5. Finish missing character and mountain assets that communicate ownership.
6. Improve bonus target, relic, and milestone presentation.
7. Add a pinned goal and a decision-focused offline recap.
8. Improve the Begin Again memory sequence and Archive completion views.
9. Complete telemetry and run the five playtests.
10. Tune prices or pacing only after those observations identify a specific stall.
