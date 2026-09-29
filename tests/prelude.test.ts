import { describe, expect, it } from 'vitest';
import { catalog } from '../src/content/catalog';
import {
  buyFlywheel,
  buyLevels,
  buyPreludeUpgrade,
  confirmPrestige,
  hireForeman,
} from '../src/core/commands';
import { ascentLimit, flywheelUnlocked, foremanUnlocked, preludeReach } from '../src/core/formulas';
import { Money } from '../src/core/money';
import { checksum, deserializeSave, serializeSave } from '../src/core/save';
import { grantIncome } from '../src/core/sim';
import type { GameEvent, GameState } from '../src/core/state';
import { expectClose, freshState, give, runFrames } from './helpers';

const ofType = <T extends GameEvent['type']>(events: GameEvent[], type: T) =>
  events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);

function buyAllGrip(s: GameState): void {
  for (const u of catalog.prelude.upgrades) {
    give(s, u.cost.toNumber());
    expect(buyPreludeUpgrade(s, u.id, []).ok).toBe(true);
  }
}

describe('prelude: the stone slips', () => {
  it('slips at the grip limit, pays the fall and lets you retry at once', () => {
    const s = freshState();
    const site = s.empire.sites[0];
    expect(ascentLimit(s, site)).toBe(0.3);
    // 0.3 of a 12 s ascent is 3.6 s; the slip from 0.3 takes 0.6 + 1.6 × 0.3 s.
    const events = runFrames(s, 3.6 + 0.001, 60, true);
    const slips = ofType(events, 'StoneSlipped');
    expect(slips).toHaveLength(1);
    expectClose(slips[0].height, 0.3, 1e-6);
    expect(slips[0].record).toBe(true);
    expect(site.phase).toBe('slipping');
    expect(ofType(events, 'SummitReached')).toHaveLength(0);

    const landed = runFrames(s, 1.08 + 0.001, 60, false); // the fall needs no input
    expect(ofType(landed, 'FallResolved')).toHaveLength(1);
    expect(s.empire.sites[0].purse.toNumber()).toBe(3);
    expect(s.wallet.runGross.toNumber()).toBe(3);
    expect(site.phase).toBe('ascending');
    expect(site.phaseProgress).toBe(0);
    expect(s.prelude.attempts).toBe(1);
    expectClose(s.prelude.bestHeight, 0.3, 1e-6);
  });

  it('releasing push braces the stone; it never slips back early', () => {
    const s = freshState();
    runFrames(s, 2, 60, true);
    const before = s.empire.sites[0].phaseProgress;
    const events = runFrames(s, 30, 60, false);
    expect(ofType(events, 'StoneSlipped')).toHaveLength(0);
    expect(s.empire.sites[0].phaseProgress).toBe(before);
  });

  it('only a higher attempt counts as a height record', () => {
    const s = freshState();
    const events = runFrames(s, 12, 60, true);
    const slips = ofType(events, 'StoneSlipped');
    expect(slips.length).toBeGreaterThanOrEqual(2);
    expect(slips.map((e) => e.record)).toEqual([true, ...slips.slice(1).map(() => false)]);
  });

  it('is identical at 15, 60 and 144 fps', () => {
    const results = [15, 60, 144].map((fps) => {
      const s = freshState();
      runFrames(s, 120, fps, true);
      return { obols: s.empire.sites[0].purse.toNumber(), attempts: s.prelude.attempts };
    });
    for (const r of results) expect(r).toEqual(results[0]);
  });

  it('frozen while away: an unautomated prelude earns nothing offline', async () => {
    const { settleOffline } = await import('../src/core/offline');
    const s = freshState();
    runFrames(s, 3.7, 60, true); // mid-slip
    const summary = settleOffline(s, 3600, []);
    expect(summary.earned.isZero()).toBe(true);
    expect(s.empire.sites[0].phase).toBe('slipping');
  });
});

