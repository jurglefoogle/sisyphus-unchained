import { catalog, siteDef } from '../content/catalog';
import { FAIR_AND_BALANCED_CLIMBS, PERPETUAL_MOTION_BLUEPRINTS } from '../content/devices';
import { modifiers } from './effects';
import { levelCost, tabletCost } from './formulas';
import { Money } from './money';
import { checkVisitor, noteBlueprint, noteSplitClimb, revealDevice } from './seals';
import type { FoundryState, GameEvent, GameState, SiteState } from './state';

/**
 * The Foundry, the Bronze Pass's machine (docs/hill-workshops-plan.md §3.4).
 * A split sends part of every payout to the pour instead of the purse. Bronze
 * fills the blueprint at the head of the queue; a finished blueprint is this
 * hill's device, revealed like a broken seal. Blueprints are the hill's dealt
 * hand, so the player chooses the order by their hints.
 *
 * Without Talos the pour stops after each blueprint until the player picks the
 * next; with him on duty the queue runs on. Income is still earned in full
 * (gross and decrees count it all): the split only decides where it lands.
 */

export function foundrySite(siteId: string): boolean {
  return catalog.foundry.siteId === siteId;
}

export function newFoundry(hand: string[]): FoundryState {
  return {
    split: catalog.foundry.defaultSplit,
    queue: [...hand],
    bronze: Money.ZERO,
    finished: 0,
    paused: false,
    gallery: Money.ZERO,
    pureStreak: 0,
    soldSince: false,
    balancedClimbs: 0,
  };
}

export function copyFoundry(f: FoundryState | null): FoundryState | null {
  return f ? { ...f, queue: [...f.queue] } : null;
}

/** Bronze the next blueprint needs: priced like the matching tablet. */
export function blueprintSize(state: GameState, site: SiteState): Money {
  const f = site.foundry!;
  const index = Math.min(f.finished, catalog.devices.tabletCosts.length - 1);
  return tabletCost(site, index).mul(modifiers(state, site.id).foundrySize).ceil();
}

/** Bronze is going into a blueprint right now. */
export function pouring(f: FoundryState): boolean {
  return !f.paused && f.queue.length > 0 && f.split > 0;
}

/**
 * Split one payout between the purse and the pour. Returns the Ingots that
 * land in the purse (sold metal, and any refunds).
 */
export function pourIncome(state: GameState, site: SiteState, amount: Money, events: GameEvent[]): Money {
  const f = site.foundry!;
  if (f.paused && site.steward) f.paused = false;
  if (!pouring(f)) {
    f.soldSince = true;
    return amount;
  }
  let m = modifiers(state, site.id);
  const poured = amount.mul(f.split);
  let sold = amount.sub(poured);
  if (sold.gt(0)) f.soldSince = true;
  let bronze = poured.mul(m.foundryPour);

  // The Golden Gallery: poured bronze also casts crew, at a multiple of a level's price.
  if (m.foundryCrew > 0) {
    f.gallery = f.gallery.add(bronze);
    const def = siteDef(site.id);
    const before = site.productionLevel;
    for (;;) {
      if (site.productionLevel >= catalog.levels.productionCap) break;
      const cost = levelCost(def, 'production', site.productionLevel).mul(m.foundryCrew);
      if (f.gallery.lt(cost)) break;
      f.gallery = f.gallery.sub(cost);
      site.productionLevel += 1;
    }
    if (site.productionLevel > before) checkVisitor(site, before, events);
  }

  while (bronze.gt(0) && pouring(f)) {
    const need = blueprintSize(state, site).sub(f.bronze);
    if (bronze.lt(need)) {
      f.bronze = f.bronze.add(bronze);
      bronze = Money.ZERO;
      break;
    }
    bronze = bronze.sub(need);
    const size = f.bronze.add(need);
    const id = f.queue.shift()!;
    f.bronze = Money.ZERO;
    f.finished += 1;
    revealDevice(state, site, id, events);
    m = modifiers(state, site.id);
    // Alcinous's Watchdogs: the bronze comes back as Ingots.
    if (m.foundryRefund > 0) sold = sold.add(size.mul(m.foundryRefund).div(m.foundryPour));
    f.pureStreak = f.soldSince ? 0 : f.pureStreak + 1;
    f.soldSince = false;
    noteBlueprint(state, f.pureStreak, PERPETUAL_MOTION_BLUEPRINTS, events);
    if (!site.steward) f.paused = true;
  }
  // Metal with nowhere to go is sold after all.
  if (bronze.gt(0)) {
    sold = sold.add(bronze.div(m.foundryPour));
    f.soldSince = true;
  }
  return sold;
}

/** Each impact: a climb at exactly half-and-half counts toward Fair and Balanced. */
export function foundryClimb(state: GameState, site: SiteState, events: GameEvent[]): void {
  const f = site.foundry!;
  f.balancedClimbs = Math.abs(f.split - 0.5) < 1e-9 ? f.balancedClimbs + 1 : 0;
  noteSplitClimb(state, f.balancedClimbs, FAIR_AND_BALANCED_CLIMBS, events);
}
