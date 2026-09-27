import { Money } from './money';

export const SCHEMA_VERSION = 2;

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

export interface SiteState {
  id: string;
  productionLevel: number;
  strengthLevel: number;
  impactLevel: number;
  wheelOwned: boolean;
  wheelCharged: boolean;
  phase: Phase;
  /** Ascending: normalised work 0..1. Other phases: seconds elapsed. */
  phaseProgress: number;
  cycleIndex: number;
  snapshot: CycleSnapshot;
}

export interface Options {
  toggleMode: boolean;
  reducedMotion: boolean;
  ambientCaptions: boolean;
  textScale: number;
  highContrast: boolean;
}

export interface GameState {
  schemaVersion: number;
  contentVersion: string;
  revision: number;
  saveId: string;
  lastSettledUtc: number;
  paused: boolean;

  wallet: {
    obols: Money;
    /** Defiance: gross Obols earned this run. */
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

  prestige: {
    lifetimeInsightAwarded: number;
    insightSpent: number;
    permanentUpgradeIds: string[];
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
  };

  counters: {
    totalClimbs: number;
    totalImpacts: number;
    totalRuns: number;
    totalActiveSeconds: number;
    highestSiteEver: number;
  };

  random: {
    coinRngState: number;
    relicRngState: number;
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
  | { type: 'CharterSigned' };

export type PurchaseKind =
  | 'production'
  | 'strength'
  | 'impact'
  | 'flywheel'
  | 'foreman'
  | 'work'
  | 'site'
  | 'insight'
  | 'prelude';
