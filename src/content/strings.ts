/**
 * English strings, keyed for later localisation. All visible text lives here
 * rather than in art or code paths (spec §05).
 *
 * Voice: Sisyphus is the craftiest mortal alive (Homer's words, not ours), a
 * king who chained up Death, talked his way out of the underworld and snitched
 * on Zeus. He is a smart-ass about all of it. Each god speaks as themselves.
 * Keep the myth accurate (spec §03, editorial rules): Atlas holds the sky,
 * never a globe; Talos is Hephaestus's bronze guardian of Crete, not a
 * Daedalus build; the Danaids' jar never fills and Ixion is never freed.
 *
 * Anachronism: the running joke is Olympus as a bureaucracy and Sisyphus as a
 * contractor working the loopholes, so contracts, invoices and management are
 * fair game, as is science he is too early for (he may notice). His wit comes
 * from cunning and myth, not from our jargon: at most one programming or
 * gamer joke per pool, and none in story beats.
 */
export const en: Record<string, string> = {
  'game.title': 'Sisyphus: Unchained',

  'site.first_hill': 'The First Hill',
  'site.tartarus_rim': 'The Tartarus Rim',
  'site.leaking_heights': 'The Leaking Heights',
  'site.bronze_pass': 'The Bronze Pass',
  'site.skyward_escarpment': 'The Skyward Escarpment',
  'site.olympian_approach': 'The Olympian Approach',

  'work.hermes': 'Hermes Dispatch',
  'work.hermes.desc': 'The god who once marched you back to Hades now handles your invoices. Awkward. All income ×1.25.',
  'work.daedalus': 'Daedalus Workshop',
  'work.daedalus.desc': 'The man who built the Labyrinth swaps the rough linkage for something elegant, patented and smug. All income ×2.',
  'work.ixion': 'Ixion Drive',
  'work.ixion.desc': 'Ixion’s eternal flaming wheel finally turns something useful. Zeus is livid. All income ×2.',
  'work.danaids': 'Danaid Waterworks',
  'work.danaids.desc': 'The jar never fills, but its leak drives a paddle wheel. A bug, promoted to feature. All income ×2.',
  'work.talos': 'Talos Heavy Labor',
  'work.talos.desc': 'Crete’s bronze guardian works the great lever between his three daily laps of the island. All income ×2.',
  'work.atlas': 'Atlas Support Contract',
  'work.atlas.desc': 'A frame takes the route’s load while Atlas keeps holding up the sky. The sky. Not a globe. All income ×2.',
  'work.charter': 'Eternal Labor Charter',
  'work.charter.desc': 'Zeus contracts your enterprise to administer its own punishment. Nobody is happy. All income ×2.',

  'story.first_slip.god': 'The stone shall never reach the summit. I have decreed it. Thunderously.',
  'story.first_slip.sis': 'Never is a long time. Luckily I once chained up Death, so my calendar’s wide open.',
  'story.first_summit.god': 'The stone shall roll back to the foot of the hill. Every time. Forever.',
  'story.first_summit.sis': 'Every time? Then it’s reliable. You’ve handed me the one dependable thing in Hades.',
  'story.flywheel_purchase.god': 'That falling stone is part of your punishment, mortal. Not a power source.',
  'story.flywheel_purchase.sis': 'You took your father’s throne while he wasn’t looking. I’m taking some torque.',
  'story.foreman_contract.god': 'Your labor must continue without end.',
  'story.foreman_contract.sis': 'It says the labor continues. It doesn’t say whose. Meet my shift supervisors: the dead.',
  'story.tartarus_offer.god': 'Your stone is insufficiently burdensome. Tartarus has a larger one.',
  'story.tartarus_offer.sis': 'You’re punishing competence with a promotion. Olympus has invented middle management.',
  'story.daedalus_purchase.god': 'I built the Labyrinth. Your pulley is simpler. Mostly. Don’t go into the gearbox.',
  'story.daedalus_purchase.sis': 'The guy who designed a maze nobody escapes is optimising my endless job. Thematically flawless.',
  'story.ixion_purchase.god': 'Strapped to a burning wheel for all eternity. Want me to plug it into something?',
  'story.ixion_purchase.sis': 'Spinning forever on one of Zeus’s grudges. Finally, a power source that never runs down.',
  'story.leaking_offer.god': 'We are the Danaids. This jar will never be full. We have checked. For millennia.',
  'story.leaking_offer.sis': 'Never full, always flowing? Ladies, that’s not a curse, that’s a hydroelectric startup.',
  'story.bronze_offer.god': 'TALOS WALKS CRETE THREE TIMES A DAY. MORTAL STRENGTH IS BELOW SPEC FOR THIS PASS.',
  'story.bronze_offer.sis': 'A towering bronze robot with one vein and a single point of failure. Buddy, you’re hired.',
  'story.talos_purchase.god': 'TALOS ACCEPTS CONTRACT. CLAUSE ONE: NOBODY TOUCHES THE ANKLE. NOBODY.',
  'story.talos_purchase.sis': 'Relax, big guy. Our entire safety policy is “don’t pull the nail.” It’s laminated.',
  'story.skyward_offer.god': 'I have held up the sky since the Titans lost. Your little rock is adorable.',
  'story.skyward_offer.sis': 'Respect. Also, every statue shows you holding a globe. Want me to sue somebody?',
  'story.olympus_offer.god': 'Enough. Your punishment will now be administered by Olympus. By me. Personally.',
  'story.olympus_offer.sis': 'Zeus is inspecting the work himself. That’s how you know Olympus is worried.',
  'story.charter_purchase.god': 'Olympus will now pay you to punish yourself. I hate that this is the best option.',
  'story.charter_purchase.sis': 'One must imagine Sisyphus invoicing.',
  'story.first_prestige.god': 'Remember me? You chained me up. Nobody died until Ares got bored. Back to the bottom.',
  'story.first_prestige.sis': 'Thanatos! Same hill, fresh start. And for the record, the chains looked great on you.',

  'prelude.chip_burrs': 'Chip Off the Burrs',
  'prelude.chip_burrs.desc': 'Knock the jagged edges off the stone so it stops snagging on every rut. Also on your dignity.',
  'prelude.wrap_feet': 'Wrap Your Feet',
  'prelude.wrap_feet.desc': 'Rags bound over bare soles. The scree stops sliding out from under you. Fashion is secondary.',
  'prelude.grind_round': 'Grind It Round',
  'prelude.grind_round.desc': 'Hours of grinding against the rocks. A round stone rolls; a lump drags. Geometry: finally useful.',
  'prelude.cut_footholds': 'Cut Footholds',
  'prelude.cut_footholds.desc': 'Steps hacked into the steepest stretch. Somewhere to stand, at last. Zeus did not approve the permit.',
  'prelude.offering': 'The shades lose their bets and pay up',

  'unlock.flywheel': 'Eureka (wrong Greek, right idea): the falling stone could turn a wheel. Flywheel available.',
  'unlock.foreman': 'The shades who heckled every fall now want the job. Foreman available.',

  'relic.hermes_seal': 'Hermes Seal',
  'relic.hermes_seal.joke': 'Delivered before the complaint. Signed by the god of thieves.',
  'relic.daedalus_pin': 'Daedalus Pin',
  'relic.daedalus_pin.joke': 'The spare part was intentional. He insists.',
  'relic.danaid_handle': 'Danaid Handle',
  'relic.danaid_handle.joke': 'Handle with care. Contents optional. Contents gone.',
  'relic.ichor_ampoule': 'Sealed Ichor Ampoule',
  'relic.ichor_ampoule.joke': 'Do not remove the stopper. Divine warranty void if shaken.',
  'relic.atlas_shard': 'Atlas Sky Shard',
  'relic.atlas_shard.joke': 'Not a piece of the Earth. Atlas wants that on the record.',
  'relic.zeus_seal': 'Zeus Seal',
  'relic.zeus_seal.joke': 'Approved under protest. Loudly. With lightning.',

  'upgrade.remembered_hand': 'Remembered Hand',
  'upgrade.remembered_hand.desc': 'Begin future runs with the foreman active.',
  'upgrade.known_machinery': 'Known Machinery',
  'upgrade.known_machinery.desc': 'Owned and newly opened hills start with a charged flywheel.',
  'upgrade.standing_orders': 'Standing Orders',
  'upgrade.standing_orders.desc': 'Hills opened after the first start at level 5.',
  'upgrade.familiar_ground': 'Familiar Ground',
  'upgrade.familiar_ground.desc': 'Hills below your highest owned hill earn twice as much.',
  'upgrade.signed_in_advance': 'Signed in Advance',
  'upgrade.signed_in_advance.desc': 'Works bought in earlier runs return free when their level is met.',
  'upgrade.eternal_shift': 'Eternal Shift',
  'upgrade.eternal_shift.desc': 'Offline earnings limit rises from 12 to 18 hours.',
  'upgrade.deep_reservoir': 'Deep Reservoir',
  'upgrade.deep_reservoir.desc': 'Charged flywheels speed ascents by 50% instead of 25%.',
  'upgrade.unbroken_memory': 'Unbroken Memory',
  'upgrade.unbroken_memory.desc': 'Double all ordinary income permanently.',

  'achievement.first_summit': 'Temporarily Successful',
  'achievement.first_summit.desc': 'Complete the first ascent. It will not last.',
  'achievement.first_return': 'Respawn',
  'achievement.first_return.desc': 'Complete the first descent. Welcome back to the bottom.',
  'achievement.first_purchase': 'Reinvested Futility',
  'achievement.first_purchase.desc': 'Buy one production level. Suffering, now with compound interest.',
  'achievement.ten_levels': 'Same Stone More Ambition',
  'achievement.ten_levels.desc': 'Any hill reaches level 10.',
  'achievement.first_wheel': 'What Goes Down',
  'achievement.first_wheel.desc': 'Charge the first flywheel. Must come around.',
  'achievement.first_auto': 'Eternal Delegation',
  'achievement.first_auto.desc': 'Hire the foreman in any run. Technically, the labor continues.',
  'achievement.first_hermes': 'Signed for on Delivery',
  'achievement.first_hermes.desc': 'Purchase Hermes Dispatch.',
  'achievement.first_expansion': 'Additional Responsibilities',
  'achievement.first_expansion.desc': 'Own two hills at once. Congratulations on the promotion.',
  'achievement.first_daedalus': 'Terms and Contraptions',
  'achievement.first_daedalus.desc': 'Purchase Daedalus Workshop.',
  'achievement.first_ixion': 'Round the Clock',
  'achievement.first_ixion.desc': 'Purchase Ixion Drive. Do not mention Hera.',
  'achievement.first_danaids': 'The Jar Half Empty',
  'achievement.first_danaids.desc': 'Purchase Danaid Waterworks.',
  'achievement.first_talos': 'Read the Ankle Label',
  'achievement.first_talos.desc': 'Purchase Talos Heavy Labor.',
  'achievement.first_atlas': 'Not a Globe',
  'achievement.first_atlas.desc': 'Purchase Atlas Support Contract.',
  'achievement.first_relic': 'Found in the Debris',
  'achievement.first_relic.desc': 'Acquire any relic.',
  'achievement.full_relics': 'Curator of Consequences',
  'achievement.full_relics.desc': 'Acquire all six relics. The museum of bad decisions is complete.',
  'achievement.first_prestige': 'New Game Plus',
  'achievement.first_prestige.desc': 'Complete Begin Again with a positive award. Death, unimpressed, again.',
  'achievement.record_prestige': 'Remembered This Time',
  'achievement.record_prestige.desc': 'Claim a second positive Insight award.',
  'achievement.old_site_50': 'Old Money',
  'achievement.old_site_50.desc': 'The First Hill reaches level 50 after opening another site. Still in production.',
  'achievement.million': 'Unreasonable Already',
  'achievement.million.desc': 'Run Defiance reaches 1M.',
  'achievement.billion': 'Beyond the Complaint Form',
  'achievement.billion.desc': 'Run Defiance reaches 1B.',
  'achievement.trillion': 'A Clerical Problem',
  'achievement.trillion.desc': 'Run Defiance reaches 1T. Olympus is out of zeros.',
  'achievement.all_sites': 'Six Places to Be Punished',
  'achievement.all_sites.desc': 'Own all six hills in one run.',
  'achievement.level_100': 'Established Procedure',
  'achievement.level_100.desc': 'Any hill reaches level 100.',
  'achievement.charter': 'Eternal Contractor',
  'achievement.charter.desc': 'Buy the Charter.',

  'target.debris': 'Debris',
  'target.coin_amphora': 'Coin amphora',
  'target.gilded_offering': 'Gilded offering',

  'hint.push': 'Hold the boulder or the Push button to climb.',
  'hint.prelude_fall': 'The shades toss an obol at every fall.',
  'hint.prelude_summit': 'Nothing holds you back now. Push to the top and ruin Zeus’s afternoon.',
  'hint.flywheel_tease': 'Something about the falling stone nags at you. Something about joules.',
  'hint.foreman_tease': 'The watching shades are asking about work. Dead, but motivated.',
  'hint.improve': 'Spend Obols to Improve Operation. Bigger payouts every climb.',
  'hint.flywheel': 'All that falling energy, wasted. A flywheel could catch it.',
  'hint.charge': 'The next descent will charge the flywheel. Let gravity do the paperwork.',
  'hint.foreman': 'Hire the foreman and the hill works without you. Delegation: your best trick yet.',
  'hint.expand': 'Keep earning. The gods are watching your Defiance. Wave.',
};

