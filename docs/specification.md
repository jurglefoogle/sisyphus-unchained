Sisyphus
Game Design and Production Specification
Version 0.1  |  20 September 2026
We will build a simple incremental game about exploiting Sisyphus's punishment. The descent powers machinery, machinery automates climbs, and the gods respond by assigning larger operations. Players follow a fixed sequence of discoveries and decide where to spend their earnings. The visual world is an animated Greek pottery frieze with a small, readable interface.
This packet specifies the proposed launch game, its economy, content, presentation, implementation, and acceptance criteria. It replaces the conflicting mechanics explored during brainstorming. Values in economy.json are a reproducible tuning seed, not a claim that the game is already balanced or enjoyable. The validation report distinguishes calculations from playtest targets.
## The proposed game
Decision
Direction
Core fantasy
Turn the boulder's inevitable fall into an industrial advantage
Player activity
Invest, automate and expand along a fixed progression path
Presentation
Animated Greek pottery world with a retractable purchase drawer
Campaign
Six operations, seven mythic works and a defined Charter ending
Permanent progress
Existential Insight, eight sequential upgrades and six relics
Release sequence
Browser proof and demo, premium Windows Steam release, then mobile
Build the first hill through automation before commissioning the full campaign.
The rules are specified. The balance is a tested seed. Enjoyment and commercial pacing still require a playable prototype and human playtests.
# Guide to the specification
Select a section title to jump to it. The accompanying source packet contains the editable Markdown chapters, economy configuration, executable balance model and raw results.
01  Player experience and rules
02  Economy and progression accounting
03  Campaign and content catalog
04  Art direction interface and audio
05  Technical architecture and data contracts
06  Production plan and acceptance tests
07  Sources decisions and revision notes
08  Balance validation and remaining evidence
## Authority and change control
User constraints take priority: simple empire idle play, a predetermined progression path, Greek mythology throughout, and pottery or scroll aesthetics. This version recommends six operations, one ordinary spending currency, one prestige currency, and fixed automation. These are concrete design recommendations rather than previously approved user decisions.
The prose defines semantics; economy.json defines numbers. Any disagreement is a defect to resolve before implementation. Save fixtures, tooltips, content data and tests must use the same revision. A gameplay change updates the relevant document and the decision log, then reruns affected checks. A number change updates economy.json and the validation report. Art changes must preserve the controls and readability requirements.
## Release shape
The first commercial target is a premium Windows Steam game. A browser demo validates the first two operations. Android follows after the desktop loop and touch layout work; iOS follows after the same mobile release gates. There is no account, multiplayer, advertising, paid currency, crafting inventory or daily obligation in the launch scope.
The files specify a full game, but implementation starts with one hill and one complete automation breakthrough. Producing all six chapters before testing that breakthrough would place the largest bet on the least certain part of the design.
# 01  Player Experience and Game Rules
## The experience we are building
The player begins by doing an exhausting, pointless job. They notice that the descending stone carries useful energy, capture some of it, hire help, and progressively convert punishment into a profitable operation. Their growing competence provokes the gods. Each new decree becomes the next production opportunity.
The pleasure should come from seeing a familiar struggle become effortless, choosing a purchase that produces a visible breakthrough, discovering a mythological joke, and returning to earnings that make the next decision possible. The core verb is invest. Manual pushing establishes the joke and gives optional participation; it is not a test of reflexes.
The repeating cycle is push, summit, descent, impact, return. The economic cycle is earn, improve, automate, expand, and begin again with permanent knowledge. These cycles remain readable when the world becomes busier.
## Boundaries that protect the game
Include in the launch design
Exclude from the launch design
One fixed uphill and downhill route per operation
Free placement, route puzzles and factory layouts
Purchases during play through a compact drawer
An upgrade screen covering the world by default
Holding or toggling manual effort
Timing windows, stamina failure and mandatory rapid clicking
Fixed managers and mythic works
Equipment builds, manager swapping and skill trees with branches
Automatic collection and offline earnings
Fuel chores, upkeep, decay and pickup clicking
Deterministic progression with small optional surprises
Random gates, loot boxes and consumable production boosts
A defined ending followed by score chasing
A promise of unlimited authored content
The action-game mockup with perfect shoves, grip and lightning hazards is retired. Its sense of motion is useful; its mechanics do not belong in this game. The grip limit in the opening prelude (below) is a different thing: a short scripted introduction with a fixed shopping list, not a timing or skill test. Earlier factory-lane and parchment-dashboard mockups are also not interface specifications.
## What the player does
During the opening, the player presses the boulder, holds Space, or enables an equivalent accessibility toggle. Sisyphus pushes uphill. Releasing pauses the ascent; it does not lose distance. In the first minutes of a new save his grip gives out partway up and the stone rolls back (see The opening prelude). Once the stone has made its first summit, every summit pays automatically. The stone then descends without input, breaks a target and resets. The descent itself is the payoff, never a failure.
The player can open a purchase drawer while the cycle continues. They choose an operation level, a strength improvement, an impact improvement, a flywheel, a foreman contract, a mythic work or the next operation. Available choices appear gradually. The prelude shows only the four grip improvements, and the first cycles show only operation levels; later purchases explain one new concept at a time.
After the foreman contract is purchased, the selected site cycles indefinitely. Holding Push adds a modest ascent speed bonus only to the selected site. The maximum ascent bonus is 50 percent, and its effect on total income is smaller because descent and reset still take time. Active input neither changes loot odds nor unlocks exclusive rewards. Holding the button has the same result as tapping continuously, so click speed is irrelevant.
### The opening prelude
A new save opens with the sentence cutscene and the stone at the foot of the First Hill. At first Sisyphus can push it only 30 percent of the way before his grip gives out. The stone then rolls back to the foot, taking 0.6 seconds plus 1.6 seconds per full hill of height, and the watching shades toss 10 Obols per full hill of height, rounded up, with a minimum of 1. A fall is never a failure: it pays, it records the best height, and the next push can start at once. The first fall plays the decree that the stone shall never reach the summit. Most falls earn a bark, with a separate pool for a new height record.
The drawer offers four grip improvements, bought once each and in order: Chip Off the Burrs (5 Obols, +20 percent reach), Wrap Your Feet (8, +20), Grind It Round (12, +15) and Cut Footholds (16, +15). Each shows in the scene: the stone loses its burrs, Sisyphus's feet are bound in rags, the stone becomes round, and steps appear on the steepest stretch. With all four, reach is 100 percent. While the prelude lasts, the header shows the best height as a record track and the drawer shows where grip gives out. The objective line names the next improvement and its price.
The first summit ends the prelude. The astonished shades pay a 50 Obol offering, the first-summit decree plays, and the ordinary cycle begins: summit payout, descent, impact and reset, with operation levels in the drawer. The prelude costs 41 Obols in all. It is played once per save and stays complete through Begin Again. A save from before the prelude existed that had already reached a summit skips it. Only the First Hill has a prelude, and nothing is earned offline during it.
The player can watch any operation or zoom out to the empire frieze. Automated operations earn equally whether on screen, off screen or in a closed panel. There is one Sisyphus, displayed at the selected site; previous sites show shades or machinery rather than duplicate Sisyphuses. Navigation is instant and free. Moving focus changes only the location receiving voluntary manual assistance.
## Operation lifecycle
Each operation uses these states: locked, available, owned, ascending, descending and returning. Automated is a flag, not an alternate economy. Locked sites contribute nothing. A decree makes the next site available when its gross-earnings requirement is met. The player opens it by paying the displayed cost. Ownership starts at production level 1, or level 5 with the relevant permanent upgrade.
The foreman is an empire contract. Once hired in a run, all owned and subsequently opened sites automate. The player is never forced to repeat the manual tutorial on every new mountain. If the player opens a site before hiring the foreman, only the selected site can receive manual effort; the interface recommends completing automation first.
Ascent progress is measured in normalized work. Strength, the flywheel and manual effort change its rate. Descent takes four seconds and return takes one second. The summit grants 70 percent of the cycle base payout; the impact grants the remaining 30 percent plus any impact-level benefit. A cycle's payout is snapshotted when it begins. Purchases can change ascent speed immediately but change that cycle's payout only when the following cycle starts. The tooltip states this clearly.
When any terminal or milestone animation runs, the simulation continues. A newly earned resource or unlock never waits for a camera shot, dialogue dismissal or particle effect. Pausing through the pause control stops simulation; opening a shop does not. A paused save resumes paused and receives no offline income for the paused interval.
## Capturing the descent
The first flywheel is the defining discovery. It is offered once the First Hill reaches production level 25, which a toast announces. The Foreman contract follows at First Hill level 35, and only once a flywheel is installed. Both are remembered once bought: in later runs the flywheel is offered from the start, and the Foreman as soon as a flywheel is installed. Before purchase, the stone crashes and its motion is wasted. After purchase, its return drives a visible wheel and turns a rope drum. That stored assistance makes future ascents 25 percent faster. A later permanent upgrade increases this to 50 percent.
Energy is represented as a machine effect and a short charge animation, not a second resource balance. There are no conversion buttons, fuel deliveries or variable battery upkeep. The speed effect begins after the first completed descent following purchase and remains available. The first cycle after a new flywheel therefore receives no retroactive benefit. The rate model approximates this steady state.
The story does not claim that a closed mechanical loop generates free physical energy. Recovered descent energy contributes assistance; Sisyphus, shades and later supernatural works supply the rest. Ixion's unending rotation is explicitly a mythological input. This explanation makes the gag coherent without adding an engineering simulation.
## Engagement and the Hooked framework
Nir Eyal's model describes trigger, action, variable reward and investment [S1]. We use that sequence as a design checklist. It does not prove that the game will be enjoyable or establish a retention forecast.
Loop
Trigger
Action
Reward
Investment
A climb
Summit is close
Push or watch automation finish
Coins, impact and a short sound flourish
Purchase the next improvement
A breakthrough
Level milestone or machine is near
Choose an immediate upgrade or save
Faster motion, a multiplier and a new visual
A more capable operation
A discovery
Next decree shows a silhouette and a clear goal
Expand or complete a mythic work
Character encounter, new setting and fixed benefit
An additional income source
A return
Remembered goal remains visible
Open the game and spend accumulated earnings
Several affordable decisions and an offline recap
Stronger automation before leaving
A new run
A useful Insight gain is available
Review and confirm Begin Again
Faster replay and permanent conveniences
Knowledge that survives the reset
Every normal screen presents one immediate goal and one larger discovery. The next milestone is explicit; later content is teased with a silhouette rather than a page of locks. A known payout anchors the loop. Variation comes from short authored reactions, an occasional bonus amphora and early relic discovery. Progress never depends on a lucky result.
No streak loss, mandatory daily quest, limited-time progression item or push-notification campaign is needed for this version. A player can stop after a purchase and return when convenient. Success means they enjoyed the time and can describe what they want next, not merely that a timer brought them back.
## The first session
These are playtest targets, not measured human completion times. The actual seeded economy measurements are in the validation report.
Moment
Interaction and response
What the player understands
First 20 seconds
A single Push prompt; grip gives out and the stone rolls back
Even a fall pays, and the next attempt can go higher
First 3 minutes
Buy the four grip improvements; the first summit and descent
The summit pays and the fall repeats
Around 3 to 8 minutes
Buy production levels; level 10 doubles output and reveals Hermes Dispatch
Earnings can improve the next cycle
Around 8 to 15 minutes
Reach level 25; buy the flywheel and see one descent charge it
The fall is useful
Around 12 to 20 minutes
Reach level 35; buy the foreman and Sisyphus steps back briefly
Production can continue without input
Around 20 to 30 minutes
Buy Hermes Dispatch and chase the next operation goal
A larger world is opening
Around 15 to 40 minutes
First worthwhile Begin Again preview
Resetting preserves value and accelerates replay
The player sees no more than two new explanations before the next payout. Each tutorial step is triggered by an actual action, can be dismissed, and is recorded so it will not repeat after prestige. Tooltips and the archive preserve all instructions. If the player saves for an unusual purchase, the tutorial adapts; it never blocks valid actions.
The first Begin Again prompt appears only at 10 available Insight or more and at least once after the player has seen automation. It is a suggestion that can be dismissed. There is no forced reset.
### Progressive disclosure rules
Control
First appearance
Later runs
Grip improvements
New save
Never; the prelude is played once per save
Improve Operation
First summit payout
Immediately available
Strength and Impact
First production-level purchase
Immediately available on owned sites
Flywheel
First Hill production level 25, announced by a toast
Visible on sites without the permanent starting wheel
Foreman
First Hill production level 35 with a flywheel installed, announced by a toast
Once a flywheel is installed; hidden when the contract is already active
Named work
Owning its site reveals its first work as a teaser, and each later work once the one before it is bought; the required production level enables purchase. Hermes Dispatch stays hidden until First Hill level 10 or automation
Same level requirement, with eligible free restoration applied
Next decree goal
First foreman purchase, or reaching its gate sooner
Visible immediately
Buy 10 and Buy to Milestone
First production-level purchase
Available immediately
Buy Max
First foreman purchase
Available immediately
Begin Again
First positive Insight entitlement after automation
Available with the exact new-record award preview
Discovery flags survive prestige. A skipped tutorial explanation never disables a mechanically valid purchase. The model does not simulate these brief interface reveals or their human reading time.
## Progression and empire scale
The launch campaign has six operations in a fixed order. A newly opened region receives a heavier-looking stone, a steeper composition and a larger base payout. Previous operations remain owned and productive throughout the run. New chapters do not stretch every earlier cycle into a longer wait.
This resolves the tension between simplicity and empire growth: each individual site is a recognizable rock loop, while global works improve the whole collection. There is no transport between sites and no production dependency that can stop another site. The player can always earn by leaving any automated operation running.
Mythic works are one-time purchases per run with fixed locations and effects. Hermes organizes collection, Daedalus supplies engineering, Ixion turns a wheel, the Danaids supply flowing water, Talos handles heavy material, and Atlas supports an elevated route. Their bonuses multiply ordinary payouts. The art gives each purchase a distinct visible consequence even when the underlying rule is a simple multiplier.
Each hill earns and keeps its own money: Obols on the First Hill, then Cinders, Drams, Ingots, Starlight and Ambrosia. Money earned on a hill is spent only on that hill; the next hill is opened from the frontier hill's purse, and a work is paid for in its own hill's currency while its effect stays global. Insight is the only thing that crosses hills, so the player chooses where to push (docs/hill-workshops-plan.md).
Once a hill's successor is open, its steward is offered for that hill's own money (the Olympian steward after the Charter), or earlier for Insight for the current run. A steward follows a standing order, reinvest or hold. Reinvesting spends the purse on the hill's own levels and flywheel. It keeps back the next opening and the next work there, and never buys works, opens hills or breaks seals. Stewards leave only the current hill needing attention.
The First Hill has a second machine beside the flywheel. At crew 25 a counterweight can be installed: a basket of up to ten stones over a summit pulley. Each stone speeds the climb by 15 percent and brakes the descent by 10 percent, so the best load depends on the hill's strength, flywheel and devices, and is lighter while the player pushes by hand. The drawer shows whether the basket is too light, balanced or too heavy, and the Superintendent keeps it balanced once hired.
Each run deals six sealed tablets from the hill's pool, seeded and saved so reloading never changes the hand. They surface at crew 5, 10, 25, 50, 100 and 150. Breaking a seal costs the hill's money and reveals a device that changes a rule for this run (impacts pay double, no return walk, every fifth climb pays double, and so on). Every revealed device is kept in the Archive Codex. Whispers are hidden devices earned by play rather than money (a thousand summits by hand; a ten-minute pause). They are permanent, pay one Insight the first time, and are hinted by a rumour halfway. Hermes visits the First Hill at crew 25 once per run with two sealed bargains; the player takes one.

