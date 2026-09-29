import { catalog, siteDef } from '../content/catalog';
import { modifiers, nthMultiplier } from './effects';
import {
  ascentLimit,
  ascentRate,
  baseReward,
  bonusTable,
  cyclePayout,
  descentSeconds,
  fallPayout,
  isAutomated,
  returnSeconds,
  slipSeconds,
  type MotionInput,
} from './formulas';
import { Money } from './money';
import { nextRandom, sampleCappedGeometric } from './rng';
import { afterImpact, copyFurnace, ignite } from './furnace';
import { copyJar, pour } from './jar';
import { copyFoundry, foundryClimb, pourIncome } from './foundry';
import { advanceSky, copySky } from './sky';
import { copyBureau, fileForms, issueEdict, tickEdict } from './bureau';
import { trialClimb, trialMet } from './trials';
import { gateOf } from './formulas';
import { noteFullEruption, noteIdle, noteJarPour, noteManualSummit, noteWish } from './seals';
import type { GameEvent, GameState, SiteState } from './state';

export interface StepContext extends MotionInput {
  events: GameEvent[];
}

/** Tolerance for comparing phase boundary times, in seconds. */
export const TIME_EPS = 1e-6;

// ------------------------------------------------------------- utilities

export function findSite(state: GameState, id: string): SiteState | undefined {
  return state.empire.sites.find((s) => s.id === id);
}

export function cloneSite(site: SiteState): SiteState {
  return {
    ...site,
    furnace: copyFurnace(site.furnace),
    jar: copyJar(site.jar),
    foundry: copyFoundry(site.foundry),
    sky: copySky(site.sky),
    bureau: copyBureau(site.bureau),
    hand: [...site.hand],
    peeked: [...site.peeked],
    devices: [...site.devices],
    snapshot: { ...site.snapshot },
  };
}

function addUnique(list: string[], id: string): boolean {
  if (list.includes(id)) return false;
  list.push(id);
  return true;
}

export function triggerStory(state: GameState, storyId: string, events: GameEvent[]): void {
  const firstTime = addUnique(state.discoveries.seenStoryIds, storyId);
  events.push({ type: 'StoryTriggered', storyId, firstTime });
}

export function markTutorial(state: GameState, id: string): void {
  addUnique(state.discoveries.tutorialIds, id);
}

// ----------------------------------------------------------------- grants

/**
 * Income lands in the earning hill's purse, in its currency, and counts toward
 * Defiance once at that hill's appraisal. Non-income credits (gifts, imports,
 * debug) must not use this function.
 */
export function grantIncome(state: GameState, site: SiteState, amount: Money, events: GameEvent[]): void {
  if (amount.lte(0)) return;
  // On the Bronze Pass part of the pay may go to the pour; it is earned all the same.
  site.purse = site.purse.add(site.foundry ? pourIncome(state, site, amount, events) : amount);
  site.gross = site.gross.add(amount);
  state.wallet.runGross = state.wallet.runGross.add(amount.mul(siteDef(site.id).appraisal));
  checkDecrees(state, events);
}

/** Issue the next decree once the frontier hill's own gross crosses its gate. */
export function checkDecrees(state: GameState, events: GameEvent[]): void {
  for (const def of catalog.sites) {
    if (def.index === 0 || findSite(state, def.id) || state.empire.offeredSiteIds.includes(def.id)) continue;
    const prev = findSite(state, catalog.sites[def.index - 1].id);
    if (!prev || prev.gross.lt(gateOf(state, def)) || !trialMet(prev)) break;
    state.empire.offeredSiteIds.push(def.id);
    events.push({ type: 'DecreeAvailable', siteId: def.id });
    if (def.offerStoryId) triggerStory(state, def.offerStoryId, events);
  }
}

// ----------------------------------------------------------------- relics

export function grantRelic(state: GameState, relicId: string, events: GameEvent[]): void {
  if (!addUnique(state.discoveries.relicIds, relicId)) return;
  addUnique(state.discoveries.archiveIds, `relic.${relicId}`);
  events.push({ type: 'RelicGranted', relicId });
  const pending = catalog.relics.catalog.find((r) => r.eligibleSiteId === state.random.eligibleSiteId);
  if (pending?.id === relicId) {
    state.random.relicCountdown = null;
    state.random.eligibleSiteId = null;
  }
}

