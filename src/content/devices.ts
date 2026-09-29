/**
 * Sealed devices, whispers and visitors' bargains (docs/hill-workshops-plan.md §3, §4).
 * Every rule is data in a fixed effect vocabulary read by core/effects.ts; a
 * device never runs code of its own. Hints are all a sealed tablet shows.
 */

export type Effect =
  /** Climbs here are this many times as fast. */
  | { kind: 'ascent'; factor: number }
  /** Descents here take this many times as long. */
  | { kind: 'descent'; factor: number }
  /** No return walk here. */
  | { kind: 'noReturn' }
  /** Impacts here pay this many times as much. */
  | { kind: 'impact'; factor: number }
  /** The crew here earns this many times as much (the whole base reward). */
  | { kind: 'crew'; factor: number }
  /** The flywheel's boost (above ×1) is this many times as strong. */
  | { kind: 'flywheel'; factor: number }
  /** Every `every`-th cycle here pays `factor` times as much. */
  | { kind: 'everyNth'; every: number; factor: number }
  /** While you push here by hand, each summit also pays this share of the base reward. */
  | { kind: 'spectator'; share: number }
  /** Coin amphorae are this many times as common (taken from debris). */
  | { kind: 'amphorae'; factor: number }
  /** After Begin Again, this hill starts at least at this crew level. */
  | { kind: 'rebirth'; crew: number }
  // ---- the Furnace (Tartarus Rim)
  /** Eruptions' extra pay (above ×1) is this many times as large. */
  | { kind: 'furnacePower'; factor: number }
  /** Eruptions last this many times as many climbs. */
  | { kind: 'furnaceDuration'; factor: number }
  /** After an eruption the wheel keeps this share of its heat. */
  | { kind: 'furnaceRetain'; share: number }
  /** After an eruption the wheel never cools below this heat. */
  | { kind: 'furnaceFloor'; heat: number }
  /** Climbs are (1 + factor × heat) times as fast. */
  | { kind: 'furnaceWhip'; factor: number }
  /** No return walk while the wheel erupts. */
  | { kind: 'furnaceNoReturn' }
  /** An eruption does not drain while you hold Push on the hill. */
  | { kind: 'furnaceHold' }
  /** Each eruption also pays this share of a cycle's base reward at once. */
  | { kind: 'furnaceLump'; share: number }
  /** Each eruption this run adds this share to heat gain (capped). */
  | { kind: 'furnaceGrowth'; step: number }
  /** After an hour away, the wheel greets you with a full eruption. */
  | { kind: 'furnaceWelcome' }
  /** Taken once: this many free crew levels on every hill held. */
  | { kind: 'freeCrew'; levels: number }
  // ---- the Jar (Leaking Heights)
  /** Inflow per climb is this many times as large. */
  | { kind: 'jarInflow'; factor: number }
  /** Each climb also pours this much water, whatever the crew. */
  | { kind: 'jarExtra'; water: number }
  /** This share of spilled water finds its way back in. */
  | { kind: 'jarReturn'; share: number }
  /** Pressure counts from this share of the level, not from empty. */
  | { kind: 'jarGlaze'; share: number }
  /** Spilled water pays this share as if it had leaked. */
  | { kind: 'jarSpillPay'; share: number }
  /** While away, spilled water pays this share as if it had leaked. */
  | { kind: 'jarSpillAway'; share: number }
  /** A slow tide: inflow rises and falls by this share. */
  | { kind: 'jarTide'; amplitude: number }
  /** Drilling costs this many times as much. */
  | { kind: 'jarDrillCost'; factor: number }
  /** Each drill makes two holes. */
  | { kind: 'jarDoubleDrill' }
  /** The jar's pay is this many times as large. */
  | { kind: 'jarPower'; factor: number }
  // ---- the Foundry (Bronze Pass)
  /** Blueprints need this many times as much bronze. */
  | { kind: 'foundrySize'; factor: number }
  /** Each Ingot poured makes this much bronze. */
  | { kind: 'foundryPour'; factor: number }
  /** A finished blueprint pays this share of its bronze back as Ingots. */
  | { kind: 'foundryRefund'; share: number }
  /** Poured bronze also casts a crew level for every `every` levels' price. */
  | { kind: 'foundryCrew'; every: number }
  // ---- the Orrery (Skyward Escarpment)
  /** The sky turns this many times as fast. */
  | { kind: 'skySpeed'; factor: number }
  /** While away, a mounted house overhead stays there. */
  | { kind: 'skyNight' }
  /** Atlas rests this many times as long between turns. */
  | { kind: 'skyCooldown'; factor: number }
  /** The sky turns the other way (an Appeal twist). */
  | { kind: 'skyBackwards' }
  // ---- the Paperwork Mill (Olympian Approach)
  /** Clerks approve this many times as fast. */
  | { kind: 'bureauSpeed'; factor: number }
  /** This many forms each climb are approved without a clerk. */
  | { kind: 'bureauFree'; forms: number }
  /** Late fees accrue this many times as fast. */
  | { kind: 'bureauFee'; factor: number }
  /** The statute of limitations is this many times as long. */
  | { kind: 'bureauCap'; factor: number }
  /** Each summit files this many times as many forms. */
  | { kind: 'bureauFiling'; factor: number }
  /** Clerks cost this many times as much. */
  | { kind: 'bureauClerkCost'; factor: number }
  /** Edicts last this many times as long. */
  | { kind: 'edictLength'; factor: number }
  /** Due Process counts each milestone this many times. */
  | { kind: 'dueProcess'; factor: number };

export type DeviceSource = 'tablet' | 'whisper' | 'bargain';

export interface DeviceDef {
  id: string;
  siteId: string;
  source: DeviceSource;
  /** What the sealed tablet (or the rumour, or the bargain) shows. */
  hint: string;
  name: string;
  /** The rule in plain words, shown once revealed. */
  rule: string;
  quip: string;
  effects: Effect[];
  /** Applies to every hill rather than only its own. */
  empireWide?: boolean;
  /** Joins its hill's pool from this Appeal on (docs/hill-workshops-plan.md §9, How 7). */
  appeal?: number;
}

export interface WhisperDef extends DeviceDef {
  source: 'whisper';
  /** Shown the first time the condition is half met. */
  rumour: string;
}

export interface VisitorDef {
  id: string;
  siteId: string;
  name: string;
  /** Crew level at which the visitor arrives, once per run. */
  arrivesAt: number;
  greeting: string;
  bargains: [string, string];
}

const d = (def: DeviceDef): DeviceDef => def;

