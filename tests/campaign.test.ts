import { describe, expect, it } from 'vitest';
import { catalog } from '../src/content/catalog';
import {
  buyFlywheel,
  buyInsightUpgrade,
  buyLevels,
  buyPreludeUpgrade,
  buyWork,
  confirmPrestige,
  hireForeman,
  openSite,
} from '../src/core/commands';
import {
  availableInsight,
  bulkCost,
  flywheelCost,
  flywheelUnlocked,
  foremanUnlocked,
  isAutomated,
  levelsToMilestone,
  nextPreludeUpgrade,
  nextUnownedSite,
  spendableInsight,
  strengthLevelEffective,
  type LevelTrack,
} from '../src/core/formulas';
import { Money } from '../src/core/money';
import { settleOffline } from '../src/core/offline';
import { checksum, deserializeSave, serializeSave } from '../src/core/save';
import { stepSites } from '../src/core/sim';
import type { GameEvent, GameState } from '../src/core/state';
import { ctx, freshState } from './helpers';

/**
 * Release-candidate campaign checks (spec §06): the Eternal Labor Charter is
 * reachable from a clean save, with coin bonuses removed, and from a migrated
 * save. The bot is deliberately plain: hold Push until the Foreman arrives,
 * then leave the game automated and glance at the drawer every few seconds.
 * It never assists manually after automation, so it is slower than the
 * spec §08 continuous model. Set CAMPAIGN=1 to print its timings.
 */

const GLANCE = 10; // seconds between purchase decisions once automated
const SAVE_HORIZON = 600;
const MILESTONE_LOOKAHEAD = 5; // wait for a site or work that is this close, instead of buying levels

interface Run {
  state: GameState;
  t: number;
  log: { t: number; what: string }[];
}

/** Worth saving for: the next site once its decree is out, or any work that is unlocked. */
function target(s: GameState): { cost: Money; buy: () => boolean; label: string } | null {
  const next = nextUnownedSite(s);
  if (next && s.empire.offeredSiteIds.includes(next.id)) {
    return { cost: next.unlockCost, buy: () => openSite(s, next.id, []).ok, label: `open ${next.id}` };
  }
  for (const w of catalog.works) {
    if (s.empire.purchasedWorkIds.includes(w.id)) continue;
    const site = s.empire.sites.find((x) => x.id === w.siteId);
    if (!site || site.productionLevel < w.requiredLevel) continue;
    return { cost: w.cost, buy: () => buyWork(s, w.id, []).ok, label: `work ${w.id}` };
  }
  return null;
}

function shop(run: Run): void {
  const s = run.state;
  const note = (what: string) => run.log.push({ t: run.t, what });
  for (let guard = 0; guard < 2000; guard++) {
    const grip = nextPreludeUpgrade(s);
    if (grip) {
      if (s.wallet.obols.lt(grip.cost) || !buyPreludeUpgrade(s, grip.id, []).ok) return;
      continue;
    }
    for (const u of [...catalog.insightUpgrades].sort((a, b) => a.order - b.order)) {
      if (s.prestige.permanentUpgradeIds.includes(u.id)) continue;
      if (spendableInsight(s) >= u.cost && buyInsightUpgrade(s, u.id, []).ok) note(`insight ${u.id}`);
      break;
    }
    if (!s.empire.foremanOwned) {
      if (foremanUnlocked(s)) {
        if (hireForeman(s, []).ok) {
          note('foreman');
          continue;
        }
        return;
      }
    }
    const goal = target(s);
    if (goal) {
      if (s.wallet.obols.gte(goal.cost) && goal.buy()) {
        note(goal.label);
        continue;
      }
    }
    if (flywheelUnlocked(s)) {
      const site = s.empire.sites.find((x) => !x.wheelOwned && s.wallet.obols.gte(flywheelCost(x)));
      if (site && buyFlywheel(s, site.id, []).ok) continue;
    }
    // Like the spec §08 heuristic, save for the selected target rather than dribbling money into levels.
    if (goal) return;
    // Short milestone lookahead, as in the spec §08 model: finish a doubling that is a few levels away.
    const push = s.empire.sites.find((site) => {
      const n = levelsToMilestone(site);
      const cost = n > 0 && n <= MILESTONE_LOOKAHEAD ? bulkCost(site, 'production', n) : null;
      return cost && s.wallet.obols.gte(cost);
    });
    if (push && buyLevels(s, push.id, 'production', levelsToMilestone(push), []).ok) continue;
    let best: { site: string; track: LevelTrack; cost: Money } | null = null;
    for (const site of s.empire.sites) {
      for (const track of ['production', 'strength', 'impact'] as LevelTrack[]) {
        if (track === 'strength' && !strengthLevelEffective(s, site, site.strengthLevel)) continue;
        const cost = bulkCost(site, track, 1);
        if (cost && s.wallet.obols.gte(cost) && (!best || cost.lt(best.cost))) best = { site: site.id, track, cost };
      }
    }
    if (!best || !buyLevels(s, best.site, best.track, 1, []).ok) return;
  }
}

