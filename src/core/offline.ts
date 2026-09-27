import { ascentSeconds, fixedPhaseSeconds, isAutomated, offlineCapSeconds, cyclePayout } from './formulas';
import { Money } from './money';
import {
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
  earned: Money;
  relicIds: string[];
  decreeSiteIds: string[];
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
  if (relicPendingOn(state, site)) {
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
  const cycle = ascentSeconds(state, site, false) + fixedPhaseSeconds();
  const k = Math.floor((rem + TIME_EPS) / cycle);
  if (k > 0) {
    const first = firstSnapshot.summit.add(firstSnapshot.impact).add(firstSnapshot.bonus);
    const rest = cyclePayout(state, site).expectedTotal.mul(k - 1);
    grantIncome(state, first.add(rest), ctx.events);
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
  const localEvents: GameEvent[] = [];
  const ctx: StepContext = { manualHeld: false, offline: true, events: localEvents };

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

  events.push(...localEvents);
  return {
    requestedSeconds: requested,
    countedSeconds: isAutomated(state) && !state.paused ? counted : 0,
    earned: state.wallet.runGross.sub(grossBefore),
    relicIds: localEvents.flatMap((e) => (e.type === 'RelicGranted' ? [e.relicId] : [])),
    decreeSiteIds: localEvents.flatMap((e) => (e.type === 'DecreeAvailable' ? [e.siteId] : [])),
  };
}
