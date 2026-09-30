import { describe, expect, it } from 'vitest';
import { catalog } from '../src/content/catalog';
import {
  buyFlywheel,
  buyLevels,
  buyPreludeUpgrade,
  buyWork,
  hireForeman,
} from '../src/core/commands';
import {
  bulkCost,
  flywheelCost,
  flywheelUnlocked,
  foremanUnlocked,
  nextPreludeUpgrade,
  strengthLevelEffective,
  type LevelTrack,
} from '../src/core/formulas';
import { stepSites } from '../src/core/sim';
import type { GameEvent, GameState } from '../src/core/state';
import { ctx, freshState } from './helpers';

/**
 * A scripted first session: hold Push the whole time and glance at the
 * drawer every few seconds. It is a fast player (no reading, no hesitation),
 * so real players land later than these times. Set PACING=1 to print them.
 */
function buyWhatMakesSense(s: GameState, log: (label: string) => void): void {
  const site = s.empire.sites[0];
  for (let guard = 0; guard < 100; guard++) {
    const grip = nextPreludeUpgrade(s);
    if (grip) {
      if (s.empire.sites[0].purse.lt(grip.cost) || !buyPreludeUpgrade(s, grip.id, []).ok) return;
      log(`grip: ${grip.id}`);
      continue;
    }
    if (foremanUnlocked(s) && !s.empire.foremanOwned) {
      if (hireForeman(s, []).ok) {
        log('foreman hired');
        continue;
      }
      return; // saving for it
    }
    if (flywheelUnlocked(s) && !site.wheelOwned) {
      if (s.empire.sites[0].purse.gte(flywheelCost(s, site)) && buyFlywheel(s, site.id, []).ok) {
        log('flywheel bought');
        continue;
      }
      return;
    }
    const hermes = catalog.works[0];
    if (s.empire.foremanOwned && site.productionLevel >= hermes.requiredLevel && !s.empire.purchasedWorkIds.includes(hermes.id)) {
      if (buyWork(s, hermes.id, []).ok) {
        log('hermes bought');
        continue;
      }
    }
    const tracks: LevelTrack[] = ['production', 'strength', 'impact'];
    const options = tracks
      .filter((t) => t !== 'strength' || strengthLevelEffective(s, site, site.strengthLevel))
      .map((t) => ({ t, cost: bulkCost(s, site, t, 1) }))
      .filter((o) => o.cost && s.empire.sites[0].purse.gte(o.cost))
      .sort((a, b) => a.cost!.cmp(b.cost!));
    if (!options.length) return;
    buyLevels(s, site.id, options[0].t, 1, []);
  }
}

function playFirstSession(seconds: number, glanceEvery: number) {
  const s = freshState();
  const timeline: { t: number; what: string }[] = [];
  const at = (t: number) => (what: string) => timeline.push({ t, what });
  const dt = 0.05;
  let nextGlance = 0;
  for (let t = 0; t < seconds; t += dt) {
    const events: GameEvent[] = [];
    stepSites(s, dt, ctx({ manualHeld: true, events }));
    for (const e of events) {
      if (e.type === 'StoneSlipped' && e.record) at(t)(`new height ${Math.round(e.height * 100)}%`);
      if (e.type === 'PreludeCompleted') at(t)('FIRST SUMMIT');
      if (e.type === 'MilestoneReached') at(t)(`level ${e.level} (×2)`);
    }
    if (t >= nextGlance) {
      const before = s.empire.sites[0].productionLevel;
      buyWhatMakesSense(s, at(t));
      const after = s.empire.sites[0].productionLevel;
      for (const m of catalog.levels.milestones) if (before < m && after >= m) at(t)(`level ${m} (×2)`);
      if (before < catalog.automation.foremanUnlockLevel && after >= catalog.automation.foremanUnlockLevel) at(t)('foreman unlocked');
      nextGlance = t + glanceEvery;
    }
  }
  const first = (what: string) => timeline.find((e) => e.what === what)?.t ?? Infinity;
  return { s, timeline, first };
}

const mmss = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;

describe('first-session pacing', () => {
  const run = playFirstSession(15 * 60, 3);

  const env = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env;
  if (env?.PACING) {
    console.log(run.timeline.map((e) => `${mmss(e.t).padStart(5)}  ${e.what}`).join('\n'));
  }

  it('fails a handful of times before the first summit, which lands in about 1.5–3 minutes', () => {
    expect(run.s.prelude.attempts).toBeGreaterThanOrEqual(5);
    expect(run.s.prelude.attempts).toBeLessThanOrEqual(12);
    const summit = run.first('FIRST SUMMIT');
    expect(summit).toBeGreaterThan(75);
    expect(summit).toBeLessThan(180);
  });

  it('keeps Sisyphus hands-on for several minutes before any automation', () => {
    expect(run.first('flywheel bought')).toBeGreaterThan(150);
    // A scripted player; people who read and hesitate land roughly 1.5× later.
    expect(run.first('foreman hired')).toBeGreaterThan(270);
    expect(run.first('foreman hired')).toBeLessThan(600);
  });

  it('never goes more than ~2 minutes without a big moment in the first 10', () => {
    const big = run.timeline
      .filter((e) => /SUMMIT|level \d+|flywheel|foreman|hermes|grip/.test(e.what))
      .map((e) => e.t)
      .filter((t) => t <= 600);
    const gaps = [big[0], ...big.slice(1).map((t, i) => t - big[i])];
    expect(Math.max(...gaps)).toBeLessThan(150);
  });
});
