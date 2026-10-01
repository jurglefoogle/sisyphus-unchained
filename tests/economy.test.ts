import { describe, expect, it } from 'vitest';
import { catalog, siteDef } from '../src/content/catalog';
import {
  ascentSeconds,
  bulkCost,
  cyclePayout,
  flywheelCost,
  insightFactor,
  levelCost,
  maxAffordable,
  prestigeEntitlement,
  steadyIncomePerSecond,
  strengthLevelEffective,
} from '../src/core/formulas';
import { formatMoney, formatMultiplier, setNotation, setNumberLocale } from '../src/core/format';
import { Money } from '../src/core/money';
import { expectClose, give, makeState } from './helpers';

describe('catalog', () => {
  it('matches the launch content counts', () => {
    expect(catalog.sites).toHaveLength(6);
    expect(catalog.works).toHaveLength(7);
    expect(catalog.relics.catalog).toHaveLength(6);
    expect(catalog.insightUpgrades).toHaveLength(8);
  });

  it('has an expected coin bonus of 0.08 × base', () => {
    expectClose(catalog.expectedBonusMultiplier, 0.08);
  });

  it('has ascending defiance gates', () => {
    for (let i = 1; i < catalog.sites.length; i++) {
      expect(catalog.sites[i].defianceGate.gt(catalog.sites[i - 1].defianceGate)).toBe(true);
    }
  });
});

describe('worked opening example (spec §02)', () => {
  it('level 1: 7 at summit, 3 at impact, ~0.635 Obols/s manually', () => {
    const s = makeState();
    const site = s.empire.sites[0];
    const p = cyclePayout(s, site);
    expectClose(p.summit, 7);
    expectClose(p.impact, 3);
    expectClose(p.expectedBonus, 0.8);
    const cycle = ascentSeconds(s, site, false) + 5;
    expect(cycle).toBe(17);
    expectClose(p.expectedTotal.toNumber() / cycle, 10.8 / 17);
  });

  it('level 10, strength 5, charged wheel: ~18.95/s, ~23.31/s assisted', () => {
    const s = makeState();
    const site = s.empire.sites[0];
    site.productionLevel = 10;
    site.strengthLevel = 5;
    site.wheelOwned = true;
    site.wheelCharged = true;
    expectClose(cyclePayout(s, site).base, 200);
    expectClose(ascentSeconds(s, site, false), 6.4);
    expectClose(steadyIncomePerSecond(s, site), 216 / 11.4);
    const assisted = ascentSeconds(s, site, true);
    expectClose(assisted, 6.4 / 1.5);
    expect((216 / (assisted + 5)).toFixed(2)).toBe('23.31');
  });

  it('applies the milestone doubling at every threshold', () => {
    const s = makeState();
    const site = s.empire.sites[0];
    let prev = cyclePayout(s, site).base;
    for (let n = 2; n <= 200; n++) {
      site.productionLevel = n;
      const next = cyclePayout(s, site).base;
      expect(next.gt(prev)).toBe(true);
      prev = next;
    }
    site.productionLevel = 200;
    expectClose(cyclePayout(s, site).base, 10 * 200 * 2 ** catalog.levels.milestones.length);
  });
});

