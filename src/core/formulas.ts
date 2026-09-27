import { catalog, siteDef, workDef, type InsightEffect, type PreludeUpgradeDef, type SiteDef } from '../content/catalog';
import { Money } from './money';
import type { GameState, SiteState } from './state';

export type LevelTrack = 'production' | 'strength' | 'impact';

// ---------------------------------------------------------------- upgrades

export function hasUpgrade(state: GameState, effect: InsightEffect): boolean {
  const def = catalog.insightUpgrades.find((u) => u.effect === effect);
  return !!def && state.prestige.permanentUpgradeIds.includes(def.id);
}

export function spendableInsight(state: GameState): number {
  return state.prestige.lifetimeInsightAwarded - state.prestige.insightSpent;
}

// ----------------------------------------------------------------- income

export function milestoneCount(level: number): number {
  return catalog.levels.milestones.filter((t) => t <= level).length;
}

export function nextMilestone(level: number): number | null {
  return catalog.levels.milestones.find((t) => t > level) ?? null;
}

export function insightFactor(lifetimeInsight: number): number {
  const p = catalog.prestige;
  return 1 + p.insightFactorScale * Math.sqrt(lifetimeInsight / p.insightFactorDivisor);
}

export function relicFactor(state: GameState): number {
  return catalog.relics.incomeMultiplier ** state.discoveries.relicIds.length;
}

export function workFactor(state: GameState): number {
  return state.empire.purchasedWorkIds.reduce((acc, id) => acc * workDef(id).value, 1);
}

function highestOwnedIndex(state: GameState): number {
  return state.empire.sites.reduce((m, s) => Math.max(m, siteDef(s.id).index), 0);
}

/** Every multiplier that applies to all ordinary income. */
export function globalFactor(state: GameState): number {
  return (
    insightFactor(state.prestige.lifetimeInsightAwarded) *
    relicFactor(state) *
    workFactor(state) *
    (hasUpgrade(state, 'doubleIncome') ? 2 : 1)
  );
}

export function oldSiteFactor(state: GameState, site: SiteState): number {
  if (!hasUpgrade(state, 'olderSitesDouble')) return 1;
  return siteDef(site.id).index < highestOwnedIndex(state) ? 2 : 1;
}

/** The base reward for one cycle at the site's current levels. */
export function baseReward(state: GameState, site: SiteState): Money {
  const def = siteDef(site.id);
  const milestone = catalog.levels.milestoneFactor ** milestoneCount(site.productionLevel);
  const factor = milestone * globalFactor(state) * oldSiteFactor(state, site);
  return def.baseYield.mul(site.productionLevel).mul(factor);
}

export interface Payout {
  base: Money;
  summit: Money;
  impact: Money;
  expectedBonus: Money;
  expectedTotal: Money;
}

export function cyclePayout(state: GameState, site: SiteState): Payout {
  const c = catalog.cycle;
  const base = baseReward(state, site);
  const summit = base.mul(c.summitShare);
  const impact = base.mul(c.impactShare * (1 + c.impactBonusPerLevel * site.impactLevel));
  const expectedBonus = base.mul(catalog.expectedBonusMultiplier);
  return { base, summit, impact, expectedBonus, expectedTotal: summit.add(impact).add(expectedBonus) };
}

// ------------------------------------------------------------------- speed

export function flywheelFactor(state: GameState): number {
  return hasUpgrade(state, 'flywheelFactor150')
    ? catalog.speed.deepReservoirFlywheelFactor
    : catalog.speed.flywheelFactor;
}

export function speedMultiplier(
  state: GameState,
  site: Pick<SiteState, 'strengthLevel' | 'wheelCharged'>,
  assisted: boolean,
): number {
  let speed = 1 + catalog.speed.strengthPerLevel * site.strengthLevel;
  if (site.wheelCharged) speed *= flywheelFactor(state);
  if (assisted) speed *= catalog.speed.manualAssistFactor;
  return speed;
}

export function ascentSeconds(
  state: GameState,
  site: Pick<SiteState, 'id' | 'strengthLevel' | 'wheelCharged'>,
  assisted: boolean,
): number {
  const base = siteDef(site.id).ascentSeconds;
  return Math.max(catalog.cycle.minAscentSeconds, base / speedMultiplier(state, site, assisted));
}