/**
 * Ambient captions, one every 90 seconds at most (spec §03). Fit 80 English
 * characters where practical.
 */
export const ambient: Record<string, string[]> = {
  first_hill: [
    'Net work over a full loop: zero. Emotionally, it’s a lot.',
    'Potential energy: high. Kinetic energy: pending. Me: over it.',
    'I cheated Death twice and my reward is cardio.',
    'Day four thousand of while(true). Still looking for the break.',
    'Zeus calls this eternal punishment. I call it a stable job.',
    'Downhill requires no qualifications. I’ve checked. Repeatedly.',
    'The rock and I aren’t friends. We’re coworkers. It’s worse.',
    'Homer called me the craftiest of men. Look at me crafting. Uphill.',
    'Coefficient of friction, limestone on scree: personally offensive.',
    'Gravity has a perfect win record. I’m playing the long game.',
    'Autolycus stole my cattle, so I engraved their hooves. Gravity is harder.',
    'Same hill. Better margins.',
    'Step one: push. Step two: push. Step three: see step one.',
    'I used to be a king. Now I’m in logistics.',
    'Zeus sentenced me to futility. I appealed to compound interest.',
    'I founded Corinth. Walls, a harbour, a market. Now I have a hill.',
    'I told my wife to skip my funeral. Best scheme I ever ran.',
    'Hades let me go home to scold my wife. I stayed for decades. Oops.',
    'The view from the top is lovely. I’ve seen about a second of it, total.',
    'Nobody tells you eternity has no weekends.',
    'Some men are born to greatness. I was sentenced to an incline.',
    'Uphill both ways. I’m not exaggerating; it’s in the sentence.',
    'This rock and I have been through a lot. Mostly the same hill.',
    'They gave Heracles twelve labours. I got one. Quality over quantity.',
  ],
  tartarus_rim: [
    'Daedalus swears the spare gear is decorative. Engineers lie about spares.',
    'Ixion hasn’t missed a revolution in millennia. Punctual, if flammable.',
    'The pulley gives a mechanical advantage of four. I bring spite.',
    'Tartarus: great acoustics, no natural light, rent is your soul.',
    'Cerberus sniffed the flywheel. Three heads, unanimous approval.',
    'Hades wanted a quarterly report. I sent him a rock. He loved it.',
    'The decree says forever. It says nothing about overtime.',
    'Olympus asks us to stop calling damnation a growth opportunity.',
    'Daedalus built a Labyrinth. The gearbox is somehow harder to navigate.',
    'Persephone is up top half the year. We schedule maintenance around her.',
    'Charon asked for an outboard motor. I told him to take a number.',
    'We are now suffering at twice the rate. Productivity!',
  ],
  leaking_heights: [
    'Please do not fix the leak. The leak is the business model.',
    'The jar is empty. The accounts are not. Checkmate, Hades.',
    'We’ve reclassified bottomless as high throughput.',
    'Forty-nine sisters, one leaky jar. Classic group project: never finished.',
    'An inspector asked when it will be full. We said Q-never.',
    'Olympus has no form for useful futility. We filed one anyway.',
    'Entropy always wins. We’ve just arranged for it to pay rent.',
    'Hydraulically, it’s a sieve. Economically, it’s a spring.',
    'The water rolls downhill for once. Someone else doing my commute.',
    'Zeus asked why the jar isn’t full. We sent him his own terms.',
    'The Danaids and I have a lot in common. Mostly spite. Some cardio.',
    'Another milestone. Still not a single drop retained. Beautiful.',
  ],
  bronze_pass: [
    'Talos requested a bigger door. Then a bigger chair. Then a bigger door.',
    'Do NOT touch the ankle fitting. We have a sign. We have many signs.',
    'The bronze stone conducts heat, electricity and complaints.',
    'Zeus specified mortal labor. Talos is not mortal. I read contracts.',
    'Hephaestus built Talos. Talos built a union. Hephaestus is concerned.',
    'Talos used to throw rocks at ships. Now he throws them uphill. Growth.',
    'Medea once stared Talos down. Sorceresses are banned from the site.',
    'Talos laps Crete three times a day. His step count is shaming me.',
    'Ichor is not a lubricant. We learned that from the paperwork. Luckily.',
    'Welcome to the Bronze Age. Management is a very large robot.',
    'The gods increased the burden. Talos said: finally, a warm-up.',
    'Heavy industry has become extremely literal.',
  ],
  skyward_escarpment: [
    'Atlas insists it’s the sky, not a globe. He is tired of the statues.',
    'The scaffolding now has its own weather.',
    'Our overhead is literally the heavens. Accounting is not coping.',
    'The Hesperides live next door. Do not touch the apples. Ask Heracles.',
    'Atlas took one afternoon off. Heracles covered. We don’t discuss it.',
    'Load-bearing Titan. Do not remove. The sky will fall. Literally.',
    'Olympus objects to us looking up. Something about the view.',
    'Atlas has lifted the sky since the Titan war. His back has opinions.',
    'Altitude sickness, Titan attitude, divine audits. Normal Tuesday.',
    'The next decree will need a longer scroll and a stepladder.',
    'The sky is no longer the limit. It is the ceiling. We checked.',
    'We have raised expectations and several tons of stone.',
  ],
  olympian_approach: [
    'The stone now arrives with its own terms and conditions.',
    'Divine marble makes a remarkably ordinary thud.',
    'We installed a complaint chute. It leads downhill. Obviously.',
    'Zeus would like to speak to the manager. I am the manager.',
    'Zeus threw a thunderbolt at the pulley. It’s electroplated now. Thanks.',
    'Olympus runs on ambrosia and grudges. We run on torque.',
    'I cheated Death, snitched on Zeus, and now he’s my client. Character arc.',
    'Hera sent a gift. We’ve quarantined it. We know this family.',
    'The Fates spin, measure and cut. We push, profit and repeat.',
    'I’m available for all of eternity. Please book through Hermes.',
    'The punishment scaled so well it needs a board of directors.',
    'The number no longer fits on the original tablet. Or the second one.',
  ],
};

