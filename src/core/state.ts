import { Money } from './money';

export const SCHEMA_VERSION = 12;

/** `slipping`: during the prelude the stone rolls back from where grip gave out. */
export type Phase = 'ascending' | 'descending' | 'returning' | 'slipping';

/** Payout fixed when a cycle begins (spec §01 "snapshotted"). */
export interface CycleSnapshot {
  summit: Money;
  impact: Money;
  bonus: Money;
  bonusTargetId: string;
  summitGranted: boolean;
  impactGranted: boolean;
  /** Height (0..1) the stone slipped from; meaningful only while slipping. */
  slipHeight: number;
}

/** The hill's manager once the player has moved on (see docs/hill-workshops-plan.md §2). */
export interface StewardState {
  /** Standing order: reinvest the hill's purse in its own improvements. */
  reinvest: boolean;
  /** Hired with the hill's money, or early with Insight. */
  paidWith: 'local' | 'insight';
}

export interface SiteState {
  id: string;
  /** This hill's own money. Income lands here and is spent only here. */
  purse: Money;
  /** Gross earned on this hill this run, in its currency (issues the next decree). */
  gross: Money;
  steward: StewardState | null;
  productionLevel: number;
  strengthLevel: number;
  impactLevel: number;
  wheelOwned: boolean;
  wheelCharged: boolean;
  /** First Hill machine: stones in the counterweight basket, or null before it is installed. */
  counterweight: number | null;
  /** Tartarus Rim machine: Ixion's Wheel. Null on every other hill. */
  furnace: FurnaceState | null;
  /** Leaking Heights machine: the Danaids' jar. Null on every other hill. */
  jar: JarState | null;
  /** Bronze Pass machine: the Foundry. Null on every other hill. */
  foundry: FoundryState | null;
  /** Skyward Escarpment machine: the Orrery. Null on every other hill. */
  sky: SkyState | null;
  /** Olympian Approach machine: the Paperwork Mill. Null on every other hill. */
  bureau: BureauState | null;
  /** This run's dealt tablets, in order (device ids). Fixed when the hill opens. */
  hand: string[];
  /** Devices working here this run: broken seals and the visitor's bargain. */
  devices: string[];
  /** Sealed tablets read in advance this run (Insight): their rule shows before the seal is broken. */
  peeked: string[];
  /** The visitor was sent for this run and waits before the crew reaches them. */
  summoned: boolean;
  /** Qualifying climbs toward this hill's decree trial (hills whose machine does not count it). */
  trial: number;
  phase: Phase;
  /** Ascending: normalised work 0..1. Other phases: seconds elapsed. */
  phaseProgress: number;
  cycleIndex: number;
  snapshot: CycleSnapshot;
}

/** The Paperwork Mill (docs/hill-workshops-plan.md §3.6). */
export interface BureauState {
  /** Forms waiting for approval (fractional: filing and clerks run in parts). */
  backlog: number;
  /** Clerks hired this run. */
  hired: number;
  /** Clerks at their desks (0..hired) when the Moirai are not running the mill. */
  onDuty: number;
  /** Impact multiplier the next cycle is paid with. */
  factor: number;
  /** Forms approved this run (every hundred brings an Edict). */
  approved: number;
  /** Climbs in a row with nothing approved (Nemesis Notices). */
  idle: number;
  /** Crew milestones in the empire as last recorded (Due Process). */
  dueProcess: number;
  /** The Edict in force (online only), or null. */
  edict: string | null;
  edictSeconds: number;
  /** Next Edict in Zeus's deck. */
  edictIndex: number;
}

/** The Orrery (docs/hill-workshops-plan.md §3.5). */
export interface SkyState {
  /** The constellation mounted in each house (device ids), or null for a dark house. */
  houses: (string | null)[];
  /** The house overhead. */
  position: number;
  /** Climbs spent under this house so far. */
  climbs: number;
  /** Climbs before Atlas will turn the sky again. */
  cooldown: number;
  /** Mounted houses in a row that came over while the player pushed (Wished on a Star). */
  streak: number;
}

/** The Foundry (docs/hill-workshops-plan.md §3.4). */
export interface FoundryState {
  /** Share of each payout poured as bronze (0..1, in tenths). */
  split: number;
  /** Blueprints still to cast, in pour order (device ids from the hand). */
  queue: string[];
  /** Bronze in the mould for the blueprint at the head of the queue. */
  bronze: Money;
  /** Blueprints finished this run (sets the next one's size). */
  finished: number;
  /** A blueprint has finished and the player has not picked the next. */
  paused: boolean;
  /** Bronze toward the Golden Gallery's next free crew level. */
  gallery: Money;
  /** Blueprints finished in a row without selling (Perpetual Motion). */
  pureStreak: number;
  /** Anything sold since the last blueprint finished. */
  soldSince: boolean;
  /** Climbs in a row at exactly half-and-half (Fair and Balanced). */
  balancedClimbs: number;
}