/** Only the highest owned operation may discover the next relic. */
export function refreshRelicEligibility(state: GameState): void {
  const highest = state.empire.sites.reduce<SiteState | null>(
    (best, s) => (!best || siteDef(s.id).index > siteDef(best.id).index ? s : best),
    null,
  );
  const relic = highest
    ? catalog.relics.catalog.find(
        (r) => r.eligibleSiteId === highest.id && !state.discoveries.relicIds.includes(r.id),
      )
    : undefined;
  if (!relic) {
    state.random.eligibleSiteId = null;
    state.random.relicCountdown = null;
    return;
  }
  if (state.random.eligibleSiteId === relic.eligibleSiteId && state.random.relicCountdown !== null) return;
  const sample = sampleCappedGeometric(
    state.random.relicRngState,
    catalog.relics.chancePerDescent,
    catalog.relics.pityDescents,
  );
  state.random.relicRngState = sample.state;
  state.random.relicCountdown = sample.count;
  state.random.eligibleSiteId = relic.eligibleSiteId;
}

function relicTick(state: GameState, site: SiteState, events: GameEvent[]): void {
  if (state.random.eligibleSiteId !== site.id || state.random.relicCountdown === null) return;
  state.random.relicCountdown -= 1;
  if (state.random.relicCountdown <= 0) {
    const relic = catalog.relics.catalog.find((r) => r.eligibleSiteId === site.id);
    if (relic) grantRelic(state, relic.id, events);
  }
}

// ----------------------------------------------------------------- cycles

/** Snapshot the payout for a new cycle and roll its bonus target. */
export function startCycle(state: GameState, site: SiteState, ctx: StepContext): void {
  const payout = cyclePayout(state, site);
  let bonus = payout.expectedBonus;
  let bonusTargetId = 'expected';
  if (!ctx.offline) {
    const roll = nextRandom(state.random.coinRngState);
    state.random.coinRngState = roll.state;
    let acc = 0;
    const targets = bonusTable(state, site.id);
    let chosen = targets[targets.length - 1];
    for (const t of targets) {
      acc += t.probability;
      if (roll.value < acc) {
        chosen = t;
        break;
      }
    }
    bonus = payout.base.mul(chosen.baseMultiplier);
    bonusTargetId = chosen.id;
  }
  // Every-Nth devices (Autolycus's Brand, the Isthmian Games) scale the whole cycle.
  const nth = nthMultiplier(modifiers(state, site.id), site.cycleIndex);
  site.phase = 'ascending';
  site.phaseProgress = 0;
  site.snapshot = {
    summit: payout.summit.mul(nth),
    impact: payout.impact.mul(nth),
    bonus: bonus.mul(nth),
    bonusTargetId,
    summitGranted: false,
    impactGranted: false,
    slipHeight: 0,
  };
  ctx.events.push({ type: 'CycleStarted', siteId: site.id, cycleIndex: site.cycleIndex });
}

function phaseFrozen(state: GameState, input: MotionInput): boolean {
  // Unautomated sites freeze entirely during an absence (spec §02).
  return input.offline && !isAutomated(state);
}

export function timeToBoundary(state: GameState, site: SiteState, input: MotionInput): number {
  switch (site.phase) {
    case 'ascending': {
      const limit = ascentLimit(state, site);
      if (site.phaseProgress >= limit) return 0;
      const rate = ascentRate(state, site, input);
      return rate > 0 ? (limit - site.phaseProgress) / rate : Infinity;
    }
    case 'slipping':
      return phaseFrozen(state, input) ? Infinity : Math.max(0, slipSeconds(site.snapshot.slipHeight) - site.phaseProgress);
    case 'descending':
      return phaseFrozen(state, input) ? Infinity : Math.max(0, descentSeconds(state, site) - site.phaseProgress);
    case 'returning':
      return phaseFrozen(state, input) ? Infinity : Math.max(0, returnSeconds(state, site) - site.phaseProgress);
  }
}

function advancePartial(state: GameState, site: SiteState, dt: number, input: MotionInput): void {
  if (dt <= 0) return;
  if (site.phase === 'ascending') {
    const limit = ascentLimit(state, site);
    site.phaseProgress = Math.min(limit, site.phaseProgress + ascentRate(state, site, input) * dt);
  } else if (!phaseFrozen(state, input)) {
    site.phaseProgress = Math.min(phaseSeconds(state, site), site.phaseProgress + dt);
  }
}

function phaseSeconds(state: GameState, site: SiteState): number {
  switch (site.phase) {
    case 'descending':
      return descentSeconds(state, site);
    case 'returning':
      return returnSeconds(state, site);
    case 'slipping':
      return slipSeconds(site.snapshot.slipHeight);
    case 'ascending':
      return Infinity;
  }
}