/**
 * Sisyphus reacting to what just happened, in the ambient caption area:
 * `slip` and `slip_record` when the stone gets away from him in the prelude,
 * `summit` and `flywheel` now and then on the selected hill.
 */
export const barks: Record<string, string[]> = {
  slip: [
    'Gravity: one. Me: zero. Best of infinity.',
    'I once talked my way out of the underworld. The hill is less persuadable.',
    'Physics is undefeated. Physics is also petty.',
    'In my defence, the rock looked heavy. It was heavier.',
    'Somewhere on Olympus, a slow clap.',
    'I meant to do that. For science.',
    'The shades call it a rockslide. I call it a strategic withdrawal.',
    'Ow. In several dialects.',
    'The shades are laughing. The shades are also paying. I’ll allow it.',
    'The inquest finds gravity at fault. Gravity has retained counsel.',
    'Down again. I’ve seen the bottom more often than Charon has.',
    'Hades just made a note. Hades makes a lot of notes.',
    'That hill has a very aggressive return policy.',
    'Newton won’t be born for two thousand years and he’s already smug.',
  ],
  slip_record: [
    'New height record! Then the old depth record. Balance.',
    'Higher than ever before. Then lower. Classic.',
    'Personal best. The rock was not impressed.',
    'Progress, measured in regret per metre.',
    'That was the highest I’ve ever fallen from. Growth!',
  ],
  summit: [
    'Summit! Enjoy the view. Five, four, three…',
    'Top of the world. Briefly.',
    'The stone is at the top. Everyone act natural.',
    'Temporary success achieved. Return trip scheduled.',
    'And there it goes. See you downstairs.',
    'Peak performance. Literally. For about a second.',
    'Summit reached. Please hold your applause for a very short time.',
    'On top of the world. The world is a hill in Hades, but still.',
    'The top! Quick, someone paint this on a vase.',
    'I’d plant a flag, but the rock would flatten it.',
    'Made it. Zeus owes me a medal. Zeus owes me a lot of things.',
    'Up! The shades are clapping. Through their own hands, but it counts.',
  ],
  flywheel: [
    'Gravity works for me now. Zeus hates that.',
    'Kinetic energy: captured. Divine irony: maximised.',
    'The stone rolls down, the wheel spins up. Conservation of spite.',
    'Every fall charges the wheel. I’ve monetised failure.',
    'What goes down must come around. Newton, take notes.',
    'Somewhere, Zeus just felt a disturbance in his punishment.',
  ],
  impact: [
    'Right in the amphora. Hermes would be proud. Then invoice me.',
    'Gilded offering, pulverised. Sorry, whoever that was for.',
    'Direct hit. Some minor deity is filing an insurance claim.',
    'Bullseye. Artemis, eat your heart out.',
    'The stone has excellent aim for something with no eyes.',
  ],
  levels: [
    'Upgraded. The futility now runs slightly faster.',
    'Line goes up. Rock goes down. Economics.',
    'Reinvesting in suffering. Very forward-thinking.',
    'Every obol reinvested. The Fates hate a planner.',
    'Same rock, bigger numbers. Pythagoras would weep, once he’s born.',
    'Stronger stone, stronger shoulders. Heracles, watch your back.',
    'New shoulders. Same rock. Progress.',
    'Money well spent. Well, spent.',
    'Capital expenditure in Hades. My accountant is literally dead.',
    'An investment in the future. I have a lot of future.',
  ],
  pause: [
    'Time stops. Chronos would be so jealous.',
    'Pausing eternity. Zeus is filing a complaint in triplicate.',
    'Break time. My first in several thousand years.',
    'Frozen mid-shove. Very dramatic. Very vase.',
    'Hypnos just sent a thumbs up.',
  ],
  idle: [
    'Taking five. The rock doesn’t mind. The rock is a rock.',
    'Hello? Eternal punishment here. It won’t punish itself.',
    'Loitering in the underworld. Charon charges for that.',
    'Standing still is technically not rolling backwards.',
    'If nobody pushes, is it still a punishment? Asking for Zeus.',
    'I could leave. I won’t. But I could. Probably not.',
    'The shades think I’ve finished. Nobody tell them.',
    'Even the dead are watching me stand here. The dead.',
  ],
};