export const DEVICES: DeviceDef[] = [
  // ---------------------------------------------------------------- First Hill
  d({
    id: 'second_stone',
    siteId: 'first_hill',
    source: 'tablet',
    hint: 'Two can play at this.',
    name: 'A Second Stone',
    rule: 'A second stone rolls down the far side: impacts pay double.',
    quip: 'Gravity, finally on payroll.',
    effects: [{ kind: 'impact', factor: 2 }],
  }),
  d({
    id: 'autolycus_brand',
    siteId: 'first_hill',
    source: 'tablet',
    hint: 'Mark what\'s yours.',
    name: 'Autolycus\'s Brand',
    rule: 'Every fifth climb pays double.',
    quip: 'He only steals from worse security. Everyone has worse security.',
    effects: [{ kind: 'everyNth', every: 5, factor: 2 }],
  }),
  d({
    id: 'merope_olives',
    siteId: 'first_hill',
    source: 'tablet',
    hint: 'Someone packs your lunch.',
    name: 'Merope\'s Olives',
    rule: 'No return walk on this hill.',
    quip: 'She packed olives. She did not pack sympathy.',
    effects: [{ kind: 'noReturn' }],
  }),
  d({
    id: 'memorial_chains',
    siteId: 'first_hill',
    source: 'tablet',
    hint: 'Death took a week off.',
    name: 'Thanatos Memorial Chains',
    rule: 'The flywheel\'s boost is half again as strong.',
    quip: 'Commemorates the week nobody died. Thanatos declined to attend.',
    effects: [{ kind: 'flywheel', factor: 1.5 }],
  }),
  d({
    id: 'asopus_spring',
    siteId: 'first_hill',
    source: 'tablet',
    hint: 'Gossip has a price.',
    name: 'Asopus\'s Spring',
    rule: 'Descents take half as long.',
    quip: 'Paid for with gossip about Zeus. He is still upset.',
    effects: [{ kind: 'descent', factor: 0.5 }],
  }),
  d({
    id: 'isthmian_games',
    siteId: 'first_hill',
    source: 'tablet',
    hint: 'Corinth throws a party.',
    name: 'The Isthmian Games',
    rule: 'Every fiftieth climb is a festival climb worth ten.',
    quip: 'Athletes, crowds, olive wreaths. The stone is unimpressed.',
    effects: [{ kind: 'everyNth', every: 50, factor: 10 }],
  }),
  d({
    id: 'missing_funeral',
    siteId: 'first_hill',
    source: 'tablet',
    hint: 'Nobody buried him.',
    name: 'The Missing Funeral',
    rule: 'After Begin Again, the First Hill starts at crew 25.',
    quip: 'Technically still on leave from being dead.',
    effects: [{ kind: 'rebirth', crew: 25 }],
  }),
  d({
    id: 'acrocorinth_tours',
    siteId: 'first_hill',
    source: 'tablet',
    hint: 'Sell the view.',
    name: 'Acrocorinth Tours',
    rule: 'While you push by hand, each summit also pays a spectator fee.',
    quip: 'Tourists pay to watch. Sisyphus does not get a cut.',
    effects: [{ kind: 'spectator', share: 0.5 }],
  }),
  // Hermes's bargains
  d({
    id: 'express_delivery',
    siteId: 'first_hill',
    source: 'bargain',
    hint: 'He is in a hurry.',
    name: 'Express Delivery',
    rule: 'Climbs on the First Hill are half again as fast, for this run.',
    quip: 'Signed for by nobody. Delivered anyway.',
    effects: [{ kind: 'ascent', factor: 1.5 }],
  }),
  d({
    id: 'fell_off_a_cart',
    siteId: 'first_hill',
    source: 'bargain',
    hint: 'It fell off something.',
    name: 'Fell Off a Cart',
    rule: 'Coin amphorae are twice as common on every hill, for this run.',
    quip: 'Don\'t ask where they came from.',
    effects: [{ kind: 'amphorae', factor: 2 }],
    empireWide: true,
  }),
  // ---------------------------------------------------------------- Tartarus Rim
  d({
    id: 'hundred_handed_bellows',
    siteId: 'tartarus_rim',
    source: 'tablet',
    hint: 'More hands than sense.',
    name: 'Hundred-Handed Bellows',
    rule: 'An eruption does not drain while you hold Push on the rim.',
    quip: 'One hundred hands, fifty heads, zero union.',
    effects: [{ kind: 'furnaceHold' }],
  }),
  d({
    id: 'erinyes_whip',
    siteId: 'tartarus_rim',
    source: 'tablet',
    hint: 'Fear is a motivator.',
    name: 'Erinyes\' Whip',
    rule: 'The crew climbs faster the hotter the wheel: half again at full heat.',
    quip: 'Morale has never been higher. Nobody was asked.',
    effects: [{ kind: 'furnaceWhip', factor: 0.5 }],
  }),
  d({
    id: 'titans_shoe',
    siteId: 'tartarus_rim',
    source: 'tablet',
    hint: 'Poseidon built the gates.',
    name: 'Titan\'s Shoe',
    rule: 'No return walk while the wheel erupts.',
    quip: 'The gates of Tartarus, propped open with a Titan\'s shoe.',
    effects: [{ kind: 'furnaceNoReturn' }],
  }),
  d({
    id: 'asphodel_lagging',
    siteId: 'tartarus_rim',
    source: 'tablet',
    hint: 'Warmth, retained.',
    name: 'Asphodel Lagging',
    rule: 'After an eruption the wheel keeps a third of its heat.',
    quip: 'Insulated with flowers of the dead. Surprisingly effective.',
    effects: [{ kind: 'furnaceRetain', share: 1 / 3 }],
  }),
  d({
    id: 'kronos_timetable',
    siteId: 'tartarus_rim',
    source: 'tablet',
    hint: 'He is very punctual.',
    name: 'Kronos\'s Timetable',
    rule: 'Eruptions last half again as long.',
    quip: 'Ate his children to stop a prophecy. Never late for anything.',
    effects: [{ kind: 'furnaceDuration', factor: 1.5 }],
  }),
  d({
    id: 'ixion_complaint',
    siteId: 'tartarus_rim',
    source: 'tablet',
    hint: 'The wheel has opinions.',
    name: 'Ixion\'s Complaint',
    rule: 'Each eruption this run makes the wheel heat a little faster, up to double.',
    quip: 'He has asked to speak to the manager. He is the manager.',
    effects: [{ kind: 'furnaceGrowth', step: 0.05 }],
  }),
  d({
    id: 'hephaestus_tongs',
    siteId: 'tartarus_rim',
    source: 'tablet',
    hint: 'A lame god, a steady hand.',
    name: 'Hephaestus\'s Tongs',
    rule: 'Eruptions are a quarter stronger.',
    quip: 'Thrown off Olympus twice. Still makes the best tools up there.',
    effects: [{ kind: 'furnacePower', factor: 1.25 }],
  }),
  d({
    id: 'charons_fare',
    siteId: 'tartarus_rim',
    source: 'tablet',
    hint: 'Exact change only.',
    name: 'Charon\'s Fare',
    rule: 'Each eruption also pays a full climb\'s crew wage on the spot.',
    quip: 'One coin per soul. He takes Cinders, grudgingly.',
    effects: [{ kind: 'furnaceLump', share: 1 }],
  }),
  // Persephone's bargains
  d({
    id: 'six_seeds',
    siteId: 'tartarus_rim',
    source: 'bargain',
    hint: 'Six small seeds.',
    name: 'Six Seeds',
    rule: 'Six free crew levels on every hill you hold.',
    quip: 'She ate six and got six months. You get six levels. Fair.',
    effects: [{ kind: 'freeCrew', levels: 6 }],
  }),
  d({
    id: 'winter_terms',
    siteId: 'tartarus_rim',
    source: 'bargain',
    hint: 'The cold half of the year.',
    name: 'Winter Terms',
    rule: 'After an eruption the wheel never cools below half heat, for this run.',
    quip: 'Negotiated with Hades. He still thinks he won.',
    effects: [{ kind: 'furnaceFloor', heat: 0.5 }],
  }),
  // ---------------------------------------------------------------- Leaking Heights
  d({
    id: 'drill_more_holes',
    siteId: 'leaking_heights',
    source: 'tablet',
    hint: 'More is more.',
    name: 'Drill More Holes',
    rule: 'Drilling costs half as much, and each drill makes two holes.',
    quip: 'Counterintuitive. Also correct.',
    effects: [{ kind: 'jarDrillCost', factor: 0.5 }, { kind: 'jarDoubleDrill' }],
  }),
  d({
    id: 'hypermnestra_bucket',
    siteId: 'leaking_heights',
    source: 'tablet',
    hint: 'One daughter kept a clean record.',
    name: 'Hypermnestra\'s Bucket',
    rule: 'Water spilled while you are away is caught, and pays as if it had leaked.',
    quip: 'The only bucket without a hole. She is insufferable about it.',
    effects: [{ kind: 'jarSpillAway', share: 1 }],
  }),
  d({
    id: 'styx_water_rights',
    siteId: 'leaking_heights',
    source: 'tablet',
    hint: 'Oaths are binding here.',
    name: 'Styx Water Rights',
    rule: 'Each climb also pours Styx water, whatever the size of the crew.',
    quip: 'Binding on gods. So is the invoice.',
    effects: [{ kind: 'jarExtra', water: 0.03 }],
  }),
  d({
    id: 'lethe_irrigation',
    siteId: 'leaking_heights',
    source: 'tablet',
    hint: 'The accountants drank the wrong river.',
    name: 'Lethe Irrigation',
    rule: 'Half of any spilled water finds its way back into the jar.',
    quip: 'The jar forgot it overflowed. So did the accountants.',
    effects: [{ kind: 'jarReturn', share: 0.5 }],
  }),
  d({
    id: 'glazed_interior',
    siteId: 'leaking_heights',
    source: 'tablet',
    hint: 'Glaze the inside.',
    name: 'Glazed Interior',
    rule: 'Pressure counts from half the jar, not from empty.',
    quip: 'Painted inside and out. Leaks with dignity.',
    effects: [{ kind: 'jarGlaze', share: 0.5 }],
  }),
  d({
    id: 'full_bucket_brigade',
    siteId: 'leaking_heights',
    source: 'tablet',
    hint: 'Fifty daughters, fifty buckets.',
    name: 'The Full Bucket Brigade',
    rule: 'Each climb pours half again as much water.',
    quip: 'They have been doing this forever. It shows.',
    effects: [{ kind: 'jarInflow', factor: 1.5 }],
  }),
  d({
    id: 'naiad_overflow_wheel',
    siteId: 'leaking_heights',
    source: 'tablet',
    hint: 'A second wheel downstream.',
    name: 'Naiad Overflow Wheel',
    rule: 'Spilled water turns a second wheel, paying a quarter of a leak.',
    quip: 'Waste not, want not, leak anyway.',
    effects: [{ kind: 'jarSpillPay', share: 0.25 }],
  }),
  d({
    id: 'tidewater_lease',
    siteId: 'leaking_heights',
    source: 'tablet',
    hint: 'The sea owes you.',
    name: 'Tidewater Lease',
    rule: 'Inflow rises and falls by half with a slow tide. High water pays more.',
    quip: 'Poseidon charges by the wave.',
    effects: [{ kind: 'jarTide', amplitude: 0.5 }],
  }),
  // Poseidon's bargains
  d({
    id: 'earthshaker',
    siteId: 'leaking_heights',
    source: 'bargain',
    hint: 'The ground moves.',
    name: 'Earthshaker',
    rule: 'Inflow doubles, for this run.',
    quip: 'Every spring on the hill burst at once. You are welcome.',
    effects: [{ kind: 'jarInflow', factor: 2 }],
  }),
  d({
    id: 'calm_seas',
    siteId: 'leaking_heights',
    source: 'bargain',
    hint: 'Flat water.',
    name: 'Calm Seas',
    rule: 'Spilled water pays as if it had leaked, for this run.',
    quip: 'Nothing is wasted. Nothing is exciting either.',
    effects: [{ kind: 'jarSpillPay', share: 1 }],
  }),
  // ---------------------------------------------------------------- Bronze Pass (blueprints)
  d({
    id: 'self_walking_tripods',
    siteId: 'bronze_pass',
    source: 'tablet',
    hint: 'Three legs, no manners.',
    name: 'Self-Walking Tripods',
    rule: 'No return walk on the Bronze Pass.',
    quip: 'They wheel themselves to meetings. Nobody invited them.',
    effects: [{ kind: 'noReturn' }],
  }),
  d({
    id: 'talos_lap',
    siteId: 'bronze_pass',
    source: 'tablet',
    hint: 'An island, three times a day.',
    name: 'Talos\'s Lap',
    rule: 'The climb is a fifth faster.',
    quip: 'Great for cardio. Terrible for the coastline.',
    effects: [{ kind: 'ascent', factor: 1.2 }],
  }),
  d({
    id: 'hephaestus_net',
    siteId: 'bronze_pass',
    source: 'tablet',
    hint: 'It has caught worse.',
    name: 'Hephaestus\'s Net',
    rule: 'Every third climb here pays double.',
    quip: 'Last used on two gods in one bed.',
    effects: [{ kind: 'everyNth', every: 3, factor: 2 }],
  }),
  d({
    id: 'golden_gallery',
    siteId: 'bronze_pass',
    source: 'tablet',
    hint: 'Maidens build themselves.',
    name: 'The Golden Gallery',
    rule: 'Poured bronze also casts crew: a free level for every two levels\' price.',
    quip: 'They assembled each other. HR is concerned.',
    effects: [{ kind: 'foundryCrew', every: 2 }],
  }),
  d({
    id: 'alcinous_watchdogs',
    siteId: 'bronze_pass',
    source: 'tablet',
    hint: 'Bronze and silver dogs.',
    name: 'Alcinous\'s Watchdogs',
    rule: 'Each blueprint finished after this pays its bronze back as Ingots.',
    quip: 'Guard dogs that never sleep, never eat, never fetch.',
    effects: [{ kind: 'foundryRefund', share: 1 }],
  }),
  d({
    id: 'ichor_inspection',
    siteId: 'bronze_pass',
    source: 'tablet',
    hint: 'Check the ankle.',
    name: 'Ichor Seal Inspection',
    rule: 'Impacts here pay double.',
    quip: 'Passed. Everyone relax.',
    effects: [{ kind: 'impact', factor: 2 }],
  }),
  d({
    id: 'shield_commission',
    siteId: 'bronze_pass',
    source: 'tablet',
    hint: 'Engrave the whole world.',
    name: 'The Shield Commission',
    rule: 'The crew here earn a quarter more.',
    quip: 'Achilles will be furious.',
    effects: [{ kind: 'crew', factor: 1.25 }],
  }),
  d({
    id: 'hephaestus_warranty',
    siteId: 'bronze_pass',
    source: 'tablet',
    hint: 'Thrown off Olympus once.',
    name: 'Hephaestus\'s Warranty',
    rule: 'Blueprints need a third less bronze.',
    quip: 'Very particular about returns. Understandably.',
    effects: [{ kind: 'foundrySize', factor: 2 / 3 }],
  }),
  // Hephaestus's bargains
  d({
    id: 'rush_job',
    siteId: 'bronze_pass',
    source: 'bargain',
    hint: 'Needed it yesterday.',
    name: 'Rush Job',
    rule: 'Blueprints need half the bronze, for this run.',
    quip: 'Finished early. Please do not lean on it.',
    effects: [{ kind: 'foundrySize', factor: 0.5 }],
  }),
  d({
    id: 'masterwork',
    siteId: 'bronze_pass',
    source: 'bargain',
    hint: 'Take your time.',
    name: 'Masterwork',
    rule: 'Each Ingot poured makes twice the bronze, for this run.',
    quip: 'He hammered it for a week. It is a very good pot.',
    effects: [{ kind: 'foundryPour', factor: 2 }],
  }),
  // ---------------------------------------------------------------- Skyward Escarpment (constellations)
  d({
    id: 'orion',
    siteId: 'skyward_escarpment',
    source: 'tablet',
    hint: 'A hunter with a belt.',
    name: 'Orion',
    rule: 'While overhead: climbs twice as fast.',
    quip: 'Belt. Drive. The astronomers are furious.',
    effects: [{ kind: 'ascent', factor: 2 }],
  }),
  d({
    id: 'pleiades',
    siteId: 'skyward_escarpment',
    source: 'tablet',
    hint: 'Seven sisters.',
    name: 'The Pleiades',
    rule: 'While overhead: the crew earn double.',
    quip: 'Six of them are visible. The seventh married Sisyphus.',
    effects: [{ kind: 'crew', factor: 2 }],
  }),
  d({
    id: 'draco',
    siteId: 'skyward_escarpment',
    source: 'tablet',
    hint: 'The orchard\'s guard.',
    name: 'Draco',
    rule: 'While overhead: the fall takes half as long.',
    quip: 'Guards golden apples. Now guards your margins.',
    effects: [{ kind: 'descent', factor: 0.5 }],
  }),
  d({
    id: 'ursa_major',
    siteId: 'skyward_escarpment',
    source: 'tablet',
    hint: 'A bear, briefly a nymph.',
    name: 'Ursa Major',
    rule: 'While overhead: impacts pay triple.',
    quip: 'Hera\'s doing. Everything is Hera\'s doing.',
    effects: [{ kind: 'impact', factor: 3 }],
  }),
  d({
    id: 'lyra',
    siteId: 'skyward_escarpment',
    source: 'tablet',
    hint: 'A lyre in the sky.',
    name: 'Lyra',
    rule: 'While overhead: no return walk.',
    quip: 'The crew works to music. The music is one note.',
    effects: [{ kind: 'noReturn' }],
  }),
  d({
    id: 'pegasus',
    siteId: 'skyward_escarpment',
    source: 'tablet',
    hint: 'Winged, unbothered.',
    name: 'Pegasus',
    rule: 'While overhead: every other climb pays triple.',
    quip: 'Faster than walking. Harder to insure.',
    effects: [{ kind: 'everyNth', every: 2, factor: 3 }],
  }),
  d({
    id: 'aquila',
    siteId: 'skyward_escarpment',
    source: 'tablet',
    hint: 'Zeus\'s courier bird.',
    name: 'Aquila',
    rule: 'While overhead: climbs half again as fast, and the crew earn half again.',
    quip: 'Carries thunderbolts and memos. Mostly memos.',
    effects: [{ kind: 'ascent', factor: 1.5 }, { kind: 'crew', factor: 1.5 }],
  }),
  d({
    id: 'argo',
    siteId: 'skyward_escarpment',
    source: 'tablet',
    hint: 'A ship of heroes.',
    name: 'Argo',
    rule: 'While overhead: the crew earn double and impacts pay double.',
    quip: 'Fifty heroes, one boat, no seating chart.',
    effects: [{ kind: 'crew', factor: 2 }, { kind: 'impact', factor: 2 }],
  }),
  // Helios's bargains
  d({
    id: 'phaethon_drives',
    siteId: 'skyward_escarpment',
    source: 'bargain',
    hint: 'The boy wants a go.',
    name: 'Let Phaethon Drive',
    rule: 'The sky turns twice as fast, for this run.',
    quip: 'He has had one lesson. The desert was a meadow before it.',
    effects: [{ kind: 'skySpeed', factor: 2 }],
  }),
  d({
    id: 'selene_night_rate',
    siteId: 'skyward_escarpment',
    source: 'bargain',
    hint: 'His sister works nights.',
    name: 'Selene\'s Night Rate',
    rule: 'While you are away, a mounted house overhead stays overhead, for this run.',
    quip: 'She parks the Moon on your best house. Cash only.',
    effects: [{ kind: 'skyNight' }],
  }),
  // ---------------------------------------------------------------- Olympian Approach
  d({
    id: 'thunderbolt_stamp',
    siteId: 'olympian_approach',
    source: 'tablet',
    hint: 'Approval, instantly.',
    name: 'Thunderbolt Rubber Stamp',
    rule: 'One form each climb is approved without a clerk.',
    quip: 'Approval is instant. So is the smell of ozone.',
    effects: [{ kind: 'bureauFree', forms: 1 }],
  }),
  d({
    id: 'hera_signature',
    siteId: 'olympian_approach',
    source: 'tablet',
    hint: 'Hera must sign.',
    name: 'Hera\'s Signature (Forged)',
    rule: 'Late fees accrue twice as fast.',
    quip: 'Required, unavailable, and expertly forged by Hermes.',
    effects: [{ kind: 'bureauFee', factor: 2 }],
  }),
  d({
    id: 'statute_amended',
    siteId: 'olympian_approach',
    source: 'tablet',
    hint: 'The statute is flexible.',
    name: 'Statute, Amended',
    rule: 'The statute of limitations runs half again as long.',
    quip: 'Amended retroactively. That is allowed up here.',
    effects: [{ kind: 'bureauCap', factor: 1.5 }],
  }),
  d({
    id: 'ganymede_coffee',
    siteId: 'olympian_approach',
    source: 'tablet',
    hint: 'Someone pours the nectar.',
    name: 'Ganymede\'s Coffee Service',
    rule: 'Clerks work half again as fast.',
    quip: 'It is nectar. It has been relabelled coffee for morale.',
    effects: [{ kind: 'bureauSpeed', factor: 1.5 }],
  }),
  d({
    id: 'hermes_filing',
    siteId: 'olympian_approach',
    source: 'tablet',
    hint: 'Mail from the provinces.',
    name: 'Hermes\'s Filing System',
    rule: 'Each summit files half again as many forms.',
    quip: 'Delivered overnight. Opened eventually.',
    effects: [{ kind: 'bureauFiling', factor: 1.5 }],
  }),
  d({
    id: 'themis_scales',
    siteId: 'olympian_approach',
    source: 'tablet',
    hint: 'Balance in all things.',
    name: 'Themis\'s Scales',
    rule: 'Due Process counts every milestone twice.',
    quip: 'The goddess of divine order. She is behind on filing.',
    effects: [{ kind: 'dueProcess', factor: 2 }],
  }),
  d({
    id: 'moirai_schedule',
    siteId: 'olympian_approach',
    source: 'tablet',
    hint: 'They know the ending.',
    name: 'The Moirai\'s Schedule',
    rule: 'Clerks cost half as much.',
    quip: 'Spoiler: it is paperwork all the way down.',
    effects: [{ kind: 'bureauClerkCost', factor: 0.5 }],
  }),
  d({
    id: 'notarised_notary',
    siteId: 'olympian_approach',
    source: 'tablet',
    hint: 'Stamp the stamp.',
    name: 'Notarised Notary',
    rule: 'Edicts last twice as long.',
    quip: 'Certified that the certificate is certified.',
    effects: [{ kind: 'edictLength', factor: 2 }],
  }),
  // Nemesis's bargains
  d({
    id: 'due_retribution',
    siteId: 'olympian_approach',
    source: 'bargain',
    hint: 'What is owed.',
    name: 'Due Retribution',
    rule: 'Late fees accrue twice as fast, for this run.',
    quip: 'Olympus pays. Olympus is not happy about it.',
    effects: [{ kind: 'bureauFee', factor: 2 }],
  }),
  d({
    id: 'balanced_books',
    siteId: 'olympian_approach',
    source: 'bargain',
    hint: 'Even columns.',
    name: 'Balanced Books',
    rule: 'Clerks work twice as fast, for this run.',
    quip: 'Every column adds up. Nobody believes it.',
    effects: [{ kind: 'bureauSpeed', factor: 2 }],
  }),
  // ---------------------------------------------------------------- Appeals: one more tablet per hill, per Appeal
  d({
    id: 'glaucus_stables',
    siteId: 'first_hill',
    source: 'tablet',
    appeal: 1,
    hint: 'Horses with a past.',
    name: 'Glaucus\'s Stables',
    rule: 'Every fifth climb pays triple.',
    quip: 'Glaucus\'s mares ate their master. These are on a strict oat diet.',
    effects: [{ kind: 'everyNth', every: 5, factor: 3 }],
  }),
  d({
    id: 'bellerophon_saddle',
    siteId: 'first_hill',
    source: 'tablet',
    appeal: 2,
    hint: 'A family heirloom.',
    name: 'Bellerophon\'s Saddle',
    rule: 'Ascents take a fifth less time.',
    quip: 'The grandson flew too high. The saddle came back fine.',
    effects: [{ kind: 'ascent', factor: 0.8 }],
  }),
  d({
    id: 'ephyra_charter',
    siteId: 'first_hill',
    source: 'tablet',
    appeal: 3,
    hint: 'The city had another name.',
    name: 'The Ephyra Charter',
    rule: 'The crew earns a quarter more.',
    quip: 'Corinth was Ephyra before it was famous. So was the paperwork.',
    effects: [{ kind: 'crew', factor: 1.25 }],
  }),
  d({
    id: 'diolkos_rails',
    siteId: 'first_hill',
    source: 'tablet',
    appeal: 4,
    hint: 'Ships crossed here by land.',
    name: 'The Diolkos',
    rule: 'Descents take a quarter less time.',
    quip: 'Corinth dragged whole ships across the isthmus. A boulder is a warm-up.',
    effects: [{ kind: 'descent', factor: 0.75 }],
  }),
  d({
    id: 'cerberus_breath',
    siteId: 'tartarus_rim',
    source: 'tablet',
    appeal: 1,
    hint: 'Three heads, three lungs.',
    name: 'Cerberus\'s Breath',
    rule: 'Eruptions pay a fifth more.',
    quip: 'Three heads, one job: breathe on the coals. He is a very good boy.',
    effects: [{ kind: 'furnacePower', factor: 1.2 }],
  }),
  d({
    id: 'cocytus_coolant',
    siteId: 'tartarus_rim',
    source: 'tablet',
    appeal: 2,
    hint: 'A river that complains.',
    name: 'Cocytus Coolant',
    rule: 'Eruptions last half again as long.',
    quip: 'The river of wailing, piped in as coolant. It wails the whole way.',
    effects: [{ kind: 'furnaceDuration', factor: 1.5 }],
  }),
  d({
    id: 'nyx_night_shift',
    siteId: 'tartarus_rim',
    source: 'tablet',
    appeal: 3,
    hint: 'Someone works the dark.',
    name: 'Nyx\'s Night Shift',
    rule: 'The wheel never cools below a fifth.',
    quip: 'Nyx takes the night shift. Nobody dares tell her it is over.',
    effects: [{ kind: 'furnaceFloor', heat: 0.2 }],
  }),
  d({
    id: 'hecate_crossroads',
    siteId: 'tartarus_rim',
    source: 'tablet',
    appeal: 4,
    hint: 'Three roads meet.',
    name: 'Hecate\'s Crossroads',
    rule: 'A vent keeps a quarter of its heat.',
    quip: 'Hecate stands where three roads meet. All three lead back to the wheel.',
    effects: [{ kind: 'furnaceRetain', share: 0.25 }],
  }),
  d({
    id: 'amymone_spring',
    siteId: 'leaking_heights',
    source: 'tablet',
    appeal: 1,
    hint: 'A spring, found by a sister.',
    name: 'Amymone\'s Spring',
    rule: 'The jar fills half again as fast.',
    quip: 'Amymone found a spring at Lerna. The jar is thrilled. It is still not full.',
    effects: [{ kind: 'jarInflow', factor: 1.5 }],
  }),
  d({
    id: 'thirsty_argos',
    siteId: 'leaking_heights',
    source: 'tablet',
    appeal: 2,
    hint: 'A city famous for thirst.',
    name: 'Very Thirsty Argos',
    rule: 'Spilled water pays a quarter.',
    quip: 'Homer called Argos very thirsty. It has not changed its mind.',
    effects: [{ kind: 'jarSpillPay', share: 0.25 }],
  }),
  d({
    id: 'danaus_ledger',
    siteId: 'leaking_heights',
    source: 'tablet',
    appeal: 3,
    hint: 'Every hole, accounted for.',
    name: 'Danaus\'s Ledger',
    rule: 'Drilling costs half as much.',
    quip: 'Danaus audits every hole in person. He has fifty daughters to help.',
    effects: [{ kind: 'jarDrillCost', factor: 0.5 }],
  }),
  d({
    id: 'oceanus_tap',
    siteId: 'leaking_heights',
    source: 'tablet',
    appeal: 4,
    hint: 'The river around the world.',
    name: 'Oceanus\'s Tap',
    rule: 'The leak pays 15 percent more.',
    quip: 'Oceanus circles the whole world. He can spare a little for one jar.',
    effects: [{ kind: 'jarPower', factor: 1.15 }],
  }),
  d({
    id: 'brontes_anvil',
    siteId: 'bronze_pass',
    source: 'tablet',
    appeal: 1,
    hint: 'Thunder, hammered flat.',
    name: 'Brontes\'s Anvil',
    rule: 'Blueprints need a fifth less bronze.',
    quip: 'Brontes forged thunderbolts. He finds tripods relaxing.',
    effects: [{ kind: 'foundrySize', factor: 0.8 }],
  }),
  d({
    id: 'kabeiroi_crew',
    siteId: 'bronze_pass',
    source: 'tablet',
    appeal: 2,
    hint: 'The smith has sons.',
    name: 'The Kabeiroi',
    rule: 'Poured pay counts a quarter more toward the mould.',
    quip: 'Hephaestus\'s sons work the bellows. They were told it was a game.',
    effects: [{ kind: 'foundryPour', factor: 1.25 }],
  }),
  d({
    id: 'lemnos_smelter',
    siteId: 'bronze_pass',
    source: 'tablet',
    appeal: 3,
    hint: 'An island that caught a god.',
    name: 'The Lemnos Smelter',
    rule: 'Each cast blueprint refunds a tenth of its bronze.',
    quip: 'Hephaestus landed on Lemnos after a long fall. He stayed for the smelting.',
    effects: [{ kind: 'foundryRefund', share: 0.1 }],
  }),
  d({
    id: 'pandora_mould',
    siteId: 'bronze_pass',
    source: 'tablet',
    appeal: 4,
    hint: 'Made from clay, first.',
    name: 'Pandora\'s Mould',
    rule: 'Every fourth blueprint casts a crew level.',
    quip: 'The first mould Hephaestus made was for a person. This one is for bronze.',
    effects: [{ kind: 'foundryCrew', every: 4 }],
  }),
  d({
    id: 'cassiopeia',
    siteId: 'skyward_escarpment',
    source: 'tablet',
    appeal: 1,
    hint: 'A queen on a throne.',
    name: 'Cassiopeia',
    rule: 'Ascents take a fifth less time.',
    quip: 'She spends half the night upside down on her throne. Relatable.',
    effects: [{ kind: 'ascent', factor: 0.8 }],
  }),
  d({
    id: 'andromeda',
    siteId: 'skyward_escarpment',
    source: 'tablet',
    appeal: 2,
    hint: 'Chained, then saved.',
    name: 'Andromeda',
    rule: 'Impacts pay half again.',
    quip: 'Rescued from a rock and set in the sky, still quite near the rock.',
    effects: [{ kind: 'impact', factor: 1.5 }],
  }),
  d({
    id: 'perseus',
    siteId: 'skyward_escarpment',
    source: 'tablet',
    appeal: 3,
    hint: 'A hero with a bag.',
    name: 'Perseus',
    rule: 'Descents take a third less time.',
    quip: 'He carries a head in one hand. Nobody asks. Nobody wants to know.',
    effects: [{ kind: 'descent', factor: 0.67 }],
  }),
  d({
    id: 'cygnus',
    siteId: 'skyward_escarpment',
    source: 'tablet',
    appeal: 4,
    hint: 'Wings over the river of stars.',
    name: 'Cygnus',
    rule: 'The crew earns half again.',
    quip: 'Zeus as a swan, again. The sky is mostly his disguises.',
    effects: [{ kind: 'crew', factor: 1.5 }],
  }),
  d({
    id: 'iris_courier',
    siteId: 'olympian_approach',
    source: 'tablet',
    appeal: 1,
    hint: 'Delivered by rainbow.',
    name: 'Iris\'s Courier Service',
    rule: 'Two forms each climb are approved without a clerk.',
    quip: 'Iris delivers by rainbow. Signature on arrival, any colour.',
    effects: [{ kind: 'bureauFree', forms: 2 }],
  }),
  d({
    id: 'mnemosyne_reminders',
    siteId: 'olympian_approach',
    source: 'tablet',
    appeal: 2,
    hint: 'She remembers everything.',
    name: 'Mnemosyne\'s Reminders',
    rule: 'Late fees accrue half again as fast.',
    quip: 'Mnemosyne remembers every late form. She has sent reminders.',
    effects: [{ kind: 'bureauFee', factor: 1.5 }],
  }),
  d({
    id: 'hestia_hearth',
    siteId: 'olympian_approach',
    source: 'tablet',
    appeal: 3,
    hint: 'Someone keeps the fire.',
    name: 'Hestia\'s Hearth',
    rule: 'Clerks cost a third less.',
    quip: 'Hestia keeps the fire going. The clerks stay late for the warmth.',
    effects: [{ kind: 'bureauClerkCost', factor: 0.67 }],
  }),
  d({
    id: 'dike_docket',
    siteId: 'olympian_approach',
    source: 'tablet',
    appeal: 4,
    hint: 'Justice keeps a list.',
    name: 'Dike\'s Docket',
    rule: 'Edicts last half again as long.',
    quip: 'Dike keeps the docket. Zeus keeps adding to it.',
    effects: [{ kind: 'edictLength', factor: 1.5 }],
  }),
];

