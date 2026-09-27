import { catalog, siteDef } from '../content/catalog';
import {
  ascentRate,
  cyclePayout,
  isAutomated,
  type MotionInput,
} from './formulas';
import { Money } from './money';
import { nextRandom, sampleCappedGeometric } from './rng';
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
  return { ...site, snapshot: { ...site.snapshot } };
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
 * Every income grant counts toward Defiance exactly once. Non-income credits
 * (gifts, imports, debug) must not use this function.
 */
export function grantIncome(state: GameState, amount: Money, events: GameEvent[]): void {
  if (amount.lte(0)) return;
  state.wallet.obols = state.wallet.obols.add(amount);
  state.wallet.runGross = state.wallet.runGross.add(amount);
  checkDecrees(state, events);
}

/** Issue decrees for every gate crossed, in chapter order. */
export function checkDecrees(state: GameState, events: GameEvent[]): void {
  const owned = new Set(state.empire.sites.map((s) => s.id));
  for (const def of catalog.sites) {
    if (def.index === 0 || owned.has(def.id) || state.empire.offeredSiteIds.includes(def.id)) continue;
    if (state.wallet.runGross.lt(def.defianceGate)) break;
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
    const targets = catalog.bonusTargets;
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
  site.phase = 'ascending';
  site.phaseProgress = 0;
  site.snapshot = {
    summit: payout.summit,
    impact: payout.impact,
    bonus,
    bonusTargetId,
    summitGranted: false,
    impactGranted: false,
  };
  ctx.events.push({ type: 'CycleStarted', siteId: site.id, cycleIndex: site.cycleIndex });
}

function phaseFrozen(state: GameState, input: MotionInput): boolean {
  // Unautomated sites freeze entirely during an absence (spec §02).
  return input.offline && !isAutomated(state);
}

export function timeToBoundary(state: GameState, site: SiteState, input: MotionInput): number {
  const c = catalog.cycle;
  switch (site.phase) {
    case 'ascending': {
      const rate = ascentRate(state, site, input);
      return rate > 0 ? Math.max(0, (1 - site.phaseProgress) / rate) : Infinity;
    }
    case 'descending':
      return phaseFrozen(state, input) ? Infinity : Math.max(0, c.descentSeconds - site.phaseProgress);
    case 'returning':
      return phaseFrozen(state, input) ? Infinity : Math.max(0, c.returnSeconds - site.phaseProgress);
  }
}

function advancePartial(state: GameState, site: SiteState, dt: number, input: MotionInput): void {
  if (dt <= 0) return;
  if (site.phase === 'ascending') {
    site.phaseProgress = Math.min(1, site.phaseProgress + ascentRate(state, site, input) * dt);
  } else if (!phaseFrozen(state, input)) {
    const limit = site.phase === 'descending' ? catalog.cycle.descentSeconds : catalog.cycle.returnSeconds;
    site.phaseProgress = Math.min(limit, site.phaseProgress + dt);
  }
}

function processBoundary(state: GameState, site: SiteState, ctx: StepContext): void {
  switch (site.phase) {
    case 'ascending': {
      if (!site.snapshot.summitGranted) {
        site.snapshot.summitGranted = true;
        grantIncome(state, site.snapshot.summit, ctx.events);
      }
      state.counters.totalClimbs += 1;
      ctx.events.push({ type: 'SummitReached', siteId: site.id, amount: site.snapshot.summit });
      if (!state.discoveries.tutorialIds.includes('first_summit')) {
        markTutorial(state, 'first_summit');
        triggerStory(state, 'first_summit', ctx.events);
      }
      site.phase = 'descending';
      site.phaseProgress = 0;
      return;
    }
    case 'descending': {
      const amount = site.snapshot.impact;
      const bonus = site.snapshot.bonus;
      if (!site.snapshot.impactGranted) {
        site.snapshot.impactGranted = true;
        grantIncome(state, amount.add(bonus), ctx.events);
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
      relicTick(state, site, ctx.events);
      site.phase = 'returning';
      site.phaseProgress = 0;
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
  let remaining = dt;
  while (remaining > 0) {
    let best = Infinity;
    let bestSite: SiteState | null = null;
    for (const s of sites) {
      const t = timeToBoundary(state, s, ctx);
      if (t < best) {
        best = t;
        bestSite = s;
      }
    }
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
      clone.phase = 'descending';
    } else if (clone.phase === 'descending') {
      if (clone.wheelOwned) clone.wheelCharged = true;
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
