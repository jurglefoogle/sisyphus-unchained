import { describe, expect, it } from 'vitest';
import { buildArchive } from '../src/app/archive';
import { buildView, goalKey, PRESTIGE_PROMPT_INSIGHT, resolveGoal } from '../src/app/view';
import { catalog } from '../src/content/catalog';
import { buyFlywheel, buyLevels, confirmPrestige, hireForeman } from '../src/core/commands';
import { Money } from '../src/core/money';
import { checksum, deserializeSave, serializeSave } from '../src/core/save';
import { stepSites } from '../src/core/sim';
import { ctx, freshState, give, knowsAutomation, makeState } from './helpers';

function automated() {
  const s = knowsAutomation(makeState());
  give(s, 1e6);
  buyFlywheel(s, 'first_hill', []);
  hireForeman(s, []);
  return s;
}

describe('pinned goal', () => {
  it('tracks one purchase, changes only the objective, and never reserves money', () => {
    const s = makeState();
    s.discoveries.tutorialIds.push('first_summit', 'first_level');
    const key = goalKey({ kind: 'levels', track: 'production' }, 'first_hill')!;
    s.pinnedGoal = key;
    const before = s.wallet.obols;
    let v = buildView(s);
    expect(v.goal?.stale).toBe(false);
    expect(v.goal?.affordable).toBe(false);
    expect(v.objective).toMatch(/^Goal: Improve Operation 2/);
    expect(v.rows.find((r) => r.key === 'production')?.pinned).toBe(true);
    expect(s.wallet.obols.eq(before)).toBe(true);

    give(s, 1000);
    v = buildView(s);
    expect(v.goal?.affordable).toBe(true);
    expect(v.objectiveProgress).toBe(1);
    expect(v.objective).toMatch(/^Goal ready/);
  });

  it('is kept but marked stale once bought, suggesting the next objective instead', () => {
    const s = automated();
    s.pinnedGoal = 'foreman';
    const v = buildView(s);
    expect(v.goal?.stale).toBe(true);
    expect(s.pinnedGoal).toBe('foreman');
    expect(v.objective).toMatch(/^Pinned goal done or unavailable/);
    expect(v.objectiveProgress).toBeNull();
  });

  it('marks a capped track stale and tolerates unknown keys', () => {
    const s = makeState();
    s.empire.sites[0].impactLevel = catalog.levels.impactCap;
    expect(resolveGoal(s, 'levels:first_hill:impact').stale).toBe(true);
    expect(resolveGoal(s, 'levels:nowhere:production').stale).toBe(true);
    expect(resolveGoal(s, 'nonsense').stale).toBe(true);
  });

  it('requires the decree before a site goal counts as affordable', () => {
    const s = makeState();
    const next = catalog.sites[1];
    s.wallet.obols = next.unlockCost.mul(2);
    expect(resolveGoal(s, `site:${next.id}`).affordable).toBe(false);
    s.empire.offeredSiteIds.push(next.id);
    expect(resolveGoal(s, `site:${next.id}`).affordable).toBe(true);
  });

  it('keeps immediate, next, and larger goals visible together', () => {
    const opening = buildView(freshState());
    expect(opening.goalStack.now).toMatch(/Push|Best height/);
    expect(opening.goalStack.next).toMatch(/Reach farther|summit/);
    expect(opening.goalStack.beyond).toMatch(/returning stone/);

    const s = automated();
    const v = buildView(s);
    expect(v.goalStack.now.length).toBeGreaterThan(0);
    expect(v.goalStack.next).toMatch(/Level|flywheel|Foreman/);
    expect(v.goalStack.beyond).toMatch(/Tartarus Rim/);
  });
});

describe('Begin Again suggestion', () => {
  it(`appears at ${PRESTIGE_PROMPT_INSIGHT} Insight after automation, once, and can be dismissed`, () => {
    const s = automated();
    s.wallet.runGross = Money.of(1e6);
    expect(buildView(s).prestige.award).toBeLessThan(PRESTIGE_PROMPT_INSIGHT + 1);
    expect(buildView(s).suggestPrestige).toBe(buildView(s).prestige.award >= PRESTIGE_PROMPT_INSIGHT);
    s.wallet.runGross = Money.of(1e9);
    expect(buildView(s).suggestPrestige).toBe(true);
    s.discoveries.tutorialIds.push('prestige_prompt');
    expect(buildView(s).suggestPrestige).toBe(false);
  });

  it('never suggests before the player has seen automation', () => {
    const s = makeState();
    s.wallet.runGross = Money.of(1e12);
    expect(buildView(s).suggestPrestige).toBe(false);
  });

  it('is retired by the first Begin Again', () => {
    const s = automated();
    s.wallet.runGross = Money.of(1e9);
    expect(confirmPrestige(s, []).ok).toBe(true);
    s.wallet.runGross = Money.of(1e12);
    expect(buildView(s).suggestPrestige).toBe(false);
  });
});

