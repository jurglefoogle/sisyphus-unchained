import { catalog, siteDef, workDef, type InsightEffect, type PreludeUpgradeDef, type SiteDef, type WorkDef } from '../content/catalog';
import { modifiers, nthAverage } from './effects';
import { furnaceImpactFactor, furnaceSite, steadyPattern } from './furnace';
import { jarImpactFactor, steadyJarFactor } from './jar';
import { climbsPerHouse, skyPattern } from './sky';
import { bureauImpactFactor, steadyBureauFactor } from './bureau';
import { trialNeeded, trialProgress } from './trials';
import { Money } from './money';
import type { GameState, SiteState } from './state';

export type LevelTrack = 'production' | 'strength' | 'impact';

// ---------------------------------------------------------------- upgrades

export function hasUpgrade(state: GameState, effect: InsightEffect): boolean {
  const def = catalog.insightUpgrades.find((u) => u.effect === effect);
  return !!def && state.prestige.permanentUpgradeIds.includes(def.id);
}

export function spendableInsight(state: GameState): number {
  return state.prestige.lifetimeInsightAwarded + state.prestige.giftedInsight - state.prestige.insightSpent;
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
  return 1 + p.insightFactorScale * (lifetimeInsight / p.insightFactorDivisor) ** p.insightFactorExponent;
}

// ---------------------------------------------------------------- appeals

/** Gates and openings cost this many times as much under the current Appeal. */
export function appealScale(state: GameState): number {
  return catalog.appeals.gateGrowth ** state.appeal.number;
}

export function gateOf(state: GameState, def: SiteDef): Money {
  return def.defianceGate.mul(appealScale(state));
}

export function unlockCostOf(state: GameState, def: SiteDef): Money {
  return def.unlockCost.mul(appealScale(state));
}

/**
 * Every price paid in a hill's own coin (levels, tablets, machines, clerks,
 * stewards) rises with the crews' pay, so an Appeal replays the campaign in
 * bigger numbers instead of letting the hills cap out in one session.
 */
export function priceScale(state: GameState): number {
  return catalog.appeals.payGrowth ** state.appeal.number;
}

/** A hill's base level price under the current Appeal. */
export function baseLevelCostOf(state: GameState, def: SiteDef): Money {
  return def.baseLevelCost.mul(priceScale(state));
}

/** Works (the Charter among them) rise more gently than gates: the last hill has no successor to feed it. */
export function workCostOf(state: GameState, def: WorkDef): Money {
  return def.cost.mul(catalog.appeals.workGrowth ** state.appeal.number);
}

/** Scorn is offered once the Charter has ever been signed. */
export function scornOpen(state: GameState): boolean {
  return (
    state.records.firstCharterSeconds !== null ||
    state.appeal.number > 0 ||
    state.appeal.laurels > 0 ||
    state.empire.purchasedWorkIds.includes('charter')
  );
}

/** The Insight price of the next rank of Scorn. */
export function scornCost(state: GameState): number {
  const c = catalog.scorn;
  return Math.round(c.baseCost * c.costGrowth ** state.prestige.scorn);
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
  const factor = milestone * globalFactor(state) * oldSiteFactor(state, site) * modifiers(state, site.id).crew;
  return def.baseYield.mul(site.productionLevel).mul(factor);
}

/** Bonus-target odds on a hill, after devices that make amphorae commoner. */
export function bonusTable(state: GameState, siteId: string): { id: string; probability: number; baseMultiplier: number }[] {
  const f = modifiers(state, siteId).amphorae;
  const targets = catalog.bonusTargets;
  if (f === 1) return targets;
  const others = targets.filter((t) => t.id !== 'debris' && t.id !== 'coin_amphora').reduce((a, t) => a + t.probability, 0);
  return targets.map((t) => {
    if (t.id === 'coin_amphora') return { ...t, probability: Math.min(1 - others, t.probability * f) };
    if (t.id === 'debris') {
      const amphora = targets.find((x) => x.id === 'coin_amphora')?.probability ?? 0;
      return { ...t, probability: Math.max(0, 1 - others - Math.min(1 - others, amphora * f)) };
    }
    return t;
  });
}

