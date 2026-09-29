import { describe, expect, it } from 'vitest';
import { catalog } from '../src/content/catalog';
import { EDICTS, NEMESIS_IDLE_CLIMBS, tabletPool } from '../src/content/devices';
import { hireClerk, openSite, setOnDuty, takeBargain } from '../src/core/commands';
import { modifiers } from '../src/core/effects';
import { bureauIncome, steadyIncomePerSecond } from '../src/core/formulas';
import { settleOffline } from '../src/core/offline';
import { checksum, deserializeSave, serializeSave } from '../src/core/save';
import { grantIncome, stepSites } from '../src/core/sim';
import { clerkCost, clerksToMatch, fileForms, filing, newBureau, recordDueProcess, statute, throughput, tickEdict } from '../src/core/bureau';
import { revealDevice } from '../src/core/seals';
import type { GameEvent, GameState, SiteState } from '../src/core/state';
import { ctx, expectClose, knowsAutomation, makeState } from './helpers';

/** A run with the Olympian Approach open and crewed, the foreman hired. */
function approach(): GameState {
  const s = knowsAutomation(makeState());
  for (const i of [1, 2, 3, 4, 5]) {
    const prev = s.empire.sites[i - 1];
    prev.trial = 1e6; // decree trials: tests/trials.test.ts
    grantIncome(s, prev, catalog.sites[i].defianceGate, []);
    prev.purse = catalog.sites[i].unlockCost;
    expect(openSite(s, catalog.sites[i].id, []).ok).toBe(true);
  }
  s.empire.foremanOwned = true;
  for (const site of s.empire.sites) {
    site.productionLevel = 30;
    site.strengthLevel = 4;
  }
  s.random.eligibleSiteId = null;
  s.random.relicCountdown = null;
  return s;
}

const millOf = (s: GameState): SiteState => s.empire.sites.find((x) => x.bureau)!;

describe('the Paperwork Mill', () => {
  it('sits on the Olympian Approach with two clerks', () => {
    const s = approach();
    const site = millOf(s);
    expect(site.id).toBe('olympian_approach');
    expect(site.bureau).toEqual({ ...newBureau(), dueProcess: site.bureau!.dueProcess });
    expect(tabletPool(site.id).length).toBeGreaterThanOrEqual(8);
  });

  it('a ripe backlog pays late fees, up to the statute', () => {
    const s = approach();
    const site = millOf(s);
    const m = modifiers(s, site.id);
    const b = site.bureau!;
    b.onDuty = 1; // slower than filing: the backlog grows
    fileForms(m, b, site.productionLevel, false);
    const green = b.factor;
    for (let i = 0; i < 400; i++) fileForms(m, b, site.productionLevel, false);
    expect(b.factor).toBeGreaterThan(green);
    const capped = b.factor;
    fileForms(m, b, site.productionLevel, false);
    expect(b.factor).toBeCloseTo(capped, 12);
  });

  it('the Moirai hold the backlog at the statute and beat a mill left alone', () => {
    const s = approach();
    const site = millOf(s);
    const m = modifiers(s, site.id);
    const b = site.bureau!;
    b.hired = clerksToMatch(m, site.productionLevel) + 2;
    b.onDuty = b.hired;
    const alone = bureauIncome(s, site, false);
    const duty = bureauIncome(s, site, true);
    expect(duty.gt(alone)).toBe(true);
    for (let i = 0; i < 400; i++) fileForms(m, b, site.productionLevel, true);
    expectClose(b.backlog, statute(m) * filing(m, site.productionLevel), 1e-6);
  });

  it('hiring costs more each time; on-duty stays within the hired', () => {
    const s = approach();
    const site = millOf(s);
    const m = modifiers(s, site.id);
    const first = clerkCost(s, site.id, site.bureau!.hired, m);
    site.purse = first.mul(100);
    expect(hireClerk(s, site.id).ok).toBe(true);
    expect(clerkCost(s, site.id, site.bureau!.hired, m).gt(first)).toBe(true);
    expect(site.bureau!.onDuty).toBe(3);
    expect(setOnDuty(s, site.id, 4).ok).toBe(false);
    expect(setOnDuty(s, site.id, 0).ok).toBe(true);
    expect(throughput(m, site.bureau!.onDuty)).toBe(0);
  });

  it('Due Process: milestones across the empire raise the crew here', () => {
    const s = approach();
    const site = millOf(s);
    recordDueProcess(s);
    const before = modifiers(s, site.id).crew;
    for (const x of s.empire.sites) x.productionLevel = 100;
    recordDueProcess(s);
    expect(modifiers(s, site.id).crew).toBeGreaterThan(before);
  });

  it('settles offline exactly as the live stepper, and an absence ends any Edict', () => {
    const make = () => {
      const s = approach();
      const site = millOf(s);
      site.bureau!.hired = 8;
      site.steward = { reinvest: false, paidWith: 'local' };
      site.bureau!.edict = 'holiday';
      site.bureau!.edictSeconds = 200;
      return s;
    };
    const a = make();
    const b = make();
    const secs = 3 * 3600;
    settleOffline(a, secs, []);
    millOf(b).bureau!.edict = null;
    millOf(b).bureau!.edictSeconds = 0;
    const c = ctx({ offline: true });
    for (let t = 0; t < secs; t++) stepSites(b, 1, c);
    expect(millOf(a).bureau).toEqual(millOf(b).bureau);
    expect(millOf(a).bureau!.edict).toBeNull();
    expectClose(millOf(a).gross, millOf(b).gross, 1e-9);
  });
});

