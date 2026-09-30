import { catalog } from '../content/catalog';
import { appealDef, deviceDef, EDICTS, remembranceFor, WHISPERS, type Effect } from '../content/devices';
import type { GameState } from './state';

/** Every device rule in force on one hill, folded into plain numbers. */
export interface Modifiers {
  ascent: number;
  descent: number;
  noReturn: boolean;
  impact: number;
  crew: number;
  flywheel: number;
  nth: { every: number; factor: number }[];
  spectator: number;
  amphorae: number;
  rebirth: number;
  furnacePower: number;
  furnaceDuration: number;
  furnaceRetain: number;
  furnaceFloor: number;
  furnaceWhip: number;
  furnaceNoReturn: boolean;
  furnaceHold: boolean;
  furnaceLump: number;
  furnaceGrowth: number;
  furnaceWelcome: boolean;
  jarInflow: number;
  jarExtra: number;
  jarReturn: number;
  jarGlaze: number;
  jarSpillPay: number;
  jarSpillAway: number;
  jarTide: number;
  jarDrillCost: number;
  jarDoubleDrill: boolean;
  jarPower: number;
  foundrySize: number;
  foundryPour: number;
  foundryRefund: number;
  /** 0: no Golden Gallery; otherwise levels' price per free crew level. */
  foundryCrew: number;
  skySpeed: number;
  skyNight: boolean;
  skyCooldown: number;
  skyBackwards: boolean;
  bureauSpeed: number;
  bureauFree: number;
  bureauFee: number;
  bureauCap: number;
  bureauFiling: number;
  bureauClerkCost: number;
  edictLength: number;
  dueProcess: number;
}

const NEUTRAL: Modifiers = {
  ascent: 1,
  descent: 1,
  noReturn: false,
  impact: 1,
  crew: 1,
  flywheel: 1,
  nth: [],
  spectator: 0,
  amphorae: 1,
  rebirth: 0,
  furnacePower: 1,
  furnaceDuration: 1,
  furnaceRetain: 0,
  furnaceFloor: 0,
  furnaceWhip: 0,
  furnaceNoReturn: false,
  furnaceHold: false,
  furnaceLump: 0,
  furnaceGrowth: 0,
  furnaceWelcome: false,
  jarInflow: 1,
  jarExtra: 0,
  jarReturn: 0,
  jarGlaze: 0,
  jarSpillPay: 0,
  jarSpillAway: 0,
  jarTide: 0,
  jarDrillCost: 1,
  jarDoubleDrill: false,
  jarPower: 1,
  foundrySize: 1,
  foundryPour: 1,
  foundryRefund: 0,
  foundryCrew: 0,
  skySpeed: 1,
  skyNight: false,
  skyCooldown: 1,
  skyBackwards: false,
  bureauSpeed: 1,
  bureauFree: 0,
  bureauFee: 1,
  bureauCap: 1,
  bureauFiling: 1,
  bureauClerkCost: 1,
  edictLength: 1,
  dueProcess: 1,
};

function fold(m: Modifiers, e: Effect): void {
  switch (e.kind) {
    case 'ascent':
      m.ascent *= e.factor;
      return;
    case 'descent':
      m.descent *= e.factor;
      return;
    case 'noReturn':
      m.noReturn = true;
      return;
    case 'impact':
      m.impact *= e.factor;
      return;
    case 'crew':
      m.crew *= e.factor;
      return;
    case 'flywheel':
      m.flywheel *= e.factor;
      return;
    case 'everyNth':
      m.nth.push({ every: e.every, factor: e.factor });
      return;
    case 'spectator':
      m.spectator += e.share;
      return;
    case 'amphorae':
      m.amphorae *= e.factor;
      return;
    case 'rebirth':
      m.rebirth = Math.max(m.rebirth, e.crew);
      return;
    case 'furnacePower':
      m.furnacePower *= e.factor;
      return;
    case 'furnaceDuration':
      m.furnaceDuration *= e.factor;
      return;
    case 'furnaceRetain':
      m.furnaceRetain = Math.max(m.furnaceRetain, e.share);
      return;
    case 'furnaceFloor':
      m.furnaceFloor = Math.max(m.furnaceFloor, e.heat);
      return;
    case 'furnaceWhip':
      m.furnaceWhip += e.factor;
      return;
    case 'furnaceNoReturn':
      m.furnaceNoReturn = true;
      return;
    case 'furnaceHold':
      m.furnaceHold = true;
      return;
    case 'furnaceLump':
      m.furnaceLump += e.share;
      return;
    case 'furnaceGrowth':
      m.furnaceGrowth += e.step;
      return;
    case 'furnaceWelcome':
      m.furnaceWelcome = true;
      return;
    case 'jarInflow':
      m.jarInflow *= e.factor;
      return;
    case 'jarExtra':
      m.jarExtra += e.water;
      return;
    case 'jarReturn':
      m.jarReturn = Math.max(m.jarReturn, e.share);
      return;
    case 'jarGlaze':
      m.jarGlaze = Math.max(m.jarGlaze, e.share);
      return;
    case 'jarSpillPay':
      m.jarSpillPay += e.share;
      return;
    case 'jarSpillAway':
      m.jarSpillAway += e.share;
      return;
    case 'jarTide':
      m.jarTide = Math.max(m.jarTide, e.amplitude);
      return;
    case 'jarDrillCost':
      m.jarDrillCost *= e.factor;
      return;
    case 'jarDoubleDrill':
      m.jarDoubleDrill = true;
      return;
    case 'jarPower':
      m.jarPower *= e.factor;
      return;
    case 'foundrySize':
      m.foundrySize *= e.factor;
      return;
    case 'foundryPour':
      m.foundryPour *= e.factor;
      return;
    case 'foundryRefund':
      m.foundryRefund += e.share;
      return;
    case 'foundryCrew':
      m.foundryCrew = m.foundryCrew > 0 ? Math.min(m.foundryCrew, e.every) : e.every;
      return;
    case 'skySpeed':
      m.skySpeed *= e.factor;
      return;
    case 'skyNight':
      m.skyNight = true;
      return;
    case 'skyCooldown':
      m.skyCooldown *= e.factor;
      return;
    case 'skyBackwards':
      m.skyBackwards = true;
      return;
    case 'bureauSpeed':
      m.bureauSpeed *= e.factor;
      return;
    case 'bureauFree':
      m.bureauFree += e.forms;
      return;
    case 'bureauFee':
      m.bureauFee *= e.factor;
      return;
    case 'bureauCap':
      m.bureauCap *= e.factor;
      return;
    case 'bureauFiling':
      m.bureauFiling *= e.factor;
      return;
    case 'bureauClerkCost':
      m.bureauClerkCost *= e.factor;
      return;
    case 'edictLength':
      m.edictLength *= e.factor;
      return;
    case 'dueProcess':
      m.dueProcess *= e.factor;
      return;
    case 'freeCrew':
      // Applied once, when the bargain is taken.
      return;
  }
}

