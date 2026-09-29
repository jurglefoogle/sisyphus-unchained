import { describe, expect, it } from 'vitest';
import { catalog } from '../src/content/catalog';
import { buildView } from '../src/app/view';
import { fileAppeal, installWork } from '../src/core/commands';
import { freshState, makeState } from './helpers';
import { playDaily } from './bot';

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

  it('builds the view for every hill of a late campaign', () => {
    const run = playDaily(freshState(), { resets: 'gain', days: 60, stopAt: (s) => s.empire.sites.length === catalog.sites.length });
    for (const site of run.state.empire.sites) {
      run.state.empire.selectedSiteId = site.id;
      expect(() => buildView(run.state)).not.toThrow();
    }
  }, 120_000);
});
