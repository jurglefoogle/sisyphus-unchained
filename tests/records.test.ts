import { describe, expect, it } from 'vitest';
import { catalog } from '../src/content/catalog';
import { closeRun, fileAppeal, installWork, passTime } from '../src/core/commands';
import { settleOffline } from '../src/core/offline';
import { checksum, deserializeSave, serializeSave } from '../src/core/save';
import { knowsAutomation, makeState } from './helpers';

const charter = catalog.works.find((w) => w.effect === 'incomeMultiplierAndEnding')!;

describe('Timed records', () => {
  it('the run and campaign clocks count play and counted absence', () => {
    const s = knowsAutomation(makeState());
    s.empire.foremanOwned = true;
    passTime(s, 100);
    settleOffline(s, 1e9, []); // beyond the cap: only the counted part passes
    const cap = s.records.runSeconds! - 100;
    expect(cap).toBeGreaterThan(0);
    expect(cap).toBeLessThan(1e9);
    expect(s.records.campaignSeconds).toBe(s.records.runSeconds);
    closeRun(s, []);
    expect(s.records.runSeconds).toBe(0);
    expect(s.records.campaignSeconds).toBe(100 + cap);
  });

  it('the Charter records the first signing and the fastest run, per Appeal', () => {
    const s = makeState();
    passTime(s, 500);
    installWork(s, charter.id, false, []);
    expect(s.records.firstCharterSeconds).toBe(500);
    expect(s.records.charterSeconds).toEqual({ '0': 500 });
    fileAppeal(s, []);
    passTime(s, 800);
    installWork(s, charter.id, false, []);
    expect(s.records.firstCharterSeconds).toBe(500);
    expect(s.records.charterSeconds).toEqual({ '0': 500, '1': 800 });
  });

  it('round-trips, and a v11 save keeps no guessed clock', () => {
    const s = makeState();
    passTime(s, 42);
    installWork(s, charter.id, false, []);
    const r = deserializeSave(serializeSave(s));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.records).toEqual(s.records);

    const env = JSON.parse(serializeSave(makeState()));
    env.data.schemaVersion = 11;
    delete env.data.records;
    env.checksum = checksum(JSON.stringify(env.data));
    const old = deserializeSave(JSON.stringify(env));
    expect(old.ok).toBe(true);
    if (!old.ok) return;
    passTime(old.state, 10);
    installWork(old.state, charter.id, false, []);
    expect(old.state.records).toEqual({ runSeconds: null, campaignSeconds: null, firstCharterSeconds: null, charterSeconds: {} });
    closeRun(old.state, []);
    expect(old.state.records.runSeconds).toBe(0); // the next run is timed
  });
});