describe('prelude: grip upgrades', () => {
  it('are bought once each, in order, and raise the reach', () => {
    const s = freshState();
    give(s, 1000);
    const [first, second] = catalog.prelude.upgrades;
    expect(buyPreludeUpgrade(s, second.id, []).ok).toBe(false);
    expect(buyPreludeUpgrade(s, first.id, []).ok).toBe(true);
    expect(buyPreludeUpgrade(s, first.id, []).ok).toBe(false);
    expectClose(preludeReach(s), 0.5, 1e-9);
    expect(s.empire.sites[0].purse.toNumber()).toBe(1000 - first.cost.toNumber());
  });

  it('refuses a purchase the wallet cannot cover', () => {
    const s = freshState();
    give(s, 4);
    expect(buyPreludeUpgrade(s, catalog.prelude.upgrades[0].id, []).ok).toBe(false);
    expect(s.empire.sites[0].purse.toNumber()).toBe(4);
  });

  it('a mid-climb purchase lets the same attempt go higher', () => {
    const s = freshState();
    runFrames(s, 2, 60, true); // 1/6 of the hill, below the 0.3 limit
    give(s, 5);
    buyPreludeUpgrade(s, catalog.prelude.upgrades[0].id, []);
    const events = runFrames(s, 3.5, 60, true); // 5.5 s in: past the old 0.3 limit, below 0.5
    expect(ofType(events, 'StoneSlipped')).toHaveLength(0);
  });

  it('full grip reaches the summit: the prelude ends with the offering, once', () => {
    const s = freshState();
    buyAllGrip(s);
    expect(preludeReach(s)).toBe(1);
    const events = runFrames(s, 12.001, 60, true);
    expect(ofType(events, 'SummitReached')).toHaveLength(1);
    const done = ofType(events, 'PreludeCompleted');
    expect(done).toHaveLength(1);
    expect(s.prelude.complete).toBe(true);
    expect(s.discoveries.tutorialIds).toContain('first_summit');
    // Summit share (7) plus the offering.
    expectClose(s.empire.sites[0].purse, 7 + catalog.prelude.summitOffering.toNumber());

    const later = runFrames(s, 60, 60, true);
    expect(ofType(later, 'PreludeCompleted')).toHaveLength(0);
    expect(ofType(later, 'StoneSlipped')).toHaveLength(0);
  });

  it('survives Begin Again: later runs never slip', () => {
    const s = freshState();
    buyAllGrip(s);
    runFrames(s, 12.001, 60, true);
    s.empire.foremanOwned = true;
    grantIncome(s, s.empire.sites[0], catalog.prestige.minimumRecord, []);
    expect(confirmPrestige(s, []).ok).toBe(true);
    expect(s.prelude.complete).toBe(true);
    expect(ascentLimit(s, s.empire.sites[0])).toBe(1);
  });
});

describe('automation gates (first run)', () => {
  function pastPrelude(): GameState {
    const s = freshState();
    buyAllGrip(s);
    runFrames(s, 12.001, 60, true);
    return s;
  }

  it('the flywheel is discovered at its level gate', () => {
    const s = pastPrelude();
    give(s, 1e6);
    expect(flywheelUnlocked(s)).toBe(false);
    expect(buyFlywheel(s, 'first_hill', []).ok).toBe(false);
    const events: GameEvent[] = [];
    buyLevels(s, 'first_hill', 'production', catalog.automation.flywheelUnlockLevel - 1, events);
    expect(ofType(events, 'FeatureUnlocked').map((e) => e.feature)).toEqual(['flywheel']);
    expect(buyFlywheel(s, 'first_hill', []).ok).toBe(true);
  });

  it('the foreman comes later, and both stay known after Begin Again', () => {
    const s = pastPrelude();
    give(s, 1e7);
    buyLevels(s, 'first_hill', 'production', catalog.automation.flywheelUnlockLevel - 1, []);
    expect(buyFlywheel(s, 'first_hill', []).ok).toBe(true);
    expect(foremanUnlocked(s)).toBe(false);
    expect(hireForeman(s, []).ok).toBe(false);
    const events: GameEvent[] = [];
    buyLevels(s, 'first_hill', 'production', catalog.automation.foremanUnlockLevel - catalog.automation.flywheelUnlockLevel, events);
    expect(ofType(events, 'FeatureUnlocked').map((e) => e.feature)).toEqual(['foreman']);
    expect(hireForeman(s, []).ok).toBe(true);

    grantIncome(s, s.empire.sites[0], catalog.prestige.minimumRecord, []);
    confirmPrestige(s, []);
    give(s, 1e4);
    expect(buyFlywheel(s, 'first_hill', []).ok).toBe(true);
    expect(hireForeman(s, []).ok).toBe(true);
  });
});

describe('prelude saves', () => {
  it('round-trips mid-slip', () => {
    const s = freshState();
    runFrames(s, 3.8, 60, true);
    expect(s.empire.sites[0].phase).toBe('slipping');
    const text = serializeSave(s);
    const loaded = deserializeSave(text);
    expect(loaded.ok).toBe(true);
    if (loaded.ok) expect(serializeSave(loaded.state)).toBe(text);
  });

  it('rejects grip upgrades out of sequence', () => {
    const env = JSON.parse(serializeSave(freshState()));
    env.data.prelude.upgradeIds = [catalog.prelude.upgrades[1].id];
    env.checksum = checksum(JSON.stringify(env.data));
    const r = deserializeSave(JSON.stringify(env));
    expect(r.ok).toBe(false);
  });

  function asV1(s: GameState): string {
    const env = JSON.parse(serializeSave(s));
    delete env.data.prelude;
    // v1 and v2 kept one shared purse in the wallet.
    env.data.wallet.obols = env.data.empire.sites[0].purse;
    for (const site of env.data.empire.sites) {
      delete site.snapshot.slipHeight;
      delete site.purse;
      delete site.gross;
      delete site.steward;
    }
    env.data.schemaVersion = 1;
    env.checksum = checksum(JSON.stringify(env.data));
    return JSON.stringify(env);
  }

  it('migrates v1: saves that reached a summit skip the prelude', () => {
    const s = freshState();
    s.discoveries.tutorialIds.push('first_summit');
    const r = deserializeSave(asV1(s));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.migratedFrom).toBe(1);
    expect(r.state.prelude.complete).toBe(true);
    expect(preludeReach(r.state)).toBe(1);
  });

  it('migrates v1: a save that never summited starts the prelude', () => {
    const r = deserializeSave(asV1(freshState()));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.state.prelude.complete).toBe(false);
  });
});