/** Remembrances: five Insight ranks per hill, each deepening its machine in every run. */
export interface RemembranceDef {
  siteId: string;
  name: string;
  /** What one rank does. */
  rule: string;
  effect: Effect;
}

export const REMEMBRANCES: RemembranceDef[] = [
  { siteId: 'first_hill', name: 'The Flywheel Remembers', rule: 'The flywheel pays a tenth more.', effect: { kind: 'flywheel', factor: 1.1 } },
  { siteId: 'tartarus_rim', name: 'Hotter Coals', rule: 'Eruptions pay 8 percent more.', effect: { kind: 'furnacePower', factor: 1.08 } },
  { siteId: 'leaking_heights', name: 'A Steadier Jar', rule: 'The leak pays 8 percent more.', effect: { kind: 'jarPower', factor: 1.08 } },
  { siteId: 'bronze_pass', name: 'Worn Moulds', rule: 'Blueprints need 15 percent less bronze.', effect: { kind: 'foundrySize', factor: 0.85 } },
  { siteId: 'skyward_escarpment', name: 'Atlas\'s Shoulders', rule: 'Atlas rests 15 percent less between turns.', effect: { kind: 'skyCooldown', factor: 0.85 } },
  { siteId: 'olympian_approach', name: 'Practised Clerks', rule: 'Clerks work 15 percent faster.', effect: { kind: 'bureauSpeed', factor: 1.15 } },
];