/**
 * Sisyphus on his colleagues, the dead: joins every hill's ambient pool.
 * Homer calls them the witless heads of the dead (Odyssey 10–11); only
 * Tiresias kept his wits, and a shade needs a drink of blood to think.
 */
export const shades: string[] = [
  'Homer calls the dead “witless heads”. Homer was being polite.',
  'A shade asked me which way is down. We are in the underworld.',
  'The dead need a drink of blood before they can think. Payday is chaos.',
  'Tiresias is the only shade who kept his wits. He won’t shut up about it.',
  'A shade asked if the rock was alive. I said no. He apologised to it anyway.',
  'I asked a shade his name. He said “Previously”.',
  'Staff meeting. Twelve shades came. Eleven thought it was a funeral.',
  'A shade tried to push the rock and walked through it. Twice. Then again.',
  'The dead can’t hold a pen. Or a thought. They sign with a cold draught.',
  'The shades squeak like bats. Homer’s words. The bats took it personally.',
  'Asphodel Meadows: an eternity of beige. It explains a lot about the staff.',
  'One shade has queued for Charon for a century. It’s the wrong river.',
  'My physio says lift with your legs. My physio is a shade. No legs.',
  'The dead are excellent listeners. Nothing goes in, but they nod.',
  'Achilles said he’d rather be a farmhand alive than king here. Fair.',
  'Explaining the job to a shade: tell him, he sips Lethe, tell him again.',
];