/** Planned resets, as in the spec §08 four-reset policy. */
const RESETS = [1e6, 1e9, 1e12, 1e15].map((x) => Money.of(x));

function play(state: GameState, opts: { resets: boolean; limitHours: number; stopAt?: (s: GameState) => boolean }): Run {
  const run: Run = { state, t: 0, log: [] };
  const limit = opts.limitHours * 3600;
  const events: GameEvent[] = [];
  // Hands-on until the Foreman: hold Push, glance every two seconds.
  while (!isAutomated(state) && run.t < limit) {
    for (let i = 0; i < 40; i++) stepSites(state, 0.05, ctx({ manualHeld: true, events }));
    run.t += 2;
    events.length = 0;
    shop(run);
    if (opts.stopAt?.(state)) return run;
  }
  while (!state.empire.purchasedWorkIds.includes('charter') && run.t < limit) {
    settleOffline(state, GLANCE, events);
    events.length = 0;
    run.t += GLANCE;
    const nextReset = RESETS[state.counters.totalRuns];
    if (opts.resets && nextReset && state.wallet.runGross.gte(nextReset) && availableInsight(state) > 0) {
      confirmPrestige(state, []);
      run.log.push({ t: run.t, what: `begin again #${state.counters.totalRuns}` });
    }
    shop(run);
    if (!isAutomated(state)) {
      // After a reset without Remembered Hand the Foreman must be rehired by hand.
      for (let i = 0; i < 200; i++) stepSites(state, 0.05, ctx({ manualHeld: true, events }));
      events.length = 0;
      run.t += 10;
    }
    if (opts.stopAt?.(state)) return run;
  }
  return run;
}

function report(name: string, run: Run): void {
  if (!process.env.CAMPAIGN) return;
  const h = (t: number) => `${(t / 3600).toFixed(2)} h`;
  console.log(`${name}: charter=${run.state.empire.purchasedWorkIds.includes('charter')} at ${h(run.t)}`);
  for (const e of run.log.filter((x) => !x.what.startsWith('insight'))) console.log(`  ${h(e.t)}  ${e.what}`);
}

function withoutCoinBonuses<T>(fn: () => T): T {
  const targets = catalog.bonusTargets.map((b) => ({ ...b }));
  const expected = catalog.expectedBonusMultiplier;
  const mutable = catalog as { bonusTargets: typeof catalog.bonusTargets; expectedBonusMultiplier: number };
  mutable.bonusTargets.forEach((b, i) => (b.probability = i === 0 ? 1 : 0));
  mutable.bonusTargets.forEach((b) => (b.baseMultiplier = 0));
  mutable.expectedBonusMultiplier = 0;
  try {
    return fn();
  } finally {
    mutable.bonusTargets.forEach((b, i) => Object.assign(b, targets[i]));
    mutable.expectedBonusMultiplier = expected;
  }
}

