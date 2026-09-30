import { describe, expect, it } from 'vitest';
import { catalog } from '../src/content/catalog';
import { charter, playBinge, playDaily, report, type Run } from './bot';
import { freshState } from './helpers';

/**
 * The length model (docs/pacing-study-2026-09-30.md, Pacing targets): the
 * Charter in two to three weeks for a daily player who buys levels that pay
 * back, and no less than about 40 hours for a binge
 * player. Set CAMPAIGN=1 to print the timelines.
 */

const DAY = 86400;
const opened = (run: Run, id: string) => run.log.find((e) => e.what === `open ${id}`)?.t ?? Infinity;

describe('length: the daily player', { timeout: 60_000 }, () => {
  const run = playDaily(freshState(), { resets: 'gain', days: 60 });
  report('daily, gain resets', run, 'd');

  it('hires the Foreman in the first session and opens the Tartarus Rim on day 1', () => {
    const foreman = run.log.find((e) => e.what === 'foreman')!.t;
    expect(foreman - 21 * 3600).toBeLessThan(45 * 60);
    expect(opened(run, 'tartarus_rim')).toBeLessThan(2 * DAY + 12 * 3600);
  });

  it('reaches the Charter in two to three weeks', () => {
    expect(charter(run.state)).toBe(true);
    expect(run.t).toBeGreaterThanOrEqual(14 * DAY);
    expect(run.t).toBeLessThanOrEqual(21 * DAY);
    expect(run.state.empire.sites).toHaveLength(catalog.sites.length);
  });

  it('never lets one absence move the story more than one decree', () => {
    for (const a of run.absences) expect(a.decrees.length).toBeLessThanOrEqual(1);
  });

  it('spaces the hills out across the weeks', () => {
    const days = catalog.sites.slice(1).map((s) => opened(run, s.id) / DAY);
    for (let i = 1; i < days.length; i++) expect(days[i]).toBeGreaterThan(days[i - 1] + 1);
  });
});

describe('length: the binge player', { timeout: 60_000 }, () => {
  it('is nowhere near the Charter after 40 hours of play', () => {
    const run = playBinge(freshState(), { resets: 'gain', limitHours: 40 });
    report('binge, gain resets', run);
    expect(charter(run.state)).toBe(false);
    // Presence buys decisions, not time: the frontier after 40 hours is still mid-campaign.
    expect(run.state.empire.sites.length).toBeLessThan(catalog.sites.length);
  });
});