/**
 * Boredom, and how the immortals get through forever: joins every hill's
 * ambient pool. Atlas holds the sky; he is never shown with a globe.
 */
export const eternity: string[] = [
  // Boredom
  'I’ve counted every pebble on this hill. Twice. There are four fewer now.',
  'The first thousand years of eternity are the hardest. I assume.',
  'I’ve been bored so long I came out the other side. It’s also boring.',
  'I named the rock. Then renamed it. It’s on its three hundredth name.',
  'Today I pushed with my left shoulder. Big day. Don’t tell Zeus.',
  'Hobbies I’ve tried: whistling, counting, despair. Despair has range.',
  'I’ve thought every thought there is. Now I’m on reruns.',
  'Time flies when you’re having fun. So I couldn’t tell you.',
  'I tried meditation. Emptied my mind. Found the rock in there.',
  'Nothing to do but wait. I’m excellent at waiting now. World class.',
  // How the immortals cope
  'Zeus handles eternity with affairs. I handle it with inclines.',
  'Hera spends eternity holding grudges. Full-time job. She’s very good.',
  'Hestia hasn’t left the hearth in an age. She calls it self-care.',
  'Tithonus got immortality but not youth. Now he’s a cricket. Read the terms.',
  'The Graeae share one eye among three. Eternity is long; that queue is longer.',
  'Persephone spends half the year down here. She calls it a sabbatical.',
  'Hades is so bored he’s sorting the dead by height. Again.',
  'The gods invented family feuds because eternity has no plot.',
  'Kronos ate his children. Prophecy, he says. Boredom, I say.',
  'Hermes never sits still. Not work ethic. He’s terrified of free time.',
  'Atlas says the trick to holding the sky forever is never looking at a clock.',
  'Olympus is where the immortals go to be bored in marble.',
  'Eternity for a god: nectar, feud, repeat. For me: rock, repeat.',
  'Dionysus spends eternity at a party. I spend it on a slope. Same headache.',
];

