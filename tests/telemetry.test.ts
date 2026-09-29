import { describe, expect, it } from 'vitest';
import { Telemetry } from '../src/app/telemetry';
import { Money } from '../src/core/money';
import type { GameEvent } from '../src/core/state';
import { makeState } from './helpers';

describe('local playtest telemetry', () => {
  it('records the Hooked funnel events without personal identifiers', () => {
    const state = makeState();
    state.options.telemetry = true;
    const telemetry = new Telemetry(() => true);
    const events: GameEvent[] = [
      { type: 'StoneSlipped', siteId: 'first_hill', height: 0.42, record: true },
      { type: 'MilestoneReached', siteId: 'first_hill', level: 10 },
      { type: 'ImpactResolved', siteId: 'first_hill', amount: Money.of(3), bonus: Money.of(20), targetId: 'gilded_offering' },
      { type: 'CharterSigned' },
    ];
    telemetry.onEvents(state, events);
    const exported = JSON.parse(telemetry.export()) as { entries: { event: string; detail?: string; level?: number }[] };
    expect(exported.entries.map((e) => e.event)).toEqual(['prelude_fall', 'milestone', 'bonus_target', 'charter_signed']);
    expect(exported.entries[0].detail).toBe('42%:record');
    expect(exported.entries[1].level).toBe(10);
    expect(JSON.stringify(exported)).not.toContain('device');
  });

  it('records the machine decisions and later-system events', () => {
    const state = makeState();
    const telemetry = new Telemetry(() => true);
    telemetry.decision(state, { type: 'SetTrim', trim: 3 } as { type: string });
    telemetry.decision(state, { type: 'Vent' });
    telemetry.decision(state, { type: 'BuyLevels' });
    telemetry.onEvents(state, [
      { type: 'Eruption', siteId: 'tartarus_rim', power: 2.5, heat: 0.8 },
      { type: 'VisitorArrived', siteId: 'first_hill', visitorId: 'hermes' },
      { type: 'Edict', edictId: 'e1' },
      { type: 'LaurelWon', number: 1 },
    ]);
    const entries = (JSON.parse(telemetry.export()) as { entries: { event: string; detail?: string | number }[] }).entries;
    expect(entries.map((e) => e.event)).toEqual(['decision', 'decision', 'eruption', 'visitor_arrive', 'edict', 'laurel']);
    expect(entries[0].detail).toBe('SetTrim trim=3');
    expect(entries[1].detail).toBe('Vent');
    expect(entries[2].detail).toBe('heat=0.80 power=2.50');
  });

  it('records nothing before opt-in', () => {
    const telemetry = new Telemetry(() => false);
    telemetry.record(makeState(), 'session_start');
    expect(JSON.parse(telemetry.export()).entries).toEqual([]);
  });
});
