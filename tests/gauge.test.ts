import { describe, expect, it } from 'vitest';
import { catalog } from '../src/content/catalog';
import { buildView } from '../src/app/view';
import { fileAppeal, installWork } from '../src/core/commands';
import { makeState } from './helpers';

describe('The tablet gauge and the Appeal review', () => {
  it('shows the viewed machine, filled within bounds', () => {
    const s = makeState();
    const g = buildView(s).gauge;
    if (g) {
      expect(g.value).toBeGreaterThanOrEqual(0);
      expect(g.value).toBeLessThanOrEqual(1);
      expect(g.text.length).toBeGreaterThan(0);
    }
  });

  it('offers the next Appeal only after the Charter, and names it', () => {
    const s = makeState();
    expect(buildView(s).appealOffer).toBeNull();
    const charter = catalog.works.find((w) => w.effect === 'incomeMultiplierAndEnding')!;
    installWork(s, charter.id, false, []);
    const offer = buildView(s).appealOffer!;
    expect(offer.number).toBe(1);
    expect(offer.gates).toBe(catalog.appeals.gateGrowth);
    fileAppeal(s, []);
    expect(buildView(s).appealOffer).toBeNull();
  });
});
