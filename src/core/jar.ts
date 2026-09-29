import { catalog } from '../content/catalog';
import type { Modifiers } from './effects';
import type { JarState, SiteState } from './state';

/**
 * The Danaids' jar, the Leaking Heights' machine (docs/hill-workshops-plan.md §3.3).
 * Each impact pours water in; only the leak pays, and a fuller jar pushes the
 * water out harder. Too few holes and the jar spills (spilled water pays
 * nothing); too many and the pressure drops. The best jar sits just short of
 * the brim, and inflow rises with the crew, so the holes need tending.
 *
 * The jar never fills: at the brim it spills over a lip that is somehow never
 * the top. Everything here is pure and deterministic, per impact, so offline
 * settlement steps it exactly as the live game does.
 */

export function jarSite(siteId: string): boolean {
  return catalog.jar.siteId === siteId;
}

export function newJar(): JarState {
  return { level: 0, holes: catalog.jar.startHoles, peak: 0, spilled: 0, factor: 1, target: catalog.jar.defaultTarget, streak: 0 };
}

export function copyJar(j: JarState | null): JarState | null {
  return j ? { ...j } : null;
}

/** Inflow per impact at this crew level, before devices and tide: the yardstick for pay. */
export function baseInflow(productionLevel: number): number {
  const c = catalog.jar;
  return c.inflow * (1 + c.inflowStep * Math.floor(productionLevel / c.inflowEvery));
}

/** Inflow with devices, before the tide: what the steward plans for. */
export function steadyInflow(m: Modifiers, productionLevel: number): number {
  return baseInflow(productionLevel) * m.jarInflow + m.jarExtra;
}

/** The tide's multiplier on cycle `index` (1 without Tidewater Lease). */
export function tide(m: Modifiers, index: number): number {
  return 1 + m.jarTide * Math.sin((2 * Math.PI * index) / catalog.jar.tidePeriod);
}

/** Share of the level that leaks out through `holes` holes in one climb. */
export function leakShare(holes: number): number {
  return 1 - (1 - catalog.jar.leakPerHole) ** holes;
}

/** Pay of a perfectly kept jar (just full, never spilling) at inflow `i`. */
function bestPay(i: number): number {
  const x = Math.min(1, i);
  return (x * (2 - x)) / 2;
}

/** The fewest holes that keep the steady peak at or under `target`. */
export function holesFor(inflow: number, target: number): number {
  const max = catalog.jar.maxHoles;
  for (let h = 1; h <= max; h++) if (inflow / leakShare(h) <= target + 1e-9) return h;
  return max;
}

/**
 * One impact pours into the jar. `vents`: Danaus is on duty and sets the holes
 * to hold the peak at the jar's target. Returns the jar's new impact factor,
 * which the next cycle's impact is paid with.
 */
export function pour(m: Modifiers, j: JarState, productionLevel: number, index: number, offline: boolean, vents: boolean): number {
  const c = catalog.jar;
  const ref = baseInflow(productionLevel);
  const steady = steadyInflow(m, productionLevel);
  if (vents) j.holes = holesFor(steady, j.target);
  const inflow = steady * tide(m, index);
  let top = j.level + inflow;
  const spill = Math.max(0, top - 1);
  top = Math.min(1, top);
  const end = top * (1 - leakShare(j.holes));
  const pressure = m.jarGlaze + (1 - m.jarGlaze) * ((top + end) / 2);
  const spillPay = Math.min(1, m.jarSpillPay + (offline ? m.jarSpillAway : 0));
  const pay = (top - end) * pressure + spill * spillPay;
  j.level = Math.min(1, end + spill * m.jarReturn);
  j.peak = top;
  j.spilled = spill;
  j.factor = (c.power * m.jarPower * pay) / bestPay(ref);
  j.streak = spill === 0 && top >= c.almostFullAt - 1e-9 ? j.streak + 1 : 0;
  return j.factor;
}

/** The impact multiplier the next cycle is paid with. */
export function jarImpactFactor(site: Pick<SiteState, 'jar'>): number {
  return site.jar ? site.jar.factor : 1;
}

/**
 * The jar's long-run impact factor with these holes (or with the steward
 * holding `target`). Used for steady income and advice, never for payouts.
 */
export function steadyJarFactor(m: Modifiers, start: JarState, productionLevel: number, vents: boolean, target?: number, holes?: number): number {
  const j: JarState = { ...start, target: target ?? start.target, holes: holes ?? start.holes };
  const period = m.jarTide > 0 ? catalog.jar.tidePeriod : 1;
  let i = 0;
  for (; i < catalog.jar.settleClimbs; i++) pour(m, j, productionLevel, i, false, vents);
  let sum = 0;
  for (let k = 0; k < period; k++) sum += pour(m, j, productionLevel, i + k, false, vents);
  return sum / period;
}

/** The holes that pay best by hand at this crew level. */
export function bestHoles(m: Modifiers, start: JarState, productionLevel: number): number {
  const guess = holesFor(steadyInflow(m, productionLevel), 1);
  let best = guess;
  let bestFactor = -1;
  for (let h = Math.max(1, guess - 4); h <= Math.min(catalog.jar.maxHoles, guess + 4); h++) {
    const f = steadyJarFactor(m, start, productionLevel, false, undefined, h);
    if (f > bestFactor * (1 + 1e-9)) {
      bestFactor = f;
      best = h;
    }
  }
  return best;
}

/** The steward's best target, to the nearest 5 percent. */
export function bestTarget(m: Modifiers, start: JarState, productionLevel: number): number {
  let best = 1;
  let bestFactor = -1;
  // From the brim down: on a tie, the fuller jar.
  for (let v = 20; v >= Math.round(catalog.jar.minTarget * 20); v--) {
    const f = steadyJarFactor(m, start, productionLevel, true, v / 20);
    if (f > bestFactor * (1 + 1e-9)) {
      bestFactor = f;
      best = v / 20;
    }
  }
  return best;
}
