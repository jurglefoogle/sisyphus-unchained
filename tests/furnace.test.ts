import { describe, expect, it } from 'vitest';
import { catalog } from '../src/content/catalog';
import { BY_THE_BOOK_ERUPTIONS, OUT_OF_SIGHT_SECONDS } from '../src/content/devices';
import { buyFlywheel, openSite, setVentAt, takeBargain, vent } from '../src/core/commands';
import { modifiers } from '../src/core/effects';
import { afterImpact, eruptionClimbs, eruptionPower, newFurnace, steadyPattern } from '../src/core/furnace';
import { bestVent, bulkCost, flywheelOffered, furnaceIncome, trackOpen } from '../src/core/formulas';
import { settleOffline } from '../src/core/offline';
import { recapMachineLines } from '../src/app/view';
import { checksum, deserializeSave, serializeSave } from '../src/core/save';
import { grantIncome, stepSites } from '../src/core/sim';
import type { GameEvent, GameState, SiteState } from '../src/core/state';
import { ctx, expectClose, knowsAutomation, makeState } from './helpers';

/** A run with the Tartarus Rim open and crewed, the foreman hired. */
function rim(): GameState {
  const s = knowsAutomation(makeState());
  s.empire.sites[0].trial = 1e6; // decree trials: tests/trials.test.ts
  grantIncome(s, s.empire.sites[0], catalog.sites[1].defianceGate, []);
  s.empire.sites[0].purse = catalog.sites[1].unlockCost;
  expect(openSite(s, 'tartarus_rim', []).ok).toBe(true);
  s.empire.foremanOwned = true;
  for (const site of s.empire.sites) {
    site.productionLevel = 30;
    site.strengthLevel = 4;
  }
  s.random.eligibleSiteId = null;
  s.random.relicCountdown = null;
  return s;
}

const wheelOf = (s: GameState): SiteState => s.empire.sites.find((x) => x.furnace)!;

function withDevices(s: GameState, ...ids: string[]): GameState {
  wheelOf(s).devices.push(...ids);
  return s;
}

