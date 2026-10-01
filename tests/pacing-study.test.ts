import { writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { catalog } from '../src/content/catalog';
import {
  bulkCost,
  empireIncomePerSecond,
  insightFactor,
  nextUnownedSite,
  steadyIncomePerSecond,
  strengthLevelEffective,
  tabletCost,
  tabletLevel,
  unlockCostOf,
  workCostOf,
  type LevelTrack,
} from '../src/core/formulas';
import type { Money } from '../src/core/money';
import type { GameState } from '../src/core/state';
import { charter, owned, playAppeals, playBinge, playDaily, setPayback, watch, type Run } from './bot';
import { freshState } from './helpers';

/**
 * The pacing study (docs/pacing-study-2026-09-30.md): the daily, binge and
 * Appeals bots, watched glance by glance. Measures what a player feels:
 * purchases per session, the wait between purchases while present, what a
 * return buys, the time to the next purchase, growth per day, and how fast
 * each Begin Again catches up.
 * Run on request: STUDY=out.txt npx vitest run tests/pacing-study.test.ts
 * (STUDY_APPEALS=1 also plays ten Appeals, several minutes; STUDY_PATIENT=1
 * plays the old saver who hoards for each goal instead of buying levels that
 * pay back before it).
 */

const out = process.env.STUDY;
const DAY = 86400;

/**
 * Time to next purchase: the shortest wait, over the hills the player runs, until its purse
 * covers the cheapest thing on offer there (a level, a tablet, a work, the
 * next hill). Zero if something is affordable now.
 */
function nextPurchase(s: GameState): { wait: number; what: string } {
  let best = { wait: Infinity, what: 'nothing' };
  const next = nextUnownedSite(s);
  // Hills with a steward run themselves; the player shops the others.
  for (const site of s.empire.sites.filter((x) => !x.steward)) {
    const income = steadyIncomePerSecond(s, site);
    const offers: [Money | null, string][] = [];
    for (const track of ['production', 'strength', 'impact'] as LevelTrack[]) {
      // Strength past what the hill can use is on sale but buys nothing.
      if (track === 'strength' && !strengthLevelEffective(s, site, site.strengthLevel)) continue;
      offers.push([bulkCost(s, site, track, 1), `${track} ${site.id}`]);
    }
    site.hand.forEach((id, i) => {
      if (!site.devices.includes(id) && site.productionLevel >= tabletLevel(i)) offers.push([tabletCost(s, site, i), `tablet ${site.id}`]);
    });
    for (const w of catalog.works) {
      if (w.siteId === site.id && !s.empire.purchasedWorkIds.includes(w.id) && site.productionLevel >= w.requiredLevel) offers.push([workCostOf(s, w), `work ${w.id}`]);
    }
    if (next && s.empire.offeredSiteIds.includes(next.id) && catalog.sites[next.index - 1].id === site.id) offers.push([unlockCostOf(s, next), `open ${next.id}`]);
    for (const [cost, what] of offers) {
      if (!cost) continue;
      const short = cost.sub(site.purse);
      const wait = short.lte(0) ? 0 : income.gt(0) ? short.div(income).toNumber() : Infinity;
      if (wait < best.wait) best = { wait, what };
    }
  }
  return best;
}

const lg = (s: GameState) => {
  const x = empireIncomePerSecond(s);
  return x.gt(0) ? x.log10() : 0;
};

interface Session {
  start: number;
  away: number;
  onReturn: number;
  during: number;
  /** Seconds between glances that bought something, while present. */
  gaps: number[];
  /** Present time after the last purchase of the session. */
  tail: number;
  /** Time to next purchase at the end of the session, and what it was. */
  ttnp: number;
  waitingFor: string;
  end: number;
  income: number;
  gross: number;
  hills: number;
  runs: number;
  appeal: number;
}

const blank = (start: number, away: number): Session => ({
  start,
  away,
  onReturn: 0,
  during: 0,
  gaps: [],
  tail: 0,
  ttnp: 0,
  waitingFor: '',
  end: start,
  income: 0,
  gross: 0,
  hills: 0,
  runs: 0,
  appeal: 0,
});

interface Reset {
  t: number;
  runLength: number;
  gross: number;
  factorBefore: number;
  factorAfter: number;
  catchUp: number | null;
}

function observe() {
  const sessions: Session[] = [];
  const resets: Reset[] = [];
  const glances: { t: number; bought: number; income: number }[] = [];
  let prev = 0;
  let lastBuy = 0;
  let sessionEnd = 0;
  let runStart = 0;
  let ttnpAt = -Infinity;
  let chase: { target: number; from: number; reset: Reset } | null = null;
  let current: Session | null = null;

  const close = () => {
    if (!current) return;
    current.end = sessionEnd;
    current.tail = Math.max(0, sessionEnd - Math.max(lastBuy, current.start));
    sessions.push(current);
    current = null;
  };
  const record = (run: Run) => {
    if (!current) return;
    const s = run.state;
    current.income = lg(s);
    current.gross = s.wallet.runGross.gt(0) ? s.wallet.runGross.log10() : 0;
    current.hills = s.empire.sites.length;
    current.runs = s.counters.totalRuns;
    current.appeal = s.appeal.number;
    // Pricing every offer is slow; once a minute of play is enough.
    if (run.t - ttnpAt >= 60) {
      const n = nextPurchase(s);
      current.ttnp = n.wait;
      current.waitingFor = n.what;
      ttnpAt = run.t;
    }
  };

  watch.glance = (run, when) => {
    const now = owned(run.state);
    const bought = Math.max(0, now - prev);
    prev = now;
    if (when === 'return') {
      close();
      current = blank(run.t, run.t - sessionEnd);
      current.onReturn = bought;
      lastBuy = run.t;
      ttnpAt = -Infinity;
    } else {
      if (!current) {
        current = blank(run.t, 0);
        lastBuy = run.t;
      }
      if (bought > 0) {
        current.during += bought;
        current.gaps.push(run.t - lastBuy);
        lastBuy = run.t;
      }
    }
    sessionEnd = run.t;
    record(run);
    glances.push({ t: run.t, bought, income: lg(run.state) });
    if (chase && run.state.wallet.runGross.log10() >= chase.target) {
      chase.reset.catchUp = run.t - chase.from;
      chase = null;
    }
  };
  watch.beforeReset = (run) => {
    const s = run.state;
    const gross = s.wallet.runGross.log10();
    const r: Reset = { t: run.t, runLength: run.t - runStart, gross, factorBefore: insightFactor(s.prestige.lifetimeInsightAwarded), factorAfter: 0, catchUp: null };
    resets.push(r);
    chase = { target: gross, from: run.t, reset: r };
  };
  watch.afterReset = (run) => {
    resets[resets.length - 1].factorAfter = insightFactor(run.state.prestige.lifetimeInsightAwarded);
    prev = owned(run.state);
    runStart = run.t;
  };
  return {
    sessions,
    resets,
    glances,
    finish() {
      close();
      watch.glance = watch.beforeReset = watch.afterReset = undefined;
    },
  };
}

const median = (xs: number[]) => {
  if (!xs.length) return 0;
  const a = [...xs].sort((x, y) => x - y);
  return a[Math.floor(a.length / 2)];
};
const pct = (xs: number[], p: number) => {
  if (!xs.length) return 0;
  const a = [...xs].sort((x, y) => x - y);
  return a[Math.min(a.length - 1, Math.floor(a.length * p))];
};
const min = (s: number) => (s / 60).toFixed(1);
const hours = (s: number) => (Number.isFinite(s) ? (s / 3600).toFixed(1) : 'never');

function sessionTable(lines: string[], sessions: Session[], label: string) {
  lines.push(`\n== ${label}: every session`);
  lines.push('day    away h  on return  during  median gap m  max gap m  idle tail m  log income  log gross  hills  runs  appeal  next buy in h');
  for (const x of sessions) {
    lines.push(
      [
        (x.start / DAY).toFixed(2).padStart(6),
        (x.away / 3600).toFixed(1).padStart(6),
        String(x.onReturn).padStart(9),
        String(x.during).padStart(7),
        min(median(x.gaps)).padStart(13),
        min(Math.max(0, ...x.gaps)).padStart(10),
        min(x.tail).padStart(12),
        x.income.toFixed(1).padStart(11),
        x.gross.toFixed(1).padStart(10),
        String(x.hills).padStart(6),
        String(x.runs).padStart(5),
        String(x.appeal).padStart(7),
        `${hours(x.ttnp).padStart(8)}  ${x.waitingFor}`,
      ].join(' '),
    );
  }
}

function phaseTable(lines: string[], sessions: Session[], edges: number[], label: string) {
  lines.push(`\n== ${label}: by phase`);
  lines.push('days       sessions  buys/session  on return  median gap m  p90 gap m  idle tail m (median)  income ×/day  next buy h (median)');
  for (let i = 0; i < edges.length - 1; i++) {
    const [a, b] = [edges[i], edges[i + 1]];
    const xs = sessions.filter((x) => x.start / DAY >= a && x.start / DAY < b);
    if (!xs.length) continue;
    const gaps = xs.flatMap((x) => x.gaps);
    const buys = xs.map((x) => x.onReturn + x.during);
    const first = xs[0];
    const last = xs[xs.length - 1];
    const days = Math.max(0.5, (last.end - first.start) / DAY);
    const perDay = 10 ** ((last.income - first.income) / days);
    lines.push(
      [
        `${a}-${b}`.padEnd(10),
        String(xs.length).padStart(8),
        median(buys).toFixed(0).padStart(13),
        median(xs.map((x) => x.onReturn)).toFixed(0).padStart(10),
        min(median(gaps)).padStart(13),
        min(pct(gaps, 0.9)).padStart(10),
        min(median(xs.map((x) => x.tail))).padStart(21),
        perDay.toFixed(2).padStart(13),
        hours(median(xs.map((x) => x.ttnp))).padStart(20),
      ].join(' '),
    );
  }
}

function resetTable(lines: string[], resets: Reset[], label: string) {
  lines.push(`\n== ${label}: Begin Again`);
  lines.push('day    run length d  log gross  factor before → after  catch-up d  catch-up share');
  for (const r of resets) {
    lines.push(
      [
        (r.t / DAY).toFixed(2).padStart(6),
        (r.runLength / DAY).toFixed(2).padStart(12),
        r.gross.toFixed(1).padStart(10),
        `${r.factorBefore.toFixed(2)} → ${r.factorAfter.toFixed(2)}`.padStart(22),
        (r.catchUp === null ? 'never' : (r.catchUp / DAY).toFixed(2)).padStart(11),
        (r.catchUp === null ? '' : `${Math.round((100 * r.catchUp) / Math.max(1, r.runLength))}%`).padStart(15),
      ].join(' '),
    );
  }
}

describe.skipIf(!out)('pacing study', { timeout: 1_800_000 }, () => {
  it('measures the daily, binge and Appeals players', () => {
    const lines: string[] = [];
    setPayback(!process.env.STUDY_PATIENT);
    // What-if runs: STUDY_TUNE='{"levels":{"productionGrowth":1.15}}' overrides catalog sections.
    if (process.env.STUDY_TUNE) {
      const tune = JSON.parse(process.env.STUDY_TUNE) as Record<string, Record<string, unknown>>;
      for (const [k, v] of Object.entries(tune)) Object.assign((catalog as unknown as Record<string, object>)[k], v);
      lines.push(`tuned: ${process.env.STUDY_TUNE}`);
    }
    lines.push(process.env.STUDY_PATIENT ? 'players: patient savers' : 'players: payback savers');

    // The daily player, to the Charter.
    let o = observe();
    const daily = playDaily(freshState(), { resets: 'gain', days: 60 });
    o.finish();
    lines.push(`daily: charter ${charter(daily.state)} on day ${(daily.t / DAY).toFixed(1)}, played ${(daily.played / 3600).toFixed(1)} h, ${daily.state.counters.totalRuns} resets`);
    for (const e of daily.log.filter((x) => x.what.startsWith('open') || x.what.startsWith('work') || x.what === 'foreman')) {
      lines.push(`  day ${(e.t / DAY).toFixed(2)}  ${e.what}`);
    }
    sessionTable(lines, o.sessions, 'daily');
    phaseTable(lines, o.sessions, [0, 1, 2, 4, 7, 11, 15, 20, 25, 31], 'daily');
    resetTable(lines, o.resets, 'daily');

    // The binge player: the first ten hours.
    o = observe();
    const binge = playBinge(freshState(), { resets: 'gain', limitHours: 10 });
    const g = o.glances;
    o.finish();
    lines.push('\n== binge: first ten hours (ten-minute steps for the first two)');
    lines.push('hour   buys  glances with a buy  longest wait m  log income');
    const steps: [number, number][] = [];
    for (let h = 0; h < 2 - 1e-9; h += 1 / 6) steps.push([h, h + 1 / 6]);
    for (let h = 2; h < 10; h += 0.5) steps.push([h, h + 0.5]);
    for (const [h, e] of steps) {
      const xs = g.filter((x) => x.t >= h * 3600 && x.t < e * 3600);
      const hits = xs.filter((x) => x.bought > 0).map((x) => x.t);
      let wait = 0;
      let last = h * 3600;
      for (const t of hits) {
        wait = Math.max(wait, t - last);
        last = t;
      }
      wait = Math.max(wait, e * 3600 - last);
      const inc = xs.length ? xs[xs.length - 1].income.toFixed(1) : '';
      lines.push(`${h.toFixed(2).padStart(5)}  ${String(xs.reduce((a, x) => a + x.bought, 0)).padStart(5)}  ${String(hits.length).padStart(18)}  ${min(wait).padStart(14)}  ${inc.padStart(10)}`);
    }
    resetTable(lines, o.resets, 'binge');
    const bn = nextPurchase(binge.state);
    const bingeOpens = binge.log.filter((e) => e.what.startsWith('open') || e.what === 'begin again' || e.what.startsWith('begin again'));
    lines.push(`binge opens: ${bingeOpens.map((e) => `${e.what.replace('open ', '')} ${(e.t / 3600).toFixed(1)} h`).join(', ') || 'none'}`);
    lines.push(`binge after 10 h: ${binge.state.empire.sites.length} hills, log gross ${binge.state.wallet.runGross.log10().toFixed(1)}, ${binge.state.counters.totalRuns} resets, next buy in ${hours(bn.wait)} h (${bn.what})`);

    if (process.env.STUDY_APPEALS) {
      o = observe();
      const appeals = playAppeals(freshState(), { resets: 'gain', appeals: 10, daysEach: 120 });
      o.finish();
      lines.push(`\nappeals: ${appeals.laurels.length - 1} won by day ${(appeals.t / DAY).toFixed(1)}`);
      const after = o.sessions.filter((x) => x.start >= appeals.laurels[0]);
      const edges = appeals.laurels.map((t) => Math.floor(t / DAY));
      phaseTable(lines, after, [...edges, Math.ceil(appeals.t / DAY) + 1], 'appeals (one row per Appeal)');
      sessionTable(lines, after.filter((_, i) => i % 6 === 0), 'appeals (every sixth session)');
      resetTable(lines, o.resets.filter((r) => r.t >= appeals.laurels[0]), 'appeals');
    }

    setPayback(true);
    writeFileSync(out!, lines.join('\n') + '\n');
    expect(charter(daily.state)).toBe(true);
  });
});
