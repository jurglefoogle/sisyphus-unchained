import { catalog } from '../content/catalog';
import type { Modifiers } from './effects';
import type { FurnaceState, SiteState } from './state';

/**
 * Ixion's Wheel, the Tartarus Rim's machine (docs/hill-workshops-plan.md §3.2).
 * Every impact heats the wheel, more slowly the hotter it is. At full heat it
 * erupts: impacts pay more for several climbs. Venting early gives a smaller
 * eruption sooner; eruption strength grows faster than heat, and heating slows
 * near the top, so there is a best vent point and devices move it.
 *
 * Everything here is pure and deterministic, so offline settlement can step
 * the wheel exactly as the live game does.
 */

const EPS = 1e-9;

export function furnaceSite(siteId: string): boolean {
  return catalog.furnace.siteId === siteId;
}

export function newFurnace(): FurnaceState {
  return { heat: 0, erupting: 0, power: 1, eruptions: 0, ventAt: catalog.furnace.defaultVentAt };
}

export function copyFurnace(f: FurnaceState | null): FurnaceState | null {
  return f ? { ...f } : null;
}

/** Heat added by one impact from `heat`. */
export function heatStep(m: Modifiers, f: FurnaceState): number {
  const c = catalog.furnace;
  const growth = Math.min(c.maxGrowth, 1 + m.furnaceGrowth * f.eruptions);
  return c.gain * growth * (1 - c.slowdown * f.heat);
}

/** Impact multiplier of an eruption vented at `heat`. */
export function eruptionPower(m: Modifiers, heat: number, extra = 1): number {
  const c = catalog.furnace;
  return 1 + c.power * heat ** c.exponent * m.furnacePower * extra;
}

export function eruptionClimbs(m: Modifiers): number {
  return Math.max(1, Math.round(catalog.furnace.climbs * m.furnaceDuration));
}

/** The impact multiplier the next cycle starts with. */
export function furnaceImpactFactor(site: Pick<SiteState, 'furnace'>): number {
  return site.furnace && site.furnace.erupting > 0 ? site.furnace.power : 1;
}

/** The heat shown on the gauge: draining through an eruption. */
export function shownHeat(m: Modifiers, f: FurnaceState): number {
  return f.erupting > 0 ? f.heat * (f.erupting / eruptionClimbs(m)) : f.heat;
}

export function canVent(f: FurnaceState | null): boolean {
  return !!f && f.erupting === 0 && f.heat >= catalog.furnace.minVent - EPS;
}

/** Start an eruption at the current heat. Returns true if the wheel was full. */
export function ignite(m: Modifiers, f: FurnaceState, extra = 1): boolean {
  const full = f.heat >= 1 - EPS;
  f.power = eruptionPower(m, f.heat, extra);
  f.erupting = eruptionClimbs(m);
  f.eruptions += 1;
  return full;
}

export type FurnaceOutcome = 'none' | 'ended' | 'erupted' | 'erupted-full';

/**
 * One impact has been paid. `held`: the player is pushing on this hill (live
 * only). `vents`: a steward is on duty and vents at `ventAt`.
 */
export function afterImpact(m: Modifiers, f: FurnaceState, held: boolean, vents: boolean): FurnaceOutcome {
  if (f.erupting > 0) {
    if (held && m.furnaceHold) return 'none';
    f.erupting -= 1;
    if (f.erupting > 0) return 'none';
    f.heat = Math.max(f.heat * m.furnaceRetain, m.furnaceFloor);
    f.power = 1;
    return 'ended';
  }
  f.heat = Math.min(1, f.heat + heatStep(m, f));
  if (f.heat >= 1 - EPS) {
    f.heat = 1;
    return ignite(m, f) ? 'erupted-full' : 'erupted';
  }
  if (vents && f.heat >= f.ventAt - EPS) {
    ignite(m, f);
    return 'erupted';
  }
  return 'none';
}

/**
 * The wheel's long-run pattern when left to itself (or to a steward venting at
 * `ventAt`): for each cycle of one steady period, its impact multiplier and
 * the wheel state it runs with. Used for steady income and advice, never for
 * payouts.
 */
export function steadyPattern(m: Modifiers, start: FurnaceState, vents: boolean, ventAt?: number): FurnaceState[] {
  const f: FurnaceState = { ...start, ventAt: ventAt ?? start.ventAt, erupting: 0, power: 1 };
  // Settle into the loop: a couple of whole eruptions first (growth is capped, so this converges).
  const cap = 4000;
  let ended = 0;
  let i = 0;
  for (; i < cap && ended < 2; i++) if (afterImpact(m, f, false, vents) === 'ended') ended++;
  const period: FurnaceState[] = [];
  for (let guard = 0; guard < cap; guard++) {
    period.push({ ...f });
    if (afterImpact(m, f, false, vents) === 'ended') break;
  }
  return period;
}
