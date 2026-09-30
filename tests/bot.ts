import { catalog } from '../src/content/catalog';
import {
  breakSeal,
  buyFlywheel,
  buyInsightUpgrade,
  buyLevels,
  buyPreludeUpgrade,
  buyWork,
  confirmPrestige,
  hireForeman,
  hireSteward,
  installCounterweight,
  openSite,
  setTrim,
  takeBargain,
  drill,
  patch,
  pourNext,
  mount,
  turnSky,
  hireClerk,
  setOnDuty,
  fileAppeal,
  keepOnFile,
  remember,
  summonVisitor,
} from '../src/core/commands';
import { remembranceFor, tabletPool, visitorFor } from '../src/content/devices';
import { canTurn, isConstellation, overhead } from '../src/core/sky';
import { clerkCost, clerksToMatch, filing, statute } from '../src/core/bureau';
import { unlockCostOf, workCostOf } from '../src/core/formulas';
import { modifiers } from '../src/core/effects';
import { bestHoles } from '../src/core/jar';
import {
  availableInsight,
  bestTrim,
  bulkCost,
  drillCost,
  counterweightCost,
  counterweightUnlocked,
  flywheelCost,
  flywheelOffered,
  foremanUnlocked,
  frontierSite,
  insightFactor,
  isAutomated,
  levelsToMilestone,
  milestoneCount,
  nextPreludeUpgrade,
  nextUnownedSite,
  spendableInsight,
  steadyIncomePerSecond,
  stewardCost,
  stewardOffered,
  strengthLevelEffective,
  tabletCost,
  tabletLevel,
  type LevelTrack,
} from '../src/core/formulas';
import { Money } from '../src/core/money';
import { settleOffline } from '../src/core/offline';
import { visitorWaiting } from '../src/core/seals';
import { stepSites } from '../src/core/sim';
import type { GameEvent, GameState, SiteState } from '../src/core/state';
import { runStewards } from '../src/core/stewards';
import { ctx } from './helpers';

/**
 * Scripted players for balance tests (docs/hill-workshops-plan.md §9).
 * They are deliberately plain: hold Push until the Foreman arrives, then leave
 * the game automated and glance at the drawer every few seconds. They never
 * assist by hand after automation, so real players who push land earlier.
 * Insight goes to the permanent upgrades in order, then to the memory: a file
 * for each hill held, Remembrances cheapest rank first, and a summons for a
 * new hill's visitor. They never Unseal (reading a rule changes nothing for
 * a player who takes every tablet).
 */

export const GLANCE = 10; // seconds between purchase decisions while present

/** Observers for measurement runs (tests/pacing-study.test.ts): called after each shop, and before each Begin Again. */
export const watch: {
  glance?: (run: Run, when: 'hand' | 'glance' | 'return') => void;
  beforeReset?: (run: Run) => void;
  afterReset?: (run: Run) => void;
} = {};
const MILESTONE_LOOKAHEAD = 5; // wait for a site or work that is this close, instead of buying levels

export interface Run {
  state: GameState;
  /** Wall-clock seconds since the save was made. */
  t: number;
  /** Seconds actually spent in the game. */
  played: number;
  log: { t: number; what: string }[];
  /** Decrees offered by each absence (the daily bot). */
  absences: { t: number; decrees: string[] }[];
}

export function newRun(state: GameState): Run {
  return { state, t: 0, played: 0, log: [], absences: [] };
}

/** Worth saving for on this hill: the next hill once its decree is out (frontier only), or an unlocked work here. */
function target(s: GameState, site: SiteState): { cost: Money; buy: () => boolean; label: string } | null {
  const next = nextUnownedSite(s);
  if (next && frontierSite(s) === site && s.empire.offeredSiteIds.includes(next.id)) {
    return { cost: unlockCostOf(s, next), buy: () => openSite(s, next.id, []).ok, label: `open ${next.id}` };
  }
  for (const w of catalog.works) {
    if (w.siteId !== site.id || s.empire.purchasedWorkIds.includes(w.id)) continue;
    if (site.productionLevel < w.requiredLevel) continue;
    return { cost: workCostOf(s, w), buy: () => buyWork(s, w.id, []).ok, label: `work ${w.id}` };
  }
  return null;
}

