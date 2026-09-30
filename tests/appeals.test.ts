import { describe, expect, it } from 'vitest';
import { catalog } from '../src/content/catalog';
import { APPEALS, appealDef, DEVICES, tabletPool } from '../src/content/devices';
import { fileAppeal, installWork } from '../src/core/commands';
import { modifiers } from '../src/core/effects';
import { bulkCost, gateOf, stewardCost, tabletCost, unlockCostOf, workCostOf } from '../src/core/formulas';
import { checksum, deserializeSave, serializeSave } from '../src/core/save';
import { dealHand } from '../src/core/seals';
import { advanceSky, newSky, nextMounted } from '../src/core/sky';
import type { GameEvent, GameState } from '../src/core/state';
import { makeState } from './helpers';

const charter = catalog.works.find((w) => w.effect === 'incomeMultiplierAndEnding')!;

function signed(): GameState {
  const s = makeState();
  s.prestige.lifetimeInsightAwarded = 50;
  installWork(s, charter.id, false, []);
  return s;
}

describe('Appeals', () => {
  it('ten twists, each within the caption length', () => {
    expect(APPEALS.length).toBe(10);
    for (const a of APPEALS) expect(a.rule.length).toBeLessThanOrEqual(120);
    expect(appealDef(0)).toBeNull();
    expect(appealDef(11)).toBe(APPEALS[0]);
  });

  it('can be filed only once the Charter is signed, and begin a stiffer run', () => {
    const s = makeState();
    expect(fileAppeal(s, []).ok).toBe(false);
    const t = signed();
    const events: GameEvent[] = [];
    const runs = t.counters.totalRuns;
    expect(fileAppeal(t, events).ok).toBe(true);
    expect(t.appeal).toEqual({ number: 1, laurels: 0 });
    expect(t.counters.totalRuns).toBe(runs + 1);
    expect(t.empire.sites.length).toBe(1);
    expect(t.empire.purchasedWorkIds).toEqual([]);
    expect(events.some((e) => e.type === 'AppealFiled')).toBe(true);
    const g = catalog.appeals.gateGrowth;
    expect(gateOf(t, catalog.sites[1]).eq(catalog.sites[1].defianceGate.mul(g))).toBe(true);
    expect(unlockCostOf(t, catalog.sites[1]).eq(catalog.sites[1].unlockCost.mul(g))).toBe(true);
    expect(workCostOf(t, charter).eq(charter.cost.mul(catalog.appeals.workGrowth))).toBe(true);
  });

  it('raises every price paid in hill coin with the pay, so the hills do not cap out at once', () => {
    const before = makeState();
    const t = signed();
    fileAppeal(t, []);
    const p = catalog.appeals.payGrowth;
    const [a, b] = [before.empire.sites[0], t.empire.sites[0]];
    // Prices round up after scaling, so they agree to rounding.
    const near = (x: { toNumber(): number }, y: { toNumber(): number }) => expect(x.toNumber() / (y.toNumber() * p)).toBeCloseTo(1, 1);
    near(bulkCost(t, b, 'production', 10)!, bulkCost(before, a, 'production', 10)!);
    near(tabletCost(t, b, 0), tabletCost(before, a, 0));
    near(stewardCost(t, b), stewardCost(before, a));
    expect(modifiers(t, b.id).crew / modifiers(before, a.id).crew).toBeCloseTo(p, 6);
  });

  it('the twist rules every hill; signing the Charter again wins a laurel', () => {
    const t = signed();
    const plain = modifiers(t, 'first_hill');
    fileAppeal(t, []);
    const twisted = modifiers(t, 'first_hill');
    expect(twisted.ascent).toBeCloseTo(plain.ascent * 1.33, 12);
    const events: GameEvent[] = [];
    installWork(t, charter.id, false, events);
    expect(t.appeal.laurels).toBe(1);
    expect(events.some((e) => e.type === 'LaurelWon')).toBe(true);
    expect(modifiers(t, 'first_hill').crew).toBeCloseTo(twisted.crew * catalog.appeals.laurelMultiplier, 12);
    // The next Appeal follows the laurels.
    fileAppeal(t, []);
    expect(t.appeal.number).toBe(2);
    expect(modifiers(t, 'first_hill').noReturn).toBe(true);
  });

  it('each Appeal adds a tablet to every hill, toward twelve', () => {
    for (const def of catalog.sites) {
      expect(tabletPool(def.id, 0).length).toBe(8);
      expect(tabletPool(def.id, 4).length).toBe(12);
    }
    const s = makeState();
    const later = DEVICES.filter((d) => d.appeal).map((d) => d.id);
    for (let i = 0; i < 30; i++) expect(dealHand(s, 'first_hill').some((id) => later.includes(id))).toBe(false);
    s.appeal = { number: 4, laurels: 3 };
    let seen = false;
    for (let i = 0; i < 30 && !seen; i++) seen = dealHand(s, 'first_hill').some((id) => later.includes(id));
    expect(seen).toBe(true);
  });

  it('the sky turns backwards under its Appeal', () => {
    const s = makeState();
    s.appeal = { number: 3, laurels: 2 };
    const m = modifiers(s, 'first_hill');
    expect(m.skyBackwards).toBe(true);
    const sky = newSky();
    sky.houses[5] = 'orion';
    for (let i = 0; i < catalog.sky.climbsPerHouse; i++) advanceSky(m, sky, false, false, false);
    expect(sky.position).toBe(sky.houses.length - 1);
    expect(nextMounted(sky, -1)).toBe(5);
  });

  it('round-trips, and a v10 save starts on the original sentence', () => {
    const t = signed();
    fileAppeal(t, []);
    const r = deserializeSave(serializeSave(t));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.appeal).toEqual(t.appeal);
    expect(r.state.empire.sites[0].hand).toEqual(t.empire.sites[0].hand);

    const env = JSON.parse(serializeSave(makeState()));
    env.data.schemaVersion = 10;
    delete env.data.appeal;
    env.checksum = checksum(JSON.stringify(env.data));
    const old = deserializeSave(JSON.stringify(env));
    expect(old.ok).toBe(true);
    if (!old.ok) return;
    expect(old.state.appeal).toEqual({ number: 0, laurels: 0 });
  });
});
