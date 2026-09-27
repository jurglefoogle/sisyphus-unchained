import { describe, expect, it } from 'vitest';
import {
  buyFlywheel,
  buyInsightUpgrade,
  buyLevels,
  confirmPrestige,
  hireForeman,
  openSite,
  previewPrestige,
} from '../src/core/commands';
import { insightFactor } from '../src/core/formulas';
import { Money } from '../src/core/money';
import { checkDecrees, grantIncome, stepSites } from '../src/core/sim';
import type { GameEvent } from '../src/core/state';
import { ctx, expectClose, give, knowsAutomation, makeState, runFrames } from './helpers';

const count = (events: GameEvent[], type: GameEvent['type']) => events.filter((e) => e.type === type).length;

describe('manual cycle', () => {
  it('does not move without effort before the foreman', () => {
    const s = makeState();
    runFrames(s, 60, 30, false);
    expect(s.empire.sites[0].phaseProgress).toBe(0);
    expect(s.wallet.obols.isZero()).toBe(true);
  });

  it('pauses without rollback and grants summit and impact once', () => {
    const s = makeState();
    runFrames(s, 6, 60, true); // halfway up a 12 s ascent
    expectClose(s.empire.sites[0].phaseProgress, 0.5, 1e-6);
    runFrames(s, 10, 60, false); // released: no rollback
    expectClose(s.empire.sites[0].phaseProgress, 0.5, 1e-6);
    const events = runFrames(s, 6.001, 60, true);
    expect(count(events, 'SummitReached')).toBe(1);
    expectClose(s.wallet.obols, 7);
    // The descent and return finish without holding push.
    const after = runFrames(s, 5, 60, false);
    expect(count(after, 'ImpactResolved')).toBe(1);
    expect(s.empire.sites[0].phase).toBe('ascending');
    expect(s.wallet.obols.gte(10)).toBe(true);
  });

  it('is economically identical at 15, 30, 60 and 144 fps', () => {
    const results = [15, 30, 60, 144].map((fps) => {
      const s = makeState();
      runFrames(s, 200, fps, true);
      return { obols: s.wallet.obols.toNumber(), climbs: s.counters.totalClimbs };
    });
    for (const r of results) {
      expect(r.climbs).toBe(results[0].climbs);
      expectClose(r.obols, results[0].obols);
    }
  });

  it('splitting an interval does not change guaranteed rewards', () => {
    const a = makeState();
    const b = makeState();
    a.empire.foremanOwned = b.empire.foremanOwned = true;
    stepSites(a, 1000, ctx());
    for (let i = 0; i < 1000; i++) stepSites(b, 1, ctx());
    expect(a.counters.totalClimbs).toBe(b.counters.totalClimbs);
    expectClose(a.wallet.obols, b.wallet.obols);
  });
});

describe('flywheel and foreman', () => {
  it('assists only after the descent following purchase', () => {
    const s = knowsAutomation(makeState());
    give(s, 80);
    runFrames(s, 3, 60, true); // mid-ascent
    expect(buyFlywheel(s, 'first_hill', []).ok).toBe(true);
    const site = s.empire.sites[0];
    expect(site.wheelCharged).toBe(false);
    runFrames(s, 9.001, 60, true); // reach summit at the uncharged rate
    expect(site.phase).toBe('descending');
    expect(site.wheelCharged).toBe(false);
    const events = runFrames(s, 4.001, 60, false);
    expect(count(events, 'FlywheelCharged')).toBe(1);
    expect(site.wheelCharged).toBe(true);
  });

  it('foreman requires a flywheel and then automates every site, now and later', () => {
    const s = knowsAutomation(makeState());
    give(s, 10_000);
    expect(hireForeman(s, []).ok).toBe(false);
    buyFlywheel(s, 'first_hill', []);
    expect(hireForeman(s, []).ok).toBe(true);
    runFrames(s, 30, 30, false);
    expect(s.counters.totalClimbs).toBeGreaterThan(0);

    // Open the second site: it runs immediately with no second bill.
    grantIncome(s, Money.of('60000'), []);
    give(s, 45_000);
    expect(openSite(s, 'tartarus_rim', []).ok).toBe(true);
    const climbsBefore = s.counters.totalClimbs;
    s.empire.selectedSiteId = 'first_hill';
    runFrames(s, 40, 30, false);
    const rim = s.empire.sites.find((x) => x.id === 'tartarus_rim')!;
    expect(rim.cycleIndex).toBeGreaterThan(0);
    expect(s.counters.totalClimbs).toBeGreaterThan(climbsBefore);
  });

  it('manual help speeds the selected automated site by 50%', () => {
    const s = makeState();
    s.empire.foremanOwned = true;
    const t0 = makeState();
    t0.empire.foremanOwned = true;
    runFrames(s, 6, 60, true);
    runFrames(t0, 6, 60, false);
    expectClose(s.empire.sites[0].phaseProgress, 0.75, 1e-6);
    expectClose(t0.empire.sites[0].phaseProgress, 0.5, 1e-6);
  });
});

