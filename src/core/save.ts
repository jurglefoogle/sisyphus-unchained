import { catalog } from '../content/catalog';
import { deviceDef, EDICTS, isDevice, tabletPool, WHISPERS } from '../content/devices';
import { closeRun } from './commands';
import { furnaceSite, newFurnace } from './furnace';
import { jarSite, newJar } from './jar';
import { foundrySite, newFoundry } from './foundry';
import { isConstellation, newSky, skySite } from './sky';
import { bureauSite, newBureau } from './bureau';
import { dealHand } from './seals';
import { Money } from './money';
import { DEFAULT_OPTIONS, SCHEMA_VERSION, type CycleSnapshot, type BureauState, type FoundryState, type FurnaceState, type SkyState, type GameState, type JarState, type SiteState } from './state';

export const SAVE_FORMAT = 'sisyphus-unchained-save';

type Json = null | boolean | number | string | Json[] | { [k: string]: Json };

const volume = (v: unknown, fallback: number): number =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : fallback;

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
    pausedAtUtc: state.pausedAtUtc,
    pinnedGoal: state.pinnedGoal,
    wallet: {
      runGross: state.wallet.runGross.serialize(),
      bestRunGross: state.wallet.bestRunGross.serialize(),
    },
    prelude: {
      complete: state.prelude.complete,
      upgradeIds: [...state.prelude.upgradeIds],
      bestHeight: state.prelude.bestHeight,
      attempts: state.prelude.attempts,
    },
    records: { ...state.records, charterSeconds: { ...state.records.charterSeconds } },
    appeal: { ...state.appeal },
    prestige: {
      lifetimeInsightAwarded: state.prestige.lifetimeInsightAwarded,
      giftedInsight: state.prestige.giftedInsight,
      insightSpent: state.prestige.insightSpent,
      permanentUpgradeIds: [...state.prestige.permanentUpgradeIds],
      remembrances: { ...state.prestige.remembrances },
      fileSlots: [...state.prestige.fileSlots],
      filed: { ...state.prestige.filed },
    },
    empire: {
      foremanOwned: state.empire.foremanOwned,
      selectedSiteId: state.empire.selectedSiteId,
      sites: state.empire.sites.map((s) => ({
        id: s.id,
        purse: s.purse.serialize(),
        gross: s.gross.serialize(),
        steward: s.steward ? { reinvest: s.steward.reinvest, paidWith: s.steward.paidWith } : null,
        productionLevel: s.productionLevel,
        strengthLevel: s.strengthLevel,
        impactLevel: s.impactLevel,
        wheelOwned: s.wheelOwned,
        wheelCharged: s.wheelCharged,
        counterweight: s.counterweight,
        furnace: s.furnace ? { ...s.furnace } : null,
        jar: s.jar ? { ...s.jar } : null,
        foundry: s.foundry
          ? { ...s.foundry, queue: [...s.foundry.queue], bronze: s.foundry.bronze.toString(), gallery: s.foundry.gallery.toString() }
          : null,
        sky: s.sky ? { ...s.sky, houses: [...s.sky.houses] } : null,
        bureau: s.bureau ? { ...s.bureau } : null,
        hand: [...s.hand],
        peeked: [...s.peeked],
        summoned: s.summoned,
        trial: s.trial,
        devices: [...s.devices],
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
      codexIds: [...state.discoveries.codexIds],
      whisperIds: [...state.discoveries.whisperIds],
      rumourIds: [...state.discoveries.rumourIds],
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

export type LoadResult =
  | {
      ok: true;
      state: GameState;
      migratedFrom?: number;
      /** Schema 3 closed a multi-hill run (one shared purse cannot be split): the Insight it paid. */
      renegotiated?: number;
    }
  | { ok: false; error: string };

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
const WHISPER_IDS = new Set(WHISPERS.map((w) => w.id));

function furnaceFrom(v: unknown, path: string): FurnaceState {
  const f = obj(v, path);
  return {
    heat: num(f.heat, `${path}.heat`, 0, 1),
    erupting: int(f.erupting, `${path}.erupting`, 0, 1000),
    power: num(f.power, `${path}.power`, 1),
    eruptions: int(f.eruptions, `${path}.eruptions`, 0, Number.MAX_SAFE_INTEGER),
    ventAt: num(f.ventAt, `${path}.ventAt`, 0, 1),
  };
}

function jarFrom(v: unknown, path: string): JarState {
  const j = obj(v, path);
  return {
    level: num(j.level, `${path}.level`, 0, 1),
    holes: int(j.holes, `${path}.holes`, 1, catalog.jar.maxHoles),
    peak: num(j.peak, `${path}.peak`, 0, 1),
    spilled: num(j.spilled, `${path}.spilled`, 0),
    factor: num(j.factor, `${path}.factor`, 0),
    target: num(j.target, `${path}.target`, 0, 1),
    streak: int(j.streak, `${path}.streak`, 0, Number.MAX_SAFE_INTEGER),
  };
}

function foundryFrom(v: unknown, path: string, siteId: string): FoundryState {
  const f = obj(v, path);
  return {
    split: num(f.split, `${path}.split`, 0, 1),
    queue: deviceList(f.queue, `${path}.queue`, siteId),
    bronze: money(f.bronze, `${path}.bronze`),
    finished: int(f.finished, `${path}.finished`, 0, 1000),
    paused: bool(f.paused, `${path}.paused`),
    gallery: money(f.gallery, `${path}.gallery`),
    pureStreak: int(f.pureStreak, `${path}.pureStreak`, 0, Number.MAX_SAFE_INTEGER),
    soldSince: bool(f.soldSince, `${path}.soldSince`),
    balancedClimbs: int(f.balancedClimbs, `${path}.balancedClimbs`, 0, Number.MAX_SAFE_INTEGER),
  };
}

function skyFrom(v: unknown, path: string): SkyState {
  const o = obj(v, path);
  const n = catalog.sky.houses;
  const raw = Array.isArray(o.houses) ? o.houses : [];
  const houses: (string | null)[] = [];
  for (let i = 0; i < n; i++) {
    const id = raw[i];
    // Unknown or duplicate ids leave the house dark rather than failing the load.
    houses.push(typeof id === 'string' && isDevice(id) && isConstellation(id) && !houses.includes(id) ? id : null);
  }
  return {
    houses,
    position: int(o.position, `${path}.position`, 0, n - 1),
    climbs: int(o.climbs, `${path}.climbs`, 0, 1000),
    cooldown: int(o.cooldown, `${path}.cooldown`, 0, 1000),
    streak: int(o.streak, `${path}.streak`, 0, Number.MAX_SAFE_INTEGER),
  };
}

function bureauFrom(v: unknown, path: string): BureauState {
  const o = obj(v, path);
  const hired = int(o.hired, `${path}.hired`, 0, 100000);
  const edict = typeof o.edict === 'string' && EDICTS.some((e) => e.id === o.edict) ? o.edict : null;
  return {
    backlog: num(o.backlog, `${path}.backlog`, 0),
    hired,
    onDuty: int(o.onDuty, `${path}.onDuty`, 0, hired),
    factor: num(o.factor, `${path}.factor`, 0),
    approved: num(o.approved, `${path}.approved`, 0),
    idle: int(o.idle, `${path}.idle`, 0, Number.MAX_SAFE_INTEGER),
    dueProcess: int(o.dueProcess, `${path}.dueProcess`, 0, 10000),
    edict,
    edictSeconds: edict ? num(o.edictSeconds, `${path}.edictSeconds`, 0) : 0,
    edictIndex: int(o.edictIndex, `${path}.edictIndex`, 0, Number.MAX_SAFE_INTEGER),
  };
}

/** Device ids this build knows for a hill; ids from removed content are dropped, not fatal. */
function deviceList(v: unknown, path: string, siteId: string): string[] {
  return idList(v, path).filter((id) => isDevice(id) && deviceDef(id).siteId === siteId);
}

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
  let steward: SiteState['steward'] = null;
  if (o.steward !== null && o.steward !== undefined) {
    const st = obj(o.steward, `${path}.steward`);
    const paidWith = str(st.paidWith, `${path}.steward.paidWith`);
    req(paidWith === 'local' || paidWith === 'insight', `${path}.steward.paidWith invalid`);
    steward = { reinvest: bool(st.reinvest, `${path}.steward.reinvest`), paidWith };
  }
  return {
    id,
    purse: money(o.purse, `${path}.purse`),
    gross: money(o.gross, `${path}.gross`),
    steward,
    productionLevel: int(o.productionLevel, `${path}.productionLevel`, 1, L.productionCap),
    strengthLevel: int(o.strengthLevel, `${path}.strengthLevel`, 0, L.strengthCap),
    impactLevel: int(o.impactLevel, `${path}.impactLevel`, 0, L.impactCap),
    wheelOwned: bool(o.wheelOwned, `${path}.wheelOwned`),
    wheelCharged: bool(o.wheelCharged, `${path}.wheelCharged`),
    counterweight: o.counterweight === null ? null : int(o.counterweight, `${path}.counterweight`, 0, catalog.counterweight.maxTrim),
    furnace: furnaceSite(id) ? furnaceFrom(o.furnace, `${path}.furnace`) : null,
    jar: jarSite(id) ? jarFrom(o.jar, `${path}.jar`) : null,
    foundry: foundrySite(id) ? foundryFrom(o.foundry, `${path}.foundry`, id) : null,
    sky: skySite(id) ? skyFrom(o.sky, `${path}.sky`) : null,
    bureau: bureauSite(id) ? bureauFrom(o.bureau, `${path}.bureau`) : null,
    hand: deviceList(o.hand, `${path}.hand`, id),
    devices: deviceList(o.devices, `${path}.devices`, id),
    peeked: deviceList(o.peeked, `${path}.peeked`, id),
    summoned: bool(o.summoned, `${path}.summoned`),
    trial: int(o.trial, `${path}.trial`, 0, Number.MAX_SAFE_INTEGER),
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

function recordsFrom(v: unknown): GameState['records'] {
  const o = obj(v, 'records');
  const clock = (x: unknown, path: string) => (x === null ? null : num(x, path, 0));
  const best = obj(o.charterSeconds, 'records.charterSeconds');
  const charterSeconds: Record<string, number> = {};
  for (const [k, x] of Object.entries(best)) {
    req(/^\d+$/.test(k), 'records.charterSeconds keys must be Appeal numbers');
    charterSeconds[k] = num(x, `records.charterSeconds.${k}`, 0);
  }
  return {
    runSeconds: clock(o.runSeconds, 'records.runSeconds'),
    campaignSeconds: clock(o.campaignSeconds, 'records.campaignSeconds'),
    firstCharterSeconds: clock(o.firstCharterSeconds, 'records.firstCharterSeconds'),
    charterSeconds,
  };
}

function appealFrom(v: unknown): GameState['appeal'] {
  const o = obj(v, 'appeal');
  const laurels = int(o.laurels, 'appeal.laurels', 0, 10000);
  return { number: int(o.number, 'appeal.number', 0, laurels + 1), laurels };
}

/** Remembrances and the files kept per hill; ids from removed content are dropped. */
function memoryFrom(prestige: Record<string, unknown>): Pick<GameState['prestige'], 'remembrances' | 'fileSlots' | 'filed'> {
  const ranks = obj(prestige.remembrances, 'prestige.remembrances');
  const remembrances: Record<string, number> = {};
  for (const [id, r] of Object.entries(ranks)) {
    if (SITE_IDS.has(id)) remembrances[id] = int(r, `prestige.remembrances.${id}`, 0, catalog.memory.remembranceCosts.length);
  }
  const files = obj(prestige.filed, 'prestige.filed');
  const filed: Record<string, string> = {};
  for (const [id, d] of Object.entries(files)) {
    if (typeof d === 'string' && tabletPool(id).some((x) => x.id === d)) filed[id] = d;
  }
  return { remembrances, fileSlots: idList(prestige.fileSlots, 'prestige.fileSlots', SITE_IDS), filed };
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
  const gifted = int(prestige.giftedInsight, 'prestige.giftedInsight', 0, 1e12);
  const spent = int(prestige.insightSpent, 'prestige.insightSpent', 0, lifetime + gifted);

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
    pausedAtUtc: d.pausedAtUtc === null ? null : num(d.pausedAtUtc, 'pausedAtUtc', 0),
    pinnedGoal: typeof d.pinnedGoal === 'string' && d.pinnedGoal.length <= 64 ? d.pinnedGoal : null,
    wallet: {
      runGross: money(wallet.runGross, 'wallet.runGross'),
      bestRunGross: money(wallet.bestRunGross, 'wallet.bestRunGross'),
    },
    prelude: {
      complete: bool(prelude.complete, 'prelude.complete'),
      upgradeIds: preludeIds,
      bestHeight: num(prelude.bestHeight, 'prelude.bestHeight', 0, 1),
      attempts: int(prelude.attempts, 'prelude.attempts', 0, Number.MAX_SAFE_INTEGER),
    },
    records: recordsFrom(d.records),
    appeal: appealFrom(d.appeal),
    prestige: { lifetimeInsightAwarded: lifetime, giftedInsight: gifted, insightSpent: spent, permanentUpgradeIds: upgrades, ...memoryFrom(prestige) },
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
      codexIds: idList(disc.codexIds, 'discoveries.codexIds').filter(isDevice),
      whisperIds: idList(disc.whisperIds, 'discoveries.whisperIds').filter((id) => WHISPER_IDS.has(id)),
      rumourIds: idList(disc.rumourIds, 'discoveries.rumourIds').filter((id) => WHISPER_IDS.has(id)),
    },
    counters: {
      totalClimbs: int(counters.totalClimbs, 'counters.totalClimbs', 0, Number.MAX_SAFE_INTEGER),
      totalImpacts: int(counters.totalImpacts, 'counters.totalImpacts', 0, Number.MAX_SAFE_INTEGER),
      totalRuns: int(counters.totalRuns, 'counters.totalRuns', 0, Number.MAX_SAFE_INTEGER),
      totalActiveSeconds: num(counters.totalActiveSeconds, 'counters.totalActiveSeconds', 0),
      highestSiteEver: int(counters.highestSiteEver, 'counters.highestSiteEver', 0, catalog.sites.length - 1),
      manualSummits: int(counters.manualSummits, 'counters.manualSummits', 0, Number.MAX_SAFE_INTEGER),
      fullEruptions: int(counters.fullEruptions, 'counters.fullEruptions', 0, Number.MAX_SAFE_INTEGER),
      atlasTurns: int(counters.atlasTurns, 'counters.atlasTurns', 0, Number.MAX_SAFE_INTEGER),
    },
    random: {
      coinRngState: int(random.coinRngState, 'random.coinRngState', 0, 0xffffffff),
      relicRngState: int(random.relicRngState, 'random.relicRngState', 0, 0xffffffff),
      dealRngState: int(random.dealRngState, 'random.dealRngState', 0, 0xffffffff),
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
      screenShake: typeof options.screenShake === 'boolean' ? options.screenShake : DEFAULT_OPTIONS.screenShake,
      flashFree: typeof options.flashFree === 'boolean' ? options.flashFree : DEFAULT_OPTIONS.flashFree,
      richEffects: typeof options.richEffects === 'boolean' ? options.richEffects : DEFAULT_OPTIONS.richEffects,
      effectsQuality: options.effectsQuality === 'balanced' ? 'balanced' : 'full',
      pushKey:
        typeof options.pushKey === 'string' && /^[A-Za-z0-9]{1,24}$/.test(options.pushKey) ? options.pushKey : DEFAULT_OPTIONS.pushKey,
      telemetry: typeof options.telemetry === 'boolean' ? options.telemetry : DEFAULT_OPTIONS.telemetry,
      effectsVolume: volume(options.effectsVolume, DEFAULT_OPTIONS.effectsVolume),
      musicVolume: volume(options.musicVolume, DEFAULT_OPTIONS.musicVolume),
      interfaceVolume: volume(options.interfaceVolume, DEFAULT_OPTIONS.interfaceVolume),
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
  /**
   * v3 gives every hill its own purse. A First Hill-only run keeps its Obols.
   * A run across several hills had one shared purse that cannot be split
   * honestly, so it is closed with its full Insight award (see `renegotiate`).
   */
  2: (data) => {
    const wallet = obj(data.wallet, 'wallet');
    const empire = obj(data.empire, 'empire');
    const sites = Array.isArray(empire.sites) ? empire.sites : [];
    const single = sites.length <= 1;
    const { obols, ...rest } = wallet;
    return {
      ...data,
      schemaVersion: 3,
      wallet: rest,
      empire: {
        ...empire,
        sites: sites.map((site, i) => ({
          ...obj(site, 'site'),
          purse: single && i === 0 ? obols : '0',
          gross: single && i === 0 ? rest.runGross : '0',
          steward: null,
        })),
      },
      ...(single ? {} : { renegotiate: true }),
    };
  },
  /** v4 adds sealed devices, the Codex and the counterweight. Hands are dealt after loading. */
  3: (data) => {
    const empire = obj(data.empire, 'empire');
    const random = obj(data.random, 'random');
    const disc = obj(data.discoveries, 'discoveries');
    const sites = Array.isArray(empire.sites) ? empire.sites : [];
    const coin = typeof random.coinRngState === 'number' ? random.coinRngState : 0;
    return {
      ...data,
      schemaVersion: 4,
      pausedAtUtc: null,
      prestige: { giftedInsight: 0, ...obj(data.prestige, 'prestige') },
      empire: {
        ...empire,
        sites: sites.map((site) => ({ ...obj(site, 'site'), counterweight: null, hand: [], devices: [] })),
      },
      discoveries: { ...disc, codexIds: [], whisperIds: [], rumourIds: [] },
      counters: { manualSummits: 0, ...obj(data.counters, 'counters') },
      random: { ...random, dealRngState: (coin ^ 0x5eed1e55) >>> 0 },
    };
  },
  /** v5 lights Ixion's Wheel on the Tartarus Rim. */
  4: (data) => {
    const empire = obj(data.empire, 'empire');
    const sites = Array.isArray(empire.sites) ? empire.sites : [];
    return {
      ...data,
      schemaVersion: 5,
      empire: {
        ...empire,
        sites: sites.map((site) => {
          const o = obj(site, 'site');
          return { ...o, furnace: furnaceSite(String(o.id)) ? newFurnace() : null };
        }),
      },
      counters: { fullEruptions: 0, ...obj(data.counters, 'counters') },
    };
  },
  /** v6 sets the Danaids' jar on the Leaking Heights. */
  5: (data) => {
    const empire = obj(data.empire, 'empire');
    const sites = Array.isArray(empire.sites) ? empire.sites : [];
    return {
      ...data,
      schemaVersion: 6,
      empire: {
        ...empire,
        sites: sites.map((site) => {
          const o = obj(site, 'site');
          return { ...o, jar: jarSite(String(o.id)) ? newJar() : null };
        }),
      },
    };
  },
  /** v7 lights the Foundry on the Bronze Pass; its queue is whatever of the hand is still sealed. */
  6: (data) => {
    const empire = obj(data.empire, 'empire');
    const sites = Array.isArray(empire.sites) ? empire.sites : [];
    return {
      ...data,
      schemaVersion: 7,
      empire: {
        ...empire,
        sites: sites.map((site) => {
          const o = obj(site, 'site');
          if (!foundrySite(String(o.id))) return { ...o, foundry: null };
          const hand = Array.isArray(o.hand) ? o.hand.map(String) : [];
          const owned = new Set(Array.isArray(o.devices) ? o.devices.map(String) : []);
          const f = newFoundry(hand.filter((id) => !owned.has(id)));
          return { ...o, foundry: { ...f, bronze: '0', gallery: '0' } };
        }),
      },
    };
  },
  /** v8 hangs the Orrery over the Skyward Escarpment, every house dark. */
  7: (data) => {
    const empire = obj(data.empire, 'empire');
    const sites = Array.isArray(empire.sites) ? empire.sites : [];
    return {
      ...data,
      schemaVersion: 8,
      empire: {
        ...empire,
        sites: sites.map((site) => {
          const o = obj(site, 'site');
          return { ...o, sky: skySite(String(o.id)) ? newSky() : null };
        }),
      },
      counters: { atlasTurns: 0, ...obj(data.counters, 'counters') },
    };
  },
  /** v9 opens the Paperwork Mill on the Olympian Approach. */
  8: (data) => {
    const empire = obj(data.empire, 'empire');
    const sites = Array.isArray(empire.sites) ? empire.sites : [];
    return {
      ...data,
      schemaVersion: 9,
      empire: {
        ...empire,
        sites: sites.map((site) => {
          const o = obj(site, 'site');
          return { ...o, bureau: bureauSite(String(o.id)) ? newBureau() : null };
        }),
      },
    };
  },
  /** v10 remembers per hill (Remembrances, Keep on File) and lets a run read seals and send for visitors. */
  9: (data) => {
    const empire = obj(data.empire, 'empire');
    const sites = Array.isArray(empire.sites) ? empire.sites : [];
    return {
      ...data,
      schemaVersion: 10,
      prestige: { remembrances: {}, fileSlots: [], filed: {}, ...obj(data.prestige, 'prestige') },
      empire: { ...empire, sites: sites.map((site) => ({ peeked: [], summoned: false, trial: 0, ...obj(site, 'site') })) },
    };
  },
  /** v11 files Appeals after the Charter. */
  10: (data) => ({ ...data, schemaVersion: 11, appeal: { number: 0, laurels: 0 } }),
  /** v12 keeps time for records; clocks already running are unknown, never guessed. */
  11: (data) => ({ ...data, schemaVersion: 12, records: { runSeconds: null, campaignSeconds: null, firstCharterSeconds: null, charterSeconds: {} } }),
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
    // A hill opened before its tablets existed (an older save, or new content) is dealt now.
    for (const site of state.empire.sites) {
      if (site.hand.length === 0 && tabletPool(site.id).length > 0) {
        site.hand = dealHand(state, site.id);
        if (site.foundry && site.foundry.finished === 0) site.foundry.queue = [...site.hand];
      }
    }
    if (data.renegotiate === true) {
      const renegotiated = closeRun(state, []);
      return { ok: true, state, migratedFrom: version, renegotiated };
    }
    return version < SCHEMA_VERSION ? { ok: true, state, migratedFrom: version } : { ok: true, state };
  } catch (e) {
    if (e instanceof SaveError) return { ok: false, error: e.message };
    return { ok: false, error: `Unexpected load failure: ${(e as Error).message}` };
  }
}