/** The Danaids' jar (docs/hill-workshops-plan.md §3.3). */
export interface JarState {
  /** 0..1 after the last leak. */
  level: number;
  holes: number;
  /** The level just after the last pour (the gauge's high-water mark). */
  peak: number;
  /** Water spilled over the lip by the last pour. */
  spilled: number;
  /** Impact multiplier the next cycle is paid with. */
  factor: number;
  /** The peak level Danaus holds (0..1). */
  target: number;
  /** Pours in a row that came near the brim without spilling (Almost Full). */
  streak: number;
}

/** Ixion's Wheel (docs/hill-workshops-plan.md §3.2). */
export interface FurnaceState {
  /** 0..1. While erupting: the heat it erupted at (drawn draining). */
  heat: number;
  /** Boosted impacts left in the current eruption; 0 when idle. */
  erupting: number;
  /** Impact multiplier of the current eruption (1 when idle). */
  power: number;
  /** Eruptions this run (Ixion's Complaint). */
  eruptions: number;
  /** The heat at which the steward vents. */
  ventAt: number;
}

export interface Options {
  toggleMode: boolean;
  reducedMotion: boolean;
  ambientCaptions: boolean;
  textScale: number;
  highContrast: boolean;
  /** Big numbers as named -illions (Qa, Qi, Sx…) or in scientific notation. */
  notation: 'named' | 'scientific';
  /** Camera shake on impacts and falls (off keeps every other effect). */
  screenShake: boolean;
  /** Decree and discovery flourishes without bright flashes. */
  flashFree: boolean;
  /** Particles, per-hill light and the glaze finish (cosmetic; off for slow machines). */
  richEffects: boolean;
  /** With rich effects on: everything, or a lighter set for modest machines. */
  effectsQuality: 'full' | 'balanced';
  /** KeyboardEvent.code that works the Push control on desktop. */
  pushKey: string;
  /** Record a local, exportable playtest event log (consented; never sent). */
  telemetry: boolean;
  /** Volumes 0..1, kept separate per the audio handoff. */
  effectsVolume: number;
  musicVolume: number;
  interfaceVolume: number;
}

export interface GameState {
  schemaVersion: number;
  contentVersion: string;
  revision: number;
  saveId: string;
  lastSettledUtc: number;
  paused: boolean;
  /** When the current pause began (for Sisyphus Takes Five), or null. */
  pausedAtUtc: number | null;
  /** One pinned next purchase (a goal key, see app/view.ts); never reserves money. */
  pinnedGoal: string | null;

  wallet: {
    /** Defiance: every hill's gross this run at its appraisal, in Obols. A score, never money. */
    runGross: Money;
    bestRunGross: Money;
  };

  /**
   * The opening: the stone slips until grip upgrades let it reach the summit.
   * Played once per save; survives Begin Again.
   */
  prelude: {
    complete: boolean;
    upgradeIds: string[];
    /** Highest point reached before a slip, 0..1. */
    bestHeight: number;
    attempts: number;
  };

  /**
   * Timed records, in game time (play plus counted absence). A clock is null
   * when it began before the save kept time, so no record is ever guessed.
   */
  records: {
    runSeconds: number | null;
    campaignSeconds: number | null;
    /** Campaign time when the Charter was first signed. */
    firstCharterSeconds: number | null;
    /** Fastest run to the Charter, per Appeal ("0" is the original sentence). */
    charterSeconds: Record<string, number>;
  };

  /** Thanatos's Appeals: the one being fought (0: the original sentence) and laurels won. */
  appeal: {
    number: number;
    laurels: number;
  };

  prestige: {
    lifetimeInsightAwarded: number;
    /** Insight given outside Begin Again (first-heard whispers); spendable, not part of the record. */
    giftedInsight: number;
    insightSpent: number;
    permanentUpgradeIds: string[];
    /** Remembrance ranks bought per hill (0..5), deepening its machine in every run. */
    remembrances: Record<string, number>;
    /** Hills with a file opened: one revealed device kept there is always dealt. */
    fileSlots: string[];
    /** The device kept on file per hill. */
    filed: Record<string, string>;
    /** Ranks of Scorn bought (after the first Charter): every crew's pay doubles with each. */
    scorn: number;
  };

