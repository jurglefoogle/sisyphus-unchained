import { describe, expect, it } from 'vitest';
import { catalog } from '../src/content/catalog';
import { deviceDef, tabletPool } from '../src/content/devices';
import { breakSeal, openSite, pourNext, setSplit, takeBargain } from '../src/core/commands';
import { modifiers } from '../src/core/effects';
import { blueprintSize, newFoundry } from '../src/core/foundry';
import { levelCost, tabletCost } from '../src/core/formulas';
import { Money } from '../src/core/money';
import { settleOffline } from '../src/core/offline';
import { checksum, deserializeSave, serializeSave } from '../src/core/save';
import { grantIncome, stepSites } from '../src/core/sim';
import type { GameEvent, GameState, SiteState } from '../src/core/state';
import { ctx, expectClose, knowsAutomation, makeState } from './helpers';

/** A run with the Bronze Pass open and crewed, the foreman hired. */
function pass(): GameState {
  const s = knowsAutomation(makeState());
  for (const i of [1, 2, 3]) {
    const prev = s.empire.sites[i - 1];
    prev.trial = 1e6; // decree trials: tests/trials.test.ts
    grantIncome(s, prev, catalog.sites[i].defianceGate, []);
    prev.purse = catalog.sites[i].unlockCost;
    expect(openSite(s, catalog.sites[i].id, []).ok).toBe(true);
  }
  s.empire.foremanOwned = true;
  for (const site of s.empire.sites) {
    site.productionLevel = 30;
    site.strengthLevel = 4;
  }
  s.random.eligibleSiteId = null;
  s.random.relicCountdown = null;
  return s;
}

const foundryOf = (s: GameState): SiteState => s.empire.sites.find((x) => x.foundry)!;

describe('the Foundry', () => {
  it('stands on the Bronze Pass with the dealt hand as its queue, and sells no tablets', () => {
    const s = pass();
    const site = foundryOf(s);
    expect(site.id).toBe('bronze_pass');
    expect(site.hand).toHaveLength(catalog.devices.dealt);
    for (const id of site.hand) expect(tabletPool('bronze_pass').map((d) => d.id)).toContain(id);
    expect(site.foundry).toEqual(newFoundry(site.hand));
    site.purse = tabletCost(s, site, 0);
    expect(breakSeal(s, site.id, 0, []).ok).toBe(false);
  });

  it('splits pay between the purse and the pour, counting all of it as earned', () => {
    const s = pass();
    const site = foundryOf(s);
    expect(setSplit(s, site.id, 0.44).ok).toBe(true);
    expect(site.foundry!.split).toBe(0.4);
    grantIncome(s, site, Money.of(100), []);
    expectClose(site.purse, 60);
    expectClose(site.foundry!.bronze, 40);
    expectClose(site.gross, 100);
  });

  it('casts the head of the queue, reveals it, and waits for the next pick', () => {
    const s = pass();
    const site = foundryOf(s);
    setSplit(s, site.id, 1);
    const head = site.foundry!.queue[0];
    const size = blueprintSize(s, site);
    expect(size.eq(tabletCost(s, site, 0))).toBe(true);
    const events: GameEvent[] = [];
    grantIncome(s, site, size.add(50), events);
    expect(site.devices).toContain(head);
    expect(events.some((e) => e.type === 'DeviceRevealed' && e.deviceId === head)).toBe(true);
    expect(site.foundry!.paused).toBe(true);
    expect(site.foundry!.finished).toBe(1);
    expectClose(site.purse, 50); // the rest had nowhere to go, so it was sold
    // While waiting, everything sells.
    grantIncome(s, site, Money.of(10), []);
    expectClose(site.purse, 60);
    // Pick the last blueprint in the queue: it moves to the head and the pour resumes.
    const last = site.foundry!.queue[site.foundry!.queue.length - 1];
    expect(pourNext(s, site.id, last).ok).toBe(true);
    expect(site.foundry!.queue[0]).toBe(last);
    expect(site.foundry!.paused).toBe(false);
    expect(blueprintSize(s, site).eq(tabletCost(s, site, 1))).toBe(true);
  });

  it('keeps pouring with Talos on duty', () => {
    const s = pass();
    const site = foundryOf(s);
    site.steward = { reinvest: false, paidWith: 'local' };
    setSplit(s, site.id, 1);
    grantIncome(s, site, tabletCost(s, site, 0).add(tabletCost(s, site, 1)), []);
    expect(site.foundry!.finished).toBe(2);
    expect(site.foundry!.paused).toBe(false);
    expect(site.purse.isZero()).toBe(true);
  });

  it('settles offline exactly as the live stepper', () => {
    const make = () => {
      const s = pass();
      const site = foundryOf(s);
      site.steward = { reinvest: false, paidWith: 'local' };
      site.foundry!.split = 0.5;
      // Small blueprints so several finish inside the window.
      site.devices.push('rush_job');
      return s;
    };
    const a = make();
    const b = make();
    const secs = 6 * 3600;
    settleOffline(a, secs, []);
    const c = ctx({ offline: true });
    for (let t = 0; t < secs; t++) stepSites(b, 1, c);
    const fa = foundryOf(a).foundry!;
    const fb = foundryOf(b).foundry!;
    expect(fa.finished).toBe(fb.finished);
    expect(fa.queue).toEqual(fb.queue);
    expectClose(fa.bronze, fb.bronze, 1e-9);
    expectClose(foundryOf(a).purse, foundryOf(b).purse, 1e-9);
    expect(foundryOf(a).devices).toEqual(foundryOf(b).devices);
  });
});

