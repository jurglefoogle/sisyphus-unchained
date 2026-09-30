import { catalog, siteDef, workDef, type SiteDef } from '../content/catalog';
import { deviceDef } from '../content/devices';
import { modifiers } from './effects';
import { canVent, furnaceSite, newFurnace } from './furnace';
import { jarSite, newJar } from './jar';
import { foundrySite, newFoundry } from './foundry';
import { canTurn, isConstellation, newSky, skySite, turn } from './sky';
import { bureauSite, clerkCost, newBureau, recordDueProcess } from './bureau';
import {
  availableInsight,
  bulkCost,
  counterweightCost,
  counterweightUnlocked,
  drillCost,
  currentLevel,
  flywheelCost,
  flywheelOffered,
  foremanUnlocked,
  hasUpgrade,
  insightFactor,
  levelCap,
  milestoneCount,
  nextPreludeUpgrade,
  prestigeEntitlement,
  prestigeRecord,
  spendableInsight,
  stewardCost,
  stewardInsightCost,
  stewardOffered,
  strengthLevelEffective,
  tabletCost,
  tabletLevel,
  type LevelTrack,
} from './formulas';
import { Money } from './money';
import { randomSeed } from './rng';
import { checkVisitor, dealHand, noteAtlasTurn, notePatch, notePauseEnded, revealDevice, visitorWaiting } from './seals';
import { trialMet } from './trials';
import { gateOf, scornCost, scornOpen, unlockCostOf, workCostOf } from './formulas';
import { remembranceFor, tabletPool, visitorFor } from '../content/devices';
import {
  findSite,
  grantRelic,
  eruptNow,
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

/** Every price is paid from one hill's own purse; money never crosses hills. */
function debit(site: SiteState, cost: Money): void {
  site.purse = site.purse.sub(cost);
}

/** The First Hill pays for the opening, the grip and the foreman. */
function firstHill(state: GameState): SiteState {
  return state.empire.sites[0];
}

function commit(state: GameState): CommandResult {
  state.revision += 1;
  // Due Process is recorded as the empire changes hands, never mid-settlement.
  recordDueProcess(state);
  return OK;
}

// ------------------------------------------------------------ construction

function createSite(state: GameState, def: SiteDef, events: GameEvent[]): SiteState {
  const machinery = hasUpgrade(state, 'startWithChargedFlywheel');
  const hand = dealHand(state, def.id);
  const site: SiteState = {
    id: def.id,
    purse: Money.ZERO,
    gross: Money.ZERO,
    steward: null,
    productionLevel: def.index > 0 && hasUpgrade(state, 'openAtLevelFive') ? 5 : 1,
    strengthLevel: 0,
    impactLevel: 0,
    // The flywheel belongs to hills without a machine of their own.
    wheelOwned: machinery && !furnaceSite(def.id),
    wheelCharged: machinery && !furnaceSite(def.id),
    counterweight: null,
    furnace: furnaceSite(def.id) ? newFurnace() : null,
    jar: jarSite(def.id) ? newJar() : null,
    foundry: foundrySite(def.id) ? newFoundry(hand) : null,
    sky: skySite(def.id) ? newSky() : null,
    bureau: bureauSite(def.id) ? newBureau() : null,
    hand,
    devices: [],
    peeked: [],
    summoned: false,
    trial: 0,
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

export function newGame(now: number, seeds?: { coin: number; relic: number; deal?: number; saveId?: string }): GameState {
  const state: GameState = {
    schemaVersion: SCHEMA_VERSION,
    contentVersion: catalog.contentVersion,
    revision: 0,
    saveId: seeds?.saveId ?? `save-${now.toString(36)}-${randomSeed().toString(36)}`,
    lastSettledUtc: now,
    paused: false,
    pausedAtUtc: null,
    pinnedGoal: null,
    wallet: { runGross: Money.ZERO, bestRunGross: Money.ZERO },
    prelude: { complete: false, upgradeIds: [], bestHeight: 0, attempts: 0 },
    records: { runSeconds: 0, campaignSeconds: 0, firstCharterSeconds: null, charterSeconds: {} },
    appeal: { number: 0, laurels: 0 },
    prestige: { lifetimeInsightAwarded: 0, giftedInsight: 0, insightSpent: 0, permanentUpgradeIds: [], remembrances: {}, fileSlots: [], filed: {}, scorn: 0 },
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
      codexIds: [],
      whisperIds: [],
      rumourIds: [],
    },
    counters: { totalClimbs: 0, totalImpacts: 0, totalRuns: 0, totalActiveSeconds: 0, highestSiteEver: 0, manualSummits: 0, fullEruptions: 0, atlasTurns: 0 },
    random: {
      coinRngState: seeds?.coin ?? randomSeed(),
      relicRngState: seeds?.relic ?? randomSeed(),
      dealRngState: seeds?.deal ?? ((seeds?.coin ?? randomSeed()) ^ 0x5eed1e55) >>> 0,
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
  const cost = bulkCost(state, site, track, count);
  if (!cost) return fail('level-cap');
  if (cost.gt(site.purse)) return fail('insufficient-funds');

  debit(site, cost);
  const milestonesBefore = milestoneCount(site.productionLevel);
  if (track === 'production') site.productionLevel += count;
  else if (track === 'strength') site.strengthLevel += count;
  else site.impactLevel += count;

  events.push({ type: 'PurchaseCompleted', kind: track, siteId, count, cost });
  if (track === 'production') {
    markTutorial(state, 'first_level');
    announceUnlocks(state, from, events);
    const reached = catalog.levels.milestones.filter((m) => m > from && m <= site.productionLevel);
    if (milestoneCount(site.productionLevel) > milestonesBefore) {
      for (const level of reached) events.push({ type: 'MilestoneReached', siteId, level });
    }
    restoreFreeWorks(state, events);
    checkVisitor(site, from, events);
  }
  return commit(state);
}

/** First-run discoveries unlocked by First Hill levels (see `automation` in economy data). */
function announceUnlocks(state: GameState, fromLevel: number, events: GameEvent[]): void {
  const hill = findSite(state, catalog.sites[0].id);
  if (!hill || hill.productionLevel === fromLevel) return;
  const a = catalog.automation;
  const crossed = (level: number) => fromLevel < level && hill.productionLevel >= level;
  if (crossed(a.flywheelUnlockLevel) && !state.discoveries.tutorialIds.includes('first_wheel')) {
    events.push({ type: 'FeatureUnlocked', feature: 'flywheel' });
  }
  if (crossed(a.foremanUnlockLevel) && !state.discoveries.tutorialIds.includes('foreman')) {
    events.push({ type: 'FeatureUnlocked', feature: 'foreman' });
  }
}

/** Prelude grip upgrades are bought once each, in order. */
export function buyPreludeUpgrade(state: GameState, upgradeId: string, events: GameEvent[]): CommandResult {
  if (state.prelude.complete) return fail('prelude-complete');
  const def = catalog.prelude.upgrades.find((u) => u.id === upgradeId);
  if (!def) return fail('unknown-upgrade');
  if (state.prelude.upgradeIds.includes(upgradeId)) return fail('already-owned');
  if (nextPreludeUpgrade(state)?.id !== upgradeId) return fail('previous-not-owned');
  if (def.cost.gt(firstHill(state).purse)) return fail('insufficient-funds');
  debit(firstHill(state), def.cost);
  state.prelude.upgradeIds.push(upgradeId);
  events.push({ type: 'PurchaseCompleted', kind: 'prelude', siteId: catalog.sites[0].id, cost: def.cost });
  return commit(state);
}

export function buyFlywheel(state: GameState, siteId: string, events: GameEvent[]): CommandResult {
  const site = findSite(state, siteId);
  if (!site) return fail('site-not-owned');
  if (site.wheelOwned) return fail('already-owned');
  if (!flywheelOffered(state, site)) return fail('locked');
  const cost = flywheelCost(state, site);
  if (cost.gt(site.purse)) return fail('insufficient-funds');
  debit(site, cost);
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
  if (!foremanUnlocked(state)) return fail('locked');
  const cost = catalog.levels.foremanCost;
  if (cost.gt(firstHill(state).purse)) return fail('insufficient-funds');
  debit(firstHill(state), cost);
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

export function installWork(state: GameState, workId: string, free: boolean, events: GameEvent[]): void {
  const def = workDef(workId);
  state.empire.purchasedWorkIds.push(workId);
  if (!state.discoveries.seenWorkIds.includes(workId)) state.discoveries.seenWorkIds.push(workId);
  if (!state.discoveries.archiveIds.includes(workId)) state.discoveries.archiveIds.push(workId);
  events.push({ type: 'WorkInstalled', workId, free });
  if (def.storyId) triggerStory(state, def.storyId, events);
  for (const relic of catalog.relics.catalog) {
    if (relic.guaranteedBy === `work:${workId}`) grantRelic(state, relic.id, events);
  }
  if (def.effect === 'incomeMultiplierAndEnding') {
    events.push({ type: 'CharterSigned' });
    recordCharter(state);
    // Signing under an Appeal wins it: a laurel, kept for good.
    if (state.appeal.number > state.appeal.laurels) {
      state.appeal.laurels = state.appeal.number;
      events.push({ type: 'LaurelWon', number: state.appeal.number });
    }
  }
}

export function buyWork(state: GameState, workId: string, events: GameEvent[]): CommandResult {
  const def = catalog.works.find((w) => w.id === workId);
  if (!def) return fail('unknown-work');
  if (state.empire.purchasedWorkIds.includes(workId)) return fail('already-owned');
  if (!workAvailable(state, workId)) return fail('requirement-not-met');
  const site = findSite(state, def.siteId)!;
  const price = workCostOf(state, def);
  if (price.gt(site.purse)) return fail('insufficient-funds');
  debit(site, price);
  events.push({ type: 'PurchaseCompleted', kind: 'work', siteId: site.id, cost: price });
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
  const prevDef = catalog.sites[def.index - 1];
  const prev = prevDef ? findSite(state, prevDef.id) : undefined;
  if (!prev) return fail('previous-not-owned');
  if (!state.empire.offeredSiteIds.includes(siteId) && (prev.gross.lt(gateOf(state, def)) || !trialMet(prev))) return fail('gate-not-met');
  // The frontier pays for its successor, in its own currency.
  const price = unlockCostOf(state, def);
  if (price.gt(prev.purse)) return fail('insufficient-funds');

  debit(prev, price);
  for (const relic of catalog.relics.catalog) {
    if (relic.guaranteedBy === `open:${siteId}`) grantRelic(state, relic.id, events);
  }
  state.empire.offeredSiteIds = state.empire.offeredSiteIds.filter((id) => id !== siteId);
  createSite(state, def, events);
  if (!state.discoveries.archiveIds.includes(`site.${siteId}`)) state.discoveries.archiveIds.push(`site.${siteId}`);
  markTutorial(state, 'first_expansion');
  events.push({ type: 'PurchaseCompleted', kind: 'site', siteId, cost: price });
  events.push({ type: 'SiteOpened', siteId });
  refreshRelicEligibility(state);
  restoreFreeWorks(state, events);
  return commit(state);
}

// ----------------------------------------------------------- counterweight

/** The First Hill's second machine: a basket of stones over a summit pulley. */
export function installCounterweight(state: GameState, siteId: string, events: GameEvent[]): CommandResult {
  const site = findSite(state, siteId);
  if (!site) return fail('site-not-owned');
  if (site.counterweight !== null) return fail('already-owned');
  if (!counterweightUnlocked(site)) return fail('locked');
  const cost = counterweightCost(state, site);
  if (cost.gt(site.purse)) return fail('insufficient-funds');
  debit(site, cost);
  site.counterweight = 0;
  markTutorial(state, 'counterweight');
  events.push({ type: 'PurchaseCompleted', kind: 'counterweight', siteId, cost });
  return commit(state);
}

/** Stones in the basket: faster climbs, braked falls. A setting, free to change. */
export function setTrim(state: GameState, siteId: string, trim: number): CommandResult {
  const site = findSite(state, siteId);
  if (!site || site.counterweight === null) return fail('no-counterweight');
  if (!Number.isInteger(trim) || trim < 0 || trim > catalog.counterweight.maxTrim) return fail('bad-trim');
  if (trim === site.counterweight) return fail('unchanged');
  site.counterweight = trim;
  return commit(state);
}

// ----------------------------------------------------------------- seals

/** Break the seal on a dealt tablet: pay, and learn what it does by owning it. */
export function breakSeal(state: GameState, siteId: string, index: number, events: GameEvent[]): CommandResult {
  const site = findSite(state, siteId);
  if (!site) return fail('site-not-owned');
  const deviceId = site.hand[index];
  if (!deviceId) return fail('no-tablet');
  // The Bronze Pass casts its devices in the Foundry; they are never bought.
  if (site.foundry) return fail('cast-not-bought');
  if (site.devices.includes(deviceId)) return fail('already-owned');
  if (site.productionLevel < tabletLevel(index)) return fail('locked');
  const cost = tabletCost(state, site, index);
  if (cost.gt(site.purse)) return fail('insufficient-funds');
  debit(site, cost);
  events.push({ type: 'PurchaseCompleted', kind: 'seal', siteId, cost });
  revealDevice(state, site, deviceId, events);
  return commit(state);
}

/** Take one of the visitor's two sealed bargains; the other stays sealed for a later run. */
export function takeBargain(state: GameState, siteId: string, bargainId: string, events: GameEvent[]): CommandResult {
  const site = findSite(state, siteId);
  if (!site) return fail('site-not-owned');
  const visitor = visitorWaiting(site);
  if (!visitor) return fail('no-visitor');
  if (!visitor.bargains.includes(bargainId) || deviceDef(bargainId).source !== 'bargain') return fail('unknown-bargain');
  revealDevice(state, site, bargainId, events);
  // Six Seeds and the like: a gift of crew levels, once, on every hill held.
  for (const e of deviceDef(bargainId).effects) {
    if (e.kind !== 'freeCrew') continue;
    for (const s of state.empire.sites) {
      const before = s.productionLevel;
      s.productionLevel = Math.min(catalog.levels.productionCap, s.productionLevel + e.levels);
      if (s.productionLevel > before) checkVisitor(s, before, events);
    }
  }
  return commit(state);
}

// ------------------------------------------------------------------ furnace

/** Vent Ixion's Wheel now: a smaller eruption, sooner. */
export function vent(state: GameState, siteId: string, events: GameEvent[]): CommandResult {
  const site = findSite(state, siteId);
  if (!site?.furnace) return fail('no-furnace');
  if (!canVent(site.furnace)) return fail(site.furnace.erupting > 0 ? 'erupting' : 'too-cold');
  eruptNow(state, site, onlineCtx(events));
  return commit(state);
}

/** The heat at which the steward vents (0..1, in steps of 5 percent). */
export function setVentAt(state: GameState, siteId: string, heat: number): CommandResult {
  const site = findSite(state, siteId);
  if (!site?.furnace) return fail('no-furnace');
  const v = Math.round(heat * 20) / 20;
  if (!Number.isFinite(v) || v < catalog.furnace.minVent - 1e-9 || v > 1) return fail('bad-heat');
  if (Math.abs(v - site.furnace.ventAt) < 1e-9) return fail('unchanged');
  site.furnace.ventAt = v;
  return commit(state);
}

// ---------------------------------------------------------------------- mill

/** Hire a clerk for the Mill (and put them at a desk). */
export function hireClerk(state: GameState, siteId: string): CommandResult {
  const site = findSite(state, siteId);
  const b = site?.bureau;
  if (!b) return fail('no-bureau');
  const cost = clerkCost(state, site.id, b.hired, modifiers(state, site.id));
  if (site.purse.lt(cost)) return fail('insufficient-funds');
  site.purse = site.purse.sub(cost);
  b.hired += 1;
  b.onDuty += 1;
  return commit(state);
}

/** How many clerks sit at their desks (the rest let the backlog ripen). */
export function setOnDuty(state: GameState, siteId: string, clerks: number): CommandResult {
  const b = findSite(state, siteId)?.bureau;
  if (!b) return fail('no-bureau');
  if (!Number.isInteger(clerks) || clerks < 0 || clerks > b.hired) return fail('bad-count');
  if (clerks === b.onDuty) return fail('unchanged');
  b.onDuty = clerks;
  return commit(state);
}

// -------------------------------------------------------------------- orrery

/**
 * Mount a revealed constellation in a house (null takes it down). A
 * constellation already in that house swaps into this one's old place.
 */
export function mount(state: GameState, siteId: string, deviceId: string, house: number | null): CommandResult {
  const site = findSite(state, siteId);
  const sky = site?.sky;
  if (!sky) return fail('no-sky');
  if (!site.devices.includes(deviceId) || !isConstellation(deviceId)) return fail('not-revealed');
  const from = sky.houses.indexOf(deviceId);
  if (house === null) {
    if (from < 0) return fail('unchanged');
    sky.houses[from] = null;
    return commit(state);
  }
  if (!Number.isInteger(house) || house < 0 || house >= sky.houses.length) return fail('bad-house');
  if (from === house) return fail('unchanged');
  const there = sky.houses[house];
  sky.houses[house] = deviceId;
  if (from >= 0) sky.houses[from] = there;
  return commit(state);
}

/** Ask Atlas to turn the sky to the next mounted house. */
export function turnSky(state: GameState, siteId: string, events: GameEvent[]): CommandResult {
  const site = findSite(state, siteId);
  const sky = site?.sky;
  if (!sky) return fail('no-sky');
  if (!canTurn(sky)) return fail(sky.cooldown > 0 ? 'resting' : 'nothing-mounted');
  turn(modifiers(state, site.id), sky);
  noteAtlasTurn(state, events);
  return commit(state);
}

// ------------------------------------------------------------------ foundry

/** The share of each payout poured as bronze, in tenths. */
export function setSplit(state: GameState, siteId: string, split: number): CommandResult {
  const site = findSite(state, siteId);
  if (!site?.foundry) return fail('no-foundry');
  const v = Math.round(split * 10) / 10;
  if (!Number.isFinite(v) || v < 0 || v > 1) return fail('bad-split');
  if (Math.abs(v - site.foundry.split) < 1e-9) return fail('unchanged');
  site.foundry.split = v;
  return commit(state);
}

/** Pour this blueprint next (bronze already in the mould goes with it), and resume. */
export function pourNext(state: GameState, siteId: string, deviceId: string): CommandResult {
  const site = findSite(state, siteId);
  const f = site?.foundry;
  if (!f) return fail('no-foundry');
  const at = f.queue.indexOf(deviceId);
  if (at < 0) return fail('no-blueprint');
  if (at === 0 && !f.paused) return fail('unchanged');
  f.queue.splice(at, 1);
  f.queue.unshift(deviceId);
  f.paused = false;
  return commit(state);
}

// ---------------------------------------------------------------------- jar

/** Drill the jar: more holes, more leak, less pressure. */
export function drill(state: GameState, siteId: string): CommandResult {
  const site = findSite(state, siteId);
  if (!site?.jar) return fail('no-jar');
  if (site.jar.holes >= catalog.jar.maxHoles) return fail('max');
  const cost = drillCost(state, site);
  if (site.purse.lt(cost)) return fail('insufficient-funds');
  site.purse = site.purse.sub(cost);
  const add = modifiers(state, site.id).jarDoubleDrill ? 2 : 1;
  site.jar.holes = Math.min(catalog.jar.maxHoles, site.jar.holes + add);
  return commit(state);
}

/** Patch a hole (free). The last one cannot be patched: someone is using it. */
export function patch(state: GameState, siteId: string, events: GameEvent[]): CommandResult {
  const site = findSite(state, siteId);
  if (!site?.jar) return fail('no-jar');
  if (site.jar.holes <= 1) {
    notePatch(state, 1, true, events);
    return fail('last-hole');
  }
  site.jar.holes -= 1;
  notePatch(state, site.jar.holes, false, events);
  return commit(state);
}

/** The peak level Danaus holds (in steps of 5 percent). */
export function setJarTarget(state: GameState, siteId: string, level: number): CommandResult {
  const site = findSite(state, siteId);
  if (!site?.jar) return fail('no-jar');
  const v = Math.round(level * 20) / 20;
  if (!Number.isFinite(v) || v < catalog.jar.minTarget - 1e-9 || v > 1) return fail('bad-level');
  if (Math.abs(v - site.jar.target) < 1e-9) return fail('unchanged');
  site.jar.target = v;
  return commit(state);
}

/** Pausing and resuming: a long enough sit is noticed. */
export function setPausedAt(state: GameState, paused: boolean, now: number, events: GameEvent[]): void {
  if (paused) {
    state.pausedAtUtc ??= now;
  } else if (state.pausedAtUtc !== null) {
    notePauseEnded(state, Math.max(0, (now - state.pausedAtUtc) / 1000), events);
    state.pausedAtUtc = null;
  }
}

// ---------------------------------------------------------------- stewards

/**
 * A steward takes over a hill the player has moved on from. Offered for the
 * hill's own money once its successor opens; Insight hires one early, for this run.
 */
export function hireSteward(state: GameState, siteId: string, paidWith: 'local' | 'insight', events: GameEvent[]): CommandResult {
  const site = findSite(state, siteId);
  if (!site) return fail('site-not-owned');
  if (site.steward) return fail('already-owned');
  if (paidWith === 'local') {
    if (!stewardOffered(state, site)) return fail('locked');
    const cost = stewardCost(state, site);
    if (cost.gt(site.purse)) return fail('insufficient-funds');
    debit(site, cost);
    events.push({ type: 'PurchaseCompleted', kind: 'steward', siteId, cost });
  } else {
    const cost = stewardInsightCost(site);
    if (spendableInsight(state) < cost) return fail('insufficient-insight');
    state.prestige.insightSpent += cost;
    events.push({ type: 'PurchaseCompleted', kind: 'steward', siteId, cost: Money.of(cost) });
  }
  site.steward = { reinvest: true, paidWith };
  events.push({ type: 'StewardHired', siteId, paidWith });
  return commit(state);
}

export function setStewardOrder(state: GameState, siteId: string, reinvest: boolean): CommandResult {
  const site = findSite(state, siteId);
  if (!site?.steward) return fail('no-steward');
  site.steward.reinvest = reinvest;
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

// ------------------------------------------------------------------ memory

function spendInsight(state: GameState, cost: number): boolean {
  if (spendableInsight(state) < cost) return false;
  state.prestige.insightSpent += cost;
  return true;
}

/** A hill held in some run (its name is in the Archive). */
function hillKnown(state: GameState, siteId: string): boolean {
  return state.discoveries.archiveIds.includes(`site.${siteId}`) || siteId === catalog.sites[0].id;
}

/** Buy the next rank of Scorn: every crew's pay multiplied, in every run. */
export function buyScorn(state: GameState, events: GameEvent[]): CommandResult {
  if (!scornOpen(state)) return fail('locked');
  const cost = scornCost(state);
  if (!spendInsight(state, cost)) return fail('insufficient-insight');
  state.prestige.scorn += 1;
  events.push({ type: 'PurchaseCompleted', kind: 'insight', cost: Money.of(cost) });
  return commit(state);
}

/** Buy the next Remembrance rank for a hill. */
export function remember(state: GameState, siteId: string, events: GameEvent[]): CommandResult {
  if (!remembranceFor(siteId)) return fail('unknown-site');
  if (!hillKnown(state, siteId)) return fail('site-unknown');
  const rank = state.prestige.remembrances[siteId] ?? 0;
  const costs = catalog.memory.remembranceCosts;
  if (rank >= costs.length) return fail('max-rank');
  if (!spendInsight(state, costs[rank])) return fail('insufficient-insight');
  state.prestige.remembrances[siteId] = rank + 1;
  events.push({ type: 'PurchaseCompleted', kind: 'insight', cost: Money.of(costs[rank]) });
  return commit(state);
}

/**
 * Keep a revealed device on file for its hill: it is dealt in every later run.
 * Opening a hill's file costs Insight once; changing or clearing it is free.
 */
export function keepOnFile(state: GameState, siteId: string, deviceId: string | null): CommandResult {
  if (!catalog.sites.some((s) => s.id === siteId)) return fail('unknown-site');
  if (deviceId !== null) {
    if (!tabletPool(siteId).some((d) => d.id === deviceId)) return fail('not-a-tablet');
    if (!state.discoveries.codexIds.includes(deviceId)) return fail('not-revealed');
  }
  if (!state.prestige.fileSlots.includes(siteId)) {
    if (deviceId === null) return fail('unchanged');
    if (!spendInsight(state, catalog.memory.keepOnFile)) return fail('insufficient-insight');
    state.prestige.fileSlots.push(siteId);
  }
  if (deviceId === null) delete state.prestige.filed[siteId];
  else state.prestige.filed[siteId] = deviceId;
  return commit(state);
}

/** Unseal in Advance: read a dealt tablet's rule before breaking its seal (this run). */
export function unseal(state: GameState, siteId: string, index: number): CommandResult {
  const site = findSite(state, siteId);
  if (!site) return fail('site-not-owned');
  const id = site.hand[index];
  if (!id || site.devices.includes(id)) return fail('no-seal');
  if (site.peeked.includes(id)) return fail('already-read');
  if (!spendInsight(state, catalog.memory.unseal)) return fail('insufficient-insight');
  site.peeked.push(id);
  return commit(state);
}

/** Send for a hill's visitor before the crew reaches them (this run). */
export function summonVisitor(state: GameState, siteId: string, events: GameEvent[]): CommandResult {
  const site = findSite(state, siteId);
  if (!site) return fail('site-not-owned');
  const v = visitorFor(siteId);
  if (!v || site.summoned || site.productionLevel >= v.arrivesAt) return fail('not-needed');
  if (v.bargains.some((b) => site.devices.includes(b))) return fail('already-met');
  if (!spendInsight(state, catalog.memory.summon)) return fail('insufficient-insight');
  site.summoned = true;
  events.push({ type: 'VisitorArrived', siteId, visitorId: v.id });
  return commit(state);
}

// ------------------------------------------------------------------ records

/** Game time passes: play, or an absence as counted. */
export function passTime(state: GameState, seconds: number): void {
  const r = state.records;
  if (r.runSeconds !== null) r.runSeconds += seconds;
  if (r.campaignSeconds !== null) r.campaignSeconds += seconds;
}

function recordCharter(state: GameState): void {
  const r = state.records;
  if (r.firstCharterSeconds === null && r.campaignSeconds !== null) r.firstCharterSeconds = r.campaignSeconds;
  if (r.runSeconds === null) return;
  const key = String(state.appeal.number);
  const best = r.charterSeconds[key];
  if (best === undefined || r.runSeconds < best) r.charterSeconds[key] = r.runSeconds;
}

// ------------------------------------------------------------------ appeals

/** The Charter is signed in this run. */
export function charterSigned(state: GameState): boolean {
  return catalog.works.some((w) => w.effect === 'incomeMultiplierAndEnding' && state.empire.purchasedWorkIds.includes(w.id));
}

/**
 * Thanatos files the next Appeal: the run closes (its Insight paid, as with
 * Begin Again) and a new one begins under the Appeal's twist, gates higher.
 */
export function fileAppeal(state: GameState, events: GameEvent[]): CommandResult {
  if (!charterSigned(state)) return fail('charter-not-signed');
  state.appeal.number = state.appeal.laurels + 1;
  const award = closeRun(state, events);
  events.push({ type: 'AppealFiled', number: state.appeal.number, award });
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
  closeRun(state, events);
  if (!state.discoveries.archiveIds.includes('thanatos')) state.discoveries.archiveIds.push('thanatos');
  markTutorial(state, 'prestige_prompt');
  events.push({ type: 'PrestigeCompleted', award });
  triggerStory(state, 'first_prestige', events);
  return commit(state);
}

/**
 * Pay the run's Insight award, record it, and restart on the First Hill with
 * permanent benefits. Shared by Begin Again and the schema 3 renegotiation.
 */
export function closeRun(state: GameState, events: GameEvent[]): number {
  // The Missing Funeral: a hill that owned it comes back already staffed.
  const rebirth = new Map(state.empire.sites.map((s) => [s.id, modifiers(state, s.id).rebirth]));
  const award = availableInsight(state);
  state.prestige.lifetimeInsightAwarded += award;
  state.wallet.bestRunGross = prestigeRecord(state);
  state.wallet.runGross = Money.ZERO;
  state.empire.sites = [];
  state.empire.purchasedWorkIds = [];
  state.empire.offeredSiteIds = [];
  state.empire.selectedSiteId = catalog.sites[0].id;
  state.empire.foremanOwned = hasUpgrade(state, 'startWithForeman');
  state.random.eligibleSiteId = null;
  state.random.relicCountdown = null;
  state.counters.totalRuns += 1;
  state.records.runSeconds = 0;

  const first = createSite(state, catalog.sites[0], events);
  first.productionLevel = Math.max(first.productionLevel, rebirth.get(first.id) ?? 0);
  refreshRelicEligibility(state);
  return award;
}