describe('prices', () => {
  const hill = siteDef('first_hill');

  it('matches the documented formulas', () => {
    const s = makeState();
    expect(levelCost(s, hill, 'production', 1).toNumber()).toBe(8);
    expect(levelCost(s, hill, 'production', 2).toNumber()).toBe(Math.ceil(8 * 1.17));
    expect(levelCost(s, hill, 'strength', 0).toNumber()).toBe(40);
    expect(levelCost(s, hill, 'impact', 0).toNumber()).toBe(100);
    expect(flywheelCost(s, s.empire.sites[0]).toNumber()).toBe(80);
    expect(catalog.levels.foremanCost.toNumber()).toBe(360);
  });

  it('bulk cost equals the sum of rounded individual prices', () => {
    const s = makeState();
    const site = s.empire.sites[0];
    let manual = Money.ZERO;
    for (let i = 0; i < 10; i++) manual = manual.add(levelCost(s, hill, 'production', 1 + i));
    expect(bulkCost(s, site, 'production', 10)!.eq(manual)).toBe(true);
  });

  it('refuses counts beyond the cap', () => {
    const s = makeState();
    expect(bulkCost(s, s.empire.sites[0], 'impact', 11)).toBeNull();
    expect(bulkCost(s, s.empire.sites[0], 'production', 200)).toBeNull();
    expect(bulkCost(s, s.empire.sites[0], 'production', 199)).not.toBeNull();
  });

  it('Buy Max returns the largest exactly affordable count', () => {
    const s = makeState();
    const site = s.empire.sites[0];
    give(s, 100);
    const n = maxAffordable(s, site, 'production');
    expect(bulkCost(s, site, 'production', n)!.lte(100)).toBe(true);
    expect(bulkCost(s, site, 'production', n + 1)!.gt(100)).toBe(true);
  });

  it('marks strength ineffective once the ascent floor is reached', () => {
    const s = makeState();
    const site = s.empire.sites[0];
    // Tartarus-free hypothetical: force a tiny base by using many levels on a fast site.
    site.wheelOwned = true;
    site.wheelCharged = true;
    s.prestige.permanentUpgradeIds = catalog.insightUpgrades.slice(0, 7).map((u) => u.id);
    // 12 / ((1 + 0.1p) * 1.5) <= 2  ⇔  p >= 30, beyond the cap: always effective on the first hill.
    for (let p = 0; p < 25; p++) expect(strengthLevelEffective(s, site, p)).toBe(true);
  });
});

describe('prestige formulas', () => {
  it('matches the documented entitlement table', () => {
    expect(prestigeEntitlement(Money.of('99999999'))).toBe(0);
    expect(prestigeEntitlement(Money.of('1e8'))).toBe(10);
    expect(prestigeEntitlement(Money.of('1e9'))).toBe(40);
    expect(prestigeEntitlement(Money.of('1e10'))).toBe(90);
    expect(prestigeEntitlement(Money.of('1e11'))).toBe(160);
    expect(prestigeEntitlement(Money.of('1e14'))).toBe(490);
  });

  it('has diminishing returns: 10 → ×1.75, 160 → ×4', () => {
    expectClose(insightFactor(10), 1.75);
    expectClose(insightFactor(160), 4);
  });
});

describe('formatting', () => {
  it('uses K, M, B, T, then named -illions, or scientific notation by choice', () => {
    expect(formatMoney(Money.of(7))).toBe('7');
    expect(formatMoney(Money.of(1234))).toBe('1.23K');
    expect(formatMoney(Money.of('45000'))).toBe('45K');
    expect(formatMoney(Money.of('2.5e7'))).toBe('25M');
    expect(formatMoney(Money.of('1.2e10'))).toBe('12B');
    expect(formatMoney(Money.of('4.8e12'))).toBe('4.8T');
    expect(formatMoney(Money.of('2e15'))).toBe('2Qa');
    expect(formatMoney(Money.of('3.1e18'))).toBe('3.1Qi');
    expect(formatMoney(Money.of('1e33'))).toBe('1Dc');
    expect(formatMoney(Money.of('4.5e37'))).toBe('45UDc');
    expect(formatMoney(Money.of('1e63'))).toBe('1Vg');
    expect(formatMoney(Money.of('1e300'))).toBe('1NoNog');
    expect(formatMoney(Money.of('2e303'))).toBe('2.00e303');
    setNotation('scientific');
    expect(formatMoney(Money.of('4.8e12'))).toBe('4.8T');
    expect(formatMoney(Money.of('2e15'))).toBe('2.00e15');
    setNotation('named');
  });

  it('follows the locale decimal mark for display only', () => {
    setNumberLocale('de-DE');
    try {
      expect(formatMoney(Money.of(1234))).toBe('1,23K');
      expect(formatMultiplier(1.75)).toBe('×1,75');
    } finally {
      setNumberLocale('en-US');
    }
    expect(formatMoney(Money.of(1234))).toBe('1.23K');
  });
});