describe('the blueprints', () => {
  it('Warranty and Rush Job shrink blueprints; Masterwork and Watchdogs return more', () => {
    const s = pass();
    const site = foundryOf(s);
    const size = blueprintSize(s, site);
    site.devices.push('hephaestus_warranty');
    expectClose(blueprintSize(s, site), size.mul(2 / 3).ceil());
    site.devices.push('rush_job');
    expectClose(blueprintSize(s, site), size.mul(1 / 3).ceil(), 1e-6);

    const t = pass();
    const tsite = foundryOf(t);
    tsite.devices.push('masterwork', 'alcinous_watchdogs');
    tsite.steward = { reinvest: false, paidWith: 'local' };
    setSplit(t, tsite.id, 1);
    const need = blueprintSize(t, tsite);
    grantIncome(t, tsite, need.div(2), []); // twice the bronze: exactly one blueprint
    expect(tsite.foundry!.finished).toBe(1);
    expectClose(tsite.purse, need.div(2), 1e-9); // refunded in Ingots
  });

  it('the Golden Gallery casts crew from poured bronze', () => {
    const s = pass();
    const site = foundryOf(s);
    site.devices.push('golden_gallery');
    site.foundry!.queue = [];
    site.foundry!.split = 1;
    const price = levelCost(s, catalog.sites[3], 'production', 30).mul(2);
    // With nothing to cast the pour is idle, so the Gallery waits too.
    grantIncome(s, site, price, []);
    expect(site.productionLevel).toBe(30);
    site.foundry!.queue = ['talos_lap'];
    grantIncome(s, site, price, []);
    expect(site.productionLevel).toBe(31);
  });

  it("Hephaestus leaves one of two moulds", () => {
    const s = pass();
    const site = foundryOf(s);
    site.productionLevel = 25;
    expect(takeBargain(s, site.id, 'rush_job', []).ok).toBe(true);
    expect(modifiers(s, site.id).foundrySize).toBeCloseTo(0.5, 12);
    expect(deviceDef('masterwork').source).toBe('bargain');
  });
});

describe('the Foundry whispers and saves', () => {
  it('Perpetual Motion: three blueprints with nothing sold', () => {
    const s = pass();
    const site = foundryOf(s);
    site.steward = { reinvest: false, paidWith: 'local' };
    setSplit(s, site.id, 1);
    for (let i = 0; i < 3; i++) grantIncome(s, site, blueprintSize(s, site).sub(site.foundry!.bronze), []);
    expect(site.foundry!.finished).toBe(3);
    expect(s.discoveries.whisperIds).toContain('perpetual_motion');
  });

  it('Perpetual Motion is not heard if anything was sold in between', () => {
    const s = pass();
    const site = foundryOf(s);
    site.steward = { reinvest: false, paidWith: 'local' };
    setSplit(s, site.id, 0.9);
    for (let i = 0; i < 3; i++) grantIncome(s, site, blueprintSize(s, site).mul(2), []);
    expect(site.foundry!.finished).toBeGreaterThanOrEqual(3);
    expect(s.discoveries.whisperIds).not.toContain('perpetual_motion');
  });

  it('Fair and Balanced: a hundred climbs at exactly half', () => {
    const s = pass();
    const site = foundryOf(s);
    setSplit(s, site.id, 0.5);
    const c = ctx();
    for (let t = 0; t < 12 * 3600 && !s.discoveries.whisperIds.includes('fair_and_balanced'); t++) stepSites(s, 1, c);
    expect(s.discoveries.whisperIds).toContain('fair_and_balanced');
    expect(modifiers(s, site.id).foundryPour).toBeCloseTo(1.1, 12);
  });

  it('round-trip the Foundry, and a v6 save gets one from its sealed hand', () => {
    const s = pass();
    const site = foundryOf(s);
    Object.assign(site.foundry!, { split: 0.7, bronze: Money.of(123.5), finished: 2, paused: true, gallery: Money.of(9), pureStreak: 1, soldSince: true, balancedClimbs: 4 });
    site.foundry!.queue = site.hand.slice(2).reverse();
    site.devices.push(...site.hand.slice(0, 2));
    const r = deserializeSave(serializeSave(s));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const f = foundryOf(r.state).foundry!;
    expect({ ...f, bronze: f.bronze.toString(), gallery: f.gallery.toString() }).toEqual({
      ...site.foundry!,
      bronze: site.foundry!.bronze.toString(),
      gallery: site.foundry!.gallery.toString(),
    });

    const env = JSON.parse(serializeSave(s));
    env.data.schemaVersion = 6;
    for (const x of env.data.empire.sites) delete x.foundry;
    env.checksum = checksum(JSON.stringify(env.data));
    const old = deserializeSave(JSON.stringify(env));
    expect(old.ok).toBe(true);
    if (!old.ok) return;
    expect(foundryOf(old.state).foundry!.queue).toEqual(site.hand.slice(2));
    expect(old.state.empire.sites.filter((x) => x.foundry)).toHaveLength(1);
  });
});
