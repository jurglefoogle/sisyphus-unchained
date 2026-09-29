import { catalog } from '../content/catalog';
import { OUT_OF_SIGHT_SECONDS } from '../content/devices';
import { modifiers, nthSum } from './effects';
import { noteAbsence } from './seals';
import { clearEdict, recordDueProcess } from './bureau';
import { trialCycles, trialNeeded } from './trials';
import { passTime } from './commands';
import { cycleSeconds, isAutomated, offlineCapSeconds, cyclePayout } from './formulas';
import { Money } from './money';
import {
  eruptNow,
  findSite,
  grantIncome,
  startCycle,
  stepSites,
  timeToBoundary,
  timeUntilImpacts,
  TIME_EPS,
  type StepContext,
} from './sim';
import type { GameEvent, GameState, SiteState } from './state';

export interface OfflineSummary {
  requestedSeconds: number;
  countedSeconds: number;
  /** Defiance gained, appraised in Obols. */
  earned: Money;
  /** Each hill's income in its own currency (only hills that earned). */
  earnedBySite: { siteId: string; amount: Money }[];
  relicIds: string[];
  decreeSiteIds: string[];
  /** What each hill's machine did while you were away (only hills where something happened). */
  machines: MachineRecap[];
}

export interface MachineRecap {
  siteId: string;
  eruptions: number;
  cast: number;
  approved: number;
  /** Trial progress before and after, while the trial was still open. */
  trial: { before: number; after: number; needed: number } | null;
  /** The foundry stopped after a blueprint and waits for the next pick. */
  castWaiting: boolean;
}

interface MachineMark {
  eruptions: number;
  cast: number;
  approved: number;
  trial: number;
}

function markMachine(site: SiteState): MachineMark {
  return {
    eruptions: site.furnace?.eruptions ?? 0,
    cast: site.foundry?.finished ?? 0,
    approved: site.bureau?.approved ?? 0,
    trial: site.trial,
  };
}

function machineRecap(site: SiteState, before: MachineMark | undefined): MachineRecap | null {
  if (!before) return null;
  const now = markMachine(site);
  const needed = trialNeeded(site.id);
  const r: MachineRecap = {
    siteId: site.id,
    eruptions: now.eruptions - before.eruptions,
    cast: now.cast - before.cast,
    approved: Math.floor(now.approved) - Math.floor(before.approved),
    trial: needed > 0 && before.trial < needed && now.trial > before.trial ? { before: before.trial, after: Math.min(now.trial, needed), needed } : null,
    castWaiting: !!site.foundry?.paused && now.cast > before.cast,
  };
  return r.eruptions > 0 || r.cast > 0 || r.approved > 0 || r.trial ? r : null;
}

function isSteady(site: SiteState): boolean {
  return !(site.wheelOwned && !site.wheelCharged);
}

function relicPendingOn(state: GameState, site: SiteState): boolean {
  return state.random.eligibleSiteId === site.id && state.random.relicCountdown !== null;
}

/**
 * Advance one site through `window` seconds, skipping whole steady cycles
 * arithmetically. Partial phases and the first uncharged flywheel cycle are
 * stepped exactly with their saved snapshot.
 */
function advanceSiteBatched(state: GameState, site: SiteState, window: number, ctx: StepContext): void {
  // Ixion's Wheel changes every cycle: step it boundary by boundary, exactly as live.
  if (relicPendingOn(state, site) || site.furnace || site.jar || site.foundry || site.sky || site.bureau) {
    // At most `pityDescents` cycles before the relic; step them exactly.
    stepSites(state, window, ctx, [site]);
    return;
  }

  let rem = window;
  // 1. Finish the saved cycle (and any first uncharged cycle) exactly.
  let firstSnapshot: SiteState['snapshot'] | null = null;
  while (rem > TIME_EPS) {
    if (site.phase === 'ascending' && site.phaseProgress === 0 && isSteady(site)) {
      firstSnapshot = site.snapshot;
      break;
    }
    const tb = timeToBoundary(state, site, ctx);
    if (!Number.isFinite(tb)) return;
    const step = Math.min(rem, tb);
    stepSites(state, step, ctx, [site]);
    rem -= step;
  }
  if (!firstSnapshot || rem <= TIME_EPS) return;

  // 2. Skip complete steady cycles. The first keeps its own snapshot.
  const cycle = cycleSeconds(state, site, false);
  const k = Math.floor((rem + TIME_EPS) / cycle);
  if (k > 0) {
    const first = firstSnapshot.summit.add(firstSnapshot.impact).add(firstSnapshot.bonus);
    // Every-Nth cycles are counted exactly over the skipped indices.
    const weight = nthSum(modifiers(state, site.id), site.cycleIndex + 1, site.cycleIndex + k - 1);
    const rest = cyclePayout(state, site).expectedTotal.mul(weight);
    trialCycles(site, k);
    grantIncome(state, site, first.add(rest), ctx.events);
    site.cycleIndex += k;
    state.counters.totalClimbs += k;
    state.counters.totalImpacts += k;
    rem = Math.max(0, rem - k * cycle);
    startCycle(state, site, ctx);
  }

  // 3. The remaining partial cycle.
  if (rem > 0) stepSites(state, rem, ctx, [site]);
}

