import { describe, expect, it } from 'vitest';
import { catalog } from '../src/content/catalog';
import { CALLUSES_SUMMITS, tabletPool, TAKES_FIVE_SECONDS } from '../src/content/devices';
import {
  breakSeal,
  buyFlywheel,
  closeRun,
  installCounterweight,
  newGame,
  setPausedAt,
  setTrim,
  takeBargain,
} from '../src/core/commands';
import { modifiers, nthAverage, nthMultiplier, nthSum } from '../src/core/effects';
import {
  bestTrim,
  bonusTable,
  cycleSeconds,
  spendableInsight,
  steadyIncomePerSecond,
  tabletCost,
  tabletLevel,
} from '../src/core/formulas';
import { settleOffline } from '../src/core/offline';
import { checksum, deserializeSave, serializeSave } from '../src/core/save';
import { noteManualSummit } from '../src/core/seals';
import { stepSites } from '../src/core/sim';
import type { GameEvent, GameState } from '../src/core/state';
import { ctx, expectClose, give, knowsAutomation, makeState } from './helpers';

function automated(): GameState {
  const s = knowsAutomation(makeState());
  give(s, 80);
  buyFlywheel(s, 'first_hill', []);
  s.empire.foremanOwned = true;
  s.empire.sites[0].productionLevel = 30;
  s.empire.sites[0].strengthLevel = 4;
  s.random.eligibleSiteId = null;
  s.random.relicCountdown = null;
  return s;
}

/** Break the seal on whichever dealt slot holds `id` (levels and money supplied). */
function own(s: GameState, id: string): void {
  const site = s.empire.sites[0];
  const index = site.hand.indexOf(id);
  if (index < 0) {
    site.hand[0] = id;
    return own(s, id);
  }
  site.productionLevel = Math.max(site.productionLevel, tabletLevel(index));
  site.purse = site.purse.add(tabletCost(site, index));
  expect(breakSeal(s, 'first_hill', index, []).ok).toBe(true);
}

describe('the deal', () => {
  it('is seeded, sized, and drawn from the hill pool', () => {
    const a = newGame(0, { coin: 1, relic: 2, deal: 99 });
    const b = newGame(0, { coin: 1, relic: 2, deal: 99 });
    const c = newGame(0, { coin: 1, relic: 2, deal: 7 });
    const hand = a.empire.sites[0].hand;
    expect(hand).toHaveLength(catalog.devices.dealt);
    expect(new Set(hand).size).toBe(hand.length);
    expect(b.empire.sites[0].hand).toEqual(hand);
    const pool = tabletPool('first_hill').map((d) => d.id);
    for (const id of hand) expect(pool).toContain(id);
    // Different seeds deal differently (these two are known to).
    expect(c.empire.sites[0].hand).not.toEqual(hand);
  });

  it('survives a reload unchanged, and a v3 save is dealt on load', () => {
    const s = makeState();
    const r = deserializeSave(serializeSave(s));
    expect(r.ok && r.state.empire.sites[0].hand).toEqual(s.empire.sites[0].hand);

    const env = JSON.parse(serializeSave(s));
    env.data.schemaVersion = 3;
    delete env.data.pausedAtUtc;
    delete env.data.prestige.giftedInsight;
    delete env.data.discoveries.codexIds;
    delete env.data.discoveries.whisperIds;
    delete env.data.discoveries.rumourIds;
    delete env.data.counters.manualSummits;
    delete env.data.random.dealRngState;
    for (const site of env.data.empire.sites) {
      delete site.counterweight;
      delete site.hand;
      delete site.devices;
    }
    env.checksum = checksum(JSON.stringify(env.data));
    const m = deserializeSave(JSON.stringify(env));
    expect(m.ok).toBe(true);
    if (!m.ok) return;
    expect(m.migratedFrom).toBe(3);
    expect(m.state.empire.sites[0].hand).toHaveLength(catalog.devices.dealt);
    expect(m.state.empire.sites[0].counterweight).toBeNull();
    expect(m.state.prestige.giftedInsight).toBe(0);
  });
});

