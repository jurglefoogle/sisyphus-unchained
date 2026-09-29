import { describe, expect, it } from 'vitest';
import { catalog } from '../src/content/catalog';
import { tabletPool } from '../src/content/devices';
import { keepOnFile, remember, summonVisitor, takeBargain, unseal } from '../src/core/commands';
import { modifiers } from '../src/core/effects';
import { spendableInsight } from '../src/core/formulas';
import { checksum, deserializeSave, serializeSave } from '../src/core/save';
import { dealHand, visitorWaiting } from '../src/core/seals';
import type { GameState } from '../src/core/state';
import { makeState } from './helpers';

function rich(insight = 500): GameState {
  const s = makeState();
  s.prestige.lifetimeInsightAwarded = insight;
  return s;
}

describe('Remembrances', () => {
  it('each rank costs more and deepens the machine in every run', () => {
    const s = rich();
    const hill = s.empire.sites[0].id;
    const before = modifiers(s, hill).flywheel;
    const costs = catalog.memory.remembranceCosts;
    for (const c of costs) {
      const left = spendableInsight(s);
      expect(remember(s, hill, []).ok).toBe(true);
      expect(spendableInsight(s)).toBe(left - c);
    }
    expect(remember(s, hill, []).ok).toBe(false);
    expect(modifiers(s, hill).flywheel).toBeCloseTo(before * 1.1 ** costs.length, 12);
  });

  it('only for hills held in some run, and never on credit', () => {
    const s = rich(0);
    expect(remember(s, s.empire.sites[0].id, []).ok).toBe(false);
    s.prestige.lifetimeInsightAwarded = 100;
    expect(remember(s, 'olympian_approach', []).ok).toBe(false);
    s.discoveries.archiveIds.push('site.olympian_approach');
    expect(remember(s, 'olympian_approach', []).ok).toBe(true);
  });
});

describe('Keep on File', () => {
  it('a revealed device kept on file is always dealt', () => {
    const hill = 'first_hill';
    const pool = tabletPool(hill, 0).map((d) => d.id); // the original sentence's pool
    const s = rich();
    const target = pool[pool.length - 1];
    expect(keepOnFile(s, hill, target).ok).toBe(false); // never revealed
    s.discoveries.codexIds.push(...pool);
    const left = spendableInsight(s);
    expect(keepOnFile(s, hill, target).ok).toBe(true);
    expect(spendableInsight(s)).toBe(left - catalog.memory.keepOnFile);
    // Changing it is free once the file is open.
    expect(keepOnFile(s, hill, pool[0]).ok).toBe(true);
    expect(spendableInsight(s)).toBe(left - catalog.memory.keepOnFile);
    for (const id of pool) {
      s.prestige.filed[hill] = id;
      for (let run = 0; run < 20; run++) expect(dealHand(s, hill)).toContain(id);
    }
  });
});

describe('Unseal in Advance and sending for a visitor', () => {
  it('reads a seal for Insight, once, this run', () => {
    const s = rich();
    const site = s.empire.sites[0];
    const left = spendableInsight(s);
    expect(unseal(s, site.id, 0).ok).toBe(true);
    expect(site.peeked).toEqual([site.hand[0]]);
    expect(unseal(s, site.id, 0).ok).toBe(false);
    expect(spendableInsight(s)).toBe(left - catalog.memory.unseal);
    expect(site.devices).not.toContain(site.hand[0]); // read, not broken
  });

  it('a visitor sent for waits before the crew reaches them', () => {
    const s = rich();
    const site = s.empire.sites[0];
    expect(visitorWaiting(site)).toBeNull();
    const events: never[] = [];
    expect(summonVisitor(s, site.id, events).ok).toBe(true);
    expect(visitorWaiting(site)).not.toBeNull();
    expect(summonVisitor(s, site.id, []).ok).toBe(false);
    const bargain = visitorWaiting(site)!.bargains[0];
    expect(takeBargain(s, site.id, bargain, []).ok).toBe(true);
    expect(visitorWaiting(site)).toBeNull();
  });

  it('round-trips, and a v9 save remembers nothing yet', () => {
    const s = rich();
    s.discoveries.codexIds.push(...tabletPool('first_hill').map((d) => d.id));
    remember(s, 'first_hill', []);
    keepOnFile(s, 'first_hill', tabletPool('first_hill')[2].id);
    unseal(s, 'first_hill', 1);
    summonVisitor(s, 'first_hill', []);
    const r = deserializeSave(serializeSave(s));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.prestige).toEqual(s.prestige);
    expect(r.state.empire.sites[0].peeked).toEqual(s.empire.sites[0].peeked);
    expect(r.state.empire.sites[0].summoned).toBe(true);

    const env = JSON.parse(serializeSave(s));
    env.data.schemaVersion = 9;
    delete env.data.prestige.remembrances;
    delete env.data.prestige.fileSlots;
    delete env.data.prestige.filed;
    for (const x of env.data.empire.sites) {
      delete x.peeked;
      delete x.summoned;
    }
    env.checksum = checksum(JSON.stringify(env.data));
    const old = deserializeSave(JSON.stringify(env));
    expect(old.ok).toBe(true);
    if (!old.ok) return;
    expect(old.state.prestige.remembrances).toEqual({});
    expect(old.state.empire.sites[0].summoned).toBe(false);
  });
});