export function expectedBonusMultiplier(state: GameState, siteId: string): number {
  if (modifiers(state, siteId).amphorae === 1) return catalog.expectedBonusMultiplier;
  return bonusTable(state, siteId).reduce((a, t) => a + t.probability * t.baseMultiplier, 0);
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
  const impactFactor = modifiers(state, site.id).impact;
  const impact = base.mul(c.impactShare * (1 + c.impactBonusPerLevel * site.impactLevel) * impactFactor * furnaceImpactFactor(site) * jarImpactFactor(site) * bureauImpactFactor(site));
  const expectedBonus = base.mul(expectedBonusMultiplier(state, site.id));
  return { base, summit, impact, expectedBonus, expectedTotal: summit.add(impact).add(expectedBonus) };
}

// ------------------------------------------------------------------- speed

export function flywheelFactor(state: GameState): number {
  return hasUpgrade(state, 'flywheelFactor150')
    ? catalog.speed.deepReservoirFlywheelFactor
    : catalog.speed.flywheelFactor;
}

/** What the climb's speed depends on; a copy with other values answers "what if". */
export type SpeedSite = Pick<SiteState, 'id' | 'strengthLevel' | 'wheelCharged' | 'counterweight' | 'furnace'>;

export function speedMultiplier(state: GameState, site: SpeedSite, assisted: boolean): number {
  const m = modifiers(state, site.id);
  let speed = (1 + catalog.speed.strengthPerLevel * site.strengthLevel) * m.ascent;
  speed *= 1 + catalog.counterweight.climbPerTrim * (site.counterweight ?? 0);
  if (site.wheelCharged) speed *= 1 + (flywheelFactor(state) - 1) * m.flywheel;
  if (site.furnace) speed *= 1 + m.furnaceWhip * site.furnace.heat;
  if (assisted) speed *= catalog.speed.manualAssistFactor;
  return speed;
}

export function ascentSeconds(state: GameState, site: SpeedSite, assisted: boolean): number {
  const base = siteDef(site.id).ascentSeconds;
  return Math.max(catalog.cycle.minAscentSeconds, base / speedMultiplier(state, site, assisted));
}

/** The counterweight brakes the fall; devices may hurry it. */
export function descentSeconds(state: GameState, site: Pick<SiteState, 'id' | 'counterweight'>): number {
  const brake = 1 + catalog.counterweight.brakePerTrim * (site.counterweight ?? 0);
  return catalog.cycle.descentSeconds * brake * modifiers(state, site.id).descent;
}

export function returnSeconds(state: GameState, site: Pick<SiteState, 'id' | 'furnace'>): number {
  const m = modifiers(state, site.id);
  if (m.noReturn || (m.furnaceNoReturn && (site.furnace?.erupting ?? 0) > 0)) return 0;
  return catalog.cycle.returnSeconds;
}

/** Descent plus return: the part of a cycle that doesn't depend on the climb. */
export function fixedPhaseSeconds(state: GameState, site: Pick<SiteState, 'id' | 'counterweight' | 'furnace'>): number {
  return descentSeconds(state, site) + returnSeconds(state, site);
}

export function cycleSeconds(state: GameState, site: SpeedSite, assisted: boolean): number {
  return ascentSeconds(state, site, assisted) + fixedPhaseSeconds(state, site);
}

// ----------------------------------------------------------- counterweight

export function counterweightUnlocked(site: SiteState): boolean {
  return siteDef(site.id).index === 0 && site.productionLevel >= catalog.counterweight.unlockLevel;
}

export function counterweightCost(state: GameState, site: SiteState): Money {
  return baseLevelCostOf(state, siteDef(site.id)).mul(catalog.counterweight.costMultiplier).ceil();
}

/** The trim with the shortest cycle (the wheel counted as charged when owned). */
export function bestTrim(state: GameState, site: SiteState, assisted = false): number {
  const charged = site.wheelOwned || site.wheelCharged;
  let best = 0;
  let bestSeconds = Infinity;
  for (let w = 0; w <= catalog.counterweight.maxTrim; w++) {
    const secs = cycleSeconds(state, { ...site, wheelCharged: charged, counterweight: w }, assisted);
    if (secs < bestSeconds - 1e-9) {
      bestSeconds = secs;
      best = w;
    }
  }
  return best;
}

// ----------------------------------------------------------------- tablets

export function tabletLevel(index: number): number {
  return catalog.devices.tabletLevels[index];
}

