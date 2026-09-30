import { catalog, siteDef } from '../content/catalog';
import { recordDueProcess } from './bureau';
import { unlockCostOf, workCostOf } from './formulas';
import { buyFlywheel, buyLevels, installCounterweight } from './commands';
import {
  bestTrim,
  bulkCost,
  counterweightCost,
  counterweightUnlocked,
  flywheelCost,
  flywheelOffered,
  frontierSite,
  levelsToMilestone,
  nextUnownedSite,
  strengthLevelEffective,
  type LevelTrack,
} from './formulas';
import { Money } from './money';
import type { GameEvent, GameState, SiteState } from './state';

/**
 * Stewards run the hills the player has moved on from (docs/hill-workshops-plan.md §2).
 * The standing order in this first cut is "reinvest": spend the hill's purse on
 * its own improvements, keeping back what the player is saving for there.
 * Stewards never buy works, never open hills and never break seals.
 */

const TRACKS: LevelTrack[] = ['production', 'strength', 'impact'];
/** Finish a doubling this close rather than buying the cheapest single level. */
const MILESTONE_LOOKAHEAD = 5;
const MAX_PURCHASES = 400;

/** Money the steward leaves alone: the next opening (on the frontier) and the next work here. */
export function stewardReserve(state: GameState, site: SiteState): Money {
  let reserve = Money.ZERO;
  const next = nextUnownedSite(state);
  if (next && frontierSite(state) === site && state.empire.offeredSiteIds.includes(next.id)) {
    reserve = reserve.add(unlockCostOf(state, next));
  }
  const work = catalog.works.find(
    (w) => w.siteId === site.id && !state.empire.purchasedWorkIds.includes(w.id) && site.productionLevel >= w.requiredLevel,
  );
  if (work) reserve = reserve.add(workCostOf(state, work));
  return reserve;
}

function reinvest(state: GameState, site: SiteState, events: GameEvent[]): number {
  const reserve = stewardReserve(state, site);
  const spare = () => site.purse.sub(reserve);
  const fits = (cost: Money | null): cost is Money => !!cost && cost.lte(spare());
  let bought = 0;
  for (let guard = 0; guard < MAX_PURCHASES; guard++) {
    if (site.counterweight === null && counterweightUnlocked(site) && fits(counterweightCost(state, site))) {
      if (installCounterweight(state, site.id, events).ok) {
        bought++;
        continue;
      }
    }
    if (!site.wheelOwned && flywheelOffered(state, site) && fits(flywheelCost(state, site))) {
      if (buyFlywheel(state, site.id, events).ok) {
        bought++;
        continue;
      }
    }
    const toMilestone = levelsToMilestone(site);
    if (toMilestone > 1 && toMilestone <= MILESTONE_LOOKAHEAD && fits(bulkCost(state, site, 'production', toMilestone))) {
      if (buyLevels(state, site.id, 'production', toMilestone, events).ok) {
        bought++;
        continue;
      }
    }
    let best: { track: LevelTrack; cost: Money } | null = null;
    for (const track of TRACKS) {
      const level = track === 'production' ? site.productionLevel : track === 'strength' ? site.strengthLevel : site.impactLevel;
      if (track === 'strength' && !strengthLevelEffective(state, site, level)) continue;
      const cost = bulkCost(state, site, track, 1);
      if (fits(cost) && (!best || cost.lt(best.cost))) best = { track, cost };
    }
    if (!best || !buyLevels(state, site.id, best.track, 1, events).ok) break;
    bought++;
  }
  return bought;
}

/** Let every hired steward act on its standing order. Returns changes made per hill. */
export function runStewards(state: GameState, events: GameEvent[]): Map<string, number> {
  const made = new Map<string, number>();
  for (const site of state.empire.sites) {
    if (!site.steward) continue;
    let n = site.steward.reinvest ? reinvest(state, site, events) : 0;
    // The Superintendent keeps the counterweight at its best trim, whatever the order.
    if (site.counterweight !== null) {
      const best = bestTrim(state, site);
      if (best !== site.counterweight) {
        site.counterweight = best;
        n++;
      }
    }
    if (n > 0) made.set(site.id, n);
  }
  recordDueProcess(state);
  return made;
}

/** The steward's title for a hill, e.g. "the Erinyes". */
export function stewardKey(site: SiteState): string {
  return `steward.${siteDef(site.id).id}`;
}
