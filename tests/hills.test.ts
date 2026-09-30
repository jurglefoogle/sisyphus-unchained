import { describe, expect, it } from 'vitest';
import { catalog } from '../src/content/catalog';
import { buyLevels, buyWork, closeRun, hireSteward, openSite, setStewardOrder } from '../src/core/commands';
import { bulkCost, stewardCost, stewardInsightCost, stewardOffered } from '../src/core/formulas';
import { Money } from '../src/core/money';
import { checksum, deserializeSave, serializeSave } from '../src/core/save';
import { grantIncome } from '../src/core/sim';
import type { GameState } from '../src/core/state';
import { runStewards, stewardReserve } from '../src/core/stewards';
import { give, knowsAutomation, makeState } from './helpers';

/** A run with the First Hill and the Tartarus Rim open, both purses empty. */
function twoHills(): GameState {
  const s = knowsAutomation(makeState());
  s.empire.sites[0].trial = 1e6; // decree trials: tests/trials.test.ts
  grantIncome(s, s.empire.sites[0], catalog.sites[1].defianceGate, []);
  s.empire.sites[0].purse = catalog.sites[1].unlockCost;
  expect(openSite(s, 'tartarus_rim', []).ok).toBe(true);
  return s;
}

/** The same save as schema v2 wrote it: one shared purse in the wallet. */
function asV2(s: GameState, obols: string): string {
  const env = JSON.parse(serializeSave(s));
  env.data.schemaVersion = 2;
  env.data.wallet.obols = obols;
  for (const site of env.data.empire.sites) {
    delete site.purse;
    delete site.gross;
    delete site.steward;
  }
  env.checksum = checksum(JSON.stringify(env.data));
  return JSON.stringify(env);
}

describe('each hill keeps its own money', () => {
  it('income lands in the earning hill, and Defiance counts it at its appraisal', () => {
    const s = twoHills();
    const [first, rim] = s.empire.sites;
    const before = s.wallet.runGross;
    first.purse = Money.ZERO;
    grantIncome(s, rim, Money.of(100), []);
    expect(rim.purse.eq(100)).toBe(true);
    expect(first.purse.isZero()).toBe(true);
    expect(s.wallet.runGross.sub(before).eq(100 * catalog.sites[1].appraisal)).toBe(true);
  });

  it('Obols cannot buy Cinder levels, nor Cinders buy Obol works', () => {
    const s = twoHills();
    give(s, '1e40');
    expect(buyLevels(s, 'tartarus_rim', 'production', 1, []).ok).toBe(false);
    give(s, bulkCost(s, s.empire.sites[1], 'production', 1)!.toString(), 'tartarus_rim');
    expect(buyLevels(s, 'tartarus_rim', 'production', 1, []).ok).toBe(true);
    expect(s.empire.sites[1].purse.isZero()).toBe(true);

    const hermes = catalog.works.find((w) => w.id === 'hermes')!;
    s.empire.sites[0].purse = Money.ZERO;
    s.empire.sites[0].productionLevel = hermes.requiredLevel;
    give(s, '1e40', 'tartarus_rim');
    expect(buyWork(s, 'hermes', []).ok).toBe(false);
    give(s, hermes.cost.toString());
    expect(buyWork(s, 'hermes', []).ok).toBe(true);
  });
});

describe('stewards', () => {
  it('are offered for local money only once the next hill is open', () => {
    const s = knowsAutomation(makeState());
    const first = s.empire.sites[0];
    give(s, '1e30');
    expect(stewardOffered(s, first)).toBe(false);
    expect(hireSteward(s, first.id, 'local', []).ok).toBe(false);

    const t = twoHills();
    const f = t.empire.sites[0];
    expect(stewardOffered(t, f)).toBe(true);
    expect(stewardOffered(t, t.empire.sites[1])).toBe(false);
    f.purse = stewardCost(s, f);
    expect(hireSteward(t, f.id, 'local', []).ok).toBe(true);
    expect(f.purse.isZero()).toBe(true);
    expect(f.steward).toEqual({ reinvest: true, paidWith: 'local' });
  });

  it('can be hired early with Insight, for this run only', () => {
    const s = knowsAutomation(makeState());
    const first = s.empire.sites[0];
    s.prestige.lifetimeInsightAwarded = 100;
    expect(hireSteward(s, first.id, 'insight', []).ok).toBe(true);
    expect(s.prestige.insightSpent).toBe(stewardInsightCost(first));
    closeRun(s, []);
    expect(s.empire.sites[0].steward).toBeNull();
  });

  it('reinvest the purse but keep back the next opening and the next work', () => {
    const s = twoHills();
    const rim = s.empire.sites[1];
    rim.steward = { reinvest: true, paidWith: 'insight' };
    // Offer the next hill: the rim is the frontier, so its opening is held back.
    rim.trial = 1e6; // decree trials: tests/trials.test.ts
    grantIncome(s, rim, catalog.sites[2].defianceGate, []);
    const reserve = stewardReserve(s, rim);
    expect(reserve.gte(catalog.sites[2].unlockCost)).toBe(true);
    const level = rim.productionLevel;
    rim.purse = reserve.add(bulkCost(s, rim, 'production', 1)!.mul(3));
    runStewards(s, []);
    expect(rim.productionLevel + rim.strengthLevel + rim.impactLevel).toBeGreaterThan(level);
    expect(rim.purse.gte(reserve)).toBe(true);
  });

  it('hold when told to, and never touch another hill', () => {
    const s = twoHills();
    const [first, rim] = s.empire.sites;
    first.steward = { reinvest: true, paidWith: 'local' };
    first.purse = Money.ZERO;
    give(s, '1e9', 'tartarus_rim');
    expect(setStewardOrder(s, first.id, false).ok).toBe(true);
    give(s, '1e9');
    const levels = first.productionLevel;
    expect(runStewards(s, []).size).toBe(0);
    expect(first.productionLevel).toBe(levels);
    expect(rim.purse.eq('1e9')).toBe(true);
    expect(setStewardOrder(s, first.id, true).ok).toBe(true);
    expect(runStewards(s, []).get(first.id)).toBeGreaterThan(0);
    expect(rim.purse.eq('1e9')).toBe(true);
  });
});

describe('schema 3 migration', () => {
  it('a First Hill-only run keeps its Obols', () => {
    const s = knowsAutomation(makeState());
    grantIncome(s, s.empire.sites[0], Money.of(5000), []);
    const r = deserializeSave(asV2(s, '1234'));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.migratedFrom).toBe(2);
    expect(r.renegotiated).toBeUndefined();
    expect(r.state.empire.sites[0].purse.eq(1234)).toBe(true);
    expect(r.state.empire.sites[0].gross.eq(r.state.wallet.runGross)).toBe(true);
  });

  it('a run across several hills is closed with its Insight paid in full', () => {
    const s = twoHills();
    grantIncome(s, s.empire.sites[0], Money.of('1e8'), []);
    const insightBefore = s.prestige.lifetimeInsightAwarded;
    const r = deserializeSave(asV2(s, '5000'));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.renegotiated).toBeGreaterThan(0);
    expect(r.state.prestige.lifetimeInsightAwarded).toBe(insightBefore + r.renegotiated!);
    expect(r.state.empire.sites).toHaveLength(1);
    expect(r.state.wallet.runGross.isZero()).toBe(true);
  });
});
