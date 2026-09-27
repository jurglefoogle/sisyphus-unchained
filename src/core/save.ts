import { catalog } from '../content/catalog';
import { Money } from './money';
import { DEFAULT_OPTIONS, SCHEMA_VERSION, type CycleSnapshot, type GameState, type SiteState } from './state';

export const SAVE_FORMAT = 'sisyphus-unchained-save';

type Json = null | boolean | number | string | Json[] | { [k: string]: Json };

/** FNV-1a. Detects accidental corruption; it is not anticheat. */
export function checksum(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

function snapshotToJson(s: CycleSnapshot): Json {
  return {
    summit: s.summit.serialize(),
    impact: s.impact.serialize(),
    bonus: s.bonus.serialize(),
    bonusTargetId: s.bonusTargetId,
    summitGranted: s.summitGranted,
    impactGranted: s.impactGranted,
    slipHeight: s.slipHeight,
  };
}

export function stateToJson(state: GameState): Json {
  return {
    schemaVersion: state.schemaVersion,
    contentVersion: state.contentVersion,
    revision: state.revision,
    saveId: state.saveId,
    lastSettledUtc: state.lastSettledUtc,
    paused: state.paused,
    wallet: {
      obols: state.wallet.obols.serialize(),
      runGross: state.wallet.runGross.serialize(),
      bestRunGross: state.wallet.bestRunGross.serialize(),
    },
    prelude: {
      complete: state.prelude.complete,
      upgradeIds: [...state.prelude.upgradeIds],
      bestHeight: state.prelude.bestHeight,
      attempts: state.prelude.attempts,
    },
    prestige: {
      lifetimeInsightAwarded: state.prestige.lifetimeInsightAwarded,
      insightSpent: state.prestige.insightSpent,
      permanentUpgradeIds: [...state.prestige.permanentUpgradeIds],
    },
    empire: {
      foremanOwned: state.empire.foremanOwned,
      selectedSiteId: state.empire.selectedSiteId,
      sites: state.empire.sites.map((s) => ({
        id: s.id,
        productionLevel: s.productionLevel,
        strengthLevel: s.strengthLevel,
        impactLevel: s.impactLevel,
        wheelOwned: s.wheelOwned,
        wheelCharged: s.wheelCharged,
        phase: s.phase,
        phaseProgress: s.phaseProgress,
        cycleIndex: s.cycleIndex,
        snapshot: snapshotToJson(s.snapshot),
      })),
      purchasedWorkIds: [...state.empire.purchasedWorkIds],
      offeredSiteIds: [...state.empire.offeredSiteIds],
    },
    discoveries: {
      seenWorkIds: [...state.discoveries.seenWorkIds],
      relicIds: [...state.discoveries.relicIds],
      seenStoryIds: [...state.discoveries.seenStoryIds],
      archiveIds: [...state.discoveries.archiveIds],
      achievementIds: [...state.discoveries.achievementIds],
      tutorialIds: [...state.discoveries.tutorialIds],
    },
    counters: { ...state.counters },
    random: { ...state.random },
    options: { ...state.options },
  };
}

export function serializeSave(state: GameState): string {
  const data = stateToJson(state);
  const body = JSON.stringify(data);
  return JSON.stringify({ format: SAVE_FORMAT, checksum: checksum(body), data: JSON.parse(body) });
}

export type LoadResult = { ok: true; state: GameState; migratedFrom?: number } | { ok: false; error: string };

// ------------------------------------------------------------- validation

class SaveError extends Error {}

function req(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new SaveError(msg);
}

function obj(v: unknown, path: string): Record<string, unknown> {
  req(v !== null && typeof v === 'object' && !Array.isArray(v), `${path} must be an object`);
  return v as Record<string, unknown>;
}

function num(v: unknown, path: string, min = -Infinity, max = Infinity): number {
  req(typeof v === 'number' && Number.isFinite(v), `${path} must be a finite number`);
  req((v as number) >= min && (v as number) <= max, `${path} out of range`);
  return v as number;
}

function int(v: unknown, path: string, min: number, max: number): number {
  const n = num(v, path, min, max);
  req(Number.isInteger(n), `${path} must be an integer`);
  return n;
}

function bool(v: unknown, path: string): boolean {
  req(typeof v === 'boolean', `${path} must be boolean`);
  return v as boolean;
}

function str(v: unknown, path: string): string {
  req(typeof v === 'string', `${path} must be a string`);
  return v as string;
}

function money(v: unknown, path: string): Money {
  const s = str(v, path);
  let m: Money;
  try {
    m = Money.of(s);
  } catch {
    throw new SaveError(`${path} is not a number`);
  }
  req(!m.isNegative(), `${path} must not be negative`);
  return m;
}

function idList(v: unknown, path: string, known?: Set<string>): string[] {
  req(Array.isArray(v), `${path} must be an array`);
  const list = (v as unknown[]).map((x, i) => str(x, `${path}[${i}]`));
  req(new Set(list).size === list.length, `${path} has duplicates`);
  if (known) for (const id of list) req(known.has(id), `${path} has unknown id ${id}`);
  return list;
}

const SITE_IDS = new Set(catalog.sites.map((s) => s.id));
const WORK_IDS = new Set(catalog.works.map((w) => w.id));
const RELIC_IDS = new Set(catalog.relics.catalog.map((r) => r.id));
const UPGRADE_IDS = new Set(catalog.insightUpgrades.map((u) => u.id));
const TARGET_IDS = new Set([...catalog.bonusTargets.map((t) => t.id), 'expected']);
const PRELUDE_IDS = new Set(catalog.prelude.upgrades.map((u) => u.id));
const PHASES = new Set(['ascending', 'descending', 'returning', 'slipping']);

function parseSite(v: unknown, path: string): SiteState {
  const o = obj(v, path);
  const id = str(o.id, `${path}.id`);
  req(SITE_IDS.has(id), `${path}.id unknown`);
  const phase = str(o.phase, `${path}.phase`);
  req(PHASES.has(phase), `${path}.phase invalid`);
  const snap = obj(o.snapshot, `${path}.snapshot`);
  const bonusTargetId = str(snap.bonusTargetId, `${path}.snapshot.bonusTargetId`);
  req(TARGET_IDS.has(bonusTargetId), `${path}.snapshot.bonusTargetId unknown`);
  const L = catalog.levels;
  return {
    id,
    productionLevel: int(o.productionLevel, `${path}.productionLevel`, 1, L.productionCap),
    strengthLevel: int(o.strengthLevel, `${path}.strengthLevel`, 0, L.strengthCap),
    impactLevel: int(o.impactLevel, `${path}.impactLevel`, 0, L.impactCap),
    wheelOwned: bool(o.wheelOwned, `${path}.wheelOwned`),
    wheelCharged: bool(o.wheelCharged, `${path}.wheelCharged`),
    phase: phase as SiteState['phase'],
    phaseProgress: num(o.phaseProgress, `${path}.phaseProgress`, 0, 60),
    cycleIndex: int(o.cycleIndex, `${path}.cycleIndex`, 0, Number.MAX_SAFE_INTEGER),
    snapshot: {
      summit: money(snap.summit, `${path}.snapshot.summit`),
      impact: money(snap.impact, `${path}.snapshot.impact`),
      bonus: money(snap.bonus, `${path}.snapshot.bonus`),
      bonusTargetId,
      summitGranted: bool(snap.summitGranted, `${path}.snapshot.summitGranted`),
      impactGranted: bool(snap.impactGranted, `${path}.snapshot.impactGranted`),
      slipHeight: num(snap.slipHeight, `${path}.snapshot.slipHeight`, 0, 1),
    },
  };
}

/** Builds a GameState from current-schema JSON, validating every field. */
export function stateFromJson(data: unknown): GameState {
  const d = obj(data, 'save');
  const wallet = obj(d.wallet, 'wallet');
  const prestige = obj(d.prestige, 'prestige');
  const empire = obj(d.empire, 'empire');
  const disc = obj(d.discoveries, 'discoveries');
  const counters = obj(d.counters, 'counters');
  const random = obj(d.random, 'random');
  const options = obj(d.options ?? {}, 'options');
  const prelude = obj(d.prelude, 'prelude');
  const preludeIds = idList(prelude.upgradeIds, 'prelude.upgradeIds', PRELUDE_IDS);
  const inOrder = catalog.prelude.upgrades.slice(0, preludeIds.length).map((u) => u.id);
  req(inOrder.every((id, i) => preludeIds[i] === id), 'prelude upgrades out of sequence');

  const sites = (() => {
    req(Array.isArray(empire.sites), 'empire.sites must be an array');
    return (empire.sites as unknown[]).map((s, i) => parseSite(s, `empire.sites[${i}]`));
  })();
  req(sites.length > 0 && sites[0].id === catalog.sites[0].id, 'the first site must be owned');
  req(new Set(sites.map((s) => s.id)).size === sites.length, 'duplicate sites');
  const selectedSiteId = str(empire.selectedSiteId, 'empire.selectedSiteId');
  req(sites.some((s) => s.id === selectedSiteId), 'selected site not owned');

  const upgrades = idList(prestige.permanentUpgradeIds, 'prestige.permanentUpgradeIds', UPGRADE_IDS);
  const ordered = catalog.insightUpgrades.slice(0, upgrades.length).map((u) => u.id);
  req(ordered.every((id) => upgrades.includes(id)), 'permanent upgrades out of sequence');

  const lifetime = int(prestige.lifetimeInsightAwarded, 'prestige.lifetimeInsightAwarded', 0, 1e12);
  const spent = int(prestige.insightSpent, 'prestige.insightSpent', 0, lifetime);

  const eligible = random.eligibleSiteId;
  req(eligible === null || (typeof eligible === 'string' && SITE_IDS.has(eligible)), 'random.eligibleSiteId invalid');
  const countdown = random.relicCountdown;
  req(countdown === null || (Number.isInteger(countdown) && (countdown as number) >= 0), 'relicCountdown invalid');

  return {
    schemaVersion: SCHEMA_VERSION,
    contentVersion: str(d.contentVersion, 'contentVersion'),
    revision: int(d.revision, 'revision', 0, Number.MAX_SAFE_INTEGER),
    saveId: str(d.saveId, 'saveId'),
    lastSettledUtc: num(d.lastSettledUtc, 'lastSettledUtc', 0),
    paused: bool(d.paused, 'paused'),
    wallet: {
      obols: money(wallet.obols, 'wallet.obols'),
      runGross: money(wallet.runGross, 'wallet.runGross'),
      bestRunGross: money(wallet.bestRunGross, 'wallet.bestRunGross'),
    },
    prelude: {
      complete: bool(prelude.complete, 'prelude.complete'),
      upgradeIds: preludeIds,
      bestHeight: num(prelude.bestHeight, 'prelude.bestHeight', 0, 1),
      attempts: int(prelude.attempts, 'prelude.attempts', 0, Number.MAX_SAFE_INTEGER),
    },
    prestige: { lifetimeInsightAwarded: lifetime, insightSpent: spent, permanentUpgradeIds: upgrades },
    empire: {
      foremanOwned: bool(empire.foremanOwned, 'empire.foremanOwned'),
      selectedSiteId,
      sites,
      purchasedWorkIds: idList(empire.purchasedWorkIds, 'empire.purchasedWorkIds', WORK_IDS),
      offeredSiteIds: idList(empire.offeredSiteIds, 'empire.offeredSiteIds', SITE_IDS),
    },
    discoveries: {
      seenWorkIds: idList(disc.seenWorkIds, 'discoveries.seenWorkIds', WORK_IDS),
      relicIds: idList(disc.relicIds, 'discoveries.relicIds', RELIC_IDS),
      seenStoryIds: idList(disc.seenStoryIds, 'discoveries.seenStoryIds'),
      archiveIds: idList(disc.archiveIds, 'discoveries.archiveIds'),
      achievementIds: idList(disc.achievementIds, 'discoveries.achievementIds'),
      tutorialIds: idList(disc.tutorialIds, 'discoveries.tutorialIds'),
    },
    counters: {
      totalClimbs: int(counters.totalClimbs, 'counters.totalClimbs', 0, Number.MAX_SAFE_INTEGER),
      totalImpacts: int(counters.totalImpacts, 'counters.totalImpacts', 0, Number.MAX_SAFE_INTEGER),
      totalRuns: int(counters.totalRuns, 'counters.totalRuns', 0, Number.MAX_SAFE_INTEGER),
      totalActiveSeconds: num(counters.totalActiveSeconds, 'counters.totalActiveSeconds', 0),
      highestSiteEver: int(counters.highestSiteEver, 'counters.highestSiteEver', 0, catalog.sites.length - 1),
    },
    random: {
      coinRngState: int(random.coinRngState, 'random.coinRngState', 0, 0xffffffff),
      relicRngState: int(random.relicRngState, 'random.relicRngState', 0, 0xffffffff),
      relicCountdown: countdown as number | null,
      eligibleSiteId: eligible as string | null,
    },
    options: {
      toggleMode: typeof options.toggleMode === 'boolean' ? options.toggleMode : DEFAULT_OPTIONS.toggleMode,
      reducedMotion: typeof options.reducedMotion === 'boolean' ? options.reducedMotion : DEFAULT_OPTIONS.reducedMotion,
      ambientCaptions:
        typeof options.ambientCaptions === 'boolean' ? options.ambientCaptions : DEFAULT_OPTIONS.ambientCaptions,
      textScale: typeof options.textScale === 'number' ? Math.min(1.5, Math.max(0.85, options.textScale)) : 1,
      highContrast: typeof options.highContrast === 'boolean' ? options.highContrast : DEFAULT_OPTIONS.highContrast,
    },
  };
}

/**
 * Sequential migrations keyed by the schema version they upgrade FROM.
 * Released schemas must keep their entry and a fixture forever.
 */
const MIGRATIONS: Record<number, (data: Record<string, unknown>) => Record<string, unknown>> = {
  /** v2 adds the prelude. Saves that already reached a summit skip it. */
  1: (data) => {
    const disc = obj(data.discoveries, 'discoveries');
    const tutorials = Array.isArray(disc.tutorialIds) ? disc.tutorialIds : [];
    const done = tutorials.includes('first_summit');
    const empire = obj(data.empire, 'empire');
    const sites = Array.isArray(empire.sites) ? empire.sites : [];
    return {
      ...data,
      schemaVersion: 2,
      empire: {
        ...empire,
        sites: sites.map((site) => {
          const o = obj(site, 'site');
          return { ...o, snapshot: { ...obj(o.snapshot, 'site.snapshot'), slipHeight: 0 } };
        }),
      },
      prelude: {
        complete: done,
        upgradeIds: done ? catalog.prelude.upgrades.map((u) => u.id) : [],
        bestHeight: done ? 1 : 0,
        attempts: 0,
      },
    };
  },
};

export function deserializeSave(text: string): LoadResult {
  try {
    let envelope: unknown;
    try {
      envelope = JSON.parse(text);
    } catch {
      return { ok: false, error: 'The save file is not valid JSON (it may be truncated).' };
    }
    const env = obj(envelope, 'envelope');
    req(env.format === SAVE_FORMAT, 'Not a Sisyphus: Unchained save.');
    const body = JSON.stringify(env.data);
    req(checksum(body) === env.checksum, 'Checksum mismatch: the save is damaged.');
    let data = obj(env.data, 'data');
    const version = int(data.schemaVersion, 'schemaVersion', 1, Number.MAX_SAFE_INTEGER);
    req(version <= SCHEMA_VERSION, `This save uses a newer format (v${version}). Update the game to load it.`);
    for (let v = version; v < SCHEMA_VERSION; v++) {
      const step = MIGRATIONS[v];
      req(step, `No migration from schema v${v}.`);
      data = step(data);
    }
    const state = stateFromJson(data);
    return version < SCHEMA_VERSION ? { ok: true, state, migratedFrom: version } : { ok: true, state };
  } catch (e) {
    if (e instanceof SaveError) return { ok: false, error: e.message };
    return { ok: false, error: `Unexpected load failure: ${(e as Error).message}` };
  }
}
