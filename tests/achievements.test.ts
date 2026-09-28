import { describe, expect, it } from 'vitest';
import { buildArchive } from '../src/app/archive';
import { ARCHIVE_SUBJECTS } from '../src/content/archive';
import { catalog } from '../src/content/catalog';
import { en } from '../src/content/strings';
import { ACHIEVEMENTS, reconcileAchievements } from '../src/core/achievements';
import { buyLevels } from '../src/core/commands';
import { Money } from '../src/core/money';
import { deserializeSave, serializeSave } from '../src/core/save';
import type { GameEvent } from '../src/core/state';
import { freshState, give, makeState, runFrames } from './helpers';

const unlocked = (events: GameEvent[]) => events.flatMap((e) => (e.type === 'AchievementUnlocked' ? [e.achievementId] : []));

describe('achievements', () => {
  it('defines the 24 launch achievements with names, descriptions and stamps', () => {
    expect(ACHIEVEMENTS).toHaveLength(24);
    expect(new Set(ACHIEVEMENTS.map((a) => a.id)).size).toBe(24);
    for (const a of ACHIEVEMENTS) {
      expect(en[`achievement.${a.id}`]).toBeTruthy();
      expect(en[`achievement.${a.id}.desc`]).toBeTruthy();
    }
  });

  it('grants nothing on a new save', () => {
    const events: GameEvent[] = [];
    expect(reconcileAchievements(freshState(), events)).toBe(0);
    expect(events).toEqual([]);
  });

  it('follows authoritative state and never grants twice', () => {
    const s = makeState();
    runFrames(s, 40, 30, true);
    give(s, 1e4);
    buyLevels(s, s.empire.selectedSiteId, 'production', 10, []);
    const events: GameEvent[] = [];
    reconcileAchievements(s, events);
    expect(unlocked(events)).toEqual(expect.arrayContaining(['first_summit', 'first_return', 'first_purchase', 'ten_levels']));
    const again: GameEvent[] = [];
    expect(reconcileAchievements(s, again)).toBe(0);
    expect(s.discoveries.achievementIds).toHaveLength(new Set(s.discoveries.achievementIds).size);
  });

  it('reconciles run Defiance thresholds missed while away', () => {
    const s = makeState();
    s.wallet.runGross = Money.of(2e9);
    const events: GameEvent[] = [];
    reconcileAchievements(s, events);
    expect(unlocked(events)).toEqual(expect.arrayContaining(['million', 'billion']));
    expect(unlocked(events)).not.toContain('trillion');
  });

  it('survives a save round trip, including after a reset clears the evidence', () => {
    const s = makeState();
    s.counters.totalClimbs = 1;
    reconcileAchievements(s, []);
    s.counters.totalClimbs = 0;
    const r = deserializeSave(serializeSave(s));
    expect(r.ok && r.state.discoveries.achievementIds).toContain('first_summit');
  });
});

describe('archive', () => {
  it('has the twelve subjects with bounded paraphrases and sources', () => {
    expect(ARCHIVE_SUBJECTS).toHaveLength(12);
    for (const s of ARCHIVE_SUBJECTS) {
      const words = s.body.split(/\s+/).length;
      expect(words, s.id).toBeGreaterThanOrEqual(35);
      expect(words, s.id).toBeLessThanOrEqual(60);
      expect(s.source.url).toMatch(/^https:\/\//);
    }
  });

  it('unlocks subjects as they appear in play', () => {
    const s = freshState();
    const before = buildArchive(s).subjects.filter((x) => x.unlocked).map((x) => x.id);
    expect(before.sort()).toEqual(['sisyphus', 'vase_painting']);
    s.discoveries.seenWorkIds.push('talos');
    const after = buildArchive(s).subjects.filter((x) => x.unlocked).map((x) => x.id);
    expect(after).toEqual(expect.arrayContaining(['talos', 'hephaestus', 'ichor']));
    expect(buildArchive(s).relics).toHaveLength(catalog.relics.catalog.length);
  });
});