export function tabletCost(state: GameState, site: SiteState, index: number): Money {
  return baseLevelCostOf(state, siteDef(site.id)).mul(catalog.devices.tabletCosts[index]).ceil();
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
  if (site.furnace) return furnaceIncome(state, site, !!site.steward, site.furnace.ventAt);
  if (site.jar) return jarIncome(state, site, !!site.steward);
  if (site.sky) return skyIncome(state, site, !!site.steward);
  if (site.bureau) return bureauIncome(state, site, !!site.steward);
  const steady = { ...site, wheelCharged: site.wheelOwned || site.wheelCharged };
  const cycle = cycleSeconds(state, steady, false);
  return cyclePayout(state, site).expectedTotal.mul(nthAverage(modifiers(state, site.id))).div(cycle);
}

/**
 * Income on the Tartarus Rim over one steady turn of the wheel: left alone it
 * erupts at full heat; with a steward on duty it vents at `ventAt`.
 */
export function furnaceIncome(state: GameState, site: SiteState, vents: boolean, ventAt: number): Money {
  const m = modifiers(state, site.id);
  const pattern = steadyPattern(m, site.furnace!, vents, ventAt);
  const steady = { ...site, wheelCharged: site.wheelOwned || site.wheelCharged };
  let pay = Money.ZERO;
  let seconds = 0;
  for (const f of pattern) {
    const s = { ...steady, furnace: f };
    pay = pay.add(cyclePayout(state, s).expectedTotal);
    seconds += cycleSeconds(state, s, false);
  }
  // Charon's Fare: one wage per eruption, and each period holds one eruption.
  if (m.furnaceLump > 0) pay = pay.add(baseReward(state, site).mul(m.furnaceLump));
  return pay.mul(nthAverage(m)).div(seconds);
}

/** Income on the Leaking Heights with the jar as it is (or as the steward holds it). */
export function jarIncome(state: GameState, site: SiteState, vents: boolean, target?: number, holes?: number): Money {
  const m = modifiers(state, site.id);
  const factor = steadyJarFactor(m, site.jar!, site.productionLevel, vents, target, holes);
  const steady = { ...site, jar: { ...site.jar!, factor }, wheelCharged: site.wheelOwned || site.wheelCharged };
  return cyclePayout(state, steady).expectedTotal.mul(nthAverage(m)).div(cycleSeconds(state, steady, false));
}

/**
 * Income on the Skyward Escarpment over a few turns of the sky: each house
 * overhead weighted by the cycles it holds (constellations work only then).
 */
export function skyIncome(state: GameState, site: SiteState, vents: boolean): Money {
  const real = state.empire.sites.find((x) => x.id === site.id)?.sky;
  if (!real || !site.sky) return Money.ZERO;
  const m = modifiers(state, site.id);
  const cycles = 3 * real.houses.length * climbsPerHouse(m);
  const counts = new Map<number, number>();
  for (const p of skyPattern(m, site.sky, vents, cycles)) counts.set(p, (counts.get(p) ?? 0) + 1);
  const kept = real.position;
  let pay = Money.ZERO;
  let seconds = 0;
  try {
    for (const [p, n] of counts) {
      real.position = p;
      const steady = { ...site, sky: { ...site.sky, position: p }, wheelCharged: site.wheelOwned || site.wheelCharged };
      const mp = modifiers(state, site.id);
      pay = pay.add(cyclePayout(state, steady).expectedTotal.mul(nthAverage(mp) * n));
      seconds += cycleSeconds(state, steady, false) * n;
    }
  } finally {
    real.position = kept;
  }
  return pay.div(seconds);
}

/** Income on the Olympian Approach with the Mill as it stands (or as the Moirai run it). */
export function bureauIncome(state: GameState, site: SiteState, vents: boolean, onDuty?: number): Money {
  const m = modifiers(state, site.id);
  const factor = steadyBureauFactor(m, site.bureau!, site.productionLevel, vents, onDuty);
  const steady = { ...site, bureau: { ...site.bureau!, factor }, wheelCharged: site.wheelOwned || site.wheelCharged };
  return cyclePayout(state, steady).expectedTotal.mul(nthAverage(m)).div(cycleSeconds(state, steady, false));
}

/** Drilling one more hole in the jar: half a crew level's price. */
export function drillCost(state: GameState, site: SiteState): Money {
  const m = modifiers(state, site.id);
  return levelCost(state, siteDef(site.id), 'production', Math.max(1, site.productionLevel))
    .mul(catalog.jar.drillShare * m.jarDrillCost)
    .ceil();
}