function asV1(s: GameState): string {
  const env = JSON.parse(serializeSave(s));
  delete env.data.prelude;
  for (const site of env.data.empire.sites) delete site.snapshot.slipHeight;
  env.data.schemaVersion = 1;
  env.checksum = checksum(JSON.stringify(env.data));
  return JSON.stringify(env);
}

const charter = (s: GameState) => s.empire.purchasedWorkIds.includes('charter');

describe('release candidate: the campaign is completable', () => {
  it('reaches the Charter from a clean save with the four-reset policy', () => {
    const run = play(freshState(), { resets: true, limitHours: 5 });
    report('clean, four resets', run);
    expect(charter(run.state)).toBe(true);
    expect(run.state.empire.sites).toHaveLength(catalog.sites.length);
    expect(run.state.counters.totalRuns).toBe(4);
    // Every relic is guaranteed by the end of the campaign; luck never gates it.
    expect(run.state.discoveries.relicIds).toHaveLength(catalog.relics.catalog.length);
  });

  it('reaches the Charter without any reset', () => {
    const run = play(freshState(), { resets: false, limitHours: 24 });
    report('clean, no reset', run);
    expect(charter(run.state)).toBe(true);
  });

  it('reaches the Charter with every coin bonus removed', () => {
    const run = withoutCoinBonuses(() => play(freshState(), { resets: true, limitHours: 5 }));
    report('no coin bonuses', run);
    expect(charter(run.state)).toBe(true);
    // Coin bonuses are a garnish (expected ×1.08), never a gate.
    const lucky = play(freshState(), { resets: true, limitHours: 5 });
    expect(run.t / lucky.t).toBeLessThan(1.2);
  });

  it('reaches the Charter from a migrated schema-v1 save', () => {
    const early = play(freshState(), { resets: true, limitHours: 5, stopAt: (s) => s.empire.sites.length >= 2 });
    const loaded = deserializeSave(asV1(early.state));
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    expect(loaded.migratedFrom).toBe(1);
    expect(loaded.state.prelude.complete).toBe(true);
    const run = play(loaded.state, { resets: true, limitHours: 5 });
    report('migrated v1', run);
    expect(charter(run.state)).toBe(true);
  });
});

describe('release candidate: invariants over a campaign', () => {
  it('Defiance only rises within a run, Insight never falls, and spending stays within the wallet', () => {
    const s = freshState();
    let lastGross = Money.ZERO;
    let lastRuns = 0;
    let lastInsight = 0;
    play(s, {
      resets: true,
      limitHours: 5,
      stopAt: (x) => {
        if (x.counters.totalRuns !== lastRuns) {
          lastRuns = x.counters.totalRuns;
          lastGross = Money.ZERO;
        }
        expect(x.wallet.runGross.gte(lastGross)).toBe(true);
        expect(x.wallet.obols.gte(0)).toBe(true);
        expect(x.wallet.obols.lte(x.wallet.runGross)).toBe(true);
        expect(x.prestige.lifetimeInsightAwarded).toBeGreaterThanOrEqual(lastInsight);
        lastGross = x.wallet.runGross;
        lastInsight = x.prestige.lifetimeInsightAwarded;
        return false;
      },
    });
    expect(charter(s)).toBe(true);
  });

  it('a save taken at any campaign stage round-trips exactly', () => {
    const snapshots: string[] = [];
    let n = 0;
    play(freshState(), {
      resets: true,
      limitHours: 5,
      stopAt: (x) => {
        if (++n % 300 === 0) snapshots.push(serializeSave(x));
        return false;
      },
    });
    expect(snapshots.length).toBeGreaterThan(3);
    for (const text of snapshots) {
      const r = deserializeSave(text);
      expect(r.ok).toBe(true);
      if (r.ok) expect(serializeSave(r.state)).toBe(text);
    }
  });
});