export type Speaker = 'Sisyphus' | 'A shade' | 'Another shade' | 'The foreman';

/**
 * Short exchanges, shown a line at a time in the ambient caption. Early ones
 * are shades heckling from the sidelines; `crew` ones need the Foreman, when
 * the dead are on the payroll.
 */
export interface Exchange {
  id: string;
  crew?: boolean;
  lines: [Speaker, string][];
}

export const exchanges: Exchange[] = [
  {
    id: 'still_rock',
    lines: [
      ['A shade', 'Is he still doing the rock?'],
      ['Another shade', 'He finished once. Then it rolled back.'],
      ['A shade', 'So he did finish?'],
      ['Sisyphus', 'Please stop helping.'],
    ],
  },
  {
    id: 'leave_it',
    lines: [
      ['A shade', 'Why doesn’t he just leave it at the top?'],
      ['Another shade', 'Maybe he likes it.'],
      ['Sisyphus', 'I can hear you. You’re see-through, not soundproof.'],
    ],
  },
  {
    id: 'building',
    lines: [
      ['A shade', 'What’s he building?'],
      ['Another shade', 'A hill, I think. He keeps using the same one.'],
    ],
  },
  {
    id: 'questions',
    lines: [
      ['Sisyphus', 'Any questions before I start?'],
      ['A shade', 'Where am I?'],
      ['Sisyphus', 'Dead. Next question.'],
      ['A shade', 'Where am I?'],
    ],
  },
  {
    id: 'lethe',
    lines: [
      ['A shade', 'I drank from the Lethe. I feel great. Who are you?'],
      ['Sisyphus', 'We met ten minutes ago.'],
      ['A shade', 'Did we? I feel great.'],
    ],
  },
  {
    id: 'button',
    lines: [
      ['A shade', 'I paid Charon a whole obol.'],
      ['Another shade', 'I paid him with a button.'],
      ['A shade', 'And he took you across?'],
      ['Another shade', 'He didn’t look. Nobody down here looks.'],
    ],
  },
  {
    id: 'bet',
    lines: [
      ['A shade', 'A drachma says it stays up this time.'],
      ['Another shade', 'You don’t have a drachma.'],
      ['A shade', 'I don’t have a body either. Let me dream.'],
    ],
  },
  {
    id: 'prophecy',
    lines: [
      ['A shade', 'Tiresias says the rock will roll back down.'],
      ['Another shade', 'He’s a prophet!'],
      ['Sisyphus', 'It’s a slope. I could have told you that.'],
    ],
  },
  {
    id: 'how_long',
    lines: [
      ['A shade', 'How long have you been doing this?'],
      ['Sisyphus', 'Define “long”.'],
      ['A shade', 'Sorry, I forgot what I asked.'],
      ['Sisyphus', 'Lucky you.'],
    ],
  },
  {
    id: 'after_bored',
    lines: [
      ['Another shade', 'Are you bored?'],
      ['Sisyphus', 'I got past bored a thousand years ago.'],
      ['Another shade', 'What comes after bored?'],
      ['Sisyphus', 'Hobbies. Then bored again, but with hobbies.'],
    ],
  },
  {
    id: 'gods_all_day',
    lines: [
      ['A shade', 'What do the gods do all day?'],
      ['Sisyphus', 'Feast, feud, turn someone into a tree.'],
      ['A shade', 'And then?'],
      ['Sisyphus', 'Then it’s tomorrow. Forever. That’s why they do it.'],
    ],
  },
  {
    id: 'clock',
    crew: true,
    lines: [
      ['The foreman', 'We’ve put up a clock for the crew.'],
      ['Sisyphus', 'What for? It’s eternity.'],
      ['The foreman', 'They like watching the hands finish a lap. Gives them hope.'],
    ],
  },
  {
    id: 'weekend',
    crew: true,
    lines: [
      ['A shade', 'A new arrival says the living get two days off a week.'],
      ['The foreman', 'Two days of doing nothing?'],
      ['A shade', 'Can we have that?'],
      ['The foreman', 'You have it already. It’s called forever.'],
    ],
  },
  {
    id: 'break',
    crew: true,
    lines: [
      ['The foreman', 'The crew are asking for a break.'],
      ['Sisyphus', 'You’re shades. You don’t get tired.'],
      ['The foreman', 'They don’t know that.'],
      ['Sisyphus', 'Then nobody tell them.'],
    ],
  },
  {
    id: 'which_up',
    crew: true,
    lines: [
      ['Sisyphus', 'Push the rock up. Not down. Up.'],
      ['A shade', 'Which one’s up?'],
      ['Sisyphus', 'The one with the hill on it.'],
    ],
  },
  {
    id: 'wages',
    crew: true,
    lines: [
      ['A shade', 'Do we get paid?'],
      ['The foreman', 'You got an obol when you died.'],
      ['A shade', 'We’re already dead.'],
      ['The foreman', 'Then you’ve been paid. Back to work.'],
    ],
  },
  {
    id: 'safety',
    crew: true,
    lines: [
      ['The foreman', 'Safety briefing. Don’t stand under the rock.'],
      ['A shade', 'What happens if we do?'],
      ['The foreman', 'Nothing. It goes straight through you. It just looks bad.'],
    ],
  },
  {
    id: 'new_hire',
    crew: true,
    lines: [
      ['Sisyphus', 'How’s the new shade?'],
      ['The foreman', 'Keen. He asked what the rock is for.'],
      ['Sisyphus', 'And?'],
      ['The foreman', 'I said nobody knows. He took notes. On mist.'],
    ],
  },
  {
    id: 'demands',
    crew: true,
    lines: [
      ['A shade', 'We demand better conditions!'],
      ['Sisyphus', 'Such as?'],
      ['A shade', '…'],
      ['Another shade', 'He forgot. We all forgot. Carry on.'],
    ],
  },
  {
    id: 'shift',
    crew: true,
    lines: [
      ['The foreman', 'Shift change!'],
      ['A shade', 'Who’s on next?'],
      ['The foreman', 'You are. You were also on before.'],
      ['A shade', 'Feels fresh.'],
    ],
  },
];

