import { catalog, siteDef, workDef, type SiteDef } from '../content/catalog';
import {
  availableInsight,
  bulkCost,
  currentLevel,
  flywheelCost,
  hasUpgrade,
  insightFactor,
  levelCap,
  milestoneCount,
  prestigeEntitlement,
  prestigeRecord,
  spendableInsight,
  strengthLevelEffective,
  type LevelTrack,
} from './formulas';
import { Money } from './money';
import { randomSeed } from './rng';
import {
  findSite,
  grantRelic,
  markTutorial,
  refreshRelicEligibility,
  startCycle,
  triggerStory,
  type StepContext,
} from './sim';
import {
  DEFAULT_OPTIONS,
  SCHEMA_VERSION,
  emptySnapshot,
  type GameEvent,
  type GameState,
  type SiteState,
} from './state';

export type CommandResult = { ok: true } | { ok: false; reason: string };

const OK: CommandResult = { ok: true };
const fail = (reason: string): CommandResult => ({ ok: false, reason });

function onlineCtx(events: GameEvent[]): StepContext {
  return { manualHeld: false, offline: false, events };
}

function debit(state: GameState, cost: Money): void {
  state.wallet.obols = state.wallet.obols.sub(cost);
}

function commit(state: GameState): CommandResult {
  state.revision += 1;
  return OK;
}

// ------------------------------------------------------------ construction

function createSite(state: GameState, def: SiteDef, events: GameEvent[]): SiteState {
  const machinery = hasUpgrade(state, 'startWithChargedFlywheel');
  const site: SiteState = {
    id: def.id,
    productionLevel: def.index > 0 && hasUpgrade(state, 'openAtLevelFive') ? 5 : 1,
    strengthLevel: 0,
    impactLevel: 0,
    wheelOwned: machinery,
    wheelCharged: machinery,
    phase: 'ascending',
    phaseProgress: 0,
    cycleIndex: 0,
    snapshot: emptySnapshot(),
  };
  state.empire.sites.push(site);
  state.empire.sites.sort((a, b) => siteDef(a.id).index - siteDef(b.id).index);
  state.counters.highestSiteEver = Math.max(state.counters.highestSiteEver, def.index);
  startCycle(state, site, onlineCtx(events));
  return site;
}

export function newGame(now: number, seeds?: { coin: number; relic: number; saveId?: string }): GameState {
  const state: GameState = {
    schemaVersion: SCHEMA_VERSION,
    contentVersion: catalog.contentVersion,
    revision: 0,
    saveId: seeds?.saveId ?? `save-${now.toString(36)}-${randomSeed().toString(36)}`,
    lastSettledUtc: now,
    paused: false,
    wallet: { obols: Money.ZERO, runGross: Money.ZERO, bestRunGross: Money.ZERO },
    prestige: { lifetimeInsightAwarded: 0, insightSpent: 0, permanentUpgradeIds: [] },
    empire: {
      foremanOwned: false,
      selectedSiteId: catalog.sites[0].id,
      sites: [],
      purchasedWorkIds: [],
      offeredSiteIds: [],
    },
    discoveries: {
      seenWorkIds: [],
      relicIds: [],
      seenStoryIds: [],
      archiveIds: ['sisyphus', 'vase_painting'],
      achievementIds: [],
      tutorialIds: [],
    },
    counters: { totalClimbs: 0, totalImpacts: 0, totalRuns: 0, totalActiveSeconds: 0, highestSiteEver: 0 },
    random: {
      coinRngState: seeds?.coin ?? randomSeed(),
      relicRngState: seeds?.relic ?? randomSeed(),
      relicCountdown: null,
      eligibleSiteId: null,
    },
    options: { ...DEFAULT_OPTIONS },
  };
  createSite(state, catalog.sites[0], []);
  refreshRelicEligibility(state);
  return state;
}

// --------------------------------------------------------------- purchases