describe('Edicts, Nemesis and the Mill whispers', () => {
  it('every hundred approvals Zeus issues an Edict for the whole empire, and it runs out', () => {
    const s = approach();
    const site = millOf(s);
    site.bureau!.approved = 99.99;
    site.bureau!.backlog = 10;
    const other = s.empire.sites[0];
    const events: GameEvent[] = [];
    const c = ctx({ events });
    for (let t = 0; t < 600 && !site.bureau!.edict; t++) stepSites(s, 1, c);
    expect(site.bureau!.edict).toBe(EDICTS[0].id);
    expect(events.some((e) => e.type === 'Edict')).toBe(true);
    expect(modifiers(s, other.id).descent).toBeLessThan(1);
    tickEdict(s, catalog.bureau.edictSeconds + 1);
    expect(site.bureau!.edict).toBeNull();
    expect(modifiers(s, other.id).descent).toBe(1);
  });

  it('Balanced Books doubles clerk speed', () => {
    const s = approach();
    const site = millOf(s);
    const before = throughput(modifiers(s, site.id), 2);
    site.productionLevel = 25;
    expect(takeBargain(s, site.id, 'balanced_books', []).ok).toBe(true);
    expect(throughput(modifiers(s, site.id), 2)).toBeCloseTo(before * 2, 12);
  });

  it('Nemesis Notices a hundred idle climbs', () => {
    const s = approach();
    const site = millOf(s);
    site.bureau!.onDuty = 0;
    s.empire.selectedSiteId = site.id;
    const c = ctx({ manualHeld: true });
    for (let t = 0; t < 6 * 3600 && site.bureau!.idle < NEMESIS_IDLE_CLIMBS; t++) stepSites(s, 1, c);
    expect(s.discoveries.whisperIds).toContain('nemesis_notices');
  });

  it('Form 1 is heard once the Codex holds every tablet of the other hills', () => {
    const s = approach();
    const others = catalog.sites.filter((x) => x.id !== 'olympian_approach').flatMap((x) => tabletPool(x.id).map((d) => d.id));
    s.discoveries.codexIds.push(...others.slice(1));
    const events: GameEvent[] = [];
    const home = s.empire.sites.find((x) => tabletPool(x.id).some((d) => d.id === others[0]))!;
    revealDevice(s, home, others[0], events);
    expect(s.discoveries.whisperIds).toContain('form_one');
  });

  it('round-trip the mill, and a v8 save gets a fresh one', () => {
    const s = approach();
    const site = millOf(s);
    Object.assign(site.bureau!, { backlog: 12.5, hired: 5, onDuty: 3, approved: 240, edict: 'census', edictSeconds: 90, edictIndex: 4 });
    const r = deserializeSave(serializeSave(s));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(millOf(r.state).bureau).toEqual(site.bureau);
    expectClose(steadyIncomePerSecond(r.state, millOf(r.state)), steadyIncomePerSecond(s, site), 1e-12);

    const env = JSON.parse(serializeSave(s));
    env.data.schemaVersion = 8;
    for (const x of env.data.empire.sites) delete x.bureau;
    env.checksum = checksum(JSON.stringify(env.data));
    const old = deserializeSave(JSON.stringify(env));
    expect(old.ok).toBe(true);
    if (!old.ok) return;
    expect(millOf(old.state).bureau).toEqual(newBureau());
  });
});