export function remembranceFor(siteId: string): RemembranceDef | undefined {
  return REMEMBRANCES.find((r) => r.siteId === siteId);
}

/** Thanatos's Appeals: the same hills, gates far higher, and one rule twist each. */
export interface AppealDef {
  name: string;
  rule: string;
  effects: Effect[];
}

export const APPEALS: AppealDef[] = [
  { name: 'The Stone Is Weighed Again', rule: 'Ascents take a third longer; impacts pay half again.', effects: [{ kind: 'ascent', factor: 1.33 }, { kind: 'impact', factor: 1.5 }] },
  { name: 'No Walking Back', rule: 'No return walks, but descents take twice as long.', effects: [{ kind: 'noReturn' }, { kind: 'descent', factor: 2 }] },
  { name: 'The Sky Turns Backwards', rule: 'The Orrery runs in reverse; houses rise the other way.', effects: [{ kind: 'skyBackwards' }] },
  { name: 'Drought on the Heights', rule: 'The jar fills 40 percent slower; its leak pays 40 percent more.', effects: [{ kind: 'jarInflow', factor: 0.6 }, { kind: 'jarPower', factor: 1.4 }] },
  { name: 'Bronze Rationing', rule: 'Blueprints need half again the bronze; each refunds a fifth.', effects: [{ kind: 'foundrySize', factor: 1.5 }, { kind: 'foundryRefund', share: 0.2 }] },
  { name: 'The Rim Runs Cold', rule: 'Eruptions pay a fifth less but last half again as long.', effects: [{ kind: 'furnacePower', factor: 0.8 }, { kind: 'furnaceDuration', factor: 1.5 }] },
  { name: 'Paper Storm', rule: 'Twice the forms are filed; clerks work a quarter slower.', effects: [{ kind: 'bureauFiling', factor: 2 }, { kind: 'bureauSpeed', factor: 0.75 }] },
  { name: 'Gravity Audit', rule: 'Falls take half as long; ascents take a quarter longer.', effects: [{ kind: 'descent', factor: 0.5 }, { kind: 'ascent', factor: 1.25 }] },
  { name: 'Crowded Hills', rule: 'Crews earn 30 percent less; every third climb pays double.', effects: [{ kind: 'crew', factor: 0.7 }, { kind: 'everyNth', every: 3, factor: 2 }] },
  { name: 'The Final Hearing', rule: 'Ascents take a fifth longer, crews earn a tenth less, impacts pay 40 percent more.', effects: [{ kind: 'ascent', factor: 1.2 }, { kind: 'crew', factor: 0.9 }, { kind: 'impact', factor: 1.4 }] },
];