export function fixedPhaseSeconds(): number {
  return catalog.cycle.descentSeconds + catalog.cycle.returnSeconds;
}

export function isAutomated(state: GameState): boolean {
  return state.empire.foremanOwned && state.prelude.complete;
}

export interface MotionInput {
  manualHeld: boolean;
  /** Offline or batched settlement: no manual effort, frozen manual sites. */
  offline: boolean;
}

/** Normalised ascent work per second for a site right now. */
export function ascentRate(state: GameState, site: SiteState, input: MotionInput): number {
  const selected = state.empire.selectedSiteId === site.id;
  const helping = !input.offline && input.manualHeld && selected;
  if (isAutomated(state)) return 1 / ascentSeconds(state, site, helping);
  return helping ? 1 / ascentSeconds(state, site, false) : 0;
}

/**
 * Steady-state unassisted income per second for an automated site: the wheel
 * is treated as charged when owned (it charges on the first descent).
 */
export function steadyIncomePerSecond(state: GameState, site: SiteState): Money {
  const steady = { ...site, wheelCharged: site.wheelOwned || site.wheelCharged };
  const cycle = ascentSeconds(state, steady, false) + fixedPhaseSeconds();
  return cyclePayout(state, site).expectedTotal.div(cycle);
}

export function empireIncomePerSecond(state: GameState): Money {
  if (!isAutomated(state)) return Money.ZERO;
  return Money.sum(state.empire.sites.map((s) => steadyIncomePerSecond(state, s)));
}

// ----------------------------------------------------------------- prelude

export function preludeActive(state: GameState): boolean {
  return !state.prelude.complete;
}

/** Fraction of the hill the stone can be pushed before grip gives out. */
export function preludeReach(state: GameState): number {
  const p = catalog.prelude;
  const owned = p.upgrades.filter((u) => state.prelude.upgradeIds.includes(u.id));
  const reach = owned.reduce((a, u) => a + u.reach, p.baseReach);
  return reach >= 1 - 1e-9 ? 1 : Math.round(reach * 1e6) / 1e6;
}

/** Highest normalised progress the current ascent can reach before a slip. */
export function ascentLimit(state: GameState, site: Pick<SiteState, 'id'>): number {
  if (state.prelude.complete || site.id !== catalog.sites[0].id) return 1;
  return preludeReach(state);
}

/** How long the stone takes to roll back to the foot from `height`. */
export function slipSeconds(height: number): number {
  const p = catalog.prelude;
  return p.slipSecondsBase + p.slipSecondsPerHeight * height;
}

/** Obols the watching shades toss when the stone falls from `height`. */
export function fallPayout(height: number): Money {
  return Money.of(Math.max(1, Math.ceil(catalog.prelude.fallYield * height - 1e-9)));
}

export function nextPreludeUpgrade(state: GameState): PreludeUpgradeDef | null {
  if (state.prelude.complete) return null;
  return catalog.prelude.upgrades.find((u) => !state.prelude.upgradeIds.includes(u.id)) ?? null;
}

// -------------------------------------------------------------- automation

function firstHillLevel(state: GameState): number {
  return state.empire.sites.find((s) => s.id === catalog.sites[0].id)?.productionLevel ?? 0;
}

/** The first flywheel is discovered at a First Hill level; afterwards it stays known. */
export function flywheelUnlocked(state: GameState): boolean {
  if (!state.prelude.complete) return false;
  if (state.discoveries.tutorialIds.includes('first_wheel')) return true;
  return firstHillLevel(state) >= catalog.automation.flywheelUnlockLevel;
}

export function foremanUnlocked(state: GameState): boolean {
  if (!state.prelude.complete || !state.empire.sites.some((s) => s.wheelOwned)) return false;
  if (state.discoveries.tutorialIds.includes('foreman')) return true;
  return firstHillLevel(state) >= catalog.automation.foremanUnlockLevel;
}

// ------------------------------------------------------------------ prices

export function levelCap(track: LevelTrack): number {
  const l = catalog.levels;
  return track === 'production' ? l.productionCap : track === 'strength' ? l.strengthCap : l.impactCap;
}

export function currentLevel(site: SiteState, track: LevelTrack): number {
  return track === 'production' ? site.productionLevel : track === 'strength' ? site.strengthLevel : site.impactLevel;
}

