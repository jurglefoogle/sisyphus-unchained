import { describe, expect, it } from 'vitest';
import { catalog } from '../src/content/catalog';
import { Money } from '../src/core/money';
import { checksum, deserializeSave, serializeSave } from '../src/core/save';
import type { GameState } from '../src/core/state';
import { charter, playDaily, report } from './bot';
import { freshState } from './helpers';

/**
 * Release-candidate campaign checks (spec §06): the Eternal Labor Charter is
 * reachable from a clean save, with coin bonuses removed, and from a migrated
 * save. The player is the daily bot in tests/bot.ts (three sessions a day),
 * resetting when Begin Again is worth it. Set CAMPAIGN=1 to print its timings.
 */

function play(state: GameState, opts: { resets: boolean; days: number; stopAt?: (s: GameState) => boolean }) {
  return playDaily(state, { resets: opts.resets ? 'gain' : 'none', days: opts.days, stopAt: opts.stopAt });
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
  // v1 and v2 kept one shared purse in the wallet.
  env.data.wallet.obols = env.data.empire.sites[0].purse;
  for (const site of env.data.empire.sites) {
    delete site.snapshot.slipHeight;
    delete site.purse;
    delete site.gross;
    delete site.steward;
  }
  env.data.schemaVersion = 1;
  env.checksum = checksum(JSON.stringify(env.data));
  return JSON.stringify(env);
}


describe('release candidate: the campaign is completable', { timeout: 120_000 }, () => {
  it('reaches the Charter from a clean save, resetting when it pays', () => {
    const run = play(freshState(), { resets: true, days: 45 });
    report('clean, with resets', run, 'd');
    expect(charter(run.state)).toBe(true);
    expect(run.state.empire.sites).toHaveLength(catalog.sites.length);
    expect(run.state.counters.totalRuns).toBeGreaterThanOrEqual(3);
    // Every relic is guaranteed by the end of the campaign; luck never gates it.
    expect(run.state.discoveries.relicIds).toHaveLength(catalog.relics.catalog.length);
    // The bot spends Insight as a player would: every permanent upgrade, then the memory.
    expect(run.state.prestige.permanentUpgradeIds).toHaveLength(catalog.insightUpgrades.length);
    expect(Object.keys(run.state.prestige.remembrances).length).toBeGreaterThan(0);
    expect(run.state.prestige.fileSlots.length).toBeGreaterThan(0);
  });

  it('never stalls without a reset, though Begin Again is part of the road', () => {
    // Without resets the campaign is not meant to finish (plan §9.6), but it keeps moving.
    const run = play(freshState(), { resets: false, days: 60 });
    report('clean, no reset', run, 'd');
    expect(charter(run.state)).toBe(false);
    expect(run.state.empire.sites.length).toBeGreaterThanOrEqual(4);
  });

  it('reaches the Charter with every coin bonus removed', () => {
    const run = withoutCoinBonuses(() => play(freshState(), { resets: true, days: 45 }));
    report('no coin bonuses', run, 'd');
    expect(charter(run.state)).toBe(true);
    // Coin bonuses are a garnish (expected ×1.08, compounded over a month), never a gate.
    // The bot's reset policy is discrete: less income can cost it a whole extra
    // Begin Again, so the bound is loose (plan Phase 8 revisits reset pacing).
    const lucky = play(freshState(), { resets: true, days: 45 });
    expect(run.t / lucky.t).toBeLessThan(1.5);
  });

  it('reaches the Charter from a migrated schema-v1 save', () => {
    // A First Hill-only run keeps its Obols across the move to per-hill purses.
    const early = play(freshState(), { resets: true, days: 45, stopAt: (s) => s.empire.foremanOwned });
    const loaded = deserializeSave(asV1(early.state));
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    expect(loaded.migratedFrom).toBe(1);
    expect(loaded.state.prelude.complete).toBe(true);
    const run = play(loaded.state, { resets: true, days: 45 });
    report('migrated v1', run, 'd');
    expect(charter(run.state)).toBe(true);
  });
});

describe('release candidate: invariants over a campaign', { timeout: 120_000 }, () => {
  it('Defiance only rises within a run, Insight never falls, and spending stays within the wallet', () => {
    const s = freshState();
    let lastGross = Money.ZERO;
    let lastRuns = 0;
    let lastInsight = 0;
    play(s, {
      resets: true,
      days: 45,
      stopAt: (x) => {
        if (x.counters.totalRuns !== lastRuns) {
          lastRuns = x.counters.totalRuns;
          lastGross = Money.ZERO;
        }
        expect(x.wallet.runGross.gte(lastGross)).toBe(true);
        for (const site of x.empire.sites) {
          expect(site.purse.gte(0)).toBe(true);
          expect(site.purse.lte(site.gross)).toBe(true);
        }
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
      days: 45,
      stopAt: (x) => {
        if (++n % 1000 === 0) snapshots.push(serializeSave(x));
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