describe('sealed tablets', () => {
  it('surface at their crew level and cost this hill money', () => {
    const s = makeState();
    const site = s.empire.sites[0];
    site.productionLevel = tabletLevel(0) - 1;
    give(s, tabletCost(site, 0).toNumber());
    expect(breakSeal(s, 'first_hill', 0, []).ok).toBe(false);
    site.productionLevel = tabletLevel(0);
    const events: GameEvent[] = [];
    expect(breakSeal(s, 'first_hill', 0, events).ok).toBe(true);
    expect(site.purse.isZero()).toBe(true);
    expect(site.devices).toEqual([site.hand[0]]);
    expect(s.discoveries.codexIds).toContain(site.hand[0]);
    expect(events.some((e) => e.type === 'DeviceRevealed' && e.firstTime)).toBe(true);
    expect(breakSeal(s, 'first_hill', 0, []).ok).toBe(false);
  });

  it('prices rise steeply along the hand', () => {
    const site = makeState().empire.sites[0];
    for (let i = 1; i < catalog.devices.dealt; i++) expect(tabletCost(site, i).gt(tabletCost(site, i - 1))).toBe(true);
  });

  it('change the rules they name', () => {
    const s = automated();
    const site = s.empire.sites[0];
    const before = cycleSeconds(s, site, false);
    own(s, 'merope_olives');
    expect(before - cycleSeconds(s, site, false)).toBeCloseTo(catalog.cycle.returnSeconds, 9);

    const t = automated();
    const impact = bonusTable(t, 'first_hill');
    own(t, 'second_stone');
    expect(modifiers(t, 'first_hill').impact).toBe(2);
    expect(bonusTable(t, 'first_hill')).toEqual(impact);
  });
});

describe('every-Nth devices', () => {
  it('sum exactly over any window, and average over their period', () => {
    const s = automated();
    own(s, 'autolycus_brand');
    own(s, 'isthmian_games');
    const m = modifiers(s, 'first_hill');
    let brute = 0;
    for (let i = 3; i <= 612; i++) brute += nthMultiplier(m, i);
    expect(nthSum(m, 3, 612)).toBeCloseTo(brute, 9);
    // Over one period of 50: ten doubled climbs, one festival (whose index is also a fifth).
    let period = 0;
    for (let i = 0; i < 50; i++) period += nthMultiplier(m, i);
    expect(period).toBe(40 + 9 * 2 + 20);
    expect(nthAverage(m) * 50).toBeCloseTo(period, 9);
  });

  it('offline settlement matches the exact stepper', () => {
    const a = automated();
    const b = automated();
    for (const s of [a, b]) {
      own(s, 'autolycus_brand');
      own(s, 'isthmian_games');
      own(s, 'merope_olives');
      own(s, 'second_stone');
    }
    const secs = 4 * 3600;
    settleOffline(a, secs, []);
    const c = ctx({ offline: true });
    for (let t = 0; t < secs; t++) stepSites(b, 1, c);
    expect(a.counters.totalClimbs).toBe(b.counters.totalClimbs);
    expectClose(a.wallet.runGross, b.wallet.runGross, 1e-9);
  });
});

describe('the counterweight', () => {
  it('opens at crew 25 on the First Hill and trims freely', () => {
    const s = automated();
    const site = s.empire.sites[0];
    site.productionLevel = 24;
    give(s, 1e9);
    expect(installCounterweight(s, 'first_hill', []).ok).toBe(false);
    site.productionLevel = 25;
    expect(installCounterweight(s, 'first_hill', []).ok).toBe(true);
    expect(site.counterweight).toBe(0);
    expect(setTrim(s, 'first_hill', 3).ok).toBe(true);
    expect(setTrim(s, 'first_hill', 3).ok).toBe(false);
    expect(setTrim(s, 'first_hill', catalog.counterweight.maxTrim + 1).ok).toBe(false);
  });

  it('has a best trim that beats an empty basket, and shifts as the hill changes', () => {
    const s = automated();
    const site = s.empire.sites[0];
    site.counterweight = 0;
    const best = bestTrim(s, site);
    expect(best).toBeGreaterThan(0);
    expect(best).toBeLessThan(catalog.counterweight.maxTrim);
    const empty = steadyIncomePerSecond(s, site);
    site.counterweight = best;
    expect(steadyIncomePerSecond(s, site).gt(empty)).toBe(true);

    // A faster fall (Asopus's Spring) can afford a heavier brake.
    own(s, 'asopus_spring');
    expect(bestTrim(s, site)).toBeGreaterThanOrEqual(best);
    // Pushing by hand already speeds the climb: a lighter basket suits.
    expect(bestTrim(s, site, true)).toBeLessThanOrEqual(bestTrim(s, site));
  });
});