/** On arriving at a hill (sometimes). */
export const arrivals: Record<string, string[]> = {
  first_hill: [
    'Home sweet hill.',
    'The original. Accept no imitations.',
    'Back where it all started. And restarted. And restarted.',
  ],
  tartarus_rim: [
    'Tartarus. Mind the Titans, they bite.',
    'Smells like brimstone and venture capital.',
    'The Titans downstairs keep banging on the ceiling.',
  ],
  leaking_heights: [
    'Hello, ladies. Still not full? Excellent.',
    'Bring a towel. And a spreadsheet.',
    'The only place where a leak counts as infrastructure.',
  ],
  bronze_pass: [
    'HELLO, TALOS. (You have to shout. Bronze ears.)',
    'Mind the ankle. Everyone mind the ankle.',
    'Smells like hot metal and someone else’s island.',
  ],
  skyward_escarpment: [
    'Air’s thin up here. So is Atlas’s patience.',
    'Look up. That’s Atlas’s whole job. Don’t make it weird.',
    'Close enough to the sky to file a noise complaint.',
  ],
  olympian_approach: [
    'Olympus. Wipe your feet. Zeus is always watching.',
    'Nice marble. Shame about the management.',
    'The gods’ front lawn. I’m rolling a boulder across it.',
  ],
};

/**
 * Extra ambient lines that join the pool once the machinery exists, so the
 * running commentary keeps up with the business.
 */