describe('empire frieze', () => {
  it('lists the six fixed sites with the next decree teased as a silhouette', () => {
    const s = automated();
    const v = buildView(s);
    expect(v.empire.map((e) => e.id)).toEqual(catalog.sites.map((d) => d.id));
    expect(v.empire[0]).toMatchObject({ owned: true, selected: true, automated: true, wheel: true });
    expect(v.empire[1]).toMatchObject({ owned: false, teased: true });
    expect(v.empire.slice(2).every((e) => !e.owned && !e.teased)).toBe(true);
  });

  it('places the stone around the loop by phase', () => {
    const s = automated();
    const site = s.empire.sites[0];
    expect(buildView(s).empire[0].loop).toBe(0);
    stepSites(s, 1, ctx());
    const up = buildView(s).empire[0].loop;
    expect(up).toBeGreaterThan(0);
    expect(up).toBeLessThanOrEqual(0.5);
    site.phase = 'descending';
    site.phaseProgress = catalog.cycle.descentSeconds / 2;
    expect(buildView(s).empire[0].loop).toBeCloseTo(0.7);
  });

  it('stamps every label once the Charter is signed', () => {
    const s = automated();
    expect(buildView(s).charterSigned).toBe(false);
    s.empire.purchasedWorkIds.push('charter');
    expect(buildView(s).charterSigned).toBe(true);
  });
});

describe('archive odds and stones', () => {
  it('publishes target odds that sum to one with the configured 0.08 expectation', () => {
    const a = buildArchive(makeState());
    const total = catalog.bonusTargets.reduce((x, b) => x + b.probability, 0);
    expect(total).toBeCloseTo(1, 12);
    expect(a.odds.targets.map((t) => t.chance)).toEqual(['80%', '18%', '2%']);
    expect(a.odds.expectedBonus).toBe('0.08×');
    expect(a.odds.relicChance).toBe('1.25%');
    expect(a.odds.relicPity).toBe(60);
  });

  it('shows only stones of discovered chapters', () => {
    const a = buildArchive(makeState());
    expect(a.stones).toHaveLength(6);
    expect(a.stones.filter((x) => x.found).map((x) => x.siteId)).toEqual(['first_hill']);
  });

  it('teases the eligible relic with honest odds and its guarantee', () => {
    const v = buildView(makeState());
    expect(v.relicHunt).toMatchObject({ site: 'The First Hill', chance: '1.25% per descent' });
    expect(v.relicHunt?.guarantee).toMatch(/next operation/);
  });

  it('summarizes collection completion and durable records', () => {
    const s = makeState();
    s.counters.totalClimbs = 12;
    s.counters.totalImpacts = 9;
    const a = buildArchive(s);
    expect(a.completion.map((x) => x.id)).toEqual(['guide', 'stamps', 'myths', 'relics', 'scenes', 'stones']);
    expect(a.completion.every((x) => x.found >= 0 && x.found <= x.total)).toBe(true);
    expect(a.records).toContainEqual({ label: 'Completed climbs', value: '12' });
    expect(a.records).toContainEqual({ label: 'Resolved impacts', value: '9' });
  });
});

describe('save fields for goals and options', () => {
  it('round-trips the pinned goal and the new comfort options', () => {
    const s = makeState();
    s.pinnedGoal = 'foreman';
    s.options = { ...s.options, screenShake: false, flashFree: true, pushKey: 'KeyJ', telemetry: true };
    const r = deserializeSave(serializeSave(s));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.pinnedGoal).toBe('foreman');
    expect(r.state.options).toMatchObject({ screenShake: false, flashFree: true, pushKey: 'KeyJ', telemetry: true });
  });

  it('fills defaults for older saves and rejects a malformed key binding', () => {
    const env = JSON.parse(serializeSave(makeState()));
    delete env.data.pinnedGoal;
    delete env.data.options.screenShake;
    env.data.options.pushKey = '<script>';
    env.checksum = checksum(JSON.stringify(env.data));
    const r = deserializeSave(JSON.stringify(env));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.pinnedGoal).toBeNull();
    expect(r.state.options.screenShake).toBe(true);
    expect(r.state.options.pushKey).toBe('Space');
  });

  it('buying levels does not disturb a pin on another track', () => {
    const s = makeState();
    give(s, 1e4);
    s.pinnedGoal = 'levels:first_hill:impact';
    expect(buyLevels(s, 'first_hill', 'production', 3, []).ok).toBe(true);
    expect(s.pinnedGoal).toBe('levels:first_hill:impact');
  });
});