/** The twist of Appeal `n` (1-based; after the tenth they come round again). */
export function appealDef(n: number): AppealDef | null {
  return n > 0 ? APPEALS[(n - 1) % APPEALS.length] : null;
}

/** Zeus's rulings: one at a time, for the whole empire, online only. */
export interface EdictDef {
  id: string;
  name: string;
  rule: string;
  effects: Effect[];
}

export const EDICTS: EdictDef[] = [
  { id: 'gravity_reform', name: 'Gravity Reform', rule: 'Falls take half as long, everywhere.', effects: [{ kind: 'descent', factor: 0.5 }] },
  { id: 'holiday', name: 'Holiday', rule: 'No return walks, everywhere.', effects: [{ kind: 'noReturn' }] },
  { id: 'festival_of_dionysus', name: 'Festival of Dionysus', rule: 'Every crew earns half again.', effects: [{ kind: 'crew', factor: 1.5 }] },
  { id: 'census', name: 'Census', rule: 'Due Process counts every milestone twice.', effects: [{ kind: 'dueProcess', factor: 2 }] },
  { id: 'tax_rebate', name: 'Tax Rebate', rule: 'Impacts pay double, everywhere.', effects: [{ kind: 'impact', factor: 2 }] },
];

export const WHISPERS: WhisperDef[] = [
  {
    id: 'calluses_of_legend',
    siteId: 'first_hill',
    source: 'whisper',
    hint: 'A thousand summits by hand.',
    rumour: 'The stone seems to know your hands by now.',
    name: 'Calluses of Legend',
    rule: 'Climbs on the First Hill are a tenth faster, in every run.',
    quip: 'It\'s grown attached. Nobody is comfortable with this.',
    effects: [{ kind: 'ascent', factor: 1.1 }],
  },
  {
    id: 'takes_five',
    siteId: 'first_hill',
    source: 'whisper',
    hint: 'Ten quiet minutes.',
    rumour: 'Someone should sit down for a while. A proper while.',
    name: 'Sisyphus Takes Five',
    rule: 'The First Hill crew earns a tenth more, in every run.',
    quip: 'He sat. The stone sat. Nobody moved for a while.',
    effects: [{ kind: 'crew', factor: 1.1 }],
  },
  {
    id: 'out_of_sight',
    siteId: 'tartarus_rim',
    source: 'whisper',
    hint: 'An hour without looking.',
    rumour: 'The Furies keep glancing at the door.',
    name: 'Out of Sight',
    rule: 'After an hour away, the wheel greets you with a full eruption, half again as strong.',
    quip: 'The Furies grew fonder in your absence.',
    effects: [{ kind: 'furnaceWelcome' }],
  },
  {
    id: 'by_the_book',
    siteId: 'tartarus_rim',
    source: 'whisper',
    hint: 'Twenty full-heat eruptions.',
    rumour: 'Ixion has started keeping count. Out loud.',
    name: 'By the Book',
    rule: 'Eruptions on the Tartarus Rim are a tenth stronger, in every run.',
    quip: 'Ixion files a complaint about each one. In triplicate.',
    effects: [{ kind: 'furnacePower', factor: 1.1 }],
  },
  {
    id: 'almost_full',
    siteId: 'leaking_heights',
    source: 'whisper',
    hint: 'A hundred climbs at the brim.',
    rumour: 'The Danaids have started to look hopeful.',
    name: 'Almost Full',
    rule: 'The jar pays a tenth more, in every run.',
    quip: 'Almost.',
    effects: [{ kind: 'jarPower', factor: 1.1 }],
  },
  {
    id: 'shes_using_that_one',
    siteId: 'leaking_heights',
    source: 'whisper',
    hint: 'Leave her one.',
    rumour: 'A Danaid is guarding one hole very closely.',
    name: 'She\'s Using That One',
    rule: 'Drilling costs a quarter less, in every run.',
    quip: 'You tried to patch the last hole. Fifty daughters looked up at once.',
    effects: [{ kind: 'jarDrillCost', factor: 0.75 }],
  },
  {
    id: 'perpetual_motion',
    siteId: 'bronze_pass',
    source: 'whisper',
    hint: 'Three blueprints, nothing sold.',
    rumour: 'The Golden Maidens have stopped asking about wages.',
    name: 'Perpetual Motion (Pending Review)',
    rule: 'Blueprints need a tenth less bronze, in every run.',
    quip: 'Submitted to the Olympian patent office. Queue number: eternity.',
    effects: [{ kind: 'foundrySize', factor: 0.9 }],
  },
  {
    id: 'fair_and_balanced',
    siteId: 'bronze_pass',
    source: 'whisper',
    hint: 'Half and half, a hundred times.',
    rumour: 'Talos has been seen weighing things. Carefully.',
    name: 'Fair and Balanced',
    rule: 'Each Ingot poured makes a tenth more bronze, in every run.',
    quip: 'Exactly half. Talos checked twice, then once more.',
    effects: [{ kind: 'foundryPour', factor: 1.1 }],
  },
  {
    id: 'wished_on_a_star',
    siteId: 'skyward_escarpment',
    source: 'whisper',
    hint: 'Push as three stars rise.',
    rumour: 'One of the Pleiades says she saw you looking up.',
    name: 'Wished on a Star',
    rule: 'The crew here earn a tenth more, in every run.',
    quip: 'You wished for an easier hill. Denied, but noted.',
    effects: [{ kind: 'crew', factor: 1.1 }],
  },
  {
    id: 'atlas_complaint',
    siteId: 'skyward_escarpment',
    source: 'whisper',
    hint: 'A hundred turns of the sky.',
    rumour: 'Atlas has asked for a form. Any form.',
    name: 'Atlas Files a Complaint',
    rule: 'Atlas rests half as long between turns, in every run.',
    quip: 'Filed in triplicate. The Bureau has lost two copies already.',
    effects: [{ kind: 'skyCooldown', factor: 0.5 }],
  },
  {
    id: 'form_one',
    siteId: 'olympian_approach',
    source: 'whisper',
    hint: 'Every seal on every other hill.',
    rumour: 'A clerk has been sent to find the right form. It is Form 1.',
    name: 'Form 1: Application to Stop Pushing',
    rule: 'Late fees accrue a fifth faster, in every run.',
    quip: 'Denied.',
    effects: [{ kind: 'bureauFee', factor: 1.2 }],
  },
  {
    id: 'nemesis_notices',
    siteId: 'olympian_approach',
    source: 'whisper',
    hint: 'A hundred climbs, nothing approved.',
    rumour: 'Somebody has started keeping a list of idle clerks.',
    name: 'Nemesis Notices',
    rule: 'The statute of limitations runs a fifth longer, in every run.',
    quip: 'She has written your name down. Neatly.',
    effects: [{ kind: 'bureauCap', factor: 1.2 }],
  },
];