function advanceAllBatched(state: GameState, window: number, ctx: StepContext): void {
  // A relic lands at the end of a window, so the eligible site goes last:
  // other sites' cycles inside the window must not see its multiplier.
  const ordered = [...state.empire.sites].sort(
    (a, b) => Number(relicPendingOn(state, a)) - Number(relicPendingOn(state, b)),
  );
  for (const site of ordered) advanceSiteBatched(state, site, window, ctx);
}

/**
 * Settle an absence. Automated sites earn their unassisted rate with expected
 * coin bonuses; unautomated sites freeze. Bounded by events, not seconds.
 */
export function settleOffline(state: GameState, seconds: number, events: GameEvent[]): OfflineSummary {
  const requested = Math.max(0, seconds);
  const counted = Math.min(requested, offlineCapSeconds(state));
  const grossBefore = state.wallet.runGross;
  const siteGrossBefore = new Map(state.empire.sites.map((s) => [s.id, s.gross]));
  const machinesBefore = new Map(state.empire.sites.map((s) => [s.id, markMachine(s)]));
  const localEvents: GameEvent[] = [];
  const ctx: StepContext = { manualHeld: false, offline: true, events: localEvents };
  // The gods don't work weekends either: an absence ends any Edict.
  clearEdict(state);

  if (isAutomated(state) && !state.paused) {
    let remaining = counted;
    for (let guard = 0; remaining > TIME_EPS && guard < 16; guard++) {
      let window = remaining;
      const eligible = state.random.eligibleSiteId ? findSite(state, state.random.eligibleSiteId) : undefined;
      if (eligible && state.random.relicCountdown !== null) {
        const due = timeUntilImpacts(state, eligible, state.random.relicCountdown, ctx);
        if (due < window) window = due;
      }
      advanceAllBatched(state, window, ctx);
      remaining -= window;
    }
  }

  // Out of Sight: an hour away is noticed on the rim, and (once heard) greeted with a full eruption.
  if (isAutomated(state) && !state.paused) {
    noteAbsence(state, requested, localEvents);
    const rim = state.empire.sites.find((s) => s.furnace);
    if (rim?.furnace && requested >= OUT_OF_SIGHT_SECONDS && modifiers(state, rim.id).furnaceWelcome && rim.furnace.erupting === 0) {
      rim.furnace.heat = 1;
      eruptNow(state, rim, ctx, catalog.furnace.welcomePower);
    }
  }

  passTime(state, counted);
  events.push(...localEvents);
  return {
    requestedSeconds: requested,
    countedSeconds: isAutomated(state) && !state.paused ? counted : 0,
    earned: state.wallet.runGross.sub(grossBefore),
    earnedBySite: state.empire.sites
      .map((s) => ({ siteId: s.id, amount: s.gross.sub(siteGrossBefore.get(s.id) ?? Money.ZERO) }))
      .filter((e) => e.amount.gt(0)),
    relicIds: localEvents.flatMap((e) => (e.type === 'RelicGranted' ? [e.relicId] : [])),
    decreeSiteIds: localEvents.flatMap((e) => (e.type === 'DecreeAvailable' ? [e.siteId] : [])),
    machines: state.empire.sites.flatMap((s) => machineRecap(s, machinesBefore.get(s.id)) ?? []),
  };
}