/** Price of the next single level from `level` (the existing level). */
export function levelCost(def: SiteDef, track: LevelTrack, level: number): Money {
  const l = catalog.levels;
  const blc = def.baseLevelCost;
  switch (track) {
    case 'production':
      return blc.mul(Money.of(l.productionGrowth).pow(level - 1)).ceil();
    case 'strength':
      return blc.mul(l.strengthCostMultiplier).mul(Money.of(l.strengthGrowth).pow(level)).ceil();
    case 'impact':
      return blc.mul(l.impactCostMultiplier).mul(Money.of(l.impactGrowth).pow(level)).ceil();
  }
}

/** Sum of rounded individual prices, or null if the count exceeds the cap. */
export function bulkCost(site: SiteState, track: LevelTrack, count: number): Money | null {
  const def = siteDef(site.id);
  const from = currentLevel(site, track);
  if (count <= 0 || from + count > levelCap(track)) return null;
  let total = Money.ZERO;
  for (let i = 0; i < count; i++) total = total.add(levelCost(def, track, from + i));
  return total;
}

export function flywheelCost(site: SiteState): Money {
  return siteDef(site.id).baseLevelCost.mul(catalog.levels.flywheelCostMultiplier).ceil();
}

/** Whether buying strength level `level + 1` would shorten the unassisted ascent. */
export function strengthLevelEffective(state: GameState, site: SiteState, level: number): boolean {
  const charged = site.wheelOwned || site.wheelCharged;
  const before = ascentSeconds(state, { id: site.id, strengthLevel: level, wheelCharged: charged }, false);
  const after = ascentSeconds(state, { id: site.id, strengthLevel: level + 1, wheelCharged: charged }, false);
  return after < before;
}

/** Largest count whose exact summed price fits the wallet (Buy Max). */
export function maxAffordable(state: GameState, site: SiteState, track: LevelTrack): number {
  const def = siteDef(site.id);
  const from = currentLevel(site, track);
  const cap = levelCap(track);
  let total = Money.ZERO;
  let count = 0;
  while (from + count < cap) {
    const lvl = from + count;
    if (track === 'strength' && !strengthLevelEffective(state, site, lvl)) break;
    const next = total.add(levelCost(def, track, lvl));
    if (next.gt(state.wallet.obols)) break;
    total = next;
    count++;
  }
  return count;
}

export function levelsToMilestone(site: SiteState): number {
  const next = nextMilestone(site.productionLevel);
  return next === null ? 0 : next - site.productionLevel;
}

// ---------------------------------------------------------------- decrees

export function nextUnownedSite(state: GameState): SiteDef | null {
  const owned = new Set(state.empire.sites.map((s) => s.id));
  return catalog.sites.find((s) => !owned.has(s.id)) ?? null;
}

/** Impertinence: progress from the previous gate to the next, 0..1. */
export function decreeProgress(state: GameState): number {
  const next = nextUnownedSite(state);
  if (!next) return 1;
  const prev = catalog.sites[next.index - 1].defianceGate;
  const span = next.defianceGate.sub(prev);
  const done = state.wallet.runGross.sub(prev);
  const ratio = done.div(span).toNumber();
  return Math.min(1, Math.max(0, ratio));
}

// --------------------------------------------------------------- prestige

export function prestigeEntitlement(record: Money): number {
  const p = catalog.prestige;
  if (record.lt(p.minimumRecord)) return 0;
  const orders = record.div(p.minimumRecord).log10();
  return Math.floor(p.entitlementScale * (1 + orders) ** 2);
}

export function prestigeRecord(state: GameState): Money {
  return Money.max(state.wallet.bestRunGross, state.wallet.runGross);
}

export function availableInsight(state: GameState): number {
  return Math.max(0, prestigeEntitlement(prestigeRecord(state)) - state.prestige.lifetimeInsightAwarded);
}

/** Smallest record that would raise the entitlement above what was awarded. */
export function nextRecordTarget(state: GameState): Money {
  const p = catalog.prestige;
  const want = state.prestige.lifetimeInsightAwarded + 1;
  const orders = Math.sqrt(want / p.entitlementScale) - 1;
  return p.minimumRecord.mul(Money.of(10).pow(Math.max(0, orders))).ceil();
}

export function offlineCapSeconds(state: GameState): number {
  const hours = hasUpgrade(state, 'offlineCap72') ? catalog.offline.extendedCapHours : catalog.offline.baseCapHours;
  return hours * 3600;
}
