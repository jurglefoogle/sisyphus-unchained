import { describe, expect, it } from 'vitest';
import { catalog } from '../src/content/catalog';
import { ATLAS_COMPLAINT_TURNS, tabletPool } from '../src/content/devices';
import { mount, openSite, takeBargain, turnSky } from '../src/core/commands';
import { modifiers } from '../src/core/effects';
import { cycleSeconds, skyIncome, steadyIncomePerSecond } from '../src/core/formulas';
import { settleOffline } from '../src/core/offline';
import { checksum, deserializeSave, serializeSave } from '../src/core/save';
import { grantIncome, stepSites } from '../src/core/sim';
import { advanceSky, climbsPerHouse, isConstellation, newSky, overhead, turnCooldown } from '../src/core/sky';
import type { GameState, SiteState } from '../src/core/state';
import { ctx, expectClose, knowsAutomation, makeState } from './helpers';

/** A run with the Skyward Escarpment open and crewed, the foreman hired. */
function ridge(): GameState {
  const s = knowsAutomation(makeState());
  for (const i of [1, 2, 3, 4]) {
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

const skyOf = (s: GameState): SiteState => s.empire.sites.find((x) => x.sky)!;

/** Reveal constellations on the ridge (as if their seals were broken). */
function reveal(s: GameState, ...ids: string[]): SiteState {
  const site = skyOf(s);
  site.devices.push(...ids);
  return site;
}

describe('the Orrery', () => {
  it('hangs over the Skyward Escarpment, twelve dark houses to start', () => {
    const s = ridge();
    const site = skyOf(s);
    expect(site.id).toBe('skyward_escarpment');
    expect(site.sky).toEqual(newSky());
    expect(tabletPool(site.id).every((d) => isConstellation(d.id))).toBe(true);
  });

  it('a constellation works only while its house is overhead', () => {
    const s = ridge();
    const site = reveal(s, 'orion');
    expect(modifiers(s, site.id).ascent).toBe(1); // revealed but not mounted
    expect(mount(s, site.id, 'orion', 1).ok).toBe(true);
    expect(modifiers(s, site.id).ascent).toBe(1); // house 1 is not overhead yet
    const m = modifiers(s, site.id);
    for (let i = 0; i < climbsPerHouse(m); i++) advanceSky(m, site.sky!, false, false, false);
    expect(site.sky!.position).toBe(1);
    expect(overhead(site.sky!)).toBe('orion');
    expect(modifiers(s, site.id).ascent).toBe(2);
  });

  it('mounting swaps, and only revealed constellations can hang', () => {
    const s = ridge();
    const site = reveal(s, 'orion', 'lyra');
    expect(mount(s, site.id, 'draco', 0).ok).toBe(false);
    mount(s, site.id, 'orion', 0);
    mount(s, site.id, 'lyra', 5);
    expect(mount(s, site.id, 'lyra', 0).ok).toBe(true);
    expect(site.sky!.houses[0]).toBe('lyra');
    expect(site.sky!.houses[5]).toBe('orion');
    expect(mount(s, site.id, 'orion', null).ok).toBe(true);
    expect(site.sky!.houses.filter(Boolean)).toEqual(['lyra']);
  });

  it('Atlas turns to the next mounted house, then rests', () => {
    const s = ridge();
    const site = reveal(s, 'ursa_major');
    expect(turnSky(s, site.id, []).ok).toBe(false); // nothing mounted
    mount(s, site.id, 'ursa_major', 7);
    expect(turnSky(s, site.id, []).ok).toBe(true);
    expect(site.sky!.position).toBe(7);
    expect(site.sky!.cooldown).toBe(turnCooldown(modifiers(s, site.id)));
    expect(s.counters.atlasTurns).toBe(1);
    expect(turnSky(s, site.id, []).ok).toBe(false); // resting (and nowhere else to go)
  });

  it('on duty, Atlas turns past dark houses, and that pays', () => {
    const s = ridge();
    const site = reveal(s, 'pleiades', 'argo');
    mount(s, site.id, 'pleiades', 0);
    mount(s, site.id, 'argo', 1);
    const alone = skyIncome(s, site, false);
    const duty = skyIncome(s, site, true);
    expect(duty.gt(alone)).toBe(true);
    const bare = ridge();
    expect(alone.gt(steadyIncomePerSecond(bare, skyOf(bare)))).toBe(true);
    // The steward's sky lingers only in mounted houses once it settles.
    site.steward = { reinvest: false, paidWith: 'local' };
    const m = modifiers(s, site.id);
    let dark = 0;
    for (let i = 0; i < 400; i++) {
      advanceSky(m, site.sky!, false, false, true);
      if (i > 100 && overhead(site.sky!) === null) dark++;
    }
    expect(dark).toBeLessThan(300 * 0.8);
  });

  it('settles offline exactly as the live stepper', () => {
    const make = () => {
      const s = ridge();
      const site = reveal(s, 'orion', 'lyra', 'pegasus', 'draco');
      mount(s, site.id, 'orion', 0);
      mount(s, site.id, 'lyra', 3);
      mount(s, site.id, 'pegasus', 4);
      mount(s, site.id, 'draco', 9);
      site.steward = { reinvest: false, paidWith: 'local' };
      return s;
    };
    const a = make();
    const b = make();
    const secs = 3 * 3600;
    settleOffline(a, secs, []);
    const c = ctx({ offline: true });
    for (let t = 0; t < secs; t++) stepSites(b, 1, c);
    expect(skyOf(a).sky).toEqual(skyOf(b).sky);
    expect(a.counters.totalClimbs).toBe(b.counters.totalClimbs);
    expectClose(skyOf(a).gross, skyOf(b).gross, 1e-9);
  });
});

describe("Helios's bargains and the sky whispers", () => {
  it('Phaethon doubles the speed of the sky; Selene holds a mounted house while away', () => {
    const s = ridge();
    const site = skyOf(s);
    const m0 = modifiers(s, site.id);
    site.productionLevel = 25;
    expect(takeBargain(s, site.id, 'phaethon_drives', []).ok).toBe(true);
    expect(climbsPerHouse(modifiers(s, site.id))).toBe(Math.round(climbsPerHouse(m0) / 2));

    const t = ridge();
    const ts = reveal(t, 'orion');
    ts.devices.push('selene_night_rate');
    mount(t, ts.id, 'orion', 0);
    const m = modifiers(t, ts.id);
    for (let i = 0; i < 50; i++) advanceSky(m, ts.sky!, false, true, false);
    expect(ts.sky!.position).toBe(0);
    advanceSky(m, ts.sky!, false, false, false);
    for (let i = 0; i < climbsPerHouse(m); i++) advanceSky(m, ts.sky!, false, false, false);
    expect(ts.sky!.position).toBe(1);
  });

  it('Wished on a Star: pushing as three mounted houses rise', () => {
    const s = ridge();
    const site = reveal(s, 'orion', 'lyra', 'argo');
    mount(s, site.id, 'orion', 1);
    mount(s, site.id, 'lyra', 2);
    mount(s, site.id, 'argo', 3);
    s.empire.selectedSiteId = site.id;
    const c = ctx({ manualHeld: true });
    for (let t = 0; t < 4 * 3600 && !s.discoveries.whisperIds.includes('wished_on_a_star'); t++) stepSites(s, 1, c);
    expect(s.discoveries.whisperIds).toContain('wished_on_a_star');
  });

  it('Atlas Files a Complaint after a hundred turns, and rests half as long', () => {
    const s = ridge();
    const site = reveal(s, 'orion', 'lyra');
    mount(s, site.id, 'orion', 0);
    mount(s, site.id, 'lyra', 6);
    const before = turnCooldown(modifiers(s, site.id));
    for (let i = 0; i < ATLAS_COMPLAINT_TURNS; i++) {
      site.sky!.cooldown = 0;
      expect(turnSky(s, site.id, []).ok).toBe(true);
    }
    expect(s.discoveries.whisperIds).toContain('atlas_complaint');
    expect(turnCooldown(modifiers(s, site.id))).toBe(Math.round(before / 2));
  });

  it('round-trip the sky, and a v7 save gets a dark one', () => {
    const s = ridge();
    const site = reveal(s, 'orion', 'lyra');
    mount(s, site.id, 'orion', 2);
    mount(s, site.id, 'lyra', 11);
    Object.assign(site.sky!, { position: 5, climbs: 2, cooldown: 7, streak: 1 });
    s.counters.atlasTurns = 12;
    const r = deserializeSave(serializeSave(s));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(skyOf(r.state).sky).toEqual(site.sky);
    expect(r.state.counters.atlasTurns).toBe(12);
    expect(cycleSeconds(r.state, skyOf(r.state), false)).toBe(cycleSeconds(s, site, false));

    const env = JSON.parse(serializeSave(s));
    env.data.schemaVersion = 7;
    for (const x of env.data.empire.sites) delete x.sky;
    delete env.data.counters.atlasTurns;
    env.checksum = checksum(JSON.stringify(env.data));
    const old = deserializeSave(JSON.stringify(env));
    expect(old.ok).toBe(true);
    if (!old.ok) return;
    expect(skyOf(old.state).sky).toEqual(newSky());
    expect(old.state.counters.atlasTurns).toBe(0);
  });
});