export function buyLevels(
  state: GameState,
  siteId: string,
  track: LevelTrack,
  count: number,
  events: GameEvent[],
): CommandResult {
  const site = findSite(state, siteId);
  if (!site) return fail('site-not-owned');
  if (!Number.isInteger(count) || count < 1) return fail('bad-count');
  const from = currentLevel(site, track);
  if (from + count > levelCap(track)) return fail('level-cap');
  if (track === 'strength') {
    for (let l = from; l < from + count; l++) {
      if (!strengthLevelEffective(state, site, l)) return fail('ineffective');
    }
  }
  const cost = bulkCost(site, track, count);
  if (!cost) return fail('level-cap');
  if (cost.gt(state.wallet.obols)) return fail('insufficient-funds');

  debit(state, cost);
  const milestonesBefore = milestoneCount(site.productionLevel);
  if (track === 'production') site.productionLevel += count;
  else if (track === 'strength') site.strengthLevel += count;
  else site.impactLevel += count;

  events.push({ type: 'PurchaseCompleted', kind: track, siteId, count, cost });
  if (track === 'production') {
    markTutorial(state, 'first_level');
    const reached = catalog.levels.milestones.filter((m) => m > from && m <= site.productionLevel);
    if (milestoneCount(site.productionLevel) > milestonesBefore) {
      for (const level of reached) events.push({ type: 'MilestoneReached', siteId, level });
    }
    restoreFreeWorks(state, events);
  }
  return commit(state);
}

export function buyFlywheel(state: GameState, siteId: string, events: GameEvent[]): CommandResult {
  const site = findSite(state, siteId);
  if (!site) return fail('site-not-owned');
  if (site.wheelOwned) return fail('already-owned');
  const cost = flywheelCost(site);
  if (cost.gt(state.wallet.obols)) return fail('insufficient-funds');
  debit(state, cost);
  site.wheelOwned = true;
  site.wheelCharged = hasUpgrade(state, 'startWithChargedFlywheel');
  markTutorial(state, 'first_wheel');
  events.push({ type: 'PurchaseCompleted', kind: 'flywheel', siteId, cost });
  triggerStory(state, 'flywheel_purchase', events);
  return commit(state);
}

export function hireForeman(state: GameState, events: GameEvent[]): CommandResult {
  if (state.empire.foremanOwned) return fail('already-owned');
  if (!state.empire.sites.some((s) => s.wheelOwned)) return fail('needs-flywheel');
  const cost = catalog.levels.foremanCost;
  if (cost.gt(state.wallet.obols)) return fail('insufficient-funds');
  debit(state, cost);
  state.empire.foremanOwned = true;
  markTutorial(state, 'foreman');
  events.push({ type: 'PurchaseCompleted', kind: 'foreman', cost });
  triggerStory(state, 'foreman_contract', events);
  return commit(state);
}

function workAvailable(state: GameState, workId: string): boolean {
  const def = workDef(workId);
  const site = findSite(state, def.siteId);
  return !!site && site.productionLevel >= def.requiredLevel && !state.empire.purchasedWorkIds.includes(workId);
}

function installWork(state: GameState, workId: string, free: boolean, events: GameEvent[]): void {
  const def = workDef(workId);
  state.empire.purchasedWorkIds.push(workId);
  if (!state.discoveries.seenWorkIds.includes(workId)) state.discoveries.seenWorkIds.push(workId);
  if (!state.discoveries.archiveIds.includes(workId)) state.discoveries.archiveIds.push(workId);
  events.push({ type: 'WorkInstalled', workId, free });
  if (def.storyId) triggerStory(state, def.storyId, events);
  for (const relic of catalog.relics.catalog) {
    if (relic.guaranteedBy === `work:${workId}`) grantRelic(state, relic.id, events);
  }
  if (def.effect === 'incomeMultiplierAndEnding') events.push({ type: 'CharterSigned' });
}

export function buyWork(state: GameState, workId: string, events: GameEvent[]): CommandResult {
  const def = catalog.works.find((w) => w.id === workId);
  if (!def) return fail('unknown-work');
  if (state.empire.purchasedWorkIds.includes(workId)) return fail('already-owned');
  if (!workAvailable(state, workId)) return fail('requirement-not-met');
  if (def.cost.gt(state.wallet.obols)) return fail('insufficient-funds');
  debit(state, def.cost);
  events.push({ type: 'PurchaseCompleted', kind: 'work', cost: def.cost });
  installWork(state, workId, false, events);
  return commit(state);
}

/** Signed in Advance: earlier-run works return free when conditions are met. */
export function restoreFreeWorks(state: GameState, events: GameEvent[]): void {
  if (!hasUpgrade(state, 'freeWorkRestoration')) return;
  for (const def of catalog.works) {
    if (def.effect === 'incomeMultiplierAndEnding') continue;
    if (!state.discoveries.seenWorkIds.includes(def.id)) continue;
    if (workAvailable(state, def.id)) installWork(state, def.id, true, events);
  }
}

