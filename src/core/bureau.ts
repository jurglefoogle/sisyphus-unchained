import { catalog, siteDef } from '../content/catalog';
import { EDICTS, type EdictDef } from '../content/devices';
import type { Modifiers } from './effects';
import { baseLevelCostOf, milestoneCount } from './formulas';
import { Money } from './money';
import type { BureauState, GameState } from './state';

/**
 * The Paperwork Mill, the Olympian Approach's machine (docs/hill-workshops-plan.md §3.6).
 * Each summit files forms (more as the crew grows). Clerks approve them, and
 * approved forms pay the hill's impact. A backlog ripens: late fees, which
 * divine law makes Olympus pay, grow with the backlog up to the statute of
 * limitations. So the best mill lets the backlog ripen, then approves exactly
 * as fast as forms are filed; the Moirai hold it there. Every hundred
 * approvals Zeus issues an Edict for the whole empire, online only.
 *
 * Due Process: every crew milestone in the empire raises this hill's crew.
 * It is recorded when commands and stewards act, never mid-settlement, so
 * offline settlement stays exact.
 */

export function bureauSite(siteId: string): boolean {
  return catalog.bureau.siteId === siteId;
}

export function newBureau(): BureauState {
  const c = catalog.bureau;
  return { backlog: 0, hired: c.startClerks, onDuty: c.startClerks, factor: 1, approved: 0, idle: 0, dueProcess: 0, edict: null, edictSeconds: 0, edictIndex: 0 };
}

export function copyBureau(b: BureauState | null): BureauState | null {
  return b ? { ...b } : null;
}

/** Forms filed per summit at this crew level, before devices: the yardstick for pay. */
export function baseFiling(productionLevel: number): number {
  const c = catalog.bureau;
  return 1 + c.filingStep * Math.floor(productionLevel / c.filingEvery);
}

export function filing(m: Modifiers, productionLevel: number): number {
  return baseFiling(productionLevel) * m.bureauFiling;
}

/** Forms approved per climb with `clerks` on duty. */
export function throughput(m: Modifiers, clerks: number): number {
  return clerks * catalog.bureau.clerkRate * m.bureauSpeed + m.bureauFree;
}

/** The backlog's ripeness cap, in climbs' worth of filing. */
export function statute(m: Modifiers): number {
  return catalog.bureau.statute * m.bureauCap;
}

/** Pay per approved form with this backlog (late fees included). */
export function formValue(m: Modifiers, backlog: number, filed: number): number {
  return 1 + catalog.bureau.lateFee * m.bureauFee * Math.min(backlog / filed, statute(m));
}

/** Clerks that would approve as fast as forms are filed. */
export function clerksToMatch(m: Modifiers, productionLevel: number): number {
  const need = filing(m, productionLevel) - m.bureauFree;
  return Math.max(0, Math.ceil(need / (catalog.bureau.clerkRate * m.bureauSpeed) - 1e-9));
}

export function clerkCost(state: GameState, siteId: string, hired: number, m: Modifiers): Money {
  const c = catalog.bureau;
  return baseLevelCostOf(state, siteDef(siteId)).mul(c.clerkCost * m.bureauClerkCost).mul(Money.of(c.clerkGrowth).pow(hired)).ceil();
}

export interface FileStep {
  /** Approvals crossed a hundred: an Edict is due (online only). */
  edicts: number;
}

/**
 * One summit files its forms and the clerks work through the backlog.
 * `vents`: the Moirai are on duty and hold the backlog at the statute.
 * Sets the factor the next cycle's impact is paid with.
 */
export function fileForms(m: Modifiers, b: BureauState, productionLevel: number, vents: boolean): FileStep {
  const filed = filing(m, productionLevel);
  b.backlog += filed;
  const value = formValue(m, b.backlog, filed);
  const t = throughput(m, vents ? b.hired : b.onDuty);
  const approve = vents ? Math.min(t, Math.max(0, b.backlog - statute(m) * filed)) : Math.min(t, b.backlog);
  b.backlog = Math.max(0, b.backlog - approve);
  b.factor = (catalog.bureau.power * approve * value) / baseFiling(productionLevel);
  b.idle = approve > 1e-12 ? 0 : b.idle + 1;
  const before = Math.floor(b.approved / 100);
  b.approved += approve;
  return { edicts: Math.floor(b.approved / 100) - before };
}

export function bureauImpactFactor(site: { bureau: BureauState | null }): number {
  return site.bureau ? site.bureau.factor : 1;
}

/** Long-run impact factor of the mill as it stands (or as the Moirai run it). */
export function steadyBureauFactor(m: Modifiers, start: BureauState, productionLevel: number, vents: boolean, onDuty?: number): number {
  const b: BureauState = { ...start, onDuty: onDuty ?? start.onDuty };
  for (let i = 0; i < catalog.bureau.settleClimbs; i++) fileForms(m, b, productionLevel, vents);
  return b.factor;
}

/** Milestones reached on every hill held, for Due Process. */
export function empireMilestones(state: GameState): number {
  return state.empire.sites.reduce((n, s) => n + milestoneCount(s.productionLevel), 0);
}

/** Record Due Process now (after commands and stewards; never mid-settlement). */
export function recordDueProcess(state: GameState): void {
  const site = state.empire.sites.find((s) => s.bureau);
  if (site?.bureau) site.bureau.dueProcess = empireMilestones(state);
}

/** The Edict in force, if any. */
export function activeEdict(state: GameState): EdictDef | null {
  const b = state.empire.sites.find((s) => s.bureau)?.bureau;
  return b?.edict ? (EDICTS.find((e) => e.id === b.edict) ?? null) : null;
}

/** Zeus issues the next Edict of the deck. */
export function issueEdict(b: BureauState, m: Modifiers): EdictDef {
  const def = EDICTS[b.edictIndex % EDICTS.length];
  b.edictIndex += 1;
  b.edict = def.id;
  b.edictSeconds = catalog.bureau.edictSeconds * m.edictLength;
  return def;
}

/** Real time passes online: the Edict runs down. */
export function tickEdict(state: GameState, dt: number): void {
  const b = state.empire.sites.find((s) => s.bureau)?.bureau;
  if (!b?.edict) return;
  b.edictSeconds -= dt;
  if (b.edictSeconds <= 1e-9) {
    b.edict = null;
    b.edictSeconds = 0;
  }
}

/** The gods don't work weekends either: an absence ends any Edict. */
export function clearEdict(state: GameState): void {
  const b = state.empire.sites.find((s) => s.bureau)?.bureau;
  if (b) {
    b.edict = null;
    b.edictSeconds = 0;
  }
}