describe("Ixion's Wheel", () => {
  it('lives only on the Tartarus Rim, which has no flywheel or impact track', () => {
    const s = rim();
    const [first, tart] = s.empire.sites;
    expect(first.furnace).toBeNull();
    expect(tart.furnace).toEqual(newFurnace());
    expect(flywheelOffered(s, tart)).toBe(false);
    expect(buyFlywheel(s, tart.id, []).ok).toBe(false);
    expect(trackOpen(tart, 'impact')).toBe(false);
    expect(bulkCost(s, tart, 'impact', 1)).toBeNull();
    expect(trackOpen(first, 'impact')).toBe(true);
  });

  it('heats with each impact, more slowly when hot, and erupts at full heat', () => {
    const m = modifiers(rim(), 'tartarus_rim');
    const f = newFurnace();
    const steps: number[] = [];
    let out = 'none';
    for (let i = 0; i < 200 && out === 'none'; i++) {
      const before = f.heat;
      out = afterImpact(m, f, false, false);
      if (out === 'none') steps.push(f.heat - before);
    }
    expect(out).toBe('erupted-full');
    for (let i = 1; i < steps.length; i++) expect(steps[i]).toBeLessThan(steps[i - 1]);
    expect(f.erupting).toBe(eruptionClimbs(m));
    expect(f.power).toBeCloseTo(eruptionPower(m, 1), 12);
    // The eruption drains one climb at a time, then the wheel is cold again.
    for (let i = 1; i < eruptionClimbs(m); i++) expect(afterImpact(m, f, false, false)).toBe('none');
    expect(afterImpact(m, f, false, false)).toBe('ended');
    expect(f).toMatchObject({ heat: 0, erupting: 0, power: 1, eruptions: 1 });
  });

  it('erupts strongest at the peak heat; a wheel left to blow at full heat pays less, but still pays', () => {
    const m = modifiers(rim(), 'tartarus_rim');
    const peak = catalog.furnace.peakHeat;
    const atPeak = eruptionPower(m, peak);
    for (let h = 0.2; h < peak - 1e-9; h += 0.05) expect(eruptionPower(m, h)).toBeLessThan(atPeak);
    for (let h = peak + 0.05; h <= 1 + 1e-9; h += 0.05) expect(eruptionPower(m, h)).toBeLessThan(eruptionPower(m, h - 0.05));
    expect(eruptionPower(m, 1)).toBeGreaterThan(1);
    expect(eruptionPower(m, 1) - 1).toBeCloseTo((atPeak - 1) * catalog.furnace.overheatShare, 12);
  });

  it('pays best when vented short of full, so waiting is never the only answer', () => {
    const s = rim();
    const site = wheelOf(s);
    const best = bestVent(s, site);
    expect(best).toBeGreaterThan(catalog.furnace.minVent);
    expect(best).toBeLessThanOrEqual(catalog.furnace.peakHeat);
    const atBest = furnaceIncome(s, site, true, best);
    const atFull = furnaceIncome(s, site, false, 1);
    expect(atBest.gt(atFull)).toBe(true);
    // The optimum is flat: a sensible guess is within a few percent.
    expect(furnaceIncome(s, site, true, catalog.furnace.defaultVentAt).div(atBest).toNumber()).toBeGreaterThan(0.97);
  });

  it('is vented by the steward at its dial, and the dial moves in fives', () => {
    const s = rim();
    const site = wheelOf(s);
    site.steward = { reinvest: false, paidWith: 'local' };
    expect(setVentAt(s, site.id, 0.52).ok).toBe(true);
    expect(site.furnace!.ventAt).toBe(0.5);
    expect(setVentAt(s, site.id, 0.5).ok).toBe(false);
    expect(setVentAt(s, site.id, 0.1).ok).toBe(false);
    const m = modifiers(s, site.id);
    const pattern = steadyPattern(m, site.furnace!, true);
    const peak = Math.max(...pattern.map((f) => (f.erupting > 0 ? f.heat : 0)));
    expect(peak).toBeGreaterThanOrEqual(0.5);
    expect(peak).toBeLessThan(0.5 + catalog.furnace.gain);
  });

  it('vents by hand, boosting the impact still to come this cycle', () => {
    const s = rim();
    const site = wheelOf(s);
    expect(vent(s, site.id, []).ok).toBe(false); // too cold
    site.furnace!.heat = 0.6;
    site.phase = 'ascending';
    site.snapshot.impactGranted = false;
    const before = site.snapshot.impact;
    const events: GameEvent[] = [];
    expect(vent(s, site.id, events).ok).toBe(true);
    const power = eruptionPower(modifiers(s, site.id), 0.6);
    expectClose(site.snapshot.impact, before.mul(power), 1e-12);
    expect(events.some((e) => e.type === 'Eruption')).toBe(true);
    expect(vent(s, site.id, []).ok).toBe(false); // already erupting
  });

  it('settles offline exactly as the live stepper, devices and all', () => {
    const make = () => {
      const s = withDevices(rim(), 'erinyes_whip', 'titans_shoe', 'asphodel_lagging', 'ixion_complaint', 'charons_fare');
      wheelOf(s).steward = { reinvest: false, paidWith: 'local' };
      return s;
    };
    const a = make();
    const b = make();
    const secs = 3 * 3600;
    settleOffline(a, secs, []);
    const c = ctx({ offline: true });
    for (let t = 0; t < secs; t++) stepSites(b, 1, c);
    expect(wheelOf(a).furnace).toEqual(wheelOf(b).furnace);
    expect(a.counters.totalClimbs).toBe(b.counters.totalClimbs);
    expectClose(wheelOf(a).gross, wheelOf(b).gross, 1e-9);
  });

  it('the return recap reports eruptions and the trial they advanced', () => {
    const s = rim();
    wheelOf(s).steward = { reinvest: false, paidWith: 'local' };
    const before = wheelOf(s).furnace!.eruptions;
    const r = settleOffline(s, 3 * 3600, []);
    const m = r.machines.find((x) => x.siteId === 'tartarus_rim')!;
    expect(m.eruptions).toBe(wheelOf(s).furnace!.eruptions - before);
    expect(m.eruptions).toBeGreaterThan(0);
    expect(m.trial?.after).toBeGreaterThan(m.trial!.before);
    expect(recapMachineLines([m])[0].text).toMatch(/eruptions/);
  });
});

