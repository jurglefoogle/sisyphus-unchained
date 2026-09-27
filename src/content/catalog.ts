import raw from './economy.json';
import { Money } from '../core/money';

export interface SiteDef {
  id: string;
  index: number;
  displayNameKey: string;
  unlockCost: Money;
  defianceGate: Money;
  baseYield: Money;
  baseLevelCost: Money;
  ascentSeconds: number;
  stoneAssetId: string;
  sceneId: string;
  patronId: string;
  offerStoryId: string | null;
}

export type WorkEffect = 'incomeMultiplier' | 'incomeMultiplierAndEnding';

export interface WorkDef {
  id: string;
  displayNameKey: string;
  siteId: string;
  requiredLevel: number;
  cost: Money;
  effect: WorkEffect;
  value: number;
  storyId: string | null;
}

export interface BonusTargetDef {
  id: string;
  probability: number;
  baseMultiplier: number;
}

export interface RelicDef {
  id: string;
  order: number;
  eligibleSiteId: string;
  guaranteedBy: string;
}

export type InsightEffect =
  | 'startWithForeman'
  | 'startWithChargedFlywheel'
  | 'openAtLevelFive'
  | 'olderSitesDouble'
  | 'freeWorkRestoration'
  | 'offlineCap72'
  | 'flywheelFactor150'
  | 'doubleIncome';

export interface InsightUpgradeDef {
  id: string;
  order: number;
  cost: number;
  effect: InsightEffect;
}

/** A one-time grip improvement bought during the opening (the prelude). */
export interface PreludeUpgradeDef {
  id: string;
  cost: Money;
  /** Added fraction of the hill the stone can be pushed before it slips. */
  reach: number;
}

export interface Catalog {
  contentVersion: string;
  cycle: typeof raw.cycle;
  speed: typeof raw.speed;
  levels: Omit<typeof raw.levels, 'foremanCost'> & { foremanCost: Money };
  prelude: Omit<typeof raw.prelude, 'summitOffering' | 'upgrades'> & {
    summitOffering: Money;
    upgrades: PreludeUpgradeDef[];
  };
  automation: typeof raw.automation;
  sites: SiteDef[];
  works: WorkDef[];
  bonusTargets: BonusTargetDef[];
  expectedBonusMultiplier: number;
  relics: {
    chancePerDescent: number;
    pityDescents: number;
    incomeMultiplier: number;
    catalog: RelicDef[];
  };
  prestige: {
    minimumRecord: Money;
    entitlementScale: number;
    insightFactorScale: number;
    insightFactorDivisor: number;
    suggestAt: number;
  };
  insightUpgrades: InsightUpgradeDef[];
  offline: typeof raw.offline;
  save: typeof raw.save;
}

/** Story shown when a site's decree first becomes available. */
const OFFER_STORIES: Record<string, string> = {
  tartarus_rim: 'tartarus_offer',
  leaking_heights: 'leaking_offer',
  bronze_pass: 'bronze_offer',
  skyward_escarpment: 'skyward_offer',
  olympian_approach: 'olympus_offer',
};

const INSIGHT_EFFECTS: InsightEffect[] = [
  'startWithForeman',
  'startWithChargedFlywheel',
  'openAtLevelFive',
  'olderSitesDouble',
  'freeWorkRestoration',
  'offlineCap72',
  'flywheelFactor150',
  'doubleIncome',
];

type RawEconomy = typeof raw;

