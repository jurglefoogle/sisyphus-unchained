import { describe, expect, it } from 'vitest';
import { buyFlywheel, openSite } from '../src/core/commands';
import { Money } from '../src/core/money';
import { settleOffline } from '../src/core/offline';
import { checksum, deserializeSave, serializeSave } from '../src/core/save';
import { grantIncome, stepSites } from '../src/core/sim';
import type { GameState } from '../src/core/state';
import { ctx, expectClose, give, makeState } from './helpers';

function automated(): GameState {
  const s = makeState();
  give(s, 80);
  buyFlywheel(s, 'first_hill', []);
  s.empire.foremanOwned = true;
  s.empire.sites[0].productionLevel = 30;
  s.empire.sites[0].strengthLevel = 4;
  return s;
}

/** Reference: the exact stepper in offline (expected-bonus) mode, one second at a time. */
function reference(state: GameState, seconds: number): void {
  const c = ctx({ offline: true });
  for (let t = 0; t < seconds; t++) stepSites(state, 1, c);
}

describe('offline settlement', () => {
  it.each([30, 8 * 3600])('batched %is matches the exact stepper', (secs) => {
    const a = automated();
    const b = automated();
    // Drop the relic countdown so only the batching is compared here.
    a.random.eligibleSiteId = b.random.eligibleSiteId = null;
    a.random.relicCountdown = b.random.relicCountdown = null;
    settleOffline(a, secs, []);
    reference(b, secs);
    expect(a.counters.totalClimbs).toBe(b.counters.totalClimbs);
    expectClose(a.wallet.runGross, b.wallet.runGross, 1e-9);
    expect(a.empire.sites[0].phase).toBe(b.empire.sites[0].phase);
    expectClose(a.empire.sites[0].phaseProgress, b.empire.sites[0].phaseProgress, 1e-6);
  });

  it('caps absences at 24 hours', () => {
    const a = automated();
    const b = automated();
    const ra = settleOffline(a, 30 * 3600, []);
    const rb = settleOffline(b, 24 * 3600, []);
    expect(ra.countedSeconds).toBe(24 * 3600);
    expectClose(ra.earned, rb.earned);
  });

  it('gives nothing to unautomated sites and nothing while paused', () => {
    const s = makeState();
    s.empire.sites[0].phase = 'descending';
    expect(settleOffline(s, 3600, []).earned.isZero()).toBe(true);
    expect(s.empire.sites[0].phase).toBe('descending');

    const p = automated();
    p.paused = true;
    expect(settleOffline(p, 3600, []).earned.isZero()).toBe(true);
  });

  it('splits rates at a mid-absence relic', () => {
    const make = () => {
      const s = automated();
      grantIncome(s, Money.of('60000'), []);
      give(s, 45_000);
      openSite(s, 'tartarus_rim', []);
      s.random.relicCountdown = 20;
      return s;
    };
    const a = make();
    const b = make();
    const summary = settleOffline(a, 4 * 3600, []);
    reference(b, 4 * 3600);
    expect(summary.relicIds).toEqual(['daedalus_pin']);
    expect(b.discoveries.relicIds).toContain('daedalus_pin');
    expect(a.counters.totalClimbs).toBe(b.counters.totalClimbs);
    expectClose(a.wallet.runGross, b.wallet.runGross, 1e-9);
  });

  it('handles the first uncharged flywheel cycle', () => {
    const a = automated();
    const b = automated();
    for (const s of [a, b]) {
      s.empire.sites[0].wheelCharged = false;
      s.random.eligibleSiteId = null;
      s.random.relicCountdown = null;
    }
    settleOffline(a, 600, []);
    reference(b, 600);
    expect(a.empire.sites[0].wheelCharged).toBe(true);
    expect(a.counters.totalClimbs).toBe(b.counters.totalClimbs);
    expectClose(a.wallet.runGross, b.wallet.runGross, 1e-9);
  });
});

describe('saves', () => {
  it('round-trips state exactly', () => {
    const s = automated();
    stepSites(s, 123.4, ctx());
    s.wallet.obols = Money.of('1.2345e40');
    const text = serializeSave(s);
    const loaded = deserializeSave(text);
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    expect(serializeSave(loaded.state)).toBe(text);
    expect(loaded.state.wallet.obols.eq(s.wallet.obols)).toBe(true);
  });

  it('rejects truncated and tampered saves', () => {
    const text = serializeSave(automated());
    expect(deserializeSave(text.slice(0, text.length - 20)).ok).toBe(false);
    const tampered = text.replace('"productionLevel":30', '"productionLevel":31');
    const r = deserializeSave(tampered);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/checksum/i);
  });

  it('refuses a newer schema with a clear message', () => {
    const env = JSON.parse(serializeSave(makeState()));
    env.data.schemaVersion = 99;
    env.checksum = checksum(JSON.stringify(env.data));
    const r = deserializeSave(JSON.stringify(env));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/newer format/);
  });
});