The Tartarus Rim has no flywheel and no impact track. Its machine is Ixion’s Wheel. Every impact heats the wheel, less the hotter it already is. At full heat it erupts: the next six impacts pay more, then the wheel cools. From 20 percent heat the player may vent it early for a smaller eruption sooner. Eruption strength grows faster than heat, and heating slows near the top, so the best vent point is below full (about 80 percent) and devices move it. The Erinyes, the rim’s steward, vent at a dial the player sets in steps of 5 percent; the drawer names the best point. Nothing about the wheel needs timing: left alone it erupts by itself. Persephone visits the rim at crew 25. The whispers Out of Sight (an hour away) and By the Book (twenty full-heat eruptions) are the rim’s.

The Leaking Heights’ machine is the Danaids’ Jar. Each impact pours water into the jar and only the leak pays: the next impact is worth up to twice as much, and a fuller jar pushes the water out harder. With too few holes the jar spills over a lip that is somehow never the top, and spilled water pays nothing. With too many, the level and the pressure drop. The best jar sits just short of the brim. Inflow rises every 25 crew levels, so the player drills holes (half the price of a crew level) or patches them (free, though never the last one; a Danaid is using it). Danaus, the hill’s steward, drills and patches to hold the jar’s peak at a level the player sets. Poseidon visits at crew 25. The whispers are Almost Full (a hundred climbs near the brim without a spill) and She’s Using That One.

The Bronze Pass’s machine is the Foundry, and the hill sells no tablets. A split, set in tenths, pours part of every payout as bronze and sells the rest as Ingots for the purse. Poured pay still counts toward decrees and Insight. The hill’s dealt hand is its blueprint queue: bronze fills the blueprint at the head, sized like the matching tablet, and a finished blueprint is revealed as a device. The player picks the order by the hints. Without Talos, the hill’s steward, the pour waits after each blueprint until the next is picked, and metal with nowhere to go is sold. With Talos the queue runs on. Hephaestus visits at crew 25. The whispers are Perpetual Motion (Pending Review) (three blueprints with nothing sold) and Fair and Balanced (a hundred climbs at exactly half).

The Skyward Escarpment’s machine is the Orrery. The sky turns through twelve houses, one every four climbs. The hill’s tablets are constellations: once revealed, the player mounts each in a house of Atlas’s frame, and it bends its rule only while its house is overhead. Empty houses are dark. Turn asks Atlas to skip to the next mounted house, after which he rests for twelve climbs. Atlas, the steward, turns past dark houses on his own. The sky moves with climbs rather than the clock, so nothing is lost by looking away. Helios visits at crew 25. The whispers are Wished on a Star (pushing as three mounted houses rise in a row) and Atlas Files a Complaint (a hundred turns).

The Olympian Approach’s machine is the Paperwork Mill. Each summit files forms, more every 25 crew levels. Clerks approve them, and only approved forms pay the hill’s impact. A waiting backlog ripens late fees, which divine law makes Olympus pay, up to the statute of limitations. The best mill lets the backlog ripen and then approves exactly as fast as forms are filed; the Moirai, the steward, hold it there. The player hires clerks (each costs more) and sets how many sit at their desks. Due Process raises this hill’s crew by 1 percent for every crew milestone across the empire, recorded when the player or a steward acts, never mid-settlement. Every hundred approved forms Zeus issues an Edict that rules every hill for five minutes. Edicts are issued only while the game is open, and an absence ends one; nothing earned while away depends on them. Nemesis visits at crew 25. The whispers are Form 1 (the Codex holds every tablet of the other five hills) and Nemesis Notices (a hundred climbs with nothing approved).
The campaign is paced for weeks: a daily player (three short sessions a day) opens the second hill on day 1 or 2 and signs the Charter around day 30, with four or more Begin Agains. Begin Again is part of the road; the Charter is not expected without it (docs/hill-workshops-plan.md §9).
Defiance is the current run's gross income on every hill, each counted at its currency's fixed appraisal in Obols. It is a progress score, not a currency to spend. Impertinence is the next-decree progress bar: the previous hill's own gross in its currency against the decree gate, not a second counter. Filling it makes an opportunity available. The gods do not delete equipment, reduce existing payouts or destroy saved money.
## What keeps choices interesting
The player chooses between immediate output, shorter cycles, stronger impacts, the next level milestone, a global work and a new operation. These options share the hill's own purse. A decision matters because paying for one postpones another; it does not need to lock out content permanently.
The UI shows cost, exact expected income change and the next milestone. It offers Buy 1, Buy 10 and Buy to Milestone. Buy Max is a convenience after the first automation. It does not automatically choose a strategy. When a player cannot afford a purchase, the interface shows the remaining cost and an estimated wait based on that hill's current automated income, labeled as an estimate.
Milestones at production levels 10, 25, 50, 100, 150 and 200 double that operation's output each time. Visible transformations occur at 10, 25 and 50; later milestones use the carved level stamp (see Installation and visible growth) instead of new structures, so the asset workload stays finite. The generic button says Improve Operation; buying levels does not imply that hundreds of actors must be rendered.
## Long term shape
Buying the Eternal Labor Charter at the sixth operation completes the authored story. Zeus accepts the enterprise as the contractor for its own punishment. The first hill is shown again with Sisyphus still technically participating. Credits are short and skippable; production continues afterward.
The player may keep earning, complete achievements or prestige for a higher record. There is no second prestige currency or additional procedural map promised at launch. Levels remain capped at their documented limits. Post-story score chasing has no guaranteed pacing target; if players want a much longer endgame, design it after observing the completed campaign. The product should advertise a complete incremental campaign with optional continued play, not infinite novel content.
## The first playable proof
Build one hill, one manual cycle, production levels, flywheel, foreman, one milestone transformation, one bonus target, save and offline return. Include enough of the next region to communicate a goal. Use the pottery art style early because reading moving silhouettes is part of the test.
The prototype succeeds if players understand why the rock falls, recognize the flywheel's benefit, voluntarily buy another improvement after automation, and can describe the next goal. If watching the completed loop is dull, add stronger feedback or change the reveal cadence before adding new currencies or mechanics.
# 02  Economy and Progression Accounting
## Resources and their roles
Name
Earned by
Used for
Reset behavior
Hill currencies (Obols, Cinders, Drams, Ingots, Starlight, Ambrosia)
Summit, downhill impact and bonus targets on their own hill
That hill's purchases, its steward, and opening the next hill
Every purse resets
Existential Insight
Claiming a new best-run entitlement through Begin Again
A fixed permanent upgrade sequence
Earned and spent totals persist
Defiance
Gross income on every hill this run, at each currency's appraisal in Obols
Decree eligibility and prestige calculation
Resets to zero
Impertinence
Derived progress between Defiance gates
Shows approach to the next decree
Derived again each run
Flywheel charge
First descent after installing the wheel
Enables automatic ascent assistance
Resets with its wheel
Relics
A bounded early-discovery chance or guaranteed chapter reward
Permanent passive bonuses and archive entries
Persist
Only the hill currencies and Insight are spendable balances. Ichor appears in Talos's animation and a relic; it is not a fuel inventory. Bronze fragments and broken amphorae are reward visuals that resolve immediately to Obols. Nothing requires collecting debris or visiting a conversion screen.
## Authoritative numerical rules
The accompanying economy.json supplies all starting numbers. Displayed suffixes use K, M, B and T, then scientific notation. Numbers in the simulation use ordinary floating point for a bounded campaign audit. The game uses a large-number representation behind a Money abstraction and serializes money as strings. Its transactions must never depend on formatted display text.
Let n be the operation production level, p the strength level and r the impact level. Owned operations start at n = 1, p = 0, r = 0. The following code is the specification of the calculation order, using decimal or large-number arithmetic in the game implementation.
milestoneCount = count(threshold &lt;= n for threshold in [10,25,50,100,150,200])
milestoneFactor = 2 ** milestoneCount
insightFactor = 1 + 0.75 * sqrt(lifetimeInsightEarned / 10)
relicFactor = 1.10 ** relicsOwned
workFactor = product(activeWork.incomeMultiplier)
oldSiteFactor = 2 if Familiar Ground owned and site is below highest owned site else
    1
memoryFactor = 2 if Unbroken Memory owned else 1
base = baseYield * n * milestoneFactor * insightFactor
base = base * relicFactor * workFactor * oldSiteFactor * memoryFactor
summit = base * 0.70
impact = base * 0.30 * (1 + 0.10 * r)
expectedBonus = base * 0.08
expectedCycleIncome = summit + impact + expectedBonus
Round only for display. Transactional rounding uses the Money implementation's canonical precision, not currency cents. Large-number arithmetic is approximate at extreme magnitudes; the game promises monotonic purchases and stable saves rather than arbitrary financial precision. Automated regression fixtures define acceptable tolerance, and a purchase that cannot be represented as reducing the wallet must be rejected or handled by the explicitly tested large-number subtraction policy.
Every income grant contributes to Defiance exactly once, including the random bonus and offline grants. Spending does not reduce Defiance. Starting gifts, imports, compensation grants and debug commands do not qualify for Defiance. This prevents buying and selling or importing money from manufacturing prestige progress. There is no sell-back feature at launch.
## Cycle time and manual assistance
speed = 1 + 0.10 * strengthLevel
if flywheelCharged: speed *= 1.25
if Deep Reservoir owned and flywheelCharged: replace 1.25 with 1.50
if automated and manualEffortHeld and selectedSite: speed *= 1.50
ascentSeconds = max(2, siteBaseAscentSeconds / speed)
cycleSeconds = ascentSeconds + 4 + 1
expectedObolsPerSecond = expectedCycleIncome / cycleSeconds
An unautomated site advances only while selected and receiving manual effort. It receives the normal base manual rate, not the additional automated-assistance multiplier. Once the foreman is hired, the automatic base rate is the same as that manual rate; helping adds the 50 percent ascent bonus. A flywheel contributes only after it has been charged by a descent. During offline time, manual assistance is always zero.
The two-second ascent floor and five-second descent-plus-return portion cap cycle frequency. Output upgrades continue increasing payouts at that cap. Strength remains a monotonic purchase but must be hidden or disabled if its next level produces no speed improvement because of the floor. Buy Max must exclude ineffective levels.
### Worked opening example
At level 1 with no upgrades, the first hill has a 12-second ascent, a four-second descent and a one-second return. Its base reward is 10 Obols: 7 at the summit and 3 at impact. The optional bonus averages 0.8 per cycle. Continuous manual participation therefore averages about 0.635 Obols per second. A returning player with no foreman earns nothing while away.
At level 10, the milestone doubles production. Base reward becomes 200 Obols. With strength 5 and a charged flywheel, automated ascent takes 6.4 seconds; the full cycle takes 11.4 seconds. With impact 0 and no other multipliers, average income is 216 / 11.4, or about 18.95 Obols per second. Manual assistance reduces ascent to about 4.27 seconds and increases average income to about 23.31 per second. Active help is useful without dominating the game.
## Purchase prices
Prices are calculated before the purchase from the existing level. Individual prices are rounded upward to an integer Obol. Bulk purchases sum those rounded prices so buying ten at once costs exactly the same as ten individual purchases.
nextProductionCost = ceil(siteBaseLevelCost * 1.17 ** (n - 1))
nextStrengthCost = ceil(siteBaseLevelCost * 5 * 1.45 ** p)
nextImpactCost = ceil(siteBaseLevelCost * 12.5 * 2.4 ** r)
flywheelCost = siteBaseLevelCost * 10
foremanCost = firstHillBaseLevelCost * 45 = 360
Production stops at level 200, strength at 25, and impact at 10. The foreman is purchased once per run, after installing a flywheel. In the first run the flywheel also waits for First Hill level 25, and the foreman for level 35. It automates every owned and future operation. Later sites have no additional foreman bill. Mythic works and site openings have fixed prices in the content table. Permanent Insight upgrades have fixed costs and sequential prerequisites. They are bought from their own Insight menu, not from Improve. The menu opens from the Insight count at the top of the screen once any Insight has been awarded. It lists all eight in order: remembered, the one on offer (which can be pinned as a goal) and those still locked, each with its cost. A glaze bead on the count marks an affordable upgrade. Begin Again itself stays in Improve.
Buy to Milestone purchases only the remaining levels to the next threshold. It is disabled if the player cannot afford the entire bundle. Buy Max uses a bounded search on cost, verifies the exact summed price, and purchases the largest affordable count. It never includes opening another operation or buying an unrelated work.
Before any spend, advance the simulation to the command timestamp. Check ownership, prerequisites, level cap and wallet against a single state revision. Debit and grant the upgrade together, then save the change. A double click cannot buy from a stale wallet.
## Operation scaling
Higher sites increase both potential output and purchase prices. They also lengthen the unmodified ascent by three seconds each. The faster growth in later purchase costs is intentional: the initial numerical draft allowed all six chapters to finish in about twenty minutes under a purchasing heuristic. Those numbers were rejected. See the measured revised model rather than assuming this new seed is final.
Operation
Base yield
Base level cost
Opening price
Defiance gate
Base ascent
First Hill
10
8
Free
0
12 s
Tartarus Rim
250
960
45K
60K
15 s
Leaking Heights
10K
160K
20M
25M
18 s
Bronze Pass
750K
48M
9B
12B
21 s
Skyward Escarpment
100M
25.6B
4.8T
6.4T
24 s
Olympian Approach
30B
25.6T
2 quadrillion
2.8 quadrillion
27 s
The gate unlocks the offer and the opening price purchases the operation. Gate progress uses gross earnings so spending does not push the goal backward. The next gate is displayed relative to the previous gate, clamped between zero and one. If a large payout crosses several gates, queue the decrees in chapter order; opening still requires the preceding operation to be owned.
A new operation starts automatically if the foreman contract is active. Fixed routes and installed defaults make it productive immediately; there is no resource delivery prerequisite. Previous sites retain their rates and never inherit the new site's steeper slope.
## Bonus targets and bounded discovery
Every completed descent resolves one target payout. The three outcomes below are additional to the guaranteed summit and impact income.
Outcome
Chance per completed descent
Additional reward
Ordinary debris
80 percent
None
Coin amphora
18 percent
0.25 times the snapshotted base reward
Gilded offering
2 percent
1.75 times the snapshotted base reward
The expected bonus is 0.08 times base reward. Display the odds in the archive. The result changes the target art and payout effect; it never requires aiming. Impact upgrades affect guaranteed impact income only. They do not secretly change the probabilities.
Six relics can be discovered early. Only the currently highest owned operation is eligible to discover the next relic in sequence. After it completes a descent, roll a 1-in-80 chance if that chapter's relic is still missing. At 60 eligible descents without success, grant it. Opening the next chapter guarantees the preceding chapter's relic immediately; the final relic is guaranteed by the Charter. The sequence therefore cannot block a chapter or produce a duplicate.
Relics are fixed passives, each multiplying ordinary income by 1.10. Their art and lore provide distinction; launch has no equipment slots or leveling. Finding one changes income from the next cycle onward. A drop occurs once and saves immediately. Relic chance is independent of the coin bonus.
For a consistent online and offline implementation, sample the number of eligible descents until the next relic when eligibility begins, from a geometric distribution with probability 1/80, capped at 60. Save the remaining count. Each eligible descent decrements it. At zero, grant the relic and stop checking until the next operation is opened. This makes batching exact without iterating a long absence.
## Prestige and permanent growth
Begin Again is a voluntary renegotiation of the sentence. It resets operations and ordinary currency in return for Insight based on the best gross-earnings run. The entitlement is cumulative; replaying the same early run cannot repeatedly farm the same award.
record = max(bestCompletedOrCurrentRunGross, currentRunGross)
if record &lt; 1_000_000: entitlement = 0
else: entitlement = floor(10 * (1 + log10(record / 1_000_000)) ** 2)
availableInsight = max(0, entitlement - lifetimeInsightAwarded)
Best run Defiance
Lifetime entitlement
New award after previously claiming 10
1M
10
0
10M
40
30
100M
90
80
1B
160
150
1T
490
480
Lifetime earned Insight increases permanent income with diminishing returns. Ten Insight gives 1.75 times base income; 160 gives 4 times. Spending Insight does not reduce that factor. The preview shows the exact before and after multiplier, so the player need not calculate a square root. Track the lifetime award and spending separately; derive the spendable balance. In the launch game, lifetime earned equals lifetime awarded and needs no second mutable counter.
The permanent upgrade path is fixed. Players may buy each next step when affordable; no respec or build selection is needed. Costs are incremental, not cumulative labels.
Order
Upgrade
Cost
Effect
1
Remembered Hand
2
Begin future runs with foreman active
2
Known Machinery
3
Start owned sites with a charged flywheel, including newly opened sites
3
Standing Orders
5
Newly opened sites after the first start at level 5
4
Familiar Ground
10
Sites below the highest currently owned site earn twice as much
5
Signed in Advance
20
Previously purchased mythic works return free when their ordinary level conditions are met; Charter excluded
6
Eternal Shift
40
Extend offline earning limit from 12 to 18 hours
7
Deep Reservoir
80
Charged flywheel speed factor rises from 1.25 to 1.50
8
Unbroken Memory
160
Double all ordinary income permanently
Signed in Advance uses the set of works actually purchased in an earlier run, not merely the highest chapter visited. Remembered Hand applies immediately if acquired while a new run has already begun. Known Machinery likewise installs and charges existing wheels immediately. Standing Orders changes future openings only; it does not remove or duplicate existing levels. The preview describes the timing of each effect.
Beside the fixed path, Insight buys four kinds of memory (docs/hill-workshops-plan.md §5). Remembrances are five ranks per hill held in any run, costing 3, 6, 12, 24 and 48 Insight. Each rank deepens that hill's machine in every run: the flywheel pays a tenth more, eruptions and the jar's leak pay 8 percent more, blueprints need 15 percent less bronze, Atlas rests 15 percent less, and clerks work 15 percent faster. Keep on File opens a hill's file once for 8 Insight. The player then names one revealed tablet there, changeable for free, and every later deal on that hill includes it (in the last, dearest slot if the shuffle missed it). Unseal in Advance reads a dealt tablet's name and rule before its seal is broken, for 2 Insight, for this run. Send for a Visitor brings a hill's visitor before crew 25, for 3 Insight, for this run. These appear once any Insight has been awarded. Nothing bought with Insight is taken away.
After the Charter, Thanatos files Appeals (docs/hill-workshops-plan.md §9, How 7). Filing closes the run like Begin Again, paying its Insight, and starts the same hills under the next Appeal. Gates and opening prices double with each Appeal, and works, the Charter included, rise by a quarter. One rule twist from a list of ten rules every hill, pairing a burden with a compensation: for example, no return walks but descents take twice as long, or the sky turning backwards. Each of the first four Appeals adds a tablet to every hill's pool, growing each pool from eight to twelve. Signing the Charter under an Appeal wins a laurel, which raises every crew's earnings by 10 percent for good. Ordinary Begin Again inside an Appeal keeps the Appeal. Nothing won is taken away.