/** Machines and devices: bought as soon as they are affordable, since each one changes the hill. */
function tinker(s: GameState, site: SiteState): boolean {
  if (flywheelOffered(s, site) && !site.wheelOwned && site.purse.gte(flywheelCost(site)) && buyFlywheel(s, site.id, []).ok) return true;
  if (site.counterweight === null && counterweightUnlocked(site) && site.purse.gte(counterweightCost(site))) {
    if (installCounterweight(s, site.id, []).ok) return true;
  }
  for (let i = 0; i < site.hand.length; i++) {
    if (site.devices.includes(site.hand[i]) || site.productionLevel < tabletLevel(i)) continue;
    if (site.purse.gte(tabletCost(site, i)) && breakSeal(s, site.id, i, []).ok) return true;
  }
  const v = visitorWaiting(site);
  if (v && takeBargain(s, site.id, v.bargains[0], []).ok) return true;
  return false;
}

/** Shop one hill from its own purse. Returns true if anything was bought. */
/** Drill or patch toward the best hole count (drilling only when it is cheap next to the purse). */
function tendJar(s: GameState, site: SiteState): void {
  const jar = site.jar!;
  const best = bestHoles(modifiers(s, site.id), jar, site.productionLevel);
  while (jar.holes > best && patch(s, site.id, []).ok);
  while (jar.holes < best && site.purse.gte(drillCost(s, site).mul(4)) && drill(s, site.id).ok);
}

/** Hire clerks while cheap; let the backlog ripen to the statute, then keep up with filing. */
function tendMill(s: GameState, site: SiteState): void {
  const b = site.bureau!;
  const m = modifiers(s, site.id);
  const match = clerksToMatch(m, site.productionLevel);
  while (b.hired < match && site.purse.gte(clerkCost(s, site.id, b.hired, m).mul(4)) && hireClerk(s, site.id).ok);
  const ripe = b.backlog >= statute(m) * filing(m, site.productionLevel);
  const want = Math.min(b.hired, ripe ? match : Math.floor(match / 2));
  if (want !== b.onDuty) setOnDuty(s, site.id, want);
}

/** Saving for a goal, buy levels that pay back before it (the pacing study's player); off by default. */
let payback = false;
export function setPayback(on: boolean): void {
  payback = on;
}

/** Buying the next level reaches `goal` sooner: its payback is shorter than the wait for the goal. */
function levelBringsGoalNearer(s: GameState, site: SiteState, goal: Money): boolean {
  const cost = bulkCost(site, 'production', 1);
  const income = steadyIncomePerSecond(s, site);
  if (!cost || site.purse.lt(cost) || income.lte(0)) return false;
  const L = site.productionLevel;
  const worth = (l: number) => l * catalog.levels.milestoneFactor ** milestoneCount(l);
  const gain = income.mul(worth(L + 1) / worth(L) - 1);
  return cost.div(gain).lt(goal.sub(site.purse).div(income));
}

function shopSite(run: Run, site: SiteState): boolean {
  const s = run.state;
  const note = (what: string) => run.log.push({ t: run.t, what });
  let any = false;
  for (let guard = 0; guard < 2000; guard++) {
    const goal = target(s, site);
    if (goal && site.purse.gte(goal.cost) && goal.buy()) {
      note(goal.label);
      any = true;
      continue;
    }
    if (!site.steward && stewardOffered(s, site) && site.purse.gte(stewardCost(site))) {
      if (hireSteward(s, site.id, 'local', []).ok) {
        note(`steward ${site.id}`);
        any = true;
      }
    }
    // A steward runs this hill from here on.
    if (site.steward) return any;
    if (tinker(s, site)) {
      any = true;
      continue;
    }
    if (site.counterweight !== null) setTrim(s, site.id, bestTrim(s, site));
    if (site.jar && !site.steward) tendJar(s, site);
    if (site.foundry?.paused && site.foundry.queue.length > 0) pourNext(s, site.id, site.foundry.queue[0]);
    if (site.sky) {
      // Hang every constellation in the first dark house, side by side; turn past dark houses by hand.
      for (const id of site.devices.filter(isConstellation)) {
        if (!site.sky.houses.includes(id)) mount(s, site.id, id, site.sky.houses.indexOf(null));
      }
      if (!site.steward && overhead(site.sky) === null && canTurn(site.sky)) turnSky(s, site.id, []);
    }
    if (site.bureau) tendMill(s, site);
    // Like the spec §08 heuristic, save for the selected target rather than dribbling money into levels.
    if (goal) {
      // The patient saver waits; the payback saver buys a level whenever it
      // pays for itself before the goal would be reached, since that brings the goal nearer.
      if (!payback || !levelBringsGoalNearer(s, site, goal.cost)) return any;
      if (!buyLevels(s, site.id, 'production', 1, []).ok) return any;
      any = true;
      continue;
    }
    // Short milestone lookahead, as in the spec §08 model: finish a doubling that is a few levels away.
    const n = levelsToMilestone(site);
    const push = n > 0 && n <= MILESTONE_LOOKAHEAD ? bulkCost(site, 'production', n) : null;
    if (push && site.purse.gte(push) && buyLevels(s, site.id, 'production', n, []).ok) {
      any = true;
      continue;
    }
    let best: { track: LevelTrack; cost: Money } | null = null;
    for (const track of ['production', 'strength', 'impact'] as LevelTrack[]) {
      if (track === 'strength' && !strengthLevelEffective(s, site, site.strengthLevel)) continue;
      const cost = bulkCost(site, track, 1);
      if (cost && site.purse.gte(cost) && (!best || cost.lt(best.cost))) best = { track, cost };
    }
    if (!best || !buyLevels(s, site.id, best.track, 1, []).ok) return any;
    any = true;
  }
  return any;
}