/** The rules in force on `siteId`: its own devices, its whispers, and empire-wide devices anywhere. */
export function modifiers(state: GameState, siteId: string): Modifiers {
  const m: Modifiers = { ...NEUTRAL, nth: [] };
  for (const site of state.empire.sites) {
    for (const id of site.devices) {
      const def = deviceDef(id);
      // On the Skyward Escarpment a constellation works only while its house is overhead.
      if (site.sky && def.source === 'tablet' && site.sky.houses[site.sky.position] !== id) continue;
      if (site.id === siteId || def.empireWide) for (const e of def.effects) fold(m, e);
    }
  }
  for (const w of WHISPERS) {
    if (w.siteId === siteId && state.discoveries.whisperIds.includes(w.id)) for (const e of w.effects) fold(m, e);
  }
  // Remembrances: Insight ranks bought for this hill, one fold per rank.
  const memory = remembranceFor(siteId);
  if (memory) for (let r = state.prestige.remembrances[siteId] ?? 0; r > 0; r--) fold(m, memory.effect);
  // The Appeal's twist rules every hill. The stakes raise every crew's pay with the gates,
  // and each laurel won multiplies it again, compounding.
  const twist = appealDef(state.appeal.number);
  if (twist) for (const e of twist.effects) fold(m, e);
  m.crew *= catalog.appeals.payGrowth ** state.appeal.number * catalog.appeals.laurelMultiplier ** state.appeal.laurels;
  // Zeus's Edict, while one is in force, rules every hill.
  for (const site of state.empire.sites) {
    const edict = site.bureau?.edict ? EDICTS.find((x) => x.id === site.bureau!.edict) : undefined;
    if (edict) for (const e of edict.effects) fold(m, e);
  }
  // Due Process: the empire's milestones, as last recorded, raise this hill's crew.
  const own = state.empire.sites.find((s) => s.id === siteId);
  if (own?.bureau) m.crew *= 1 + catalog.bureau.dueStep * own.bureau.dueProcess * m.dueProcess;
  return m;
}

/** Payout multiplier of cycle `index` under the every-Nth rules. */
export function nthMultiplier(m: Modifiers, index: number): number {
  let f = 1;
  for (const r of m.nth) if (index % r.every === 0) f *= r.factor;
  return f;
}

function lcm(a: number, b: number): number {
  const gcd = (x: number, y: number): number => (y === 0 ? x : gcd(y, x % y));
  return (a / gcd(a, b)) * b;
}

function period(m: Modifiers): number {
  return m.nth.reduce((p, r) => lcm(p, r.every), 1);
}

/** Sum of cycle multipliers over indices from..to inclusive (exact, for offline batches). */
export function nthSum(m: Modifiers, from: number, to: number): number {
  if (to < from) return 0;
  const count = to - from + 1;
  if (m.nth.length === 0) return count;
  const p = period(m);
  let perPeriod = 0;
  for (let i = 0; i < p; i++) perPeriod += nthMultiplier(m, i);
  const full = Math.floor(count / p);
  let sum = full * perPeriod;
  for (let i = from + full * p; i <= to; i++) sum += nthMultiplier(m, i);
  return sum;
}

/** Long-run average cycle multiplier. */
export function nthAverage(m: Modifiers): number {
  if (m.nth.length === 0) return 1;
  const p = period(m);
  return nthSum(m, 0, p - 1) / p;
}