/** Grip gave out: the stone rolls back to the foot (prelude only). */
function beginSlip(state: GameState, site: SiteState, events: GameEvent[]): void {
  // The boundary is the grip limit; a migrated save may already sit above it.
  const height = Math.max(site.phaseProgress, ascentLimit(state, site));
  const record = height > state.prelude.bestHeight + 1e-9;
  if (record) state.prelude.bestHeight = height;
  state.prelude.attempts += 1;
  site.snapshot.slipHeight = height;
  site.phase = 'slipping';
  site.phaseProgress = 0;
  events.push({ type: 'StoneSlipped', siteId: site.id, height, record });
  if (!state.discoveries.tutorialIds.includes('first_slip')) {
    markTutorial(state, 'first_slip');
    triggerStory(state, 'first_slip', events);
  }
}

/** The first summit ends the prelude; the astonished shades pay up. */
function completePrelude(state: GameState, events: GameEvent[]): void {
  state.prelude.complete = true;
  state.prelude.bestHeight = 1;
  const offering = catalog.prelude.summitOffering;
  grantIncome(state, state.empire.sites[0], offering, events);
  events.push({ type: 'PreludeCompleted', offering });
}

function processBoundary(state: GameState, site: SiteState, ctx: StepContext): void {
  switch (site.phase) {
    case 'ascending': {
      if (ascentLimit(state, site) < 1) {
        beginSlip(state, site, ctx.events);
        return;
      }
      if (!site.snapshot.summitGranted) {
        site.snapshot.summitGranted = true;
        grantIncome(state, site, site.snapshot.summit, ctx.events);
      }
      state.counters.totalClimbs += 1;
      ctx.events.push({ type: 'SummitReached', siteId: site.id, amount: site.snapshot.summit });
      if (!ctx.offline && ctx.manualHeld && state.empire.selectedSiteId === site.id) {
        noteManualSummit(state, ctx.events);
        // Acrocorinth Tours: spectators pay to watch someone actually push.
        const fee = modifiers(state, site.id).spectator;
        if (fee > 0 && state.prelude.complete) grantIncome(state, site, baseReward(state, site).mul(fee), ctx.events);
      }
      if (!state.discoveries.tutorialIds.includes('first_summit')) {
        markTutorial(state, 'first_summit');
        triggerStory(state, 'first_summit', ctx.events);
      }
      if (!state.prelude.complete) completePrelude(state, ctx.events);
      site.phase = 'descending';
      site.phaseProgress = 0;
      return;
    }
    case 'descending': {
      const amount = site.snapshot.impact;
      const bonus = site.snapshot.bonus;
      if (!site.snapshot.impactGranted) {
        site.snapshot.impactGranted = true;
        grantIncome(state, site, amount.add(bonus), ctx.events);
      }
      state.counters.totalImpacts += 1;
      ctx.events.push({
        type: 'ImpactResolved',
        siteId: site.id,
        amount,
        bonus,
        targetId: site.snapshot.bonusTargetId,
      });
      markTutorial(state, 'first_descent');
      if (site.wheelOwned && !site.wheelCharged) {
        site.wheelCharged = true;
        markTutorial(state, 'first_charge');
        ctx.events.push({ type: 'FlywheelCharged', siteId: site.id });
      }
      if (site.furnace) {
        const m = modifiers(state, site.id);
        const out = afterImpact(m, site.furnace, heldHere(state, site, ctx), !!site.steward);
        if (out === 'erupted' || out === 'erupted-full') erupted(state, site, out === 'erupted-full', ctx);
      }
      if (site.jar) {
        pour(modifiers(state, site.id), site.jar, site.productionLevel, site.cycleIndex, ctx.offline, !!site.steward);
        noteJarPour(state, site.jar, ctx.events);
      }
      if (site.foundry) foundryClimb(state, site, ctx.events);
      let entered = false;
      if (site.sky) {
        const step = advanceSky(modifiers(state, site.id), site.sky, heldHere(state, site, ctx), ctx.offline, !!site.steward);
        if (step.entered) noteWish(state, site.sky.streak, ctx.events);
        entered = step.entered;
      }
      if (site.bureau) {
        const m = modifiers(state, site.id);
        const step = fileForms(m, site.bureau, site.productionLevel, !!site.steward);
        noteIdle(state, site.bureau.idle, ctx.events);
        // Zeus works office hours: Edicts are issued only while someone is watching.
        if (step.edicts > 0 && !ctx.offline) {
          const edict = issueEdict(site.bureau, m);
          ctx.events.push({ type: 'Edict', edictId: edict.id });
        }
      }
      const wasMet = trialMet(site);
      trialClimb(site, entered);
      // A trial finished after the gross was already met issues the decree now.
      if (!wasMet && trialMet(site)) checkDecrees(state, ctx.events);
      relicTick(state, site, ctx.events);
      site.phase = 'returning';
      site.phaseProgress = 0;
      return;
    }
    case 'slipping': {
      const amount = fallPayout(site.snapshot.slipHeight);
      grantIncome(state, site, amount, ctx.events);
      ctx.events.push({ type: 'FallResolved', siteId: site.id, amount });
      site.cycleIndex += 1;
      startCycle(state, site, ctx);
      return;
    }
    case 'returning':
      site.cycleIndex += 1;
      startCycle(state, site, ctx);
      return;
  }
}