export function shop(run: Run): void {
  const s = run.state;
  const note = (what: string) => run.log.push({ t: run.t, what });
  for (let guard = 0; guard < 200; guard++) {
    const grip = nextPreludeUpgrade(s);
    if (grip) {
      if (s.empire.sites[0].purse.lt(grip.cost) || !buyPreludeUpgrade(s, grip.id, []).ok) return;
      continue;
    }
    spendInsight(run);
    if (!s.empire.foremanOwned && foremanUnlocked(s)) {
      // Save for the Foreman once he is on offer.
      if (!hireForeman(s, []).ok) return;
      note('foreman');
    }
    let any = false;
    // Newest hill first: it is the one being pushed.
    for (const site of [...s.empire.sites].reverse()) any = shopSite(run, site) || any;
    runStewards(s, []);
    if (!any) return;
  }
}

// ------------------------------------------------------------ Insight

/** Hills whose name is in the Archive: held in some run, so their memory can be bought. */
const known = (s: GameState) => catalog.sites.filter((d, i) => i === 0 || s.discoveries.archiveIds.includes(`site.${d.id}`));

/**
 * The next permanent upgrade first, saving for it; once all are owned, the
 * memory. A file (8) for each hill held, with its first revealed tablet;
 * then one Remembrance rank at a time, cheapest first. A summons (3, this run
 * only) calls a newly opened hill's visitor, once the file and ranks are paid for.
 */
function spendInsight(run: Run): void {
  const s = run.state;
  const note = (what: string) => run.log.push({ t: run.t, what });
  const next = [...catalog.insightUpgrades].sort((a, b) => a.order - b.order).find((u) => !s.prestige.permanentUpgradeIds.includes(u.id));
  if (next) {
    if (spendableInsight(s) >= next.cost && buyInsightUpgrade(s, next.id, []).ok) note(`insight ${next.id}`);
    return;
  }
  for (let guard = 0; guard < 100; guard++) {
    const hills = known(s);
    const unfiled = hills.find((d) => !s.prestige.fileSlots.includes(d.id) && tabletPool(d.id).some((t) => s.discoveries.codexIds.includes(t.id)));
    if (unfiled) {
      const pick = tabletPool(unfiled.id).find((t) => s.discoveries.codexIds.includes(t.id))!;
      if (!keepOnFile(s, unfiled.id, pick.id).ok) return;
      note(`insight file ${unfiled.id}`);
      continue;
    }
    const costs = catalog.memory.remembranceCosts;
    const rank = (id: string) => s.prestige.remembrances[id] ?? 0;
    const cheapest = hills.filter((d) => remembranceFor(d.id) && rank(d.id) < costs.length).sort((a, b) => rank(a.id) - rank(b.id))[0];
    if (cheapest) {
      if (!remember(s, cheapest.id, []).ok) return;
      note(`insight remember ${cheapest.id} ${rank(cheapest.id)}`);
      continue;
    }
    for (const site of s.empire.sites) {
      const v = visitorFor(site.id);
      if (v && !site.summoned && site.productionLevel < v.arrivesAt && summonVisitor(s, site.id, []).ok) note(`insight summon ${site.id}`);
    }
    return;
  }
}