describe('the rim devices', () => {
  it('reshape the wheel as their rules say', () => {
    const base = modifiers(rim(), 'tartarus_rim');
    const m = modifiers(
      withDevices(rim(), 'asphodel_lagging', 'kronos_timetable', 'hephaestus_tongs', 'ixion_complaint', 'winter_terms'),
      'tartarus_rim',
    );
    expect(eruptionClimbs(m)).toBe(Math.round(eruptionClimbs(base) * 1.5));
    expect(eruptionPower(m, 1) - 1).toBeCloseTo((eruptionPower(base, 1) - 1) * 1.25, 12);

    // Winter Terms floors the heat above the Lagging's third.
    const f = { ...newFurnace(), heat: 0.9, erupting: 1, power: 2 };
    expect(afterImpact(m, f, false, false)).toBe('ended');
    expect(f.heat).toBe(0.5);
    const g = { ...newFurnace(), heat: 0.9, erupting: 1, power: 2 };
    afterImpact(modifiers(withDevices(rim(), 'asphodel_lagging'), 'tartarus_rim'), g, false, false);
    expect(g.heat).toBeCloseTo(0.3, 12);

    // Ixion's Complaint: more eruptions, faster heating, capped at double.
    const cold = newFurnace();
    const late = { ...newFurnace(), eruptions: 1000 };
    afterImpact(m, cold, false, false);
    afterImpact(m, late, false, false);
    expect(late.heat).toBeCloseTo(cold.heat * catalog.furnace.maxGrowth, 12);
  });

  it('holds an eruption while Push is held, with the Bellows', () => {
    const m = modifiers(withDevices(rim(), 'hundred_handed_bellows'), 'tartarus_rim');
    const f = { ...newFurnace(), heat: 1, erupting: 2, power: 3 };
    expect(afterImpact(m, f, true, false)).toBe('none');
    expect(f.erupting).toBe(2);
    afterImpact(m, f, false, false);
    expect(f.erupting).toBe(1);
  });

  it("pays Charon's Fare on each eruption", () => {
    const plain = rim();
    const fare = withDevices(rim(), 'charons_fare');
    for (const s of [plain, fare]) {
      wheelOf(s).furnace!.heat = 0.5;
      vent(s, 'tartarus_rim', []);
    }
    expect(wheelOf(fare).gross.gt(wheelOf(plain).gross)).toBe(true);
  });

  it("Persephone's Six Seeds gives six crew levels on every hill", () => {
    const s = rim();
    const site = wheelOf(s);
    site.productionLevel = 25;
    site.hand = [...site.hand];
    const before = s.empire.sites.map((x) => x.productionLevel);
    const r = takeBargain(s, site.id, 'six_seeds', []);
    expect(r.ok).toBe(true);
    s.empire.sites.forEach((x, i) => expect(x.productionLevel).toBe(Math.min(catalog.levels.productionCap, before[i] + 6)));
  });
});

describe('the rim whispers', () => {
  it('By the Book is heard after enough full-heat eruptions', () => {
    const s = rim();
    const site = wheelOf(s);
    const c = ctx();
    for (let t = 0; t < 24 * 3600 && s.counters.fullEruptions < BY_THE_BOOK_ERUPTIONS; t++) stepSites(s, 1, c);
    expect(s.counters.fullEruptions).toBe(BY_THE_BOOK_ERUPTIONS);
    expect(s.discoveries.whisperIds).toContain('by_the_book');
    expect(modifiers(s, site.id).furnacePower).toBeCloseTo(1.1, 12);
  });

  it('Out of Sight is heard after an hour away, and then welcomes you back', () => {
    const s = rim();
    settleOffline(s, OUT_OF_SIGHT_SECONDS - 1, []);
    expect(s.discoveries.whisperIds).not.toContain('out_of_sight');
    expect(s.discoveries.rumourIds).toContain('out_of_sight');
    settleOffline(s, OUT_OF_SIGHT_SECONDS, []);
    expect(s.discoveries.whisperIds).toContain('out_of_sight');
    const f = wheelOf(s).furnace!;
    // Heard this time; the welcome itself is also paid now that it is known.
    expect(f.erupting).toBeGreaterThan(0);
    expect(f.power).toBeCloseTo(eruptionPower(modifiers(s, 'tartarus_rim'), 1, catalog.furnace.welcomePower), 12);
  });
});

describe('saves', () => {
  it('round-trip the wheel, and a v4 save gets one on load', () => {
    const s = rim();
    Object.assign(wheelOf(s).furnace!, { heat: 0.35, erupting: 2, power: 1.7, eruptions: 9, ventAt: 0.65 });
    s.counters.fullEruptions = 4;
    const r = deserializeSave(serializeSave(s));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(wheelOf(r.state).furnace).toEqual(wheelOf(s).furnace);
    expect(r.state.counters.fullEruptions).toBe(4);

    const env = JSON.parse(serializeSave(s));
    env.data.schemaVersion = 4;
    for (const site of env.data.empire.sites) delete site.furnace;
    delete env.data.counters.fullEruptions;
    env.checksum = checksum(JSON.stringify(env.data));
    const old = deserializeSave(JSON.stringify(env));
    expect(old.ok).toBe(true);
    if (!old.ok) return;
    expect(wheelOf(old.state).furnace).toEqual(newFurnace());
    expect(old.state.empire.sites[0].furnace).toBeNull();
    expect(old.state.counters.fullEruptions).toBe(0);
  });
});