export const ambientWorks: Record<string, string[]> = {
  foreman: [
    'The shades took over. I’m management now. Horrifying.',
    'The dead work harder than the living. Morale is, well, dead.',
    'Shades don’t take breaks. Shades don’t take anything. It’s eerie.',
    'My foreman is a ghost. Literally. He haunts the break room.',
  ],
  hermes: [
    'Hermes delivers the invoices before I write them. Unsettling.',
    'Winged sandals, zero tips. Classic courier.',
    'Hermes once walked me down to Hades. Now he does my filing.',
  ],
  daedalus: [
    'Daedalus added a failsafe. It’s a smaller labyrinth.',
    'Daedalus insists wax is load-bearing. I have concerns.',
    'Every gear is patented. Even the one I whittled.',
  ],
  ixion: [
    'Ixion hums while he spins. It’s the same note. Forever.',
    'Ixion asked for a break. The wheel creaked no.',
    'Renewable energy, Tartarus style: one guy, very sorry, spinning.',
  ],
  danaids: [
    'The Danaids asked for a bigger jar. Same result, more volume.',
    'The Danaids have poured longer than Olympus has had a calendar.',
    'Water in, water out. The jar is a pass-through entity.',
  ],
  talos: [
    'TALOS HAS COMPLETED HIS LAP OF CRETE. TALOS WOULD LIKE A MEDAL.',
    'Talos asked what a holiday is. We are still drafting an answer.',
    'Hephaestus came to check on Talos. He brought a very large wrench.',
  ],
  atlas: [
    'Atlas likes the frame. He still won’t put the sky down.',
    'Atlas asked if the frame could take the sky too. Zeus said no. Loudly.',
    'Ovid says Perseus turned Atlas into a mountain. Atlas disputes this.',
  ],
  charter: [
    'I am now legally my own punishment. HR is very confused.',
    'Zeus signs every page with a thunderbolt. Paper costs are up.',
    'We’re an official contractor of Olympus. Our logo is a sigh.',
  ],
};

/**
 * Sisyphus remembers what Begin Again was meant to erase. When a decree comes
 * round again he says so, and the gods are running out of material.
 */
export const again: Record<string, string[]> = {
  first_slip: [
    'Yes, yes. Never. Thunderously. I could lip-sync this.',
    'You’ve used this decree before. Olympus needs new writers.',
  ],
  first_summit: [
    'Every time, yes. I had the schedule framed.',
    'Déjà vu. Olympus is doing reruns now.',
    'Rolls back, I know. Got anything new?',
  ],
  flywheel_purchase: [
    'Same torque, second helping. Kronos sends his regards.',
    'You said that last time. The wheel still spins.',
  ],
  foreman_contract: [
    'The dead remember their shifts. Unlike you, they read the contract.',
    'Rehiring the underworld. Their references are posthumous but glowing.',
  ],
  tartarus_offer: [
    'Another promotion. I’ll need bigger business cards. And stone.',
    'Tartarus again. They kept my parking spot.',
  ],
  daedalus_purchase: [
    'Still no gearbox access? Still going into the gearbox.',
    'Last time I found a Minotaur-sized gap in the manual.',
  ],
  ixion_purchase: [
    'Ixion, buddy. Same wheel. Same five-star review.',
    'He didn’t notice I was gone. Occupational hazard of spinning.',
  ],
  leaking_offer: [
    'Still not full? Good. The whole business model depends on it.',
    'Same jar, same leak. You’re the most reliable vendors I have.',
  ],
  bronze_offer: [
    'BIG BRONZE FRIEND. I missed you. Please don’t hug me.',
    'He remembers me. Or the bronze does. Hard to tell.',
  ],
  talos_purchase: [
    'Ankle clause, initialled. Twice. In bronze.',
    'The laminated safety policy survived Begin Again. Priorities.',
  ],
  skyward_offer: [
    'Still the sky, still not a globe. Admirable consistency.',
    'Want a break? Last guy who offered was Heracles. Ask how that went.',
  ],
  olympus_offer: [
    'Management visits again. I’ll put the ambrosia on.',
    'Personally again? Don’t you have a swan disguise to maintain?',
  ],
  charter_purchase: [
    'Sign here, here and here. The ink’s still warm from last time.',
    'Same contract. I’ve added a clause about thunderbolts.',
  ],
  first_prestige: [
    'Skipped the Lethe again. I remember everything, including the chains.',
    'Same hill, more Insight. You’re the one who keeps losing, pal.',
    'I remember everything this time. That’s your punishment, not mine.',
    'See you next run. Bring snacks. It’s a long way down.',
  ],
};

/**
 * Thanatos on the second, third and fourth Begin Again, then any of the rest.
 * He is getting tired of this.
 */
export const thanatos: string[] = [
  'Again? I have other clients. Well. Everyone is my client, eventually.',
  'Third time. I’m starting a loyalty card. Tenth death is free.',
  'My twin brother Sleep says you look tired. He would know.',
  'I’ve stopped bringing the chains. You always ask to see them.',
  'Hypnos gets poetry. I get you. Every. Single. Run.',
  'Hades wants to know why you keep coming back. So do I.',
  'Down you go. Try not to shackle any personifications on the way.',
];

/** Sisyphus on the “While you were away” card. */
export const recapLines: string[] = [
  'You left. The rock didn’t notice. I did.',
  'The dead did all the work. There is talk of a union.',
  'Welcome back. Nothing happened. Forever. Profitably.',
  'Hermes kept the books. He swears nothing is missing. He would.',
  'It went up. It came down. Repeat until you came back.',
  'Time flies when you’re eternally punished.',
  'I kept your seat warm. It’s a rock. It doesn’t get warm.',
];

export function t(key: string): string {
  return en[key] ?? key;
}
