import { describe, expect, it } from 'vitest';
import { catalog } from '../src/content/catalog';
import { ALMOST_FULL_CLIMBS } from '../src/content/devices';
import { drill, openSite, patch, setJarTarget, takeBargain } from '../src/core/commands';
import { modifiers } from '../src/core/effects';
import { bulkCost, drillCost, jarIncome, trackOpen } from '../src/core/formulas';
import { baseInflow, bestHoles, bestTarget, holesFor, leakShare, newJar, pour, steadyInflow } from '../src/core/jar';
import { settleOffline } from '../src/core/offline';
import { checksum, deserializeSave, serializeSave } from '../src/core/save';
import { grantIncome, stepSites } from '../src/core/sim';
import type { GameState, JarState, SiteState } from '../src/core/state';
import { ctx, expectClose, give, knowsAutomation, makeState } from './helpers';

/** A run with the Leaking Heights open and crewed, the foreman hired. */
function heights(): GameState {
  const s = knowsAutomation(makeState());
  for (const i of [1, 2]) {
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

const jarOf = (s: GameState): SiteState => s.empire.sites.find((x) => x.jar)!;

function withDevices(s: GameState, ...ids: string[]): GameState {
  jarOf(s).devices.push(...ids);
  return s;
}

/** Pour `n` times by hand (no steward), returning the last factor. */
function pourMany(s: GameState, j: JarState, n: number, level = 30, offline = false): number {
  const m = modifiers(s, 'leaking_heights');
  let f = 0;
  for (let i = 0; i < n; i++) f = pour(m, j, level, i, offline, false);
  return f;
}

describe("the Danaids' jar", () => {
  it('stands only on the Leaking Heights, which keeps its impact track', () => {
    const s = heights();
    expect(s.empire.sites.filter((x) => x.jar).map((x) => x.id)).toEqual(['leaking_heights']);
    expect(jarOf(s).jar).toEqual(newJar());
    expect(trackOpen(jarOf(s), 'impact')).toBe(true);
  });

  it('pays best just short of the brim: too few holes spill, too many lose pressure', () => {
    const s = heights();
    const m = modifiers(s, 'leaking_heights');
    const best = bestHoles(m, newJar(), 30);
    const at = (holes: number) => {
      const j = { ...newJar(), holes };
      return { f: pourMany(s, j, 400), j };
    };
    const good = at(best);
    const few = at(Math.max(1, best - 2));
    const many = at(best + 3);
    expect(good.f).toBeGreaterThan(few.f);
    expect(good.f).toBeGreaterThan(many.f);
    expect(few.j.spilled).toBeGreaterThan(0);
    expect(many.j.spilled).toBe(0);
    expect(many.j.peak).toBeLessThan(good.j.peak);
    // A well-kept jar pays close to the catalog's power; the starting holes pay far less.
    expect(good.f).toBeGreaterThan(0.8 * catalog.jar.power);
    expect(good.f).toBeLessThanOrEqual(catalog.jar.power + 1e-9);
    expect(at(catalog.jar.startHoles).f).toBeLessThan(0.75 * good.f);
  });

  it('needs more holes as the crew grows', () => {
    const m = modifiers(heights(), 'leaking_heights');
    expect(baseInflow(49)).toBeLessThan(baseInflow(50));
    expect(bestHoles(m, newJar(), 150)).toBeGreaterThan(bestHoles(m, newJar(), 30));
  });

  it('drills for money, patches for free, and will not patch the last hole', () => {
    const s = heights();
    const site = jarOf(s);
    expect(drill(s, site.id).ok).toBe(false); // empty purse
    const cost = drillCost(s, site);
    expect(cost.eq(bulkCost(s, site, 'production', 1)!.mul(catalog.jar.drillShare).ceil())).toBe(true);
    give(s, cost.toString(), site.id);
    expect(drill(s, site.id).ok).toBe(true);
    expect(site.jar!.holes).toBe(catalog.jar.startHoles + 1);
    expect(site.purse.isZero()).toBe(true);
    while (site.jar!.holes > 1) expect(patch(s, site.id, []).ok).toBe(true);
    expect(s.discoveries.rumourIds).toContain('shes_using_that_one');
    expect(patch(s, site.id, []).ok).toBe(false);
    expect(site.jar!.holes).toBe(1);
    expect(s.discoveries.whisperIds).toContain('shes_using_that_one');
    expect(drillCost(s, site).lt(cost)).toBe(true);
  });

  it('is held by Danaus at the level set, in fives', () => {
    const s = heights();
    const site = jarOf(s);
    site.steward = { reinvest: false, paidWith: 'local' };
    expect(setJarTarget(s, site.id, 0.83).ok).toBe(true);
    expect(site.jar!.target).toBe(0.85);
    expect(setJarTarget(s, site.id, 0.2).ok).toBe(false);
    const m = modifiers(s, site.id);
    const j = site.jar!;
    for (let i = 0; i < 400; i++) pour(m, j, 30, i, false, true);
    expect(j.holes).toBe(holesFor(steadyInflow(m, 30), 0.85));
    expect(j.peak).toBeLessThanOrEqual(0.85 + 1e-9);
    expect(j.spilled).toBe(0);
    // Holding the brim is best without a tide.
    expect(bestTarget(m, newJar(), 30)).toBe(1);
    expect(jarIncome(s, site, true, 1).gt(jarIncome(s, site, true, 0.6))).toBe(true);
  });

  it('settles offline exactly as the live stepper, devices and all', () => {
    const make = () => withDevices(heights(), 'tidewater_lease', 'lethe_irrigation', 'naiad_overflow_wheel', 'hypermnestra_bucket');
    const a = make();
    const b = make();
    const secs = 3 * 3600;
    settleOffline(a, secs, []);
    const c = ctx({ offline: true });
    for (let t = 0; t < secs; t++) stepSites(b, 1, c);
    expect(jarOf(a).jar).toEqual(jarOf(b).jar);
    expect(a.counters.totalClimbs).toBe(b.counters.totalClimbs);
    expectClose(jarOf(a).gross, jarOf(b).gross, 1e-9);
  });
});

describe('the jar devices', () => {
  it('each change the water as their rules say', () => {
    const s = heights();
    const f = (...ids: string[]) => {
      const t = withDevices(heights(), ...ids);
      return modifiers(t, 'leaking_heights');
    };
    // Starved of holes, spill decides everything.
    const spillJar = () => ({ ...newJar(), holes: 1 });
    const plain = pourMany(s, spillJar(), 200);
    const naiad = (() => {
      const j = spillJar();
      const m = f('naiad_overflow_wheel');
      let x = 0;
      for (let i = 0; i < 200; i++) x = pour(m, j, 30, i, false, false);
      return { x, spilled: j.spilled };
    })();
    expect(naiad.x - plain).toBeCloseTo((catalog.jar.power * 0.25 * naiad.spilled) / ((baseInflow(30) * (2 - baseInflow(30))) / 2), 9);

    // Hypermnestra only while away.
    const away = spillJar();
    const home = spillJar();
    const hm = f('hypermnestra_bucket');
    for (let i = 0; i < 200; i++) {
      pour(hm, away, 30, i, true, false);
      pour(hm, home, 30, i, false, false);
    }
    expect(home.factor).toBeCloseTo(plain, 12);
    expect(away.factor).toBeGreaterThan(home.factor);

    // Brigade and Styx pour more; Lethe returns spill; Glaze keeps pressure.
    expect(steadyInflow(f('full_bucket_brigade'), 30)).toBeCloseTo(baseInflow(30) * 1.5, 12);
    expect(steadyInflow(f('styx_water_rights'), 30)).toBeCloseTo(baseInflow(30) + 0.03, 12);
    const lethe = spillJar();
    for (let i = 0; i < 200; i++) pour(f('lethe_irrigation'), lethe, 30, i, false, false);
    expect(lethe.spilled).toBeGreaterThan(0);
    expect(lethe.level).toBeCloseTo(Math.min(1, (1 - leakShare(1)) + lethe.spilled * 0.5), 12);
    const over = { ...newJar(), holes: 40 };
    const glazed = { ...newJar(), holes: 40 };
    pourMany(s, over, 100);
    for (let i = 0; i < 100; i++) pour(f('glazed_interior'), glazed, 30, i, false, false);
    expect(glazed.factor).toBeGreaterThan(over.factor);

    // Drill More Holes: half price, two at a time.
    const t = withDevices(heights(), 'drill_more_holes');
    const site = jarOf(t);
    expect(drillCost(t, site).eq(drillCost(heights(), jarOf(heights())).mul(0.5).ceil())).toBe(true);
    give(t, drillCost(t, site).toString(), site.id);
    expect(drill(t, site.id).ok).toBe(true);
    expect(site.jar!.holes).toBe(catalog.jar.startHoles + 2);
  });

  it('the tide makes a lower hold worthwhile', () => {
    const m = modifiers(withDevices(heights(), 'tidewater_lease'), 'leaking_heights');
    expect(bestTarget(m, newJar(), 30)).toBeLessThan(1);
  });

  it("Poseidon's Earthshaker doubles the inflow", () => {
    const s = heights();
    const site = jarOf(s);
    site.productionLevel = 25;
    expect(takeBargain(s, site.id, 'earthshaker', []).ok).toBe(true);
    expect(steadyInflow(modifiers(s, site.id), 25)).toBeCloseTo(baseInflow(25) * 2, 12);
  });
});

describe('the jar whispers and saves', () => {
  it('Almost Full is heard after a hundred climbs at the brim', () => {
    const s = heights();
    const site = jarOf(s);
    site.steward = { reinvest: false, paidWith: 'local' };
    site.jar!.target = 1;
    const c = ctx();
    for (let t = 0; t < 12 * 3600 && !s.discoveries.whisperIds.includes('almost_full'); t++) stepSites(s, 1, c);
    expect(s.discoveries.whisperIds).toContain('almost_full');
    expect(site.jar!.streak).toBeGreaterThanOrEqual(ALMOST_FULL_CLIMBS);
    expect(modifiers(s, site.id).jarPower).toBeCloseTo(1.1, 12);
  });

  it('round-trip the jar, and a v5 save gets one on load', () => {
    const s = heights();
    Object.assign(jarOf(s).jar!, { level: 0.4, holes: 9, peak: 0.97, spilled: 0.01, factor: 1.6, target: 0.8, streak: 12 });
    const r = deserializeSave(serializeSave(s));
    expect(r.ok && jarOf(r.state).jar).toEqual(jarOf(s).jar);

    const env = JSON.parse(serializeSave(s));
    env.data.schemaVersion = 5;
    for (const site of env.data.empire.sites) delete site.jar;
    env.checksum = checksum(JSON.stringify(env.data));
    const old = deserializeSave(JSON.stringify(env));
    expect(old.ok).toBe(true);
    if (!old.ok) return;
    expect(jarOf(old.state).jar).toEqual(newJar());
    expect(old.state.empire.sites.filter((x) => x.jar)).toHaveLength(1);
  });
});