/** The steward's best vent heat, to the nearest 5 percent. */
export function bestVent(state: GameState, site: SiteState): number {
  let best = 1;
  let bestIncome = Money.ZERO;
  for (let v = 20; v <= 100; v += 5) {
    const income = furnaceIncome(state, site, true, v / 100);
    if (income.gt(bestIncome.mul(1 + 1e-9))) {
      bestIncome = income;
      best = v / 100;
    }
  }
  return best;
}

/** The flywheel is the First Hill's machine; hills with their own machine have no use for it. */
export function flywheelOffered(state: GameState, site: Pick<SiteState, 'id'>): boolean {
  return flywheelUnlocked(state) && !furnaceSite(site.id);
}

/** The impact track, until a hill's machine replaces it (plan §6). */
export function trackOpen(site: Pick<SiteState, 'id'>, track: LevelTrack): boolean {
  return !(track === 'impact' && furnaceSite(site.id));
}

/** Defiance per second: every hill's steady income at its appraisal, in Obols. */
export function empireIncomePerSecond(state: GameState): Money {
  if (!isAutomated(state)) return Money.ZERO;
  return Money.sum(state.empire.sites.map((s) => steadyIncomePerSecond(state, s).mul(siteDef(s.id).appraisal)));
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
export function levelCost(state: GameState, def: SiteDef, track: LevelTrack, level: number): Money {
  const l = catalog.levels;
  const blc = baseLevelCostOf(state, def);
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
export function bulkCost(state: GameState, site: SiteState, track: LevelTrack, count: number): Money | null {
  const def = siteDef(site.id);
  const from = currentLevel(site, track);
  if (count <= 0 || from + count > levelCap(track) || !trackOpen(site, track)) return null;
  let total = Money.ZERO;
  for (let i = 0; i < count; i++) total = total.add(levelCost(state, def, track, from + i));
  return total;
}

export function flywheelCost(state: GameState, site: SiteState): Money {
  return baseLevelCostOf(state, siteDef(site.id)).mul(catalog.levels.flywheelCostMultiplier).ceil();
}

/** Whether buying strength level `level + 1` would shorten the unassisted ascent. */
export function strengthLevelEffective(state: GameState, site: SiteState, level: number): boolean {
  const charged = site.wheelOwned || site.wheelCharged;
  const at = (strengthLevel: number) =>
    ascentSeconds(state, { id: site.id, strengthLevel, wheelCharged: charged, counterweight: site.counterweight, furnace: site.furnace }, false);
  const before = at(level);
  const after = at(level + 1);
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
    const next = total.add(levelCost(state, def, track, lvl));
    if (next.gt(site.purse)) break;
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

/** The owned hill that pays for the next opening: the highest one owned. */
export function frontierSite(state: GameState): SiteState {
  return state.empire.sites.reduce((best, s) => (siteDef(s.id).index > siteDef(best.id).index ? s : best));
}

/** Impertinence: the frontier hill's gross toward the next decree, 0..1. */
export function decreeProgress(state: GameState): number {
  const next = nextUnownedSite(state);
  if (!next) return 1;
  const prev = state.empire.sites.find((s) => s.id === catalog.sites[next.index - 1].id);
  if (!prev) return 0;
  const ratio = Math.min(1, prev.gross.div(gateOf(state, next)).toNumber());
  const need = trialNeeded(prev.id);
  // The gross and the trial each fill half of the bar when there is a trial.
  if (need === 0) return Math.max(0, ratio);
  return Math.max(0, (ratio + Math.min(1, trialProgress(prev) / need)) / 2);
}

// ---------------------------------------------------------------- stewards

/** A hill's steward is offered once the hill behind it has a successor (or the Charter is signed). */
export function stewardOffered(state: GameState, site: SiteState): boolean {
  const index = siteDef(site.id).index;
  if (index === catalog.sites.length - 1) return state.empire.purchasedWorkIds.includes('charter');
  return state.empire.sites.some((s) => siteDef(s.id).index > index);
}

export function stewardCost(state: GameState, site: SiteState): Money {
  return baseLevelCostOf(state, siteDef(site.id)).mul(catalog.stewards.localCostMultiplier).ceil();
}

export function stewardInsightCost(site: SiteState): number {
  return catalog.stewards.insightCosts[siteDef(site.id).index];
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
  const hours = hasUpgrade(state, 'offlineCapExtended') ? catalog.offline.extendedCapHours : catalog.offline.baseCapHours;
  return hours * 3600;
}