describe('visitors and bargains', () => {
  it('Hermes offers two, once per run, and the cart helps every hill', () => {
    const s = automated();
    const site = s.empire.sites[0];
    site.productionLevel = 10;
    expect(takeBargain(s, 'first_hill', 'fell_off_a_cart', []).ok).toBe(false);
    site.productionLevel = 25;
    expect(takeBargain(s, 'first_hill', 'fell_off_a_cart', []).ok).toBe(true);
    expect(takeBargain(s, 'first_hill', 'express_delivery', []).ok).toBe(false);
    expect(modifiers(s, 'first_hill').amphorae).toBe(2);
    expect(modifiers(s, 'tartarus_rim').amphorae).toBe(2);
    const amphora = (id: string) => bonusTable(s, id).find((t) => t.id === 'coin_amphora')!.probability;
    const base = catalog.bonusTargets.find((t) => t.id === 'coin_amphora')!.probability;
    expect(amphora('first_hill')).toBeCloseTo(base * 2, 12);
    const total = bonusTable(s, 'first_hill').reduce((a, t) => a + t.probability, 0);
    expect(total).toBeCloseTo(1, 12);
  });
});

describe('whispers', () => {
  it('a thousand summits by hand: a rumour halfway, then a permanent device and one Insight', () => {
    const s = makeState();
    const events: GameEvent[] = [];
    for (let i = 0; i < CALLUSES_SUMMITS / 2; i++) noteManualSummit(s, events);
    expect(events.filter((e) => e.type === 'Rumour')).toHaveLength(1);
    const insight = spendableInsight(s);
    for (let i = CALLUSES_SUMMITS / 2; i < CALLUSES_SUMMITS; i++) noteManualSummit(s, events);
    expect(s.discoveries.whisperIds).toContain('calluses_of_legend');
    expect(spendableInsight(s)).toBe(insight + 1);
    expect(modifiers(s, 'first_hill').ascent).toBeCloseTo(1.1, 12);
    // Begin Again keeps it, and doesn't pay the Insight twice.
    closeRun(s, []);
    expect(modifiers(s, 'first_hill').ascent).toBeCloseTo(1.1, 12);
    for (let i = 0; i < 10; i++) noteManualSummit(s, events);
    expect(s.prestige.giftedInsight).toBe(1);
  });

  it('a long enough pause is heard; a short one only rumoured', () => {
    const s = makeState();
    const events: GameEvent[] = [];
    setPausedAt(s, true, 0, events);
    setPausedAt(s, false, (TAKES_FIVE_SECONDS / 2) * 1000, events);
    expect(s.discoveries.rumourIds).toContain('takes_five');
    expect(s.discoveries.whisperIds).not.toContain('takes_five');
    setPausedAt(s, true, 1e6, events);
    setPausedAt(s, false, 1e6 + TAKES_FIVE_SECONDS * 1000, events);
    expect(s.discoveries.whisperIds).toContain('takes_five');
    expect(modifiers(s, 'first_hill').crew).toBeCloseTo(1.1, 12);
  });
});

describe('the Missing Funeral', () => {
  it('starts the next run First Hill crew at 25', () => {
    const s = automated();
    own(s, 'missing_funeral');
    closeRun(s, []);
    expect(s.empire.sites[0].productionLevel).toBe(25);
    expect(s.empire.sites[0].devices).toEqual([]);
    closeRun(s, []);
    expect(s.empire.sites[0].productionLevel).toBeLessThan(25);
  });
});