describe('purchases', () => {
  it('preserves the current payout snapshot when buying mid-cycle', () => {
    const s = makeState();
    runFrames(s, 12.001, 60, true); // summit (7) reached, now descending
    give(s, 1000);
    const snapImpact = s.empire.sites[0].snapshot.impact;
    expect(buyLevels(s, 'first_hill', 'production', 5, []).ok).toBe(true);
    expect(s.empire.sites[0].snapshot.impact.eq(snapImpact)).toBe(true);
    const events = runFrames(s, 5.001, 60, false);
    const impact = events.find((e) => e.type === 'ImpactResolved');
    expect(impact?.type).toBe('ImpactResolved');
    if (impact?.type === 'ImpactResolved') expectClose(impact.amount, 3);
    // The next cycle uses level 6.
    expectClose(s.empire.sites[0].snapshot.summit, 42);
  });

  it('never lets two purchases overdraw the wallet', () => {
    const s = makeState();
    give(s, 8);
    expect(buyLevels(s, 'first_hill', 'production', 1, []).ok).toBe(true);
    expect(buyLevels(s, 'first_hill', 'production', 1, []).ok).toBe(false);
    expect(s.wallet.obols.isZero()).toBe(true);
  });

  it('Buy 10 equals ten individual purchases', () => {
    const a = makeState();
    const b = makeState();
    give(a, 10_000);
    give(b, 10_000);
    buyLevels(a, 'first_hill', 'production', 10, []);
    for (let i = 0; i < 10; i++) buyLevels(b, 'first_hill', 'production', 1, []);
    expect(a.empire.sites[0].productionLevel).toBe(b.empire.sites[0].productionLevel);
    expect(a.wallet.obols.eq(b.wallet.obols)).toBe(true);
  });

  it('spending never reduces Defiance', () => {
    const s = makeState();
    grantIncome(s, Money.of(500), []);
    buyLevels(s, 'first_hill', 'production', 5, []);
    expect(s.wallet.runGross.eq(500)).toBe(true);
  });
});

describe('decrees', () => {
  it('queues every crossed gate in chapter order without skipping ownership', () => {
    const s = makeState();
    const events: GameEvent[] = [];
    grantIncome(s, Money.of('3e7'), events);
    const offers = events.flatMap((e) => (e.type === 'DecreeAvailable' ? [e.siteId] : []));
    expect(offers).toEqual(['tartarus_rim', 'leaking_heights']);
    give(s, '1e9');
    expect(openSite(s, 'leaking_heights', []).ok).toBe(false);
    expect(openSite(s, 'tartarus_rim', []).ok).toBe(true);
    expect(openSite(s, 'leaking_heights', []).ok).toBe(true);
    checkDecrees(s, events);
  });

  it('opening the next chapter guarantees the previous relic', () => {
    const s = makeState();
    grantIncome(s, Money.of('60000'), []);
    give(s, 45_000);
    const events: GameEvent[] = [];
    openSite(s, 'tartarus_rim', events);
    expect(s.discoveries.relicIds).toContain('hermes_seal');
    expect(s.random.eligibleSiteId).toBe('tartarus_rim');
    expect(s.random.relicCountdown).toBeGreaterThan(0);
  });
});

describe('relics', () => {
  it('drops by the pity cap and never duplicates', () => {
    const s = makeState();
    s.empire.foremanOwned = true;
    expect(s.random.eligibleSiteId).toBe('first_hill');
    const events: GameEvent[] = [];
    const c = ctx({ events });
    for (let i = 0; i < 61 * 17; i++) stepSites(s, 1, c);
    expect(count(events, 'RelicGranted')).toBe(1);
    expect(s.discoveries.relicIds).toEqual(['hermes_seal']);
    expect(s.random.relicCountdown).toBeNull();
  });
});

describe('prestige', () => {
  it('awards only new records and resets precisely', () => {
    const s = makeState();
    s.empire.foremanOwned = true;
    grantIncome(s, Money.of('1e6'), []);
    s.discoveries.relicIds.push('hermes_seal');
    s.discoveries.seenStoryIds.push('first_summit');
    expect(previewPrestige(s).award).toBe(10);
    expect(confirmPrestige(s, []).ok).toBe(true);

    expect(s.prestige.lifetimeInsightAwarded).toBe(10);
    expect(s.wallet.obols.isZero()).toBe(true);
    expect(s.wallet.runGross.isZero()).toBe(true);
    expect(s.empire.sites.map((x) => x.id)).toEqual(['first_hill']);
    expect(s.empire.foremanOwned).toBe(false);
    expect(s.discoveries.relicIds).toEqual(['hermes_seal']);
    expect(s.discoveries.seenStoryIds).toContain('first_summit');

    // Same record again: nothing to claim.
    grantIncome(s, Money.of('1e6'), []);
    expect(previewPrestige(s).award).toBe(0);
    expect(confirmPrestige(s, []).ok).toBe(false);

    // A better record pays the difference.
    grantIncome(s, Money.of('9e6'), []);
    expect(previewPrestige(s).award).toBe(30);
  });

  it('spending Insight never lowers the permanent income factor', () => {
    const s = makeState();
    s.prestige.lifetimeInsightAwarded = 10;
    const before = insightFactor(s.prestige.lifetimeInsightAwarded);
    expect(buyInsightUpgrade(s, 'remembered_hand', []).ok).toBe(true);
    expect(s.empire.foremanOwned).toBe(true);
    expect(insightFactor(s.prestige.lifetimeInsightAwarded)).toBe(before);
    expect(buyInsightUpgrade(s, 'standing_orders', []).ok).toBe(false); // out of order
  });

  it('Known Machinery installs charged wheels immediately', () => {
    const s = makeState();
    s.prestige.lifetimeInsightAwarded = 5;
    buyInsightUpgrade(s, 'remembered_hand', []);
    buyInsightUpgrade(s, 'known_machinery', []);
    expect(s.empire.sites[0].wheelOwned && s.empire.sites[0].wheelCharged).toBe(true);
  });
});