The offline recap reports, per hill, what its machine did while you were away: eruptions, blueprints cast (and whether the next one waits for a pick), forms approved, and progress on the decree trial. The game keeps a run clock and a campaign clock in game time, which is play plus the absence the cap counted. The Archive's records show this run, the first Charter and the fastest Charter for each Appeal. A save from before the clocks existed keeps them unknown rather than guessing; its next run is timed.
### The reset transaction
First settle simulation to the request timestamp and calculate the exact award. Open a confirmation showing current earnings, available Insight, new permanent factor, what resets and what stays. Require an affirmative confirmation separate from opening the preview. If the award is zero, disable the reset action and show the next record target.
On confirmation, settle again, grant the latest valid award and record the old run. Clear the Obol balance, run Defiance, owned-site progress, bought works and temporary cycle snapshots. Restore the first hill and any permanent starting benefits. Preserve relics, Insight totals, permanent upgrades, archive discoveries, story-seen flags, achievements, settings, playtime and best records. Discard unfinished cycle progress without a payout; the preview warns of that small loss. Save the entire reset as one atomic state change with a pre-reset backup.
Do not replay full dialogue on subsequent runs. Use a short stamp animation and an optional transcript link. Previously discovered regions remain visible in the archive but require reopening during a new run.
## Offline earnings and clock behavior
Automated sites earn at 100 percent of their unassisted rate for up to 12 hours per absence, or 18 with Eternal Shift. Absences cannot finish the story: each one moves it at most one decree (docs/hill-workshops-plan.md §9). There are no offline purchase orders in the launch version. No dialogue or new-site purchase is performed automatically. Gross earnings can make decrees available; offers wait for the player's return.
Each decree also asks a trial of the frontier hill's machine, counted in climbs and casts rather than time: 100 climbs with the First Hill's counterweight hung, 25 eruptions on the Tartarus Rim, 300 climbs with the jar at least 80 percent full, 3 blueprints cast, and 12 houses rising with 3 or more constellations mounted. The decree is issued when both the gross and the trial are met, whichever comes last. Trial progress belongs to the run and only rises, and it settles offline exactly like income. The decree row shows both measures.
Unautomated sites freeze during an absence, including any saved descent or return. They resume that phase on return without an offline payout. The offline routine below processes automated sites only. Foreground descents still finish without holding Push.
Offline simulation must first finish any saved partial phase at its saved payout snapshot. It then resolves complete steady-state cycles in batches and leaves the remaining partial phase. Include strength, impact, works, charged flywheels, permanent upgrades and owned relics. If a relic is due during absence, split the interval at its award before applying its income multiplier to subsequent cycles. Handle the first uncharged flywheel cycle separately.
Coin bonuses during a batched absence grant their exact expected value of 0.08 times base per complete cycle. Online bonuses are random; the expected rate is the same, not the exact payout distribution. Changing focus or opening panels never creates an absence. Repeated application of the same offline interval must grant nothing the second time. Track a settlement identifier and the saved accounting timestamp.
For the first opening after an absence, show time counted, earned Obols, relic discoveries and ready goals. Grant these before showing the recap, so dismissal cannot lose the money. A recap can be minimized; it must not become a mandatory second collection action.
Use a monotonic clock during active sessions and wall-clock timestamps for elapsed time between launches. Clamp a negative elapsed interval to zero. On a backward-clock event, retain the prior accounting high-water timestamp until real time catches up, and show a quiet informational notice. A large forward interval receives only the cap, and the accounting timestamp advances to the observed present. The game has no competitive economy, so it does not require a server to prevent clock editing.
## Balance principles and failure responses
The ordinary loop must remain playable if every random bonus is removed. Automation must arrive while the initial push is still amusing. A milestone should occasionally make an older operation worth revisiting. The game must expose prices and benefits clearly enough that a sensible player can progress without calculating return on investment externally.
If the opening drags, reduce the foreman price or early level costs, not the clarity of the tutorial. If later play accelerates too fast, adjust site-specific cost-to-yield ratios or work multipliers rather than imposing arbitrary real-time locks. If late play stalls, add a visible useful milestone or reduce the price gap; do not use a rare required drop. If frequent prestige is dominant, reduce record growth rewards or improve the benefit of continuing the current run.
A price seed and a successful simulation cannot establish subjective fun. Final tuning requires comparing real first-session behavior, return sessions, a player who buys whenever possible, and a player who saves for milestones. The test plan specifies what to observe.
# 03  Campaign and Content Catalog
## Fixed campaign order
The campaign follows six operations. These are fictional locations within our comic version of the underworld, not a claim that ancient sources place every character on one mountain. The first hill evokes Corinth through distant architecture. Later routes expand the same enterprise across the underworld and toward the divine administrative realm.
Every operation opens with a single short decree, a new stone silhouette and a clear investment goal. Every ordinary cycle remains ascent, summit payout, descent impact and return. A site's material identity changes the visual impact; numerical advantages are encoded in its base yield and ascent duration, not in an undisclosed physics model.
Chapter
Scene and stone
New discovery
Next objective
1 The First Hill
Bare terracotta ridge and limestone
Descending motion can turn a flywheel; Hermes observes the accounts
Foreman, Hermes and Tartarus offer
2 The Tartarus Rim
Black volcanic cliffs and basalt
Daedalus connects machinery; Ixion's wheel joins the enterprise
Purchase both works and reach the cistern
3 The Leaking Heights
Incised water channels and marble
The Danaids' vessel never fills, but its leak drives a wheel
Improve a hydraulic operation and earn the Bronze Pass
4 The Bronze Pass
Tall bronze supports and metal stone
Talos handles huge loads; ichor is visible behind a sealed ankle fitting
Establish the giant's work and approach the sky
5 The Skyward Escarpment
Suspended stone route and star-patterned rock
Atlas supports the heavens while a new frame supports the route
Acquire Atlas's work and open the final ascent
6 The Olympian Approach
Pale columns against an ink sky and inscribed decree stone
Zeus has created a larger customer base for his own problem
Buy the Eternal Labor Charter
Boulders unlock with their chapters. Players can view earlier stones in the archive, but the launch game has no boulder loadout screen. Each operation keeps its assigned stone. This preserves the appeal of discovering new boulders without introducing a second optimization system or a risk that the wrong stone stalls progress.
## Installation and visible growth
At production level 1, each site contains its assigned stone and a simple route. At level 10, the hauling animation becomes visibly stronger and an extra scaffold appears. At level 25, a bronze support and a more forceful return impact replace the earlier assets. At level 50, the completed installation receives an animated belt, capstan or equivalent chapter prop. At levels 100, 150 and 200, a level stamp and richer sound replace new major structures.
The level stamp is a giant on-screen carving, painted with the same richness as the other effects. A pinax of fired clay, grained and bevelled with meander bands and a chipped corner, slams down over the scene. Its sunken black glaze field has a gloss streak. The slam sends a kiln shockwave, a dashed ring along its foot and billows of dust. A giant mallet and chisel float in and cut the level into the glaze as a Roman numeral (C, CL or CC), stroke by stroke. The mallet is timber with a cord grip and glaze bands; the chisel has a bronze ferrule and a steel blade that glints. Each cut is a deep V with a lit wall, a shaded wall and bright and dark lips. Each blow thuds, stops the flying pieces for a beat, shakes the camera slightly and flashes a glint at the edge. It throws glowing sparks, painted glaze sherds, clay grit and a puff of dust, and each new cut flashes pale. When the numeral is done, a band of light sweeps across it, a gold star glints and a bronze ray burst opens behind the pinax. The pinax then shrinks and flies into a glazed cartouche on the hillside, landing in a spray of sparks. The cartouche keeps every stamp that operation has earned (for example C · CL), and each numeral stays hidden there until its own pinax lands. Stamps queue and play one at a time. The carving takes two to four seconds, then a one-second pause and a flight of under a second; the simulation never waits for it. Effects Off drops the sparks, pieces, dust, rays and shockwave. Reduced motion shows the finished pinax fading in and out for about two seconds, with no slam, blows or flight.
These changes are scripted at fixed anchors. They do not introduce construction selection, collision simulation or pathfinding. The original Sisyphus pose remains available for manual assistance even after machines operate the route.
The first foreman uses one shade attendant on the original hill. Later routes use the same attendant rig recolored and combined with their chapter machinery. Additional production levels increase throughput mathematically; they never require 200 independently animated workers.
## Mythic works and managers
Managers are permanent assignments within a run. Their role is to explain a particular system, deliver a brief character beat and decorate its location. They never demand salary or reassignment. The Foreman contract is the automation unlock; named works improve the enterprise afterward.
ID
Work
Availability
Price
Mechanical effect
hermes
Hermes Dispatch
First Hill level 10
600
All income x1.25
daedalus
Daedalus Workshop
Tartarus Rim level 10
150K
All income x2
ixion
Ixion Drive
Tartarus Rim level 25
1.2M
All income x2
danaids
Danaid Waterworks
Leaking Heights level 10
80M
All income x2
talos
Talos Heavy Labor
Bronze Pass level 10
36B
All income x2
atlas
Atlas Support Contract
Skyward Escarpment level 10
19.2T
All income x2
charter
Eternal Labor Charter
Olympian Approach level 25
20 quadrillion
All income x2 and story completion
Works on a site are offered one at a time: the next is teased only after the previous one is bought. Hermes Dispatch is the exception to teasing on ownership. Its row stays out of the drawer until the First Hill reaches level 10 or the foreman is hired, so the opening introduces one idea at a time. The objective line points to it only after automation.
Hermes stamps a delivery docket and small wing motifs appear on payout effects. Daedalus replaces a rough linkage with an elegant geared connection. Ixion's wheel starts turning a belt. Water pours through the Danaids' leaking vessel and rotates a paddle wheel. Talos moves a massive lever without effort. Atlas's frame visibly takes a route's load while he still carries the sky. The Charter stamps all six operation labels with divine approval, to Sisyphus's amusement.
These are intentionally straightforward global multipliers. Distinct mechanics belong in a later expansion only if tests show that the fixed loop needs them. The first release's variety comes from discovery, animation and purchase pacing rather than seven separate rule systems.
## Decrees and story beats
Each opening decree is triggered once per first discovery. Returning runs use a short title stamp. The full dialogue is available in the archive. All lines below are original game writing and can be revised without changing mechanics.
The voice is geeky and sarcastic. The speaker is usually Zeus, but a beat that introduces a figure lets that figure speak for themselves; Talos speaks in capitals. Sisyphus answers as the craftiest of men and a relentless smart aleck: myth-literate and loophole-hunting. The written reply appears on first viewing; repeats get a comeback (see Repeated decrees). Anachronism stays in one register: Olympus as a bureaucracy and Sisyphus as its contractor, so contracts, invoices and management are fair game, as is science he is too early for, which he may notice. His wit comes from cunning and myth rather than modern jargon: at most one programming or gamer joke per pool of lines, and none in story beats. The jokes never break the accuracy rules below.
Trigger
Speaker
Line
Sisyphus response
First fall in the prelude
Zeus
The stone shall never reach the summit. I have decreed it. Thunderously.
Never is a long time. Luckily I once chained up Death, so my calendar’s wide open.
First summit
Zeus
The stone shall roll back to the foot of the hill. Every time. Forever.
Every time? Then it’s reliable. You’ve handed me the one dependable thing in Hades.
Flywheel purchase
Zeus
That falling stone is part of your punishment, mortal. Not a power source.
You took your father’s throne while he wasn’t looking. I’m taking some torque.
Foreman contract
Zeus
Your labor must continue without end.
It says the labor continues. It doesn’t say whose. Meet my shift supervisors: the dead.
Tartarus offer
Zeus
Your stone is insufficiently burdensome. Tartarus has a larger one.
You’re punishing competence with a promotion. Olympus has invented middle management.
Daedalus purchase
Daedalus
I built the Labyrinth. Your pulley is simpler. Mostly. Don’t go into the gearbox.
The guy who designed a maze nobody escapes is optimising my endless job. Thematically flawless.
Ixion purchase
Ixion
Strapped to a burning wheel for all eternity. Want me to plug it into something?
Spinning forever on one of Zeus’s grudges. Finally, a power source that never runs down.
Leaking Heights offer
The Danaids
We are the Danaids. This jar will never be full. We have checked. For millennia.
Never full, always flowing? Ladies, that’s not a curse, that’s a hydroelectric startup.
Bronze Pass offer
Talos
TALOS WALKS CRETE THREE TIMES A DAY. MORTAL STRENGTH IS BELOW SPEC FOR THIS PASS.
A towering bronze robot with one vein and a single point of failure. Buddy, you’re hired.
Talos purchase
Talos
TALOS ACCEPTS CONTRACT. CLAUSE ONE: NOBODY TOUCHES THE ANKLE. NOBODY.
Relax, big guy. Our entire safety policy is “don’t pull the nail.” It’s laminated.
Skyward offer
Atlas
I have held up the sky since the Titans lost. Your little rock is adorable.
Respect. Also, every statue shows you holding a globe. Want me to sue somebody?
Olympus offer
Zeus
Enough. Your punishment will now be administered by Olympus. By me. Personally.
Zeus is inspecting the work himself. That’s how you know Olympus is worried.
Charter purchase
Zeus
Olympus will now pay you to punish yourself. I hate that this is the best option.
One must imagine Sisyphus invoicing.
First Begin Again
Thanatos
Remember me? You chained me up. Nobody died until Ares got bored. Back to the bottom.
Thanatos! Same hill, fresh start. And for the record, the chains looked great on you.
The gods create opportunities; they do not attack the player's controls or interrupt production. Lightning is a brief decree flourish with reduced-motion support. It never knocks a boulder backward or destroys a purchase.
## Cutscenes
Ten short scenes carry the authored story: the sentence, each new hill's decree, the two Tartarus works, the first Begin Again and the ending. They are staged from existing art: a scene painting pans behind the speakers, Sisyphus stands at left, and the gods loom from the right as mirrored portrait busts. Hades has no portrait yet, so he speaks from offstage as an ember glow from below. Lines type onto a papyrus scroll between meander letterbox bands, with a decree stamp, a lightning accent or a stone thud where a beat calls for one. No new art or voice acting is required.
Scene
Plays
Content
The Sentence
Once, on a new game, before the first push
The court of Olympus reads the three charges (Asopus, the chaining of Thanatos, the escape from Persephone) and sets the stone. Hermes escorts him to the First Hill.
The Larger Stone
In place of the Tartarus Rim decree, on first viewing
Zeus answers competence with a bigger stone. At the Rim, Hades objects from the dark until Sisyphus offers him a cut of everything that falls.
The Workshop
In place of the Daedalus purchase decree, on first viewing
Daedalus arrives with plans, a warning about the gearbox and a condition: if Hephaestus asks, Sisyphus built it.
The Burning Wheel
In place of the Ixion purchase decree, on first viewing
Ixion explains the cloud and the wheel. Sisyphus belts the wheel to his drum; Ixion is useful, not freed.
The Waters of Lethe
In place of the First Begin Again decree, on first viewing
Thanatos comes to collect; Sisyphus declines the Lethe and keeps what he learned. This is the story reason that prestige keeps permanent growth.
The Leaking Heights
In place of the Leaking Heights decree, on first viewing
The Danaids introduce their jar. Sisyphus promises it will never fill and asks only for a wheel under the leak.
The Bronze Pass
In place of the Bronze Pass decree, on first viewing
Talos, Hephaestus's guardian, has walked off the map of Crete. Sisyphus recognises tireless staff.
The Skyward Escarpment
In place of the Skyward Escarpment decree, on first viewing
Atlas holds the heavens (not a globe) and remembers Heracles's trick. Sisyphus offers a contract and bracing; the sky stays exactly where it is.
The Personal Touch
In place of the Olympian Approach decree, on first viewing
Zeus takes over the punishment himself with the sealed stone; Hermes raises his pay at the worst moment.
The Eternal Labor Charter
In place of the Charter purchase decree, on first viewing; the credits follow
Olympus cannot win, so it hires him. Hermes brings the Charter, the seal lands, and the First Hill closes the story.
A scene replaces its story panel only on first viewing; later triggers use the normal decree and comeback. Each scene is recorded when it closes, whether finished or skipped, and never plays again on its own. The archive lists the scenes; any scene viewed or unlocked by its story can be rewatched there, and The Sentence is always available.
Space, Enter, the right arrow, a click or a tap finishes the current line or advances. Escape or the Skip button closes the scene at once. Scenes never pause the simulation, block a purchase or hold rewards; production and offline accounting run underneath as usual (§01). Music and ambience duck while a scene is open, and ambient captions are held back.
Reduced motion removes the camera pan, entrance movement and shake. Flash-free softens the lightning to a dim pulse. Lines stay within the scroll at 120 English characters, with expansion space for translation, and follow the voice and accuracy rules for decrees.
## Relic catalog
Each relic supplies the same small permanent income multiplier, x1.10, and a distinct archive illustration. It arrives early through the bounded discovery system or no later than its listed guarantee. The art depicts collectible symbols, not equipment that must be worn.
ID
Relic
Eligible location
Guaranteed by
Archive joke
hermes_seal
Hermes Seal
First Hill
Open Tartarus Rim
Delivered before the complaint. Signed by the god of thieves.
daedalus_pin
Daedalus Pin
Tartarus Rim
Open Leaking Heights
The spare part was intentional. He insists.
danaid_handle
Danaid Handle
Leaking Heights
Open Bronze Pass
Handle with care. Contents optional. Contents gone.
ichor_ampoule
Sealed Ichor Ampoule
Bronze Pass
Open Skyward Escarpment
Do not remove the stopper. Divine warranty void if shaken.
atlas_shard
Atlas Sky Shard
Skyward Escarpment
Open Olympian Approach
Not a piece of the Earth. Atlas wants that on the record.
zeus_seal
Zeus Seal
Olympian Approach
Buy Charter
Approved under protest. Loudly. With lightning.
The ampoule is an invented game collectible inspired by Talos's vital fluid. Its appearance does not imply the player injures Talos. Machinery uses a consensual fictional servicing arrangement; there is no drain-or-repair minigame.
## Launch achievements
Achievements are milestones and jokes. They grant an illustrated stamp and archive entry, not additional multipliers, so they do not create hidden economy dependencies. All are available in ordinary play with no date restrictions or missable opportunities.
ID
Display name
Exact trigger
first_summit
Temporarily Successful
Complete the first ascent
first_return
Respawn
Complete the first descent
first_purchase
Reinvested Futility
Buy one production level
ten_levels
Same Stone More Ambition
Any operation reaches level 10
first_wheel
What Goes Down
Charge the first flywheel
first_auto
Eternal Delegation
Hire the foreman in any run
first_hermes
Signed for on Delivery
Purchase Hermes Dispatch
first_expansion
Additional Responsibilities
Own two operations at once
first_daedalus
Terms and Contraptions
Purchase Daedalus Workshop
first_ixion
Round the Clock
Purchase Ixion Drive
first_danaids
The Jar Half Empty
Purchase Danaid Waterworks
first_talos
Read the Ankle Label
Purchase Talos Heavy Labor
first_atlas
Not a Globe
Purchase Atlas Support Contract
first_relic
Found in the Debris
Acquire any relic
full_relics
Curator of Consequences
Acquire all six relics
first_prestige
New Game Plus
Complete Begin Again with a positive award
record_prestige
Remembered This Time
Claim a second positive Insight award
old_site_50
Old Money
First Hill reaches level 50 after opening another site
million
Unreasonable Already
Run Defiance reaches 1M
billion
Beyond the Complaint Form
Run Defiance reaches 1B
trillion
A Clerical Problem
Run Defiance reaches 1T
all_sites
Six Places to Be Punished
Own all six operations in one run
level_100
Established Procedure
Any operation reaches level 100
charter
Eternal Contractor
Buy the Charter
Achievement conditions run from authoritative state, not from a sound or animation callback. Load, import and offline settlement reconcile missed valid achievements. Local achievements work without Steam; the platform adapter later synchronizes the same stable IDs.
## Mythology archive
The archive contains twelve short subject entries: Sisyphus, Thanatos, Hermes, Daedalus, Ixion, the Danaids, Talos, ichor, Atlas, Zeus, Hephaestus and Greek vase painting. It also contains six relic entries and the viewed decrees. Entries unlock when their subject first appears, with Thanatos tied to the first prestige and Hephaestus mentioned in the Talos entry.
Each subject entry uses the same structure: a 35 to 60 word paraphrase of the ancient association, one sentence on our adaptation, a source link, and a note if variants materially differ. The archive is optional; reading it never grants a production advantage. Long quotations from modern translations are unnecessary.
### Editorial accuracy rules
Sisyphus's stone and his earlier tricks against death anchor the story [S2, S3]. The familiar image of a stone returning downhill is retained throughout. Our income, machines and divine contracting plot are inventions. The historical punishment does not establish an ancient energy business.
Talos is the bronze guardian associated with Crete. Sources describe a vulnerable vital-fluid channel and differing accounts of his defeat. Some accounts associate his creation with Hephaestus; do not casually attribute this bronze giant to Daedalus or confuse him with another Talos connected to Daedalus [S4]. Daedalus is our engineer by adaptation.
Atlas bears the heavens, not a terrestrial globe [S5]. The sky route and its support machinery should make this visible. The Danaids' unfinishable water task and Ixion's wheel remain recognizable; a filled cistern or freed Ixion would accidentally remove the joke. Ancient versions and artistic depictions differ [S6, S7].
Prometheus, Tantalus, the Hydra, Ariadne, the Trojan horse and Zeno are reserved for later content. Their inclusion was brainstormed, but the launch does not need every myth at once. Zeno and the modern absurdist reading belong in optional philosophical references rather than being presented as characters from the same mythic episode.
## Reactions and content budget
The launch target is 72 short ambient reactions: 12 per chapter, mixing the local machine, the gods' rules and Sisyphus's opinion of both. Display at most one ambient line per 90 seconds, never over a purchase or story interaction. Choose from unseen lines first, then enforce a no-repeat window of ten minutes. Store only the identifiers required for this behavior.
Ambient lines have no reward and do not pause play. They live in a small caption area, not in a speech balloon covering the path. They can be disabled independently. Text should fit in 80 English characters when practical, with expansion space for translation.
The asset budget covers six chapter environments assembled from three shared landscape kits, six stone textures, one Sisyphus rig, one shade rig, seven work installations, eight mythological portraits including Thanatos, six relic icons, three target types and roughly twenty interface icons.
Sisyphus also reacts to live play in the same caption area. A bark is a short quip chosen by chance: most prelude falls get one; summits, flywheel charges and bonus-target hits on the hill in view get one rarely, with at least 45 seconds between those; level purchases get one about one time in eight, at most once a minute. Pausing always gets one. Before the foreman, a minute without input earns one remark until the player acts again. Barks follow the ambient rules above, share its switch and never respond to offline settlement. A bark pushes the next ambient line back by 30 seconds so they never arrive together.
The following copy supplies the first complete set. Final copy can change after voice and localization review.
### Ambient copy for the First Hill
- Net work over a full loop: zero. Emotionally, it’s a lot.
- Potential energy: high. Kinetic energy: pending. Me: over it.
- I cheated Death twice and my reward is cardio.
- Day four thousand of while(true). Still looking for the break.
- Zeus calls this eternal punishment. I call it a stable job.
- Downhill requires no qualifications. I’ve checked. Repeatedly.
- The rock and I aren’t friends. We’re coworkers. It’s worse.
- Homer called me the craftiest of men. Look at me crafting. Uphill.
- Coefficient of friction, limestone on scree: personally offensive.
- Gravity has a perfect win record. I’m playing the long game.
- Autolycus stole my cattle, so I engraved their hooves. Gravity is harder.
- Same hill. Better margins.
### Ambient copy for the Tartarus Rim
- Daedalus swears the spare gear is decorative. Engineers lie about spares.
- Ixion hasn’t missed a revolution in millennia. Punctual, if flammable.
- The pulley gives a mechanical advantage of four. I bring spite.
- Tartarus: great acoustics, no natural light, rent is your soul.
- Cerberus sniffed the flywheel. Three heads, unanimous approval.
- Hades wanted a quarterly report. I sent him a rock. He loved it.
- The decree says forever. It says nothing about overtime.
- Olympus asks us to stop calling damnation a growth opportunity.
- Daedalus built a Labyrinth. The gearbox is somehow harder to navigate.
- Persephone is up top half the year. We schedule maintenance around her.
- Charon asked for an outboard motor. I told him to take a number.
- We are now suffering at twice the rate. Productivity!
### Ambient copy for the Leaking Heights
- Please do not fix the leak. The leak is the business model.
- The jar is empty. The accounts are not. Checkmate, Hades.
- We’ve reclassified bottomless as high throughput.
- Forty-nine sisters, one leaky jar. Classic group project: never finished.
- An inspector asked when it will be full. We said Q-never.
- Olympus has no form for useful futility. We filed one anyway.
- Entropy always wins. We’ve just arranged for it to pay rent.
- Hydraulically, it’s a sieve. Economically, it’s a spring.
- The water rolls downhill for once. Someone else doing my commute.
- Zeus asked why the jar isn’t full. We sent him his own terms.
- The Danaids and I have a lot in common. Mostly spite. Some cardio.
- Another milestone. Still not a single drop retained. Beautiful.
### Ambient copy for the Bronze Pass
- Talos requested a bigger door. Then a bigger chair. Then a bigger door.
- Do NOT touch the ankle fitting. We have a sign. We have many signs.
- The bronze stone conducts heat, electricity and complaints.
- Zeus specified mortal labor. Talos is not mortal. I read contracts.
- Hephaestus built Talos. Talos built a union. Hephaestus is concerned.
- Talos used to throw rocks at ships. Now he throws them uphill. Growth.
- Medea once stared Talos down. Sorceresses are banned from the site.
- Talos laps Crete three times a day. His step count is shaming me.
- Ichor is not a lubricant. We learned that from the paperwork. Luckily.
- Welcome to the Bronze Age. Management is a very large robot.
- The gods increased the burden. Talos said: finally, a warm-up.
- Heavy industry has become extremely literal.
### Ambient copy for the Skyward Escarpment
- Atlas insists it’s the sky, not a globe. He is tired of the statues.
- The scaffolding now has its own weather.
- Our overhead is literally the heavens. Accounting is not coping.
- The Hesperides live next door. Do not touch the apples. Ask Heracles.
- Atlas took one afternoon off. Heracles covered. We don’t discuss it.
- Load-bearing Titan. Do not remove. The sky will fall. Literally.
- Olympus objects to us looking up. Something about the view.
- Atlas has lifted the sky since the Titan war. His back has opinions.
- Altitude sickness, Titan attitude, divine audits. Normal Tuesday.
- The next decree will need a longer scroll and a stepladder.
- The sky is no longer the limit. It is the ceiling. We checked.
- We have raised expectations and several tons of stone.
### Ambient copy for the Olympian Approach
- The stone now arrives with its own terms and conditions.
- Divine marble makes a remarkably ordinary thud.
- We installed a complaint chute. It leads downhill. Obviously.
- Zeus would like to speak to the manager. I am the manager.
- Zeus threw a thunderbolt at the pulley. It’s electroplated now. Thanks.
- Olympus runs on ambrosia and grudges. We run on torque.
- I cheated Death, snitched on Zeus, and now he’s my client. Character arc.
- Hera sent a gift. We’ve quarantined it. We know this family.
- The Fates spin, measure and cut. We push, profit and repeat.
- I’m available for all of eternity. Please book through Hermes.
- The punishment scaled so well it needs a board of directors.
- The number no longer fits on the original tablet. Or the second one.
### Barks: Any prelude fall
- Gravity: one. Me: zero. Best of infinity.
- I once talked my way out of the underworld. The hill is less persuadable.
- Physics is undefeated. Physics is also petty.
- In my defence, the rock looked heavy. It was heavier.
- Somewhere on Olympus, a slow clap.
- I meant to do that. For science.
- The shades call it a rockslide. I call it a strategic withdrawal.
- Ow. In several dialects.
- The shades are laughing. The shades are also paying. I’ll allow it.
- The inquest finds gravity at fault. Gravity has retained counsel.
- Down again. I’ve seen the bottom more often than Charon has.
- Hades just made a note. Hades makes a lot of notes.
- That hill has a very aggressive return policy.
- Newton won’t be born for two thousand years and he’s already smug.
### Barks: A prelude fall from a new height record
- New height record! Then the old depth record. Balance.
- Higher than ever before. Then lower. Classic.
- Personal best. The rock was not impressed.
- Progress, measured in regret per metre.
- That was the highest I’ve ever fallen from. Growth!
### Barks: A summit on the hill in view
- Summit! Enjoy the view. Five, four, three…
- Top of the world. Briefly.
- The stone is at the top. Everyone act natural.
- Temporary success achieved. Return trip scheduled.
- And there it goes. See you downstairs.
- Peak performance. Literally. For about a second.
### Barks: A flywheel charge on the hill in view
- Gravity works for me now. Zeus hates that.
- Kinetic energy: captured. Divine irony: maximised.
- The stone rolls down, the wheel spins up. Conservation of spite.
- Every fall charges the wheel. I’ve monetised failure.
- What goes down must come around. Newton, take notes.
- Somewhere, Zeus just felt a disturbance in his punishment.
### Barks: A bonus target hit on the hill in view
- Right in the amphora. Hermes would be proud. Then invoice me.
- Gilded offering, pulverised. Sorry, whoever that was for.
- Direct hit. Some minor deity is filing an insurance claim.
- Bullseye. Artemis, eat your heart out.
- The stone has excellent aim for something with no eyes.
### Barks: Buying levels
- Upgraded. The futility now runs slightly faster.
- Line goes up. Rock goes down. Economics.
- Reinvesting in suffering. Very forward-thinking.
- Every obol reinvested. The Fates hate a planner.
- Same rock, bigger numbers. Pythagoras would weep, once he’s born.
- Stronger stone, stronger shoulders. Heracles, watch your back.
### Barks: Pausing
- Time stops. Chronos would be so jealous.
- Pausing eternity. Zeus is filing a complaint in triplicate.
- Break time. My first in several thousand years.
- Frozen mid-shove. Very dramatic. Very vase.
- Hypnos just sent a thumbs up.
### Barks: A minute idle before the foreman
- Taking five. The rock doesn’t mind. The rock is a rock.
- Hello? Eternal punishment here. It won’t punish itself.
- Loitering in the underworld. Charon charges for that.
- Standing still is technically not rolling backwards.
- If nobody pushes, is it still a punishment? Asking for Zeus.
- I could leave. I won’t. But I could. Probably not.
### Arrivals
Half the time, switching to a hill earns a line about it.
#### The First Hill
- Home sweet hill.
- The original. Accept no imitations.
- Back where it all started. And restarted. And restarted.
#### The Tartarus Rim
- Tartarus. Mind the Titans, they bite.
- Smells like brimstone and venture capital.
- The Titans downstairs keep banging on the ceiling.
#### The Leaking Heights
- Hello, ladies. Still not full? Excellent.
- Bring a towel. And a spreadsheet.
- The only place where a leak counts as infrastructure.
#### The Bronze Pass
- HELLO, TALOS. (You have to shout. Bronze ears.)
- Mind the ankle. Everyone mind the ankle.
- Smells like hot metal and someone else’s island.
#### The Skyward Escarpment
- Air’s thin up here. So is Atlas’s patience.
- Look up. That’s Atlas’s whole job. Don’t make it weird.
- Close enough to the sky to file a noise complaint.
#### The Olympian Approach
- Olympus. Wipe your feet. Zeus is always watching.
- Nice marble. Shame about the management.
- The gods’ front lawn. I’m rolling a boulder across it.
### Machinery commentary
These lines join the ambient pool once the foreman is hired or the work is installed, on whichever hill is in view.
#### Foreman
- The shades took over. I’m management now. Horrifying.
- The dead work harder than the living. Morale is, well, dead.
- Shades don’t take breaks. Shades don’t take anything. It’s eerie.
- My foreman is a ghost. Literally. He haunts the break room.
#### Hermes Dispatch
- Hermes delivers the invoices before I write them. Unsettling.
- Winged sandals, zero tips. Classic courier.
- Hermes once walked me down to Hades. Now he does my filing.
#### Daedalus Workshop
- Daedalus added a failsafe. It’s a smaller labyrinth.
- Daedalus insists wax is load-bearing. I have concerns.
- Every gear is patented. Even the one I whittled.
#### Ixion Drive
- Ixion hums while he spins. It’s the same note. Forever.
- Ixion asked for a break. The wheel creaked no.
- Renewable energy, Tartarus style: one guy, very sorry, spinning.
#### Danaid Waterworks
- The Danaids asked for a bigger jar. Same result, more volume.
- The Danaids have poured longer than Olympus has had a calendar.
- Water in, water out. The jar is a pass-through entity.
#### Talos Heavy Labor
- TALOS HAS COMPLETED HIS LAP OF CRETE. TALOS WOULD LIKE A MEDAL.
- Talos asked what a holiday is. We are still drafting an answer.
- Hephaestus came to check on Talos. He brought a very large wrench.
#### Atlas Support Contract
- Atlas likes the frame. He still won’t put the sky down.
- Atlas asked if the frame could take the sky too. Zeus said no. Loudly.
- Ovid says Perseus turned Atlas into a mountain. Atlas disputes this.
#### Eternal Labor Charter
- I am now legally my own punishment. HR is very confused.
- Zeus signs every page with a thunderbolt. Paper costs are up.
- We’re an official contractor of Olympus. Our logo is a sigh.
### Repeated decrees
Sisyphus remembers what Begin Again was meant to erase. A repeated decree keeps the speaker’s line and adds one comeback from this list, chosen like an ambient line. The compact panel stays up for five seconds when it carries one.
#### First fall in the prelude
- Yes, yes. Never. Thunderously. I could lip-sync this.
- You’ve used this decree before. Olympus needs new writers.
#### First summit
- Every time, yes. I had the schedule framed.
- Déjà vu. Olympus is doing reruns now.
- Rolls back, I know. Got anything new?
#### Flywheel purchase
- Same torque, second helping. Kronos sends his regards.
- You said that last time. The wheel still spins.
#### Foreman contract
- The dead remember their shifts. Unlike you, they read the contract.
- Rehiring the underworld. Their references are posthumous but glowing.
#### Tartarus offer
- Another promotion. I’ll need bigger business cards. And stone.
- Tartarus again. They kept my parking spot.
#### Daedalus purchase
- Still no gearbox access? Still going into the gearbox.
- Last time I found a Minotaur-sized gap in the manual.
#### Ixion purchase
- Ixion, buddy. Same wheel. Same five-star review.
- He didn’t notice I was gone. Occupational hazard of spinning.
#### Leaking Heights offer
- Still not full? Good. The whole business model depends on it.
- Same jar, same leak. You’re the most reliable vendors I have.
#### Bronze Pass offer
- BIG BRONZE FRIEND. I missed you. Please don’t hug me.
- He remembers me. Or the bronze does. Hard to tell.
#### Talos purchase
- Ankle clause, initialled. Twice. In bronze.
- The laminated safety policy survived Begin Again. Priorities.
#### Skyward offer
- Still the sky, still not a globe. Admirable consistency.
- Want a break? Last guy who offered was Heracles. Ask how that went.
#### Olympus offer
- Management visits again. I’ll put the ambrosia on.
- Personally again? Don’t you have a swan disguise to maintain?
#### Charter purchase
- Sign here, here and here. The ink’s still warm from last time.
- Same contract. I’ve added a clause about thunderbolts.
#### First Begin Again
- Skipped the Lethe again. I remember everything, including the chains.
- Same hill, more Insight. You’re the one who keeps losing, pal.
- I remember everything this time. That’s your punishment, not mine.
- See you next run. Bring snacks. It’s a long way down.
### Thanatos on later runs
The second, third and fourth Begin Again use the first three lines in order; later runs draw from the rest.
- Again? I have other clients. Well. Everyone is my client, eventually.
- Third time. I’m starting a loyalty card. Tenth death is free.
- My twin brother Sleep says you look tired. He would know.
- I’ve stopped bringing the chains. You always ask to see them.
- Hypnos gets poetry. I get you. Every. Single. Run.
- Hades wants to know why you keep coming back. So do I.
- Down you go. Try not to shackle any personifications on the way.
### While you were away
The offline recap card closes with one line from Sisyphus.
- You left. The rock didn’t notice. I did.
- The dead did all the work. There is talk of a union.
- Welcome back. Nothing happened. Forever. Profitably.
- Hermes kept the books. He swears nothing is missing. He would.
- It went up. It came down. Repeat until you came back.
- Time flies when you’re eternally punished.
- I kept your seat warm. It’s a rock. It doesn’t get warm.
### Archive margin notes
Each mythology subject carries a one-line note from Sisyphus, set apart from the paraphrase and adaptation so that the jokes never read as sources. The notes live with the archive content.
# 04  Art Direction Interface and Audio
## The world on screen
The game looks like Greek pottery art that has started moving. Its world fills most of the display. Sisyphus leans into the stone; a capstan slowly turns; a fall throws a few angular chips; water pours in a repeatable line. The art uses flat figures with adult proportions, terracotta and ink silhouettes, and fine incised details. It should read as a stylized playable world at a glance.
Ancient black-figure and red-figure pottery provide a visual reference, not a demand for archaeological reconstruction [S8]. Use dark silhouettes on warm clay in early chapters. Reserve reversed light figures on dark backgrounds for later regions so the campaign gains variety without leaving its palette. Scroll imagery belongs in optional information panels and chapter transitions; a giant parchment frame must not turn the gameplay view into a menu.
The previous pottery mockup is useful for figure treatment and palette. Its large Push card, permanent upgrade strip and static composition are rejected. The dramatic timing mockup is useful for motion and scale only. Its stamina, combat, timing track and lightning danger are rejected. Neither image is a complete reference for the launch layout.
## Composition and camera
The default site view shows the entire useful loop: uphill route, summit, return chute and impact area. A single boulder travels that loop. Sisyphus and the working mechanism are large enough to identify on a phone. The camera makes short, gentle adjustments around a milestone but does not chase every cycle. This lets the player observe machinery and use purchases without a constantly moving target.
The empire view is a horizontally unfolding frieze of the six fixed sites. Dragging, wheel scrolling or controller shoulder buttons move between sites. It is navigation, not construction. Zooming to a site never changes its production rate. Show at most three nearby sites in full detail; distant sites use a simpler loop or silhouette.
At the summit, pause the rock's visual motion briefly before the fall while preserving the configured phase durations. On the descent, accelerate its visual motion along a predetermined curve, rotate the painted stone markings and trigger the impact at the scheduled payout. The release of tension matters more than a large number of particles.
## Screen layouts
Surface
Desktop landscape
Phone portrait
World
At least 80 percent of normal screen area
At least 65 percent above controls, with camera reframed to the hill
Top HUD
Obols, automated income rate, next decree icon
Obols and rate on one line, next goal on a second compact line
Site navigation
Small location name and arrows; empire button
Swipe between sites plus labeled arrows as an alternative
Push
World hotspot and small fixed control
Large thumb-accessible control beneath the world
Purchases
Retractable side drawer, up to 30 percent of width
Bottom sheet with one to three visible purchase rows
Next objective
One text line and progress marker
One text line directly above controls
Archive and settings
Small labeled icons
Accessible through a compact labeled menu
The exact proportions are design targets, not permission to make text unreadable. At narrow widths the world crop changes instead of scaling the entire desktop UI. If portrait composition fails the first visual test, the mobile version may ship landscape first; this decision belongs before full asset production.
Use DOM controls for text, buttons, navigation, purchase rows and dialogs. The canvas handles the world and nonessential effects. Critical values must also exist as accessible text, rather than being baked into an image. A visible sprite hotspot and its corresponding DOM button send the same game command.
## Purchase drawer behavior
Opening the drawer never pauses or resets the cycle. The selected site remains visible and sounds continue at reduced volume. The drawer presents the current operation level and the next milestone, then Strength, Impact and special purchases that meet their discovery conditions. Locked late-game systems are not listed in a long wall of disabled rows.
Each purchase shows its exact price, affordable state and consequence. For repeatable purchases, show the resulting expected unassisted income change. For automation, show Works while away. For a flywheel, show Helps after the next descent. A purchase produces a small confirmation motion on the corresponding machine, so the world explains where the money went.
The player can pin one next purchase as a goal. Pinning changes only the displayed progress line and never reserves money. When it becomes affordable, use a quiet highlight. There are no flashing repeated alerts. If the chosen purchase becomes irrelevant or capped, suggest the next milestone without replacing the pin automatically.
The drawer is a papyrus scroll hung from a turned wooden rod with bronze finials beneath the top bar. Rolled up, it is a single cylinder carrying a clay seal that counts the offers within reach. Up to three of those offers (two on phones) hang below it as sillyboi, the small title tags of ancient scrolls; the pinned goal comes first, and one click buys the tag's offer. Unrolled, the sheet runs down the right column with the roll at its foot, and on phones it drops over the top half of the screen. Entries are written in ink with a paragraphos in the margin, affordable buttons are pressed clay seals, and pins are drops of wax. The papyrus is painted in the browser from layered pith strips and fibres, with ragged edges; nothing is cartoon-outlined. The sheet stays DOM text, and Reduced Motion opens and closes it without the unrolling.
The rest of the interface frames the world as architecture, in the same browser-painted materials. Across the top is a limestone beam. The balance and the site name are cut into it, flanked by the site arrows. Empire, Pause, Archive and Settings are buttons sunk into the stone, and Insight is a violet-glazed plaque. A terracotta band with a running key runs along the beam's lower face, and the scroll's rod hangs from it on bronze straps. At the foot of the world is a basalt tabula ansata (an inscription tablet with dovetail handles). The current goal is cut into it with its progress inlaid in bronze and Next and Beyond beneath, and the glazed clay Push is set beside the goal. The scroll's roll is the only Improve control. On phones the tablet stacks the goal above Push, and the decree runs as one line under the site name. Dialogs are papyrus sheets held open between two rods, titled over the same running key, and the title screen's card is the same scroll. The while-you-were-away recap waits until the player continues past the title screen. Whatever speaks over the world is cut in basalt: god lines (the portrait a bronze-rimmed medallion), captions, notices and the pause banner. The Begin Again prompt is a papyrus slip marked in violet, and notices appear beside the scroll rather than over it. The Empire strip lies on darkened basalt, and its cards are squared with a bronze fillet.
The upgrade drawer closes with Escape, a close button or a swipe gesture. Clicking the world outside it can close it, but never also triggers a push or purchase. Modal confirmations trap keyboard focus and return it to the initiating control when dismissed.
## Art palette and typography
Role
Starting color
Use
Ink
#211B17
Main figures, text and machine silhouettes
Clay
#B65D35
Ground, stone markings and primary action
Pale clay
#D99C6C
Secondary terrain and foreground accents
Parchment
#EBDCC0
Sky negative space and readable panels
Bronze
#A57B3B
Machinery and permanent rewards
Light ivory
#F6ECDC
Highlight and text on dark regions
These are an art starting palette, not an accessibility certification. Measure actual combinations after compositing. Small text targets at least 4.5 to 1 contrast; large text and meaningful graphics target at least 3 to 1. Use labels, shapes and icons as well as color for affordability and progress.
Titles can use a restrained classical serif in ordinary Latin letters. Body labels and numbers need a very readable serif or sans serif. Avoid replacing Latin letters with Greek-looking characters, wide letter spacing in small labels, or distress texture across small digits. License and package every font. The prototype can use locally available fonts; the final title face is selected during the first art proof.
World textures may have mild ceramic wear. Interface backgrounds remain quiet. The game has no black drop-shadow buttons, glossy gems, large cartoon heads, heavy speech balloons or high-detail painted scenery. Fine vase incision lines appear only where they survive at the actual display scale.
## Animation inventory
Asset
Required states or clips
Implementation target
Sisyphus
Rest, push loop, strain accent, summit reaction, step aside, manual assist
One reusable cutout rig with clean silhouette transitions
Boulder
Rolling, summit hesitation, fast descent, impact rebound
Shared transform animation and six texture variants
Shade attendant
Pull loop, idle, purchase reaction
One rig reused at all sites
Flywheel and capstan
Uninstalled, charging, turning, upgraded
Two or three moving components per machine
Mythic works
Entrance accent and short idle loop
Seven compact installations
Coin and relic effects
Small grant, milestone grant, rare discovery
Shared particles and icon trails
Decree
Seal stamp and short sky accent
One reusable transition
No individual sprite needs physically simulated joints. Use deterministic path splines and authored loops. Expensive effects are cosmetic and can be disabled without changing timing or rewards. A maximum of one major reward flourish should occupy the screen at once; aggregate additional awards into a small counter.
The expected scene budget is 100 to 250 visible sprites in a normal detailed site and fewer than 500 in the empire view. These are profiling targets to validate on reference devices, not measured performance claims. Limit active particle counts and reuse sprite objects.
### Pottery effects
The effects layer keeps the vase look. Marks such as rays, cracks and speed lines are shapes in the palette with an incised ink line. The pieces are painted by the renderer rather than drawn as flat vector: struck obols with an owl face and a Σ reverse, black-figure, glazed and gilded sherds, faceted stone chips and billows of dust. The waiting targets are a figured amphora of obols, a bronze tripod hoard and a heap of debris. The machinery uses grained timber posts with bronze collars and cast sheaves. A struck target breaks into pieces cut from its own painting; bronze rings with a chime and gold sparks instead. Each hill answers a blow in its own way: cinders on the Tartarus Rim, splashing water in the Leaking Heights, bronze sparks on the Bronze Pass, silver stars on the Skyward Escarpment and gold leaf on the Olympian Approach. Pieces lie where they land for a few seconds, and broken sherds lie about the impact ground. A summit throws gold and bay laurel and bevelled gold stars. A relic rises and turns in a painted ray burst, painted as itself, and a decree is sealed in red wax with Zeus's thunderbolt. The hill's light stays fixed on the stone as it rolls. The Effects setting offers Full, Balanced (no distortion or rim light, a lighter bloom and half the particles) and Off. Light is the one thing allowed to be more than paint: sparks, embers, gold, stars and the hit frame carry additive glow, so they really shine. Impacts get a hit-stop of a few frames, a glint, a dashed shockwave ring, incised cracks and shards of the stone's own material that bounce and settle. A summit prelude gets a black-figure ray burst with ink laurel, gold stars and flipping obols. Production levels 100, 150 and 200 are carved on screen as Roman numerals by a floating giant mallet and chisel (see Installation and visible growth). Fast descents leave ink speed lines. Each hill has its own air: shafts of light on the First Hill, the Bronze Pass and the Olympian Approach, heat bands, embers and ash at the Tartarus Rim, mist and drips in the Leaking Heights, and twinkling stars and meteors on the Skyward Escarpment. On WebGL, a post pipeline (the kiln) runs over the whole scene. It distorts first: heavy blows send a shockwave ring through the picture, heat haze rises over the Tartarus pit, and painted sea swells and glitters. Then it lights: a bloom pass on what is truly bright, and light scattered from each hill's painted sun, so hills, temples and trees cut shafts out of it. Last it finishes: a per-hill split-tone grade with a soft shoulder, a brief flash on the hit frame and at the summit, the fine grain of the slip, faint crazing fixed to the world, and a darkened rim like the foot of a pot. Sisyphus, the stone, the shade and the wheel are rim-lit on the edges that face the hill's light and shaded on the far side. Hills blend their looks as the player moves between them. Particles are capped at 360.
Heavy moments lean the camera a few percent toward the blow and shake it with a smooth tremor rather than per-frame noise. Earned obols arc from the payout to the purse, which knocks and brightens as each lands, with a soft metallic tink. The interface moves in the same register: dialogs are set down like tablets, drawer rows rise in turn, a buy button glazes over with light when it comes within reach and stamps the row gold when used, bars carry a travelling glint, and changing hills passes a chapter card across the scene. Cutscenes share the fired finish (grain and a darkened rim), busts breathe, and dust rises through the painting.
Setting Effects to Off turns off particles, air, the kiln and the coin flights together. Reduced motion keeps the still light, grade and rim light but drops all moving particles, shockwaves, haze, sea motion and flashes. None of it changes timing or rewards.
## Sound and music
Audio gives the loop weight without becoming exhausting. The push uses restrained stone scrape, cloth movement and a low exertion accent. The summit has a short two-note reward. The descent rolls faster, followed by a pottery or bronze impact appropriate to the target. Automation adds a soft mechanical pulse that can blend into the music.
Use a small original musical palette inspired by plucked strings, reeds and frame percussion. It is an artistic interpretation rather than a claim of historically reconstructed Greek music. Three evolving ambient arrangements cover early labor, the underworld enterprise and the approach to Olympus. Each can loop without a conspicuous seam.
Use a sound concurrency limit: one foreground scrape, one rolling stone and one reward accent per selected site. Background operations produce no repeated impact spam. Machine ambience ducks during dialogue text or a major discovery. Provide separate music, effects and interface volume controls; muted play remains fully understandable.
Launch audio scope is approximately 20 reusable effect families with a few pitch variants, three music arrangements and no required voice acting. A future narrator is optional. Browser playback begins only after the first user interaction to respect platform audio behavior.
## Accessibility and comfort
Space, mouse and touch all support the same manual effort. A toggle mode replaces holding. Rebinding is supported on desktop. No action demands rapid input, precise timing or hearing a cue. Buttons target at least 44 logical pixels, with larger touch controls where layout permits. The final device test verifies actual sizing rather than trusting a CSS label.
Offer text scaling, high-contrast panels, reduced motion, a rich-effects switch, screen-shake off, flash-free decree effects and an independent ambient-caption switch. Reduced motion keeps essential phase changes but removes camera sweeps and particle bursts. The game should not depend on repeated full-screen flashes.
Controller navigation covers world selection, opening a drawer, moving between rows, purchasing, backing out and prestige confirmation. Screen-reader labels expose balances, selected operation, next goal and purchase effects. Do not announce every coin; announce a summarized change on request or at meaningful milestones.
## Asset acceptance
Every delivered asset has an identifier, source file, export file, dimensions, pivot, license or creation provenance, and intended use. Sprite exports use transparent backgrounds, sufficient edge padding and a consistent scale. Do not deliver a generated screenshot as if it were a production sprite sheet.
An art proof passes when a new viewer can identify Sisyphus, the stone, the uphill route, the returning stone and the powered mechanism within five seconds at phone scale. The team must also distinguish an affordable control from scenery without explaining it aloud. Test motion in a running scene, not only in a still image.
# 05  Technical Architecture and Data Contracts
## Stack decision
Use TypeScript for all authoritative game rules, Svelte for interface controls, Vite for development and builds, and PixiJS for the animated world. PixiJS is a 2D renderer; the small game simulation remains our own module [S9]. Package the first desktop release with Electron, which includes Chromium and Node [S10]. Use Capacitor for later Android and iOS containers [S11].
This is one shared simulation with platform-specific adapters, not a promise of one-click shipping. Steam integration, native saving, mobile lifecycle, purchases and store submission each require their own proof. The choice fits a small 2D incremental game and shares browser-based rendering across the demo and packaged versions. Team expertise should be confirmed before committing to it. No full physics engine, 3D renderer or remote game server is required.
Component
Responsibility
Must not own
Simulation
Purchases, phase progress, income, progression, prestige
Rendering, DOM state or network calls
Content catalog
IDs, prices, thresholds, narrative keys and asset references
Mutable player state
Svelte UI
Input commands, formatted snapshots, accessibility
Independent money calculations
Pixi scene
Pose, camera, effects and visual interpolation
Authoritative completion or payout
Persistence adapter
Save, load, backup, export and migration
Economy rules
Platform adapter
Achievements, lifecycle, cloud files, purchase entitlement
Altering progression by platform
Audit harness
Simulated purchases, invariants, pacing reports
Claims about player enjoyment
## Module organization
Keep packages for core, content, presentation and platform. Core imports only pure utility code, the validated catalog and a Money wrapper. Content is versioned JSON validated at load. The app composes Svelte controls and a Pixi scene around snapshots emitted from core. Tests import core without a browser.
A practical directory plan is src/core for rules, src/content for definitions, src/ui for Svelte, src/world for Pixi, src/platform for adapters, and tests for model and integration fixtures. Desktop and mobile entry points select adapters while importing the same core package. This is a suggested layout, not a requirement to build a multi-package framework.
The Money abstraction initially wraps break_infinity.js, a library whose author explicitly prioritizes speed and very large magnitudes over exact precision [S12]. Expose add, subtract, multiply, compare, serialize and format through the wrapper. That keeps a future numeric-library change away from gameplay code. Never use BigInt as an unexplained substitute for fractional exponential income.
## Authoritative state
Use stable IDs from economy.json. Runtime state contains the following fields. Names below are descriptive contract names; implementation may abbreviate only behind an explicit serializer mapping.
State group
Required fields
Envelope
schemaVersion, contentVersion, revision, saveId, lastSettledUtc, paused, checksum
Wallet
obols, runGrossObols, bestRunGrossObols
Prestige
lifetimeInsightAwarded, insightSpent, permanentUpgradeIds
Empire
foremanOwned, selectedSiteId, ownedSiteStates, purchasedWorkIds
Durable discoveries
seenWorkIds, relicIds, seenStoryIds, archiveIds, achievementIds
Counters
totalClimbs, totalImpacts, totalRuns, totalActiveSeconds, highestSiteEver
Random state
coinRngState, relicRngState, relicCountdown and eligibleSiteId
Options
Audio, input, text scale, motion and display settings
An owned site state includes productionLevel, strengthLevel, impactLevel, wheelOwned, wheelCharged, phase, phaseProgress, cycleIndex, and the current cycle payout snapshot. The snapshot includes summitAmount, impactAmount, sampledBonusAmount and any already-granted phase bits. An economic grant references saveId, siteId, cycleIndex and grantType for idempotency.
In the launch implementation, lifetimeInsightEarned equals lifetimeInsightAwarded; do not store a second mutable copy. Spendable Insight is lifetimeInsightAwarded minus insightSpent. The model's shorter field names map to these fields. Its test state is not the release save format.
## Commands and emitted events
Command
Validation
State effect
SetManualEffort
Valid selected site and unpaused state
Set session input state; never persist a held key
SelectSite
Site owned or available for preview
Change focus; manual input is released
BuyLevels
Valid track, positive count, cap, exact affordability
Atomically debit and raise levels
BuyFlywheel
Owned site and not already installed
Install uncharged wheel unless permanent benefit applies
HireForeman
First wheel installed and no active contract
Debit once and automate all sites
BuyWork
Chapter and level conditions met
Debit, add work and durable seen ID
OpenSite
Previous site owned, gate met and funds sufficient
Create site with starting permanent benefits
BuyInsightUpgrade
Previous step owned and balance sufficient
Debit Insight and apply defined permanent effect
PreviewPrestige
Current state settled
Return a read-only preview
ConfirmPrestige
Positive award and valid confirmation
Atomic reset with preserved fields
SetPaused
Always valid
Settle to time, then change paused state
Core emits CycleStarted, SummitReached, ImpactResolved, PurchaseCompleted, WorkInstalled, SiteOpened, DecreeAvailable, RelicGranted, PrestigeCompleted and AchievementGranted. Event consumers may show effects or platform achievements. Replaying an animation event must not replay a currency grant. An event can be dropped visually without losing income.
Commands carry a timestamp and a request ID. State revisions let UI detect stale previews. A purchase applies at the authoritative settlement time; duplicate request IDs are ignored. A prestige confirmation is recalculated from settled state, so a few additional earnings improve the award rather than disappearing.
## Time advancement
Separate rendering frequency from simulation time. requestAnimationFrame drives the scene. Core advances against elapsed monotonic time and phase boundaries, with a nominal UI snapshot rate of 10 Hz. The scene interpolates between snapshots to appear smooth. No reward is multiplied by rendered frame count.
For short foreground intervals, advance each site's normalized ascent work and fixed descent/return durations. Process transitions until the supplied interval is exhausted. A large interval switches to the same batch settlement used after suspension. Clamp input-held duration across focus loss: visibility changes and pointer cancellation release manual effort immediately.
The deterministic order for equal timestamps is settle existing grants, apply queued commands in request order, apply resulting permanent changes, start new cycles, then emit UI events. Old cycle snapshots remain valid even if a new multiplier is purchased at the same boundary. A fixture must specify exact boundary behavior.
Offline batching skips complete cycles with constant parameters. It splits at partial-phase completion, flywheel first charge, relic due time, the offline cap and the final remainder. Decree thresholds can be recorded as available without interrupting a numeric batch because they change no production until purchased. There are at most six sites and one eligible relic countdown, so the algorithm's work is bounded by events rather than seconds elapsed.
For a cycle that began online, retain its already sampled bonus when resuming. For new cycles simulated entirely offline, use the expected bonus. Coin and relic random generators have separate saved states; changing the number of cosmetic particles never affects drops. Visual randomness uses a third nonauthoritative source.
## Saves and recovery
Autosave every 15 seconds while dirty, after purchases and permanent grants, before and after prestige, and on lifecycle suspension when possible. Mobile platforms may kill a process before a suspend callback completes, so periodic saves and transactional persistence are the primary defense.
Keep one current save and three rotating backups. On desktop write a temporary file, flush it and atomically rename it through the platform adapter. In the browser, use an IndexedDB transaction. On mobile, use a tested native file store with the same temp-and-replace behavior. A browser's local storage can be cleared or evicted; provide explicit export and import from the first public demo.
Every save is validated before replacing a known-good copy. Verify schema, allowed ranges, known IDs, unique arrays and checksum. The checksum detects accidental corruption; it is not anticheat. A failure opens recovery choices and leaves the invalid bytes available for export. Never silently replace a corrupt save with a fresh game.
Migrations run sequentially by schema version and preserve an original backup. Unknown future versions are refused with a clear message. Deprecated content IDs map through a versioned alias table or receive an explicitly documented conversion. The store build must include migration fixtures from every released schema.
Import previews the run, record, timestamp and permanent progress, then requires confirmation before replacing local progress. Reset Save is separate from Begin Again and requires a stronger confirmation. Both provide an export option and preserve a recovery copy when storage is available.
## Cloud and concurrent devices
Steam Cloud is a file synchronization layer, not a shared authoritative wallet. Enable it only after the desktop save format works. When two saves diverge, compare revision, save lineage and content version, then let the player choose with a concise progress preview. Never add balances or sum offline earnings from both copies.
Cross-platform cloud saving and account login are deferred. Manual export permits transferring progress when formats and entitlement allow it. Restoring a save does not confer a mobile full-game purchase; entitlement belongs to the platform adapter and is checked separately.
The game does not need multiplayer anticheat. Normal local modding or clock changes are not reasons to add a server. Future competitive leaderboards would require a separately scoped authority design.
## Content schema and localization
Every site definition provides id, displayNameKey, unlockCost, defianceGate, baseYield, baseLevelCost, ascentSeconds, stoneAssetId, sceneId and patronId. Works provide id, requirement, cost, effect enum, value and presentation keys. Relics specify their order, eligible site, guaranteed trigger, effect and archive key. Story events specify trigger, priority, once policy and text keys.
Use an enumerated effect interpreter for income multipliers and the eight permanent upgrades. Do not put executable scripts in user-editable JSON. Validate unique IDs, prerequisite order, nonnegative costs, positive durations, bounded probabilities, existing assets and references to actual sites. The sum of drop probabilities must equal one.
All visible text uses localization keys. Do not bake words into sprites, coin effects, signs or generated backgrounds. Compose the three content layers separately: mythological fact, fictional adaptation and joke. Numeric formatting follows locale while serialized values stay canonical.
## Performance and platform proof
Targets are 60 frames per second on the chosen desktop reference machine and 30 on the minimum tested phone. These are acceptance targets, not promises before profiling. Limit atlas size, total textures and particle counts based on measured memory. Pause offscreen visual work while maintaining exact simulation. Provide a low-motion and low-effects mode.
The desktop wrapper ships a local app with no required network request to play. Use context isolation and a narrow preload bridge; the renderer does not get arbitrary filesystem access. Expose only typed save, achievement and lifecycle calls. Verify shutdown and interrupted-write recovery.
Before committing to Electron for release, demonstrate one packaged build that launches through Steam, saves to the intended user directory, handles the overlay, records one achievement and recovers from forced exit. If that fails for an engine-specific reason, evaluate the wrapper then; the core simulation need not change.
Before mobile production, demonstrate backgrounding during descent, process death, screen rotation, a two-day absence, export/import, purchase restoration and touch on a low-end device. Capacitor provides access to native APIs but does not implement those game behaviors automatically [S11].
## Testing boundaries
Core unit tests cover prices, cycle snapshots, resource grants, milestone multiplicative order, prestige and reset preservation. Property tests cover monotonic progression, no negative balances, grant idempotency and numeric serialization. Integration tests cover UI commands and actual save adapters. Manual device tests cover readability, input, sound and lifecycle.
The bundled Python model is a documentation audit. The release core must have its own TypeScript fixtures matching the same numbers. Passing the Python model does not prove the Pixi animation, save format, platform build or offline batch implementation works.
# 06  Production Plan and Acceptance Tests
## Release scope and order
Build a browser prototype first, then a complete Windows release for Steam. The prototype tests the loop; the browser demo later covers the first two operations and preserves progress for export. The full game contains all six operations, seven mythic works, six relics, eight permanent upgrades, 24 achievements and the Charter ending.
The mobile plan reuses the economy and content. Android follows after touch, lifecycle and local saving pass their device tests. iOS follows the same gates plus its own native build and submission setup. Linux and macOS support can be added after the Windows package works; neither is assumed simply because the wrapper can target it.
Recommended pricing is a hypothesis: a complete Steam purchase around USD 5.99, tested against the finished content and actual audience response. Mobile can offer the two-operation introduction with one full-game unlock. No paid multipliers or advertising are required. Revisit pricing before launch; the design does not depend on a revenue forecast.
For Steam, current official documentation lists a USD 100 product fee, a 30-day wait after fee payment for the initial release process, and a coming-soon page visible for at least two weeks [S13]. These are scheduling inputs, not the complete submission checklist. Google Play's testing rule applies to personal developer accounts created after 13 November 2023: at least 12 testers opted in continuously for 14 days before applying for production access [S14]. Determine the actual publisher account type before scheduling Android. Check store requirements again at submission.
## Build milestones
Stage
Deliverable
Exit condition
Rough effort
1 Core loop
One complete hill, input, phase payouts and level purchases
Frame-rate independence and first feedback test pass
1 developer week
2 Automation proof
Flywheel, foreman, visual change, offline return and recovery
Players explain why descent helps and choose a next goal
1 to 2 developer weeks
3 First complete run
Two operations, Hermes, Daedalus, Ixion and first prestige
Save migration, meaningful reset and first-session tests pass
2 to 3 developer weeks
4 Campaign
Remaining four operations, all works, relics and ending
Every content path reachable; campaign playtest completed
3 to 5 developer weeks
5 Art and sound integration
Production art, interface, motion options and original audio
Readability, accessibility and performance targets pass
2 to 4 developer weeks
6 Shipping
Packaged build, Steam features, settings and support workflow
Release candidate gate passes
2 to 3 developer weeks
These are planning estimates for one experienced developer with art and audio support, not fixed commitments. Some art work can overlap engineering. A sensible initial planning envelope is 11 to 18 developer weeks plus approximately 4 to 8 artist weeks and 1 to 2 audio weeks, refined after the automation proof. Doing all roles part-time extends calendar duration. AI assistance can accelerate implementation and iteration but does not remove art cleanup, real-device testing or balancing.
The first staffing decision is who owns economy tuning and who owns visual consistency. Even if several people contribute, each needs a single reviewer. Art hours and the repeated-playtest schedule are likely to dominate uncertainty more than the small simulation module.
## Prototype acceptance gates
Test the first hill with five to eight people who have not helped design it. That group supplies qualitative evidence, not statistically reliable retention estimates. Observe without coaching for the first ten minutes, then ask them to describe the loop and the next thing they wanted.
Question
Initial acceptance target
If it fails
Can they start
At least 80 percent begin without explanation
Improve the first prompt and hotspot
Do they understand the fall
At least 80 percent explain its role after the flywheel
Improve the charge and assistance animation
Does automation feel valuable
At least 80 percent notice the change without being told
Make Sisyphus stepping aside and continued income clearer
Is another goal desirable
At least 60 percent voluntarily continue to another purchase after automation
Rework the next reveal and purchase benefit
Are menus overwhelming
No more than one participant reports not knowing where to spend
Reduce simultaneous options and improve comparison
Is manual input tiring
No participant must rapidly click to progress
Verify hold and toggle input behave identically
These percentages are product goals for observation, not market benchmarks. With a small group, inspect the individual failures as well as the percentage. Repeat after a material design change with new participants where possible.
Before adding all chapters, test two return sessions after at least several hours away. Ask whether the recap was clear, whether the next purchase felt earned, and whether the player remembered a goal. A technically correct idle calculation is insufficient if returning means reading a confusing ledger.
## Functional test matrix
Area
Test case
Required result
Manual cycle
Hold, release halfway, resume
Progress pauses without rollback; one summit and impact grant
Input equivalence
Tap, hold and toggle over equal active duration
Equal progress within timing tolerance
Automation
Hire after owning multiple sites
All sites automate; future sites inherit contract
Charge
Buy wheel during ascent
Assistance begins after the following descent, with no extra reward
Purchases
Buy during descent
Current payout snapshot preserved; next cycle uses new value
Bulk buy
Ten individual purchases versus Buy 10
Identical levels and total spend
Caps
Strength reaches ascent floor
Ineffective next purchase disabled and excluded from Buy Max
Affordability
Two purchases with a nearly empty wallet
No negative balance or duplicate transaction
Decree
One grant crosses multiple gates
Ordered offers; no skipped ownership prerequisite
Relics
Repeated misses and chapter opening
Award by the countdown cap or chapter guarantee; no duplicate
Prestige
Reset twice at the same best record
First valid award only; zero-award reset unavailable
Permanent spending
Buy an Insight step
Income factor based on lifetime awards never falls
Story
Prestige after reading chapter dialogue
Discovery remains recorded; long dialogue does not repeat
Pause
Leave game explicitly paused for a day
No production for paused interval
Suspension
Close during summit or impact effect
One grant, never zero or two because an effect was interrupted
Offline
30 seconds, 8 hours, 30 hours and 80 hours
Correct phases and configured cap; no manual bonus
Offline relic
Discovery occurs mid-absence
Split rates at award and preserve current snapshots
Clock
Move time backward or far forward
No negative income; cap and timestamp policy respected
Save corruption
Truncated newest save
Valid backup offered and damaged bytes preserved
Migration
Load every released schema fixture
Same owned content and money within documented conversion
Import
Import divergent save
Preview and explicit replacement; no summed balances
Locale
Long strings and alternate number formatting
Controls fit; save values remain canonical
## Quantitative invariants
All paid purchase costs are positive, the first free operation is the explicit exception, durations are positive, and drop probabilities sum to one. Every reachable nonterminal owned operation can eventually produce income if manual input is available or automation is active. Ordinary spending never reduces Defiance. Opening a site never reduces the unassisted income of an existing site. Buying a multiplier never decreases output.
No operation or work depends on a random event. Permanent upgrades form one acyclic prerequisite sequence. All references resolve to defined IDs. A repeated request ID, grant ID or offline settlement ID changes the economy at most once. Prestige preserves precisely the documented durable fields. A save round trip preserves numerical comparisons even when display suffixes change.
Foreground simulations at 15, 30, 60 and 144 rendered frames per second must agree economically when fed identical elapsed time and commands. Splitting a deterministic time interval into smaller intervals must not change guaranteed rewards. For random online rewards, compare identical saved generator states rather than fresh samples. Offline expected-value mode is intentionally a different distribution and must not be tested as identical online randomness.
## Product telemetry
During consented playtests, record a local event log with session start, first push, first summit, first purchase, wheel purchase and charge, foreman purchase, site opening, work purchase, relic grant, prestige preview and confirmation, and session end. Include timestamps, site ID, level, price and balance where useful. Avoid personal content or arbitrary device identifiers. The prototype can export logs manually; a production analytics service is not required.
Inspect time to automation, purchases per minute, the longest interval without an affordable useful purchase, post-automation continuation, the number of zero-value prestige previews and the difference between active and unattended progression. Ask players why they stopped. Do not treat session length alone as success.
If a full campaign takes too little time under repeated prestige, adjust permanent scaling before producing more filler chapters. If a casual return cannot afford anything satisfying, adjust pacing before adding push notifications. If players never revisit old sites, verify milestone or Familiar Ground benefits are visible rather than increasing interface clutter.
## Release candidate checklist
The complete campaign is reachable on a clean save, a no-bonus save and a migrated save. All achievements have stable IDs. A full run can be completed with mouse, keyboard and controller on the supported desktop build. Touch is required before mobile release. Every visible option works, and every setting persists.
The package starts offline, saves and restores after forced termination, handles missing or full storage clearly, and survives a 24-hour soak without unbounded memory growth. Profile the reference devices and publish minimum requirements based on evidence. Confirm distribution rights and attribution for code dependencies, fonts, art and audio. The store description matches the implemented offline behavior and campaign scope.
The trailer uses captured gameplay showing manual labor, the first flywheel, automation, another chapter and a large milestone. It should not rely on a still generated mockup. The capsule and screenshots can emphasize the pottery identity, but the product listing must make the idle progression legible.
Prepare a short support guide covering export, backups, corrupted saves, missing purchases and recovery. Keep a known-good release build and a rollback plan. A balance patch must not silently devalue permanent rewards or delete content from an existing save.
## Risks and decisions before production
Risk
Evidence to gather
Response
Watching is pleasant but not compelling
First ten-minute sessions after automation
Change rewards and reveals before expanding scope
Prestige overwhelms later pacing
Multiple reset policies and human replays
Tune diminishing returns and convenience timing
Pottery figures become hard to read
Phone-scale moving art proof
Simplify incisions and increase silhouette separation
Six scenes exceed the art budget
Finish one chapter to production quality
Reuse three kits and cap unique animation counts
UI covers the world
Touch and desktop recording
Adjust drawer size and camera framing
Platform wrapper creates integration risk
Early packaged Steam and mobile spikes
Fix adapter or revisit wrapper before campaign build
Mythology becomes generic flavor
Review each work and archive entry
Keep recognizable visual associations and source notes
The current recommendation is to approve the first-hill prototype before treating the full content list as a production commitment. The complete specification gives that prototype a clear destination while leaving its enjoyment to be demonstrated.
# 07  Sources Decisions and Revision Notes
## Sources and how they are used
Sources were checked on 20 September 2026. They support the framework, mythological associations, art reference and platform capabilities. All game economics, industrial adaptations, dialogue, thresholds and pacing targets are original proposals. None of the sources establishes that this design will retain players or achieve a sales target.
S1. Nir Eyal, The Hooked Model. Author's description of trigger, action, variable reward and investment. We apply the four-part sequence as a design lens; claims about dopamine or addiction are not required by this specification.
https://www.nirandfar.com/how-to-manufacture-desire/
S2. Homer, Odyssey 11, especially the passage beginning at line 593, translated by A T Murray and hosted by Theoi. Establishes the repeated uphill labor and returning stone. Our game counts a summit payout at the near-summit threshold; it does not claim Homer describes a successful escape over the crest.
https://www.theoi.com/Text/HomerOdyssey11.html
S3. Theoi, Thanatos, collecting classical references and later summaries. Supports the tradition that Sisyphus bound Death and interrupted death until intervention. Keep variants identified in archive prose.
https://www.theoi.com/Daimon/Thanatos.html
S4. Theoi, Talos, collecting ancient passages and variant accounts. Supports the bronze Cretan guardian, the vital-fluid vulnerability and the need to distinguish accounts of origin and defeat. Our work contract and servicing arrangement are fictional.
https://www.theoi.com/Gigante/GiganteTalos.html
S5. Hesiod, Theogony, passage following line 507, translated by Hugh G Evelyn-White and hosted by Theoi. Atlas supports the sky; this is why our art does not give him an Earth globe.
https://www.theoi.com/Text/HesiodTheogony.html
S6. Apollodorus, Library Epitome 1.20, translated by J G Frazer and hosted by Theoi. Describes Ixion bound to a wheel. Our power belt is an invented adaptation of the continuing motion.
https://www.theoi.com/Text/ApollodorusE.html
S7. Musee Rodin, Danaid collection entry. Museum explanation of the never-completed water task. Our waterworks preserves the inability to fill the vessel while using the escaping water.
https://www.musee-rodin.fr/en/musee/collections/oeuvres/danaid
S8. The Metropolitan Museum of Art, Athenian Vase Painting Black and Red Figure Techniques. Supports the visual distinction between dark painted figures with incised details and clay-colored figures against dark grounds. The game's blended palette is an adaptation.
https://www.metmuseum.org/essays/athenian-vase-painting-black-and-red-figure-techniques
S9. PixiJS official introduction. Documents its role as a 2D rendering engine. The choice to pair it with our independent simulation is a design judgment.
https://pixijs.com/8.x/guides/getting-started/intro
S10. Electron official introduction. Documents packaging web technologies with Chromium and Node for desktop. The recommendation still requires a Steam integration proof.
https://www.electronjs.org/docs/latest/
S11. Capacitor official documentation. Documents a native mobile container and plugin access for web applications. Save handling, offline rules and purchase integration remain application work.
https://capacitorjs.com/docs
S12. Patashu, break_infinity.js repository. Describes large-number incremental-game arithmetic and its performance versus precision tradeoff. Pin and verify a specific dependency version during implementation.
https://github.com/Patashu/break_infinity.js/
S13. Steamworks, Steam Direct. Current product fee and initial timing requirements. Recheck before submitting and schedule account, store and build review work separately.
https://partner.steamgames.com/steamdirect
S14. Google Play, App testing requirements for new personal developer accounts. Current 12-tester and 14-day requirements apply to the account category and date specified in the official page.
https://support.google.com/googleplay/android-developer/answer/14151465?hl=en
S15. Theoi, Minotaur, collecting classical accounts including Daedalus and the labyrinth. Supports the engineer association used in our fictional workshop, without assigning the bronze guardian's creation to him.
https://www.theoi.com/Ther/Minotauros.html
## Resolved design decisions
ID
Decision in this revision
Reason
D01
Incremental empire game with optional manual help
Matches the original pitch and shared design conversation
D02
Fixed routes and installation anchors
Keeps progress simple and art costs predictable
D03
No timing, stamina or combat system
Those appeared in a visual exploration and changed the genre
D04
Descending motion visibly powers assistance
Supplies the distinctive mechanical and narrative hook
D05
Obols plus Insight are the only spendable resources
Removes duplicated functions across energy, Defiance and materials
D06
Defiance is gross run earnings; Impertinence is its next-goal display
Makes divine escalation legible without another economy
D07
One foreman contract automates current and future sites
Prevents repeated opening chores at every chapter
D08
New decrees add opportunities without weakening old assets
Maintains the pleasure of earned progress
D09
Six sites and seven fixed works
Gives a complete campaign with a bounded content workload
D10
Boulders are chapter unlocks, not selectable builds
Preserves discovery without customization
D11
Relics are optional early surprises and guaranteed later
Variation does not block progress
D12
Prestige rewards a new best-run entitlement
Prevents repeated first-run farming
D13
Prestige income uses diminishing returns
Early tests showed linear scaling compressed later chapters too much
D14
Pottery world occupies most of the normal screen
Responds to the menu-like mockups
D15
Ending at the Charter with optional continued play
Makes the promised product finite and finishable
D16
Shared TypeScript simulation, desktop first
Fits the proposed visuals and reduces launch platform scope
## Assumptions and unresolved choices
The user has specified genre, simplicity, mythological depth and art direction. The six-site content list, pricing hypothesis, exact economy, story ending and platform sequence are recommendations made concrete in this packet. They can be changed without pretending earlier discussion approved every detail.
The product owner should review the Charter ending, the ordinary currency name, the scope of six sites and the purchase model before full production. These choices do not block the first-hill prototype. The technical lead owns save-format and platform-adapter implementation. The art owner selects licensed fonts and approves the moving pottery style proof.
Human playtests must resolve whether automation arrives at the right moment, whether repeated prestige remains satisfying, and whether players prefer a close site view or the empire overview. Mobile orientation is decided after an actual portrait prototype. Commercial playtime claims wait until representative players complete the campaign.
## Revision history
Version 0.1 consolidates the conversation into one proposed implementation. It retires the action-game detour and the construction puzzle, defines the resources and accounting, supplies a complete campaign structure, and includes an executable economy approximation. An early seed completed too quickly; later chapter costs and prestige scaling were revised. The validation report contains the final seed's measured outputs and limitations.
Future revisions should append the date, changed rule, rationale and affected tests. Preserve earlier released save mappings even when a design term changes. Generated concept art is a visual exploration, not a release screenshot or evidence that a system has been implemented.
# 08  Balance Validation and Remaining Evidence
## What was executed
The packet includes a runnable Python economy model and its JSON output. It simulates the proposed six-site economy, level costs, milestone multipliers, works, guaranteed relic awards and specified prestige policies. It uses a purchasing heuristic with a short milestone lookahead. It is a rate approximation for finding gross design errors, not the actual game core.
The initial seed allowed a continuous buyer to reach the ending in roughly 18 minutes. Raising later chapter costs fixed that immediate pacing collapse but produced long waits without prestige. A linear permanent income factor then made four planned resets complete the campaign in roughly 55 minutes. The included final seed uses diminishing returns and a lower Charter cost. Those revisions are recorded so the numbers are explainable rather than decorative.
## Results for the included seed
All durations below are simulated elapsed time, not observed human playtime. Continuous-buyer scenarios hold manual assistance on the newest operation and consider purchases at one-second intervals. The five-minute scenario makes one purchase per interval and never manually assists after its explicitly modeled opening setup. It is not a claim that a real casual player returns every five minutes.
Policy
First automation
First prestige eligibility
Charter reached
Longest modeled purchase gap
Continuous buying with no reset
1.6 min
12.5 min
9.61 h
81.3 min
Same policy with coin bonuses removed
1.7 min
13.5 min
10.26 h
86.6 min
One reset near 1M Defiance
1.6 min
12.5 min
5.59 h
46.5 min
Four resets near 1M, 1B, 1T and 1 quadrillion
1.6 min
12.5 min
1.85 h
4.5 min
No active help and one purchase every five minutes
Setup assumption
2.74 h
33.16 h
35.7 min
Exact seconds, reset awards and final levels are in balance/validation.json. These numbers are reproducible for the included model. Changing content, policy or calculation order requires regenerating the report.
## Interpretation
The current seed reaches every chapter without random coin bonuses. That supports the requirement that luck never gates the game. The first wheel appears around 68 seconds and automation around 94 seconds under the continuous model; discrete payouts and real decision time will move these timings. The first hill still needs a human playtest to establish whether its initial repetition is pleasant.
Prestige has a large effect on completion time. Four preselected resets reduce modeled completion to under two hours, while refusing resets produces long late waits. This is a remaining balance risk, not evidence of a finished commercial pacing curve. A reasonable first product hypothesis is a few hours of engaged progression spread over return sessions, but no marketed duration should be based on this approximation.
The next tuning pass should compare additional reset policies and actual player behavior. If repeated resets feel like chores, slow the growth of convenience benefits or reduce later cost ratios rather than forcing resets. If two hours feels too brief for the finished content, first adjust permanent scaling and chapter targets; do not pad the game with unproductive waiting.
The longest purchase gap reports the heuristic's choice to save for its selected target. It does not necessarily mean all other purchases were unaffordable. Instrument both the chosen wait and the time with no useful affordable purchase in the real prototype.
## Executed checks
- The catalog has six sites, seven works, six relics and eight permanent upgrades.
- Site identifiers are unique and Defiance gates ascend in order.
- Coin-drop probabilities sum to one and match the configured expected bonus.
- Manual operation produces positive income; unattended unautomated operation produces zero.
- Every production-level increase from 1 through 200 raises income in the tested setup.
- A best run of 1M awards 10 Insight; a later best of 10M awards 30 additional Insight.
- Repeating the same prestige record awards zero additional Insight.
- Spending Insight does not reduce the lifetime income multiplier.
- Dividing an unchanged-rate offline interval into smaller pieces preserves the model's income within numeric tolerance.
- Hiring the foreman propagates to existing sites and subsequently opened sites.
- Rounded bulk costs equal the corresponding sequence of individual costs.
## Limits of this validation
The model distributes income continuously instead of granting it at phase boundaries. It uses expected coin bonuses, awards relics only at guaranteed chapter milestones and treats purchased flywheels as already charged. It does not simulate tutorial interface reveals or reading time. It uses ordinary floating point and does not implement the release Money abstraction, exact saved-cycle snapshots, offline RNG, platform lifecycle, save migrations or actual input.
The reset policies are chosen examples, not an optimization search. The model records first-time milestone timestamps across resets; they are elapsed times since starting the experiment, not durations of individual runs. The five-minute scenario begins from a slow explicit automation setup of 748 seconds with no level upgrades; this is a comparison assumption, not a tutorial measurement.
No players have tested this specification, no game build has been produced by this documentation task, and no store release has been validated. The functional test matrix describes the evidence required from implementation. The model's passing assertions must not be reported as proof that the full game works.
## Reproducing the model
From the extracted documentation folder, run the following with Python 3. No third-party Python dependencies are required for the balance model.
python balance/simulate.py --output balance/validation.json
The optional Word renderer requires python-docx. Rebuild with python tools/build_doc.py.