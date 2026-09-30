import { writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { catalog } from '../src/content/catalog';
import { playAppeals, report } from './bot';
import { freshState } from './helpers';

/**
 * The Appeals after the first Charter (docs/hill-workshops-plan.md Phase 9),
 * played by the daily bot straight on from its campaign: Insight spent on the
 * upgrades and the memory, Begin Again when it pays. It plays about a year of
 * game time and takes minutes, so it runs only on request:
 * APPEALS=path/to/timeline.txt npx vitest run tests/appeals-campaign.test.ts
 */
describe.skipIf(!process.env.APPEALS)('length: the Appeals', { timeout: 1_200_000 }, () => {
  it('measures Appeals 1 to 10', () => {
    const t0 = Date.now();
    // Tuning runs: APPEALS_TUNE=gateGrowth,workGrowth,payGrowth,laurelMultiplier overrides the economy.
    if (process.env.APPEALS_TUNE) {
      const [gateGrowth, workGrowth, payGrowth, laurelMultiplier] = process.env.APPEALS_TUNE.split(',').map(Number);
      Object.assign(catalog.appeals, { gateGrowth, workGrowth, payGrowth, laurelMultiplier });
    }
    // APPEALS_SCORN=baseCost,costGrowth,payMultiplier overrides Scorn.
    if (process.env.APPEALS_SCORN) {
      const [baseCost, costGrowth, payMultiplier] = process.env.APPEALS_SCORN.split(',').map(Number);
      Object.assign(catalog.scorn, { baseCost, costGrowth, payMultiplier });
    }
    const appealGain = process.env.APPEALS_GAIN ? Number(process.env.APPEALS_GAIN) : undefined;
    const run = playAppeals(freshState(), { resets: 'gain', appeals: Number(process.env.APPEALS_N ?? 10), daysEach: 120, appealGain });
    const DAY = 86400;
    if (process.env.APPEALS) {
      const lines = [`wall ${((Date.now() - t0) / 1000).toFixed(0)} s`];
      run.laurels.forEach((t, i) => {
        const from = i === 0 ? 0 : run.appealed[i - 1];
        const resets = run.log.filter((e) => e.what.startsWith('begin again') && e.t > from && e.t <= t).length;
        lines.push(`charter ${i === 0 ? 'original' : `appeal ${i}`}: day ${(t / DAY).toFixed(1)} (took ${((t - from) / DAY).toFixed(1)} days, ${resets} resets)`);
      });
      if (run.laurels.length <= run.appealed.length) lines.push(`appeal ${run.appealed.length}: no Charter within the limit`);
      lines.push(...run.log.filter((e) => (e.what.startsWith('laurel') || e.what.startsWith('begin again') || (e.what.startsWith('insight') && !e.what.startsWith('insight summon')))).map((e) => `  day ${(e.t / DAY).toFixed(1)} ${e.what}`));
      writeFileSync(process.env.APPEALS, lines.join('\n') + '\n');
      report('appeals', run, 'd');
    }
    expect(run.laurels.length).toBeGreaterThan(1);
  });
});
