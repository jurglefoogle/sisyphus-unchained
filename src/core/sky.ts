import { catalog } from '../content/catalog';
import { deviceDef } from '../content/devices';
import type { Modifiers } from './effects';
import type { SiteState, SkyState } from './state';

/**
 * The Orrery, the Skyward Escarpment's machine (docs/hill-workshops-plan.md §3.5).
 * The sky turns through twelve houses, one every few climbs. Constellations
 * (this hill's tablets) are mounted in houses of Atlas's frame; each bends its
 * rule only while its house is overhead. Empty houses are dark. Asking Atlas
 * to turn skips to the next mounted house, then he needs a rest.
 *
 * The sky moves per climb, not per second, so it never asks for timing, and
 * offline settlement steps it exactly as the live game does.
 */

export function skySite(siteId: string): boolean {
  return catalog.sky.siteId === siteId;
}

export function newSky(): SkyState {
  return { houses: Array(catalog.sky.houses).fill(null), position: 0, climbs: 0, cooldown: 0, streak: 0 };
}

export function copySky(s: SkyState | null): SkyState | null {
  return s ? { ...s, houses: [...s.houses] } : null;
}

/** A sealed find of the sky hill: it only works while mounted overhead. */
export function isConstellation(deviceId: string): boolean {
  const def = deviceDef(deviceId);
  return def.source === 'tablet' && skySite(def.siteId);
}

/** The constellation overhead, if its house is mounted. */
export function overhead(sky: SkyState): string | null {
  return sky.houses[sky.position] ?? null;
}

export function climbsPerHouse(m: Modifiers): number {
  return Math.max(1, Math.round(catalog.sky.climbsPerHouse / m.skySpeed));
}

export function turnCooldown(m: Modifiers): number {
  return Math.max(0, Math.round(catalog.sky.cooldown * m.skyCooldown));
}

/** The next mounted house after the one overhead, or null if there is none. */
export function nextMounted(sky: SkyState, dir: 1 | -1 = 1): number | null {
  const n = sky.houses.length;
  for (let k = 1; k <= n; k++) {
    const h = (((sky.position + dir * k) % n) + n) % n;
    if (sky.houses[h]) return h;
  }
  return null;
}

export function canTurn(sky: SkyState): boolean {
  const next = nextMounted(sky);
  return sky.cooldown === 0 && next !== null && next !== sky.position;
}

/** Atlas turns the sky to the next mounted house. */
export function turn(m: Modifiers, sky: SkyState): void {
  const next = nextMounted(sky, m.skyBackwards ? -1 : 1);
  if (next === null) return;
  sky.position = next;
  sky.climbs = 0;
  sky.cooldown = turnCooldown(m);
}

export interface SkyStep {
  /** The sky rolled on into a new house (not a turn). */
  entered: boolean;
  /** Atlas, on duty, turned past a dark house. */
  turned: boolean;
}

/**
 * One climb has ended. `held`: the player is pushing on this hill (live only).
 * `vents`: Atlas is on duty and turns past dark houses. `offline` with Selene's
 * Night Rate: a mounted house overhead stays there.
 */
export function advanceSky(m: Modifiers, sky: SkyState, held: boolean, offline: boolean, vents: boolean): SkyStep {
  const step: SkyStep = { entered: false, turned: false };
  if (sky.cooldown > 0) sky.cooldown -= 1;
  const pinned = offline && m.skyNight && overhead(sky) !== null;
  if (!pinned) {
    sky.climbs += 1;
    if (sky.climbs >= climbsPerHouse(m)) {
      const n = sky.houses.length;
      sky.position = (sky.position + (m.skyBackwards ? n - 1 : 1)) % n;
      sky.climbs = 0;
      step.entered = true;
      // Wished on a Star: pushing as mounted houses come over, several in a row.
      sky.streak = held && overhead(sky) !== null ? sky.streak + 1 : 0;
    }
  }
  if (vents && overhead(sky) === null && canTurn(sky)) {
    turn(m, sky);
    step.turned = true;
  }
  return step;
}

/**
 * The houses overhead for the next `cycles` cycles from `start`, as the sky
 * turns by itself (or with Atlas on duty). Used for steady income, never payouts.
 */
export function skyPattern(m: Modifiers, start: SkyState, vents: boolean, cycles: number): number[] {
  const sky = copySky(start)!;
  const out: number[] = [];
  for (let i = 0; i < cycles; i++) {
    out.push(sky.position);
    advanceSky(m, sky, false, false, vents);
  }
  return out;
}

/** Mounted where? (-1 when not mounted.) */
export function houseOf(sky: SkyState, deviceId: string): number {
  return sky.houses.indexOf(deviceId);
}

/** Whether `site` is the sky hill with this constellation overhead right now. */
export function aligned(site: Pick<SiteState, 'sky'>, deviceId: string): boolean {
  return !!site.sky && overhead(site.sky) === deviceId;
}