export const VISITORS: VisitorDef[] = [
  {
    id: 'hermes',
    siteId: 'first_hill',
    name: 'Hermes',
    arrivesAt: 25,
    greeting: 'Hermes is at the gate with two sealed parcels. He will leave one.',
    bargains: ['express_delivery', 'fell_off_a_cart'],
  },
  {
    id: 'persephone',
    siteId: 'tartarus_rim',
    name: 'Persephone',
    arrivesAt: 25,
    greeting: 'Persephone is up for the season, with two sealed jars. She will leave one.',
    bargains: ['six_seeds', 'winter_terms'],
  },
  {
    id: 'poseidon',
    siteId: 'leaking_heights',
    name: 'Poseidon',
    arrivesAt: 25,
    greeting: 'Poseidon has come up the hill, dripping, with two sealed amphorae. He will leave one.',
    bargains: ['earthshaker', 'calm_seas'],
  },
  {
    id: 'hephaestus',
    siteId: 'bronze_pass',
    name: 'Hephaestus',
    arrivesAt: 25,
    greeting: 'Hephaestus has limped up the pass with two sealed moulds. He will leave one.',
    bargains: ['rush_job', 'masterwork'],
  },
  {
    id: 'helios',
    siteId: 'skyward_escarpment',
    name: 'Helios',
    arrivesAt: 25,
    greeting: 'Helios has parked the sun on the ridge with two sealed offers. He will leave one.',
    bargains: ['phaethon_drives', 'selene_night_rate'],
  },
  {
    id: 'nemesis',
    siteId: 'olympian_approach',
    name: 'Nemesis',
    arrivesAt: 25,
    greeting: 'Nemesis has come to audit the Mill, with two sealed rulings. She will leave one.',
    bargains: ['due_retribution', 'balanced_books'],
  },
];