// ------------------------------------------------------------ Begin Again

/** Fixed resets at these Defiance records (the spec §08 four-reset policy). */
export const FIXED_RESETS = [1e6, 1e9, 1e12, 1e15].map((x) => Money.of(x));

/**
 * A player's reset: when Begin Again would raise the Insight factor by half
 * again. Because the factor is linear in orders of Defiance, the runs lengthen
 * as the campaign goes on.
 */
export const RESET_GAIN = 1.5;

export type ResetPolicy = 'none' | 'fixed' | 'gain';

/** The factor rise that makes Begin Again worth it; `playAppeals` may lower it for the Appeals. */
let resetGain = RESET_GAIN;

function wantsReset(s: GameState, policy: ResetPolicy): boolean {
  const award = availableInsight(s);
  if (policy === 'none' || award <= 0) return false;
  if (policy === 'fixed') {
    const next = FIXED_RESETS[s.counters.totalRuns];
    return !!next && s.wallet.runGross.gte(next);
  }
  const lifetime = s.prestige.lifetimeInsightAwarded;
  return insightFactor(lifetime + award) >= resetGain * insightFactor(lifetime);
}

function maybeReset(run: Run, policy: ResetPolicy): void {
  if (!wantsReset(run.state, policy)) return;
  watch.beforeReset?.(run);
  confirmPrestige(run.state, []);
  watch.afterReset?.(run);
  run.log.push({ t: run.t, what: `begin again #${run.state.counters.totalRuns}` });
}

// ------------------------------------------------------------ players

/** Hold Push for `seconds`, glancing every two. */
function pushByHand(run: Run, seconds: number, events: GameEvent[]): void {
  for (let spent = 0; spent < seconds; spent += 2) {
    for (let i = 0; i < 40; i++) stepSites(run.state, 0.05, ctx({ manualHeld: true, events }));
    events.length = 0;
    run.t += 2;
    run.played += 2;
    shop(run);
    watch.glance?.(run, 'hand');
  }
}

/** Be present for `seconds`: glance and shop every GLANCE seconds. */
function present(run: Run, seconds: number, policy: ResetPolicy, stopAt?: (s: GameState) => boolean): boolean {
  const events: GameEvent[] = [];
  const end = run.t + seconds;
  while (run.t < end) {
    if (!isAutomated(run.state)) {
      pushByHand(run, 10, events);
    } else {
      settleOffline(run.state, GLANCE, events);
      events.length = 0;
      run.t += GLANCE;
      run.played += GLANCE;
      maybeReset(run, policy);
      shop(run);
      watch.glance?.(run, 'glance');
    }
    if (charter(run.state) || stopAt?.(run.state)) return true;
  }
  return false;
}

export const charter = (s: GameState) => s.empire.purchasedWorkIds.includes('charter');

/** Always present, never away. */
export function playBinge(
  state: GameState,
  opts: { resets: ResetPolicy; limitHours: number; stopAt?: (s: GameState) => boolean },
): Run {
  const run = newRun(state);
  present(run, opts.limitHours * 3600, opts.resets, opts.stopAt);
  return run;
}

/** Three sessions a day (start hour, minutes), about an hour in all, away the rest. */
export const DAY: [number, number][] = [
  [8, 20],
  [13, 15],
  [21, 25],
];

/**
 * The daily player. Day 0 starts with an evening session that lasts until the
 * Foreman is hired (and a few minutes more). Away time is settled exactly as
 * the game does on return: capped, then stewards act once.
 */