export function openSite(state: GameState, siteId: string, events: GameEvent[]): CommandResult {
  const def = catalog.sites.find((s) => s.id === siteId);
  if (!def) return fail('unknown-site');
  if (findSite(state, siteId)) return fail('already-owned');
  const prev = catalog.sites[def.index - 1];
  if (!prev || !findSite(state, prev.id)) return fail('previous-not-owned');
  if (state.wallet.runGross.lt(def.defianceGate)) return fail('gate-not-met');
  if (def.unlockCost.gt(state.wallet.obols)) return fail('insufficient-funds');

  debit(state, def.unlockCost);
  for (const relic of catalog.relics.catalog) {
    if (relic.guaranteedBy === `open:${siteId}`) grantRelic(state, relic.id, events);
  }
  state.empire.offeredSiteIds = state.empire.offeredSiteIds.filter((id) => id !== siteId);
  createSite(state, def, events);
  if (!state.discoveries.archiveIds.includes(`site.${siteId}`)) state.discoveries.archiveIds.push(`site.${siteId}`);
  markTutorial(state, 'first_expansion');
  events.push({ type: 'PurchaseCompleted', kind: 'site', siteId, cost: def.unlockCost });
  events.push({ type: 'SiteOpened', siteId });
  refreshRelicEligibility(state);
  restoreFreeWorks(state, events);
  return commit(state);
}

export function selectSite(state: GameState, siteId: string): CommandResult {
  if (!findSite(state, siteId)) return fail('site-not-owned');
  state.empire.selectedSiteId = siteId;
  return commit(state);
}

// ---------------------------------------------------------------- prestige

export function buyInsightUpgrade(state: GameState, upgradeId: string, events: GameEvent[]): CommandResult {
  const def = catalog.insightUpgrades.find((u) => u.id === upgradeId);
  if (!def) return fail('unknown-upgrade');
  const owned = state.prestige.permanentUpgradeIds;
  if (owned.includes(upgradeId)) return fail('already-owned');
  const prev = catalog.insightUpgrades.find((u) => u.order === def.order - 1);
  if (prev && !owned.includes(prev.id)) return fail('previous-not-owned');
  if (spendableInsight(state) < def.cost) return fail('insufficient-insight');

  state.prestige.insightSpent += def.cost;
  owned.push(upgradeId);
  events.push({ type: 'PurchaseCompleted', kind: 'insight', cost: Money.of(def.cost) });

  // Effects that apply to the run already in progress.
  if (def.effect === 'startWithForeman') state.empire.foremanOwned = true;
  if (def.effect === 'startWithChargedFlywheel') {
    for (const s of state.empire.sites) {
      s.wheelOwned = true;
      s.wheelCharged = true;
    }
  }
  if (def.effect === 'freeWorkRestoration') restoreFreeWorks(state, events);
  return commit(state);
}

export interface PrestigePreview {
  revision: number;
  record: Money;
  runGross: Money;
  entitlement: number;
  award: number;
  factorBefore: number;
  factorAfter: number;
}

export function previewPrestige(state: GameState): PrestigePreview {
  const record = prestigeRecord(state);
  const award = availableInsight(state);
  const lifetime = state.prestige.lifetimeInsightAwarded;
  return {
    revision: state.revision,
    record,
    runGross: state.wallet.runGross,
    entitlement: prestigeEntitlement(record),
    award,
    factorBefore: insightFactor(lifetime),
    factorAfter: insightFactor(lifetime + award),
  };
}

/** Atomic Begin Again. The caller settles simulation first and saves a backup. */
export function confirmPrestige(state: GameState, events: GameEvent[]): CommandResult {
  const award = availableInsight(state);
  if (award <= 0) return fail('no-award');

  state.prestige.lifetimeInsightAwarded += award;
  state.wallet.bestRunGross = prestigeRecord(state);
  state.wallet.obols = Money.ZERO;
  state.wallet.runGross = Money.ZERO;
  state.empire.sites = [];
  state.empire.purchasedWorkIds = [];
  state.empire.offeredSiteIds = [];
  state.empire.selectedSiteId = catalog.sites[0].id;
  state.empire.foremanOwned = hasUpgrade(state, 'startWithForeman');
  state.random.eligibleSiteId = null;
  state.random.relicCountdown = null;
  state.counters.totalRuns += 1;

  createSite(state, catalog.sites[0], events);
  refreshRelicEligibility(state);
  if (!state.discoveries.archiveIds.includes('thanatos')) state.discoveries.archiveIds.push('thanatos');
  events.push({ type: 'PrestigeCompleted', award });
  triggerStory(state, 'first_prestige', events);
  return commit(state);
}