  empire: {
    foremanOwned: boolean;
    selectedSiteId: string;
    sites: SiteState[];
    purchasedWorkIds: string[];
    /** Sites whose decree has been issued this run but are not yet opened. */
    offeredSiteIds: string[];
  };

  discoveries: {
    /** Works purchased in any run (drives Signed in Advance). */
    seenWorkIds: string[];
    relicIds: string[];
    seenStoryIds: string[];
    archiveIds: string[];
    achievementIds: string[];
    tutorialIds: string[];
    /** Every device, whisper and bargain ever revealed (the Codex). */
    codexIds: string[];
    /** Whispers heard; they hold in every run. */
    whisperIds: string[];
    /** Rumours already told (a whisper's condition half met). */
    rumourIds: string[];
  };

  counters: {
    totalClimbs: number;
    totalImpacts: number;
    totalRuns: number;
    totalActiveSeconds: number;
    highestSiteEver: number;
    /** Summits reached while pushing by hand, over all runs. */
    manualSummits: number;
    /** Eruptions at full heat, over all runs. */
    fullEruptions: number;
    /** Times Atlas has been asked to turn the sky, over all runs. */
    atlasTurns: number;
  };

  random: {
    coinRngState: number;
    relicRngState: number;
    /** Shuffles each hill's tablets when it opens. */
    dealRngState: number;
    relicCountdown: number | null;
    eligibleSiteId: string | null;
  };

  options: Options;
}

export const DEFAULT_OPTIONS: Options = {
  toggleMode: false,
  reducedMotion: false,
  ambientCaptions: true,
  textScale: 1,
  highContrast: false,
  notation: 'named',
  screenShake: true,
  flashFree: false,
  richEffects: true,
  effectsQuality: 'full',
  pushKey: 'Space',
  telemetry: false,
  effectsVolume: 0.7,
  musicVolume: 0.4,
  interfaceVolume: 0.5,
};

export function emptySnapshot(): CycleSnapshot {
  return {
    summit: Money.ZERO,
    impact: Money.ZERO,
    bonus: Money.ZERO,
    bonusTargetId: 'debris',
    summitGranted: false,
    impactGranted: false,
    slipHeight: 0,
  };
}

export type GameEvent =
  | { type: 'CycleStarted'; siteId: string; cycleIndex: number }
  | { type: 'SummitReached'; siteId: string; amount: Money }
  | { type: 'ImpactResolved'; siteId: string; amount: Money; bonus: Money; targetId: string }
  | { type: 'FlywheelCharged'; siteId: string }
  | { type: 'StoneSlipped'; siteId: string; height: number; record: boolean }
  | { type: 'FallResolved'; siteId: string; amount: Money }
  | { type: 'PreludeCompleted'; offering: Money }
  | { type: 'FeatureUnlocked'; feature: 'flywheel' | 'foreman' }
  | { type: 'PurchaseCompleted'; kind: PurchaseKind; siteId?: string; count?: number; cost: Money }
  | { type: 'MilestoneReached'; siteId: string; level: number }
  | { type: 'WorkInstalled'; workId: string; free: boolean }
  | { type: 'SiteOpened'; siteId: string }
  | { type: 'DecreeAvailable'; siteId: string }
  | { type: 'RelicGranted'; relicId: string }
  | { type: 'StoryTriggered'; storyId: string; firstTime: boolean }
  | { type: 'PrestigeCompleted'; award: number }
  | { type: 'CharterSigned' }
  | { type: 'AchievementUnlocked'; achievementId: string }
  | { type: 'StewardHired'; siteId: string; paidWith: 'local' | 'insight' }
  | { type: 'DeviceRevealed'; siteId: string; deviceId: string; firstTime: boolean }
  | { type: 'Rumour'; whisperId: string; text: string }
  | { type: 'Edict'; edictId: string }
  | { type: 'AppealFiled'; number: number; award: number }
  | { type: 'LaurelWon'; number: number }
  | { type: 'VisitorArrived'; siteId: string; visitorId: string }
  | { type: 'Eruption'; siteId: string; power: number; heat: number };

export type PurchaseKind =
  | 'production'
  | 'strength'
  | 'impact'
  | 'flywheel'
  | 'foreman'
  | 'work'
  | 'site'
  | 'insight'
  | 'prelude'
  | 'steward'
  | 'seal'
  | 'counterweight';
