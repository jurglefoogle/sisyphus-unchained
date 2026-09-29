import { describe, expect, it } from 'vitest';
import { catalog } from '../src/content/catalog';
import { MACHINE_CARDS } from '../src/content/machines';

describe('machine cards', () => {
  it('every hill has exactly one card', () => {
    for (const site of catalog.sites) expect(MACHINE_CARDS.filter((c) => c.siteId === site.id)).toHaveLength(1);
    expect(MACHINE_CARDS).toHaveLength(catalog.sites.length);
  });

  it('names one decision in a caption-length line, and quips stay short', () => {
    for (const c of MACHINE_CARDS) {
      expect(c.decision.length, c.machine).toBeLessThanOrEqual(120);
      expect(c.quip.length, c.machine).toBeLessThanOrEqual(80);
    }
  });
});