export function playDaily(
  state: GameState,
  opts: { resets: ResetPolicy; days: number; stopAt?: (s: GameState) => boolean },
): Run {
  const run = newRun(state);
  const events: GameEvent[] = [];
  // First session: until the Foreman, plus ten minutes to look around.
  run.t = 21 * 3600;
  while (!isAutomated(state) && run.t < 23 * 3600) pushByHand(run, 10, events);
  if (present(run, 600, opts.resets, opts.stopAt)) return run;
  for (let day = 1; day <= opts.days; day++) {
    for (const [hour, minutes] of DAY) {
      const start = day * 86400 + hour * 3600;
      if (start <= run.t) continue;
      const away = start - run.t;
      const summary = settleOffline(state, away, events);
      events.length = 0;
      run.absences.push({ t: start, decrees: summary.decreeSiteIds });
      runStewards(state, []);
      run.t = start;
      maybeReset(run, opts.resets);
      shop(run);
      watch.glance?.(run, 'return');
      if (present(run, minutes * 60, opts.resets, opts.stopAt)) return run;
    }
  }
  return run;
}

/**
 * The daily player carried on through Thanatos's Appeals: each Charter is
 * followed by filing the next Appeal at the next glance, and the campaign
 * goes on under its twist (resetting when Begin Again is worth it, as before).
 * `appealed` holds the day each Appeal was filed; `laurels` the day each
 * Charter under an Appeal was signed.
 */
export function playAppeals(
  state: GameState,
  opts: { resets: ResetPolicy; appeals: number; daysEach: number; appealGain?: number },
): Run & { appealed: number[]; laurels: number[] } {
  const appealed: number[] = [];
  const laurels: number[] = [];
  const run = playDaily(state, { resets: opts.resets, days: opts.daysEach });
  const result = Object.assign(run, { appealed, laurels });
  if (!charter(state)) return result;
  laurels.push(run.t);
  resetGain = opts.appealGain ?? RESET_GAIN;
  try {
    appeals(run, state, opts, appealed, laurels);
  } finally {
    resetGain = RESET_GAIN;
  }
  return result;
}

function appeals(run: Run, state: GameState, opts: { resets: ResetPolicy; appeals: number; daysEach: number }, appealed: number[], laurels: number[]): void {
  for (let n = 1; n <= opts.appeals; n++) {
    if (!fileAppeal(state, []).ok) return;
    appealed.push(run.t);
    run.log.push({ t: run.t, what: `appeal ${n}` });
    if (!continueDaily(run, { resets: opts.resets, until: run.t + opts.daysEach * 86400 })) return;
    laurels.push(run.t);
    const w = state.wallet;
    run.log.push({ t: run.t, what: `laurel ${n}: run gross 1e${w.runGross.log10().toFixed(1)}, best 1e${w.bestRunGross.log10().toFixed(1)}, Insight ${state.prestige.lifetimeInsightAwarded} (+${availableInsight(state)} on offer)` });
  }
}

/** Carry on the daily routine from `run.t` until the Charter is signed or `until`. */
function continueDaily(run: Run, opts: { resets: ResetPolicy; until: number }): boolean {
  const state = run.state;
  const events: GameEvent[] = [];
  const first = Math.floor(run.t / 86400);
  for (let day = first; day * 86400 < opts.until; day++) {
    for (const [hour, minutes] of DAY) {
      const start = day * 86400 + hour * 3600;
      if (start <= run.t) continue;
      const summary = settleOffline(state, start - run.t, events);
      events.length = 0;
      run.absences.push({ t: start, decrees: summary.decreeSiteIds });
      runStewards(state, []);
      run.t = start;
      maybeReset(run, opts.resets);
      shop(run);
      watch.glance?.(run, 'return');
      if (!isAutomated(state)) pushByHand(run, 60, events);
      if (present(run, minutes * 60, opts.resets)) return true;
    }
  }
  return false;
}

export function report(name: string, run: Run, unit: 'h' | 'd' = 'h'): void {
  if (!process.env.CAMPAIGN) return;
  const at = (t: number) => (unit === 'h' ? `${(t / 3600).toFixed(2)} h` : `day ${(t / 86400).toFixed(1)}`);
  console.log(
    `${name}: charter=${charter(run.state)} at ${at(run.t)} (played ${(run.played / 3600).toFixed(1)} h, ${run.state.counters.totalRuns} resets)`,
  );
  const insight = run.log.filter((x) => x.what.startsWith('insight')).length;
  console.log(`  insight spends: ${insight}, spendable left ${spendableInsight(run.state)}, lifetime ${run.state.prestige.lifetimeInsightAwarded}`);
  for (const e of run.log.filter((x) => !x.what.startsWith('insight') && !x.what.startsWith('steward'))) {
    console.log(`  ${at(e.t)}  ${e.what}`);
  }
}