/** Parses and validates economy data. Throws on any contract violation. */
export function buildCatalog(data: RawEconomy): Catalog {
  const errors: string[] = [];
  const check = (cond: boolean, msg: string) => {
    if (!cond) errors.push(msg);
  };

  const sites: SiteDef[] = data.sites.map((s, index) => ({
    ...s,
    index,
    unlockCost: Money.of(s.unlockCost),
    defianceGate: Money.of(s.defianceGate),
    baseYield: Money.of(s.baseYield),
    baseLevelCost: Money.of(s.baseLevelCost),
    offerStoryId: OFFER_STORIES[s.id] ?? null,
  }));
  const siteIds = new Set(sites.map((s) => s.id));
  check(siteIds.size === sites.length, 'site ids must be unique');
  check(sites.length > 0 && sites[0].unlockCost.isZero(), 'first site must be free');
  sites.forEach((s, i) => {
    check(s.ascentSeconds > 0, `${s.id}: ascent must be positive`);
    check(s.baseYield.gt(0) && s.baseLevelCost.gt(0), `${s.id}: yield and cost must be positive`);
    if (i > 0) {
      check(s.unlockCost.gt(0), `${s.id}: paid sites need a positive price`);
      check(s.defianceGate.gt(sites[i - 1].defianceGate), `${s.id}: gates must ascend`);
    }
  });

  const works: WorkDef[] = data.works.map((w) => ({
    ...w,
    effect: w.effect as WorkEffect,
    cost: Money.of(w.cost),
  }));
  check(new Set(works.map((w) => w.id)).size === works.length, 'work ids must be unique');
  for (const w of works) {
    check(siteIds.has(w.siteId), `${w.id}: unknown site ${w.siteId}`);
    check(w.cost.gt(0), `${w.id}: cost must be positive`);
    check(w.value >= 1, `${w.id}: multiplier must not reduce income`);
    check(['incomeMultiplier', 'incomeMultiplierAndEnding'].includes(w.effect), `${w.id}: bad effect`);
  }

  const probSum = data.bonusTargets.reduce((a, b) => a + b.probability, 0);
  check(Math.abs(probSum - 1) < 1e-9, 'bonus probabilities must sum to 1');
  for (const b of data.bonusTargets) check(b.probability >= 0 && b.probability <= 1, `${b.id}: bad probability`);
  const expectedBonusMultiplier = data.bonusTargets.reduce((a, b) => a + b.probability * b.baseMultiplier, 0);

  const relicCatalog = [...data.relics.catalog].sort((a, b) => a.order - b.order);
  for (const r of relicCatalog) {
    check(siteIds.has(r.eligibleSiteId), `${r.id}: unknown site`);
    const [kind, ref] = r.guaranteedBy.split(':');
    check(
      (kind === 'open' && siteIds.has(ref)) || (kind === 'work' && works.some((w) => w.id === ref)),
      `${r.id}: bad guarantee ${r.guaranteedBy}`,
    );
  }
  check(data.relics.chancePerDescent > 0 && data.relics.chancePerDescent <= 1, 'relic chance out of range');

  const upgrades = [...data.insightUpgrades].sort((a, b) => a.order - b.order) as InsightUpgradeDef[];
  upgrades.forEach((u, i) => {
    check(u.order === i + 1, `${u.id}: upgrade order must be sequential`);
    check(u.cost > 0, `${u.id}: cost must be positive`);
    check(INSIGHT_EFFECTS.includes(u.effect), `${u.id}: unknown effect ${u.effect}`);
  });

  const prelude = {
    ...data.prelude,
    summitOffering: Money.of(data.prelude.summitOffering),
    upgrades: data.prelude.upgrades.map((u) => ({ ...u, cost: Money.of(u.cost) })),
  };
  check(new Set(prelude.upgrades.map((u) => u.id)).size === prelude.upgrades.length, 'prelude upgrade ids must be unique');
  check(prelude.baseReach > 0 && prelude.baseReach < 1, 'prelude base reach must be inside the hill');
  for (const u of prelude.upgrades) check(u.reach > 0 && u.cost.gt(0), `${u.id}: reach and cost must be positive`);
  const fullReach = prelude.upgrades.reduce((a, u) => a + u.reach, prelude.baseReach);
  check(fullReach >= 1 - 1e-9, 'prelude upgrades must eventually reach the summit');
  check(prelude.fallYield > 0 && prelude.slipSecondsBase > 0, 'prelude falls must pay and take time');

  check(data.cycle.descentSeconds > 0 && data.cycle.returnSeconds > 0, 'phase durations must be positive');
  check(Math.abs(data.cycle.summitShare + data.cycle.impactShare - 1) < 1e-9, 'summit + impact shares must be 1');

  if (errors.length) throw new Error('Invalid economy data:\n' + errors.join('\n'));

  return {
    contentVersion: data.contentVersion,
    cycle: data.cycle,
    speed: data.speed,
    levels: { ...data.levels, foremanCost: Money.of(data.levels.foremanCost) },
    prelude,
    automation: data.automation,
    sites,
    works,
    bonusTargets: data.bonusTargets,
    expectedBonusMultiplier,
    relics: { ...data.relics, catalog: relicCatalog },
    prestige: { ...data.prestige, minimumRecord: Money.of(data.prestige.minimumRecord) },
    insightUpgrades: upgrades,
    offline: data.offline,
    save: data.save,
  };
}

export const catalog: Catalog = buildCatalog(raw);

export function siteDef(id: string): SiteDef {
  const s = catalog.sites.find((x) => x.id === id);
  if (!s) throw new Error(`Unknown site ${id}`);
  return s;
}

export function workDef(id: string): WorkDef {
  const w = catalog.works.find((x) => x.id === id);
  if (!w) throw new Error(`Unknown work ${id}`);
  return w;
}