/**
 * Advance the listed sites (default: all) by `dt` seconds, processing phase
 * boundaries in global time order so that splitting an interval never
 * changes guaranteed rewards.
 */
export function stepSites(state: GameState, dt: number, ctx: StepContext, only?: SiteState[]): void {
  const sites = only ?? state.empire.sites;
  if (!only && !ctx.offline) tickEdict(state, dt);
  let remaining = dt;
  for (;;) {
    let best = Infinity;
    let bestSite: SiteState | null = null;
    for (const s of sites) {
      const t = timeToBoundary(state, s, ctx);
      if (t < best) {
        best = t;
        bestSite = s;
      }
    }
    // Out of time, unless a boundary is due right now (a zero-length phase, e.g. no return walk).
    if (remaining <= 0 && best > 0) return;
    if (!bestSite || best > remaining + TIME_EPS) {
      for (const s of sites) advancePartial(state, s, remaining, ctx);
      return;
    }
    const step = Math.min(best, remaining);
    for (const s of sites) if (s !== bestSite) advancePartial(state, s, step, ctx);
    processBoundary(state, bestSite, ctx);
    remaining -= step;
  }
}

/** The player is pushing this hill by hand right now (never offline). */
function heldHere(state: GameState, site: SiteState, input: MotionInput): boolean {
  return !input.offline && input.manualHeld && state.empire.selectedSiteId === site.id;
}

/** Book-keeping for an eruption that has just started. */
function erupted(state: GameState, site: SiteState, full: boolean, ctx: StepContext): void {
  const m = modifiers(state, site.id);
  if (!ctx.offline) ctx.events.push({ type: 'Eruption', siteId: site.id, power: site.furnace!.power, heat: site.furnace!.heat });
  if (full) noteFullEruption(state, ctx.events);
  // Charon's Fare: a wage on the spot.
  if (m.furnaceLump > 0) grantIncome(state, site, baseReward(state, site).mul(m.furnaceLump), ctx.events);
}

/**
 * Erupt now, outside an impact: a vent by hand or the welcome after an
 * absence. If this cycle's impact has not paid yet, it is the first boosted one.
 */
export function eruptNow(state: GameState, site: SiteState, ctx: StepContext, extra = 1): void {
  const f = site.furnace;
  if (!f || f.erupting > 0) return;
  const full = ignite(modifiers(state, site.id), f, extra);
  if (!site.snapshot.impactGranted && (site.phase === 'ascending' || site.phase === 'descending')) {
    site.snapshot.impact = site.snapshot.impact.mul(f.power);
  }
  erupted(state, site, full, ctx);
}

/** Advance a copy of a site's phases without grants; used to predict relic timing. */
export function timeUntilImpacts(state: GameState, site: SiteState, impacts: number, input: MotionInput): number {
  const clone = cloneSite(site);
  let t = 0;
  let left = impacts;
  for (let guard = 0; guard < 10_000; guard++) {
    const tb = timeToBoundary(state, clone, input);
    if (!Number.isFinite(tb)) return Infinity;
    t += tb;
    if (clone.phase === 'ascending') {
      if (ascentLimit(state, clone) < 1) {
        clone.snapshot.slipHeight = clone.phaseProgress + tb * ascentRate(state, clone, input);
        clone.phase = 'slipping';
      } else {
        clone.phase = 'descending';
      }
    } else if (clone.phase === 'slipping') {
      clone.phase = 'ascending';
    } else if (clone.phase === 'descending') {
      if (clone.wheelOwned) clone.wheelCharged = true;
      if (clone.furnace) afterImpact(modifiers(state, clone.id), clone.furnace, heldHere(state, clone, input), !!clone.steward);
      left -= 1;
      if (left <= 0) return t;
      clone.phase = 'returning';
    } else {
      clone.phase = 'ascending';
    }
    clone.phaseProgress = 0;
  }
  return Infinity;
}
