import { describe, expect, it } from 'vitest';
import { catalog } from '../src/content/catalog';
import { installCounterweight, openSite } from '../src/core/commands';
import { settleOffline } from '../src/core/offline';
import { grantIncome, stepSites } from '../src/core/sim';
import { trialMet, trialNeeded } from '../src/core/trials';
import type { GameEvent } from '../src/core/state';
import { ctx, knowsAutomation, makeState } from './helpers';

describe('decree trials', () => {
  it('every hill but the last asks a feat of its machine', () => {
    for (const def of catalog.sites.slice(0, -1)) expect(trialNeeded(def.id)).toBeGreaterThan(0);
    expect(trialNeeded(catalog.sites[catalog.sites.length - 1].id)).toBe(0);
  });

  it('the gross alone issues no decree; finishing the trial does', () => {
    const s = knowsAutomation(makeState());
    const hill = s.empire.sites[0];
    const events: GameEvent[] = [];
    grantIncome(s, hill, catalog.sites[1].defianceGate, events);
    expect(s.empire.offeredSiteIds).toEqual([]);
    hill.purse = catalog.sites[1].unlockCost.mul(2);
    expect(openSite(s, 'tartarus_rim', []).ok).toBe(false);

    // Hang the counterweight and climb: the decree follows the hundredth climb.
    hill.productionLevel = catalog.counterweight.unlockLevel;
    hill.purse = hill.purse.mul(1e6);
    expect(installCounterweight(s, hill.id, []).ok).toBe(true);
    s.empire.foremanOwned = true;
    const c = ctx({ events });
    for (let t = 0; t < 24 * 3600 && !trialMet(hill); t++) stepSites(s, 1, c);
    expect(trialMet(hill)).toBe(true);
    expect(s.empire.offeredSiteIds).toContain('tartarus_rim');
    expect(events.some((e) => e.type === 'DecreeAvailable')).toBe(true);
  });

  it('the First Hill counts batched offline cycles like live ones', () => {
    const make = () => {
      const s = knowsAutomation(makeState());
      const hill = s.empire.sites[0];
      s.empire.foremanOwned = true;
      hill.productionLevel = catalog.counterweight.unlockLevel;
      hill.purse = hill.purse.add(catalog.sites[1].unlockCost.mul(1e9));
      installCounterweight(s, hill.id, []);
      return s;
    };
    const a = make();
    const b = make();
    settleOffline(a, 3600, []);
    const c = ctx({ offline: true });
    for (let t = 0; t < 3600; t++) stepSites(b, 1, c);
    expect(a.empire.sites[0].trial).toBe(b.empire.sites[0].trial);
    expect(a.empire.sites[0].trial).toBeGreaterThan(0);
  });
});