/** Manual summits that hear Calluses of Legend. */
export const CALLUSES_SUMMITS = 1000;
/** Seconds paused that hear Sisyphus Takes Five. */
export const TAKES_FIVE_SECONDS = 600;
/** Seconds away that hear Out of Sight. */
export const OUT_OF_SIGHT_SECONDS = 3600;
/** Full-heat eruptions (over all runs) that hear By the Book. */
export const BY_THE_BOOK_ERUPTIONS = 20;
/** Pours in a row near the brim, without a spill, that hear Almost Full. */
export const ALMOST_FULL_CLIMBS = 100;
/** Blueprints in a row, nothing sold, that hear Perpetual Motion. */
export const PERPETUAL_MOTION_BLUEPRINTS = 3;
/** Climbs in a row at exactly half-and-half that hear Fair and Balanced. */
export const FAIR_AND_BALANCED_CLIMBS = 100;
/** Mounted houses in a row that must rise while you push, for Wished on a Star. */
export const WISHED_ON_A_STAR_HOUSES = 3;
/** Turns of the sky (over all runs) that hear Atlas Files a Complaint. */
export const ATLAS_COMPLAINT_TURNS = 100;
/** Climbs in a row with nothing approved that hear Nemesis Notices. */
export const NEMESIS_IDLE_CLIMBS = 100;

const BY_ID = new Map<string, DeviceDef>([...DEVICES, ...WHISPERS].map((x) => [x.id, x]));

export function deviceDef(id: string): DeviceDef {
  const def = BY_ID.get(id);
  if (!def) throw new Error(`Unknown device ${id}`);
  return def;
}

export function isDevice(id: string): boolean {
  return BY_ID.has(id);
}

/** The tablets a hill can deal (not whispers or bargains). */
/** A hill's tablets; `appeal` limits it to those in the pool by that Appeal (all by default). */
export function tabletPool(siteId: string, appeal = Infinity): DeviceDef[] {
  return DEVICES.filter((x) => x.siteId === siteId && x.source === 'tablet' && (x.appeal ?? 0) <= appeal);
}

export function visitorFor(siteId: string): VisitorDef | undefined {
  return VISITORS.find((v) => v.siteId === siteId);
}
