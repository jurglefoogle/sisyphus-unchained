import { catalog } from '../content/catalog';
import { deviceDef, visitorFor } from '../content/devices';
import { again, ambient, ambientWorks, arrivals, barks, eternity, exchanges, recapLines, shades, t, thanatos, type Speaker } from '../content/strings';
import { formatMoney } from '../core/format';
import {
  breakSeal,
  buyFlywheel,
  buyInsightUpgrade,
  buyLevels,
  buyPreludeUpgrade,
  buyWork,
  confirmPrestige,
  hireForeman,
  hireSteward,
  installCounterweight,
  newGame,
  openSite,
  previewPrestige,
  selectSite,
  setPausedAt,
  setStewardOrder,
  setTrim,
  setVentAt,
  takeBargain,
  vent,
  drill,
  patch,
  setJarTarget,
  setSplit,
  pourNext,
  mount,
  turnSky,
  hireClerk,
  setOnDuty,
  remember,
  buyScorn,
  keepOnFile,
  fileAppeal,
  passTime,
  unseal,
  summonVisitor,
  type CommandResult,
  type PrestigePreview,
} from '../core/commands';
import { EDICTS } from '../content/devices';
import { isConstellation } from '../core/sky';
import type { LevelTrack } from '../core/formulas';
import { reconcileAchievements } from '../core/achievements';
import { settleOffline, type OfflineSummary } from '../core/offline';
import { deserializeSave, serializeSave } from '../core/save';
import { markTutorial, stepSites } from '../core/sim';
import { runStewards } from '../core/stewards';
import type { GameEvent, GameState, Options } from '../core/state';
import { detectPlatform, type Platform } from '../platform/platform';
import { CURRENT, PRE_RESET, backupKey, type SaveStore } from '../platform/storage';
import { Telemetry } from './telemetry';
import { buildView, resolveGoal, type GameView } from './view';

const STEWARD_INTERVAL_MS = 1000;
/** Foreground gaps longer than this (hidden tab, sleep) settle as an absence. */
const LARGE_GAP_SECONDS = 5;
const RECAP_MIN_SECONDS = 60;
const BACKUP_INTERVAL_MS = 5 * 60_000;
const AMBIENT_INTERVAL_MS = 90_000;
/** Before the Foreman the player is watching every climb: more to hear. */
const AMBIENT_EARLY_MS = 45_000;
/** An ambient turn becomes an exchange this often, at most once per gap. */
const EXCHANGE_CHANCE = 0.3;
const EXCHANGE_GAP_MS = 4 * 60_000;
/** Time each line of an exchange holds the caption before the reply. */
const EXCHANGE_LINE_MS = 4_500;
const AMBIENT_REPEAT_WINDOW_MS = 10 * 60_000;
/** Standing idle this long by hand (before the foreman) earns a remark. */
const IDLE_BARK_MS = 60_000;
/** Events that change durable progress and so save immediately. */
const PERMANENT = new Set<GameEvent['type']>(['RelicGranted', 'AchievementUnlocked', 'DecreeAvailable', 'PreludeCompleted', 'FeatureUnlocked']);

export interface Notice {
  kind: 'recap' | 'story' | 'relic' | 'info' | 'error' | 'toast' | 'achievement' | 'reveal';
  /** A device, whisper or bargain just revealed. */
  deviceId?: string;
  storyId?: string;
  achievementIds?: string[];
  firstTime?: boolean;
  relicId?: string;
  text?: string;
  recap?: OfflineSummary;
  /** Who says an ambient line, when it is not Sisyphus alone. */
  speaker?: Speaker;
  /** Story and recap text, chosen when the notice is raised. */
  god?: string;
  sis?: string;
}

type EventListener = (events: GameEvent[]) => void;

/** Player commands (spec §05). Each carries a request id; duplicates are ignored. */
export type Command =
  | { type: 'BuyLevels'; track: LevelTrack; count: number }
  | { type: 'BuyPreludeUpgrade'; upgradeId: string }
  | { type: 'BuyFlywheel' }
  | { type: 'HireForeman' }
  | { type: 'BuyWork'; workId: string }
  | { type: 'OpenSite'; siteId: string }
  | { type: 'BuyInsightUpgrade'; upgradeId: string }
  | { type: 'HireSteward'; paidWith: 'local' | 'insight' }
  | { type: 'SetStewardOrder'; reinvest: boolean }
  | { type: 'InstallCounterweight' }
  | { type: 'SetTrim'; trim: number }
  | { type: 'BreakSeal'; index: number }
  | { type: 'TakeBargain'; bargainId: string }
  | { type: 'Vent' }
  | { type: 'SetVentAt'; heat: number }
  | { type: 'Drill' }
  | { type: 'Patch' }
  | { type: 'SetJarTarget'; level: number }
  | { type: 'SetSplit'; split: number }
  | { type: 'PourNext'; deviceId: string }
  | { type: 'TurnSky' }
  | { type: 'Mount'; deviceId: string; house: number | null }
  | { type: 'HireClerk' }
  | { type: 'SetOnDuty'; clerks: number }
  | { type: 'Remember'; siteId: string }
  | { type: 'BuyScorn' }
  | { type: 'KeepOnFile'; siteId: string; deviceId: string | null }
  | { type: 'Unseal'; index: number }
  | { type: 'Summon' }
  | { type: 'FileAppeal' };

export interface CommandRequest {
  requestId: string;
  /** Client timestamp (ms). The purchase applies at the authoritative settlement time. */
  at: number;
  command: Command;
}

const REQUEST_MEMORY = 256;
let requestCounter = 0;
export const newRequestId = (): string => `r${Date.now().toString(36)}-${(requestCounter++).toString(36)}`;

/** A save that can be restored from the recovery screen. */
export interface RecoveryOption {
  key: string;
  label: string;
  savedAt: number;
  runGross: string;
  record: string;
  insight: number;
  sites: number;
}

export class Game {
  state!: GameState;
  store!: SaveStore;
  manualHeld = false;

  private lastFrame = 0;
  /** Stewards act about once a second, not every frame. */
  private lastStewards = 0;
  private dirty = false;
  private lastSave = 0;
  private lastBackup = 0;
  /** While a load problem is unresolved, keep the good backups from rotating out. */
  private holdBackups = false;
  /** A failed save is reported once, then again only after it recovers and fails anew. */
  private saveFailing = false;
  private listeners = new Set<EventListener>();
  private noticeListeners = new Set<(n: Notice) => void>();
  /** Notices raised before the UI subscribes (load problems, the offline recap). */
  private pendingNotices: Notice[] = [];
  private viewListeners = new Set<(v: GameView) => void>();
  private viewTimer: ReturnType<typeof setInterval> | null = null;
  private lastAmbient = 0;
  private lastBark = 0;
  private lastInput = 0;
  private idleRemarked = false;
  private seenRequests: string[] = [];
  private ambientShown = new Map<string, number>();
  /** An exchange being played out a line at a time. */
  private exchange: { lines: [Speaker, string][]; next: number } | null = null;
  private lastExchange = -Infinity;
  loadProblem: { error: string; raw: string; restored: boolean } | null = null;
  readonly telemetry = new Telemetry(() => !!this.state?.options.telemetry);

  constructor(readonly platform: Platform = detectPlatform()) {}

  async init(): Promise<void> {
    this.store = await this.platform.openSaveStore();
    if (this.store.kind.startsWith('memory')) {
      this.notify({
        kind: 'error',
        text: 'This browser is not keeping saves (private browsing or blocked storage). Progress lasts only this session; export it from Settings to keep it.',
      });
    }
    const raw = await this.store.get(CURRENT).catch(() => null);
    if (raw) {
      const loaded = deserializeSave(raw);
      if (loaded.ok) {
        this.state = loaded.state;
        if (loaded.migratedFrom !== undefined) {
          await this.store.put({ [`pre-migration-v${loaded.migratedFrom}`]: raw }).catch(() => {});
        }
        if (loaded.renegotiated !== undefined) {
          this.notify({
            kind: 'info',
            text: `Every hill keeps its own purse now. Your shared purse could not be split fairly, so Thanatos closed the run and paid ${loaded.renegotiated} Insight in full.`,
          });
        }
      } else {
        // Never silently replace a corrupt save: preserve it and try backups.
        await this.store.put({ [`corrupt-${Date.now()}`]: raw }).catch(() => {});
        const recovered = await this.recoverFromBackups();
        this.loadProblem = { error: loaded.error, raw, restored: !!recovered };
        // Don't rotate backups until the player has chosen how to recover.
        this.holdBackups = true;
        this.state = recovered ?? newGame(Date.now());
      }
    } else {
      this.state = newGame(Date.now());
    }
    const sessionStarted = Date.now();
    const returnSeconds = Math.max(0, Math.round((sessionStarted - this.state.lastSettledUtc) / 1000));
    this.settleAbsence(sessionStarted, true);
    this.reconcile();
    this.lastFrame = performance.now();
    this.lastAmbient = Date.now();
    this.lastInput = Date.now();
    this.dirty = true;
    await this.save();
    this.viewTimer = setInterval(() => this.publishView(), 100);
    this.telemetry.record(this.state, 'session_start', { detail: returnSeconds });
    // Store fronts may have missed unlocks earned offline or on another device.
    for (const id of this.state.discoveries.achievementIds) this.platform.unlockAchievement(id);
    this.platform.onQuit(() => {
      this.telemetry.record(this.state, 'session_end', { detail: Math.round(this.state.counters.totalActiveSeconds) });
      this.settleNow();
      return this.save();
    });
    // A load problem opens the recovery screen (App reads `loadProblem`).
  }

  private async recoverFromBackups(): Promise<GameState | null> {
    for (let i = 0; i < catalog.save.backupCount; i++) {
      const raw = await this.store.get(backupKey(i)).catch(() => null);
      if (!raw) continue;
      const r = deserializeSave(raw);
      if (r.ok) return r.state;
    }
    return null;
  }

  // ------------------------------------------------------------ subscriptions

  onEvents(fn: EventListener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  onNotice(fn: (n: Notice) => void): () => void {
    this.noticeListeners.add(fn);
    const pending = this.pendingNotices;
    this.pendingNotices = [];
    for (const n of pending) fn(n);
    return () => this.noticeListeners.delete(fn);
  }

  onView(fn: (v: GameView) => void): () => void {
    this.viewListeners.add(fn);
    fn(this.view());
    return () => this.viewListeners.delete(fn);
  }

  view(): GameView {
    return buildView(this.state);
  }

  publishView(): void {
    const v = this.view();
    for (const fn of this.viewListeners) fn(v);
  }

  private notify(n: Notice): void {
    if (!this.noticeListeners.size) {
      this.pendingNotices.push(n);
      return;
    }
    for (const fn of this.noticeListeners) fn(n);
  }

  /** Pick up achievements earned by loading, importing or anything missed. */
  private reconcile(): void {
    const events: GameEvent[] = [];
    reconcileAchievements(this.state, events);
    this.emit(events);
  }

  private emit(events: GameEvent[]): void {
    if (!events.length) return;
    // Achievements follow from the state these events produced.
    reconcileAchievements(this.state, events);
    this.dirty = true;
    this.telemetry.onEvents(this.state, events);
    const achieved = events.flatMap((e) => (e.type === 'AchievementUnlocked' ? [e.achievementId] : []));
    if (achieved.length) {
      this.notify({ kind: 'achievement', achievementIds: achieved });
      for (const id of achieved) this.platform.unlockAchievement(id);
    }
    for (const e of events) {
      if (e.type === 'StoryTriggered') this.notify({ kind: 'story', storyId: e.storyId, firstTime: e.firstTime, ...this.storyLines(e.storyId, e.firstTime) });
      if (e.type === 'RelicGranted') this.notify({ kind: 'relic', relicId: e.relicId });
      if (e.type === 'PreludeCompleted') {
        this.notify({ kind: 'toast', text: `${t('prelude.offering')}: +${formatMoney(e.offering)} Obols` });
      }
      if (e.type === 'FallResolved' && !this.state.prelude.complete) {
        this.notify({ kind: 'toast', text: `The fall paid +${formatMoney(e.amount)} Obol${e.amount.eq(1) ? '' : 's'}. Improve your grip and the next attempt reaches higher.` });
      }
      if (e.type === 'FeatureUnlocked') this.notify({ kind: 'toast', text: t(`unlock.${e.feature}`) });
      if (e.type === 'DeviceRevealed') this.notify({ kind: 'reveal', deviceId: e.deviceId, firstTime: e.firstTime });
      if (e.type === 'Rumour') this.notify({ kind: 'info', text: `Rumour: ${e.text}` });
      if (e.type === 'LaurelWon') this.notify({ kind: 'toast', text: `Appeal ${e.number} won. A laurel: every crew earns more, for good.` });
      if (e.type === 'AppealFiled') this.notify({ kind: 'toast', text: `Thanatos files Appeal ${e.number}. The sentence begins again, stiffer.` });
      if (e.type === 'Edict') {
        const edict = EDICTS.find((x) => x.id === e.edictId);
        if (edict) this.notify({ kind: 'toast', text: `Zeus decrees: ${edict.name}. ${edict.rule}` });
      }
      if (e.type === 'VisitorArrived') {
        const v = visitorFor(e.siteId);
        if (v) this.notify({ kind: 'toast', text: `${v.greeting} (see the Improve list)` });
      }
    }
    for (const fn of this.listeners) fn(events);
  }

  // -------------------------------------------------------------------- time

  /** Settle wall-clock time since the last accounting timestamp. */
  private settleAbsence(nowUtc: number, showRecap: boolean): void {
    const s = this.state;
    const elapsed = (nowUtc - s.lastSettledUtc) / 1000;
    if (elapsed < 0) {
      // Clock moved backward: keep the high-water mark until real time catches up.
      if (showRecap) this.notify({ kind: 'info', text: 'The system clock moved backward. Earnings resume once it catches up.' });
      return;
    }
    if (s.paused) {
      s.lastSettledUtc = nowUtc;
      return;
    }
    const events: GameEvent[] = [];
    const summary = settleOffline(s, elapsed, events);
    s.lastSettledUtc = nowUtc;
    // Stewards settle their accounts once on return (docs/hill-workshops-plan.md §2).
    this.stewards(events);
    this.emit(events);
    if (showRecap && elapsed >= RECAP_MIN_SECONDS && !summary.earned.isZero()) {
      this.notify({ kind: 'recap', recap: summary, sis: this.pickLine(recapLines, nowUtc) ?? undefined });
    }
  }

  /** Advance to `now`. Called every animation frame and before every command. */
  frame(now: number): void {
    const dt = Math.max(0, (now - this.lastFrame) / 1000);
    this.lastFrame = now;
    const s = this.state;
    const utc = Date.now();

    if (s.paused) {
      s.lastSettledUtc = Math.max(s.lastSettledUtc, utc);
      return;
    }
    if (dt > LARGE_GAP_SECONDS) {
      this.manualHeld = false;
      this.settleAbsence(utc, true);
    } else if (dt > 0) {
      const events: GameEvent[] = [];
      stepSites(s, dt, { manualHeld: this.manualHeld, offline: false, events });
      if (utc - this.lastStewards >= STEWARD_INTERVAL_MS) {
        this.lastStewards = utc;
        this.stewards(events);
      }
      s.counters.totalActiveSeconds += dt;
      passTime(s, dt);
      s.lastSettledUtc = Math.max(s.lastSettledUtc, utc);
      this.emit(events);
      this.react(events, utc);
      this.checkIdle(utc);
      // Permanent grants save at once rather than waiting for the autosave (spec §02, §05).
      if (events.some((e) => PERMANENT.has(e.type))) void this.save();
    }

    this.tickAmbient(utc);
    if (this.dirty && utc - this.lastSave > catalog.save.autosaveSeconds * 1000) void this.save();
  }

  /**
   * Let stewards spend. Their purchases are bookkeeping, not the player's
   * clicks: no purchase chimes, but milestones and unlocks still count.
   */
  private stewards(events: GameEvent[]): void {
    if (!this.state.empire.sites.some((site) => site.steward)) return;
    const own: GameEvent[] = [];
    if (runStewards(this.state, own).size === 0) return;
    this.dirty = true;
    for (const e of own) if (e.type !== 'PurchaseCompleted') events.push(e);
  }

  private settleNow(): void {
    this.frame(performance.now());
  }

  // ---------------------------------------------------------------- commands

  private run(fn: (events: GameEvent[]) => CommandResult, saveAfter = true): CommandResult {
    this.settleNow();
    const pinnedBefore = this.state.pinnedGoal;
    const pinnedWasActive = !!pinnedBefore && !resolveGoal(this.state, pinnedBefore).stale;
    const events: GameEvent[] = [];
    const result = fn(events);
    if (result.ok) {
      this.dirty = true;
      this.emit(events);
      this.react(events, Date.now());
      if (pinnedBefore && pinnedWasActive && resolveGoal(this.state, pinnedBefore).stale) {
        this.telemetry.record(this.state, 'goal_completed', { detail: pinnedBefore });
      }
      this.publishView();
      if (saveAfter) void this.save();
    }
    return result;
  }

  setManual(held: boolean): void {
    if (this.manualHeld === held) return;
    this.settleNow();
    this.noteInput();
    this.manualHeld = held && !this.state.paused;
    if (this.manualHeld) this.telemetry.push(this.state);
  }

  /**
   * Apply a command at the settled present. A repeated request id (a double
   * click on the same offer, a retried message) is ignored.
   */
  dispatch(req: CommandRequest): CommandResult {
    if (this.seenRequests.includes(req.requestId)) return { ok: false, reason: 'duplicate-request' };
    this.noteInput();
    const result = this.apply(req.command);
    // Only applied requests are remembered, so a refused one can be retried later.
    if (result.ok) {
      this.telemetry.decision(this.state, req.command);
      this.seenRequests.push(req.requestId);
      if (this.seenRequests.length > REQUEST_MEMORY) this.seenRequests.shift();
    }
    return result;
  }

  private apply(c: Command): CommandResult {
    const s = () => this.state;
    switch (c.type) {
      case 'BuyLevels':
        return this.run((e) => buyLevels(s(), s().empire.selectedSiteId, c.track, c.count, e));
      case 'BuyPreludeUpgrade':
        return this.run((e) => buyPreludeUpgrade(s(), c.upgradeId, e));
      case 'BuyFlywheel':
        return this.run((e) => buyFlywheel(s(), s().empire.selectedSiteId, e));
      case 'HireForeman':
        return this.run((e) => hireForeman(s(), e));
      case 'BuyWork':
        return this.run((e) => buyWork(s(), c.workId, e));
      case 'OpenSite': {
        const r = this.run((e) => openSite(s(), c.siteId, e));
        if (r.ok) this.selectSite(c.siteId);
        return r;
      }
      case 'BuyInsightUpgrade':
        return this.run((e) => buyInsightUpgrade(s(), c.upgradeId, e));
      case 'HireSteward':
        return this.run((e) => hireSteward(s(), s().empire.selectedSiteId, c.paidWith, e));
      case 'SetStewardOrder':
        return this.run(() => setStewardOrder(s(), s().empire.selectedSiteId, c.reinvest));
      case 'InstallCounterweight':
        return this.run((e) => installCounterweight(s(), s().empire.selectedSiteId, e));
      case 'SetTrim':
        return this.run(() => setTrim(s(), s().empire.selectedSiteId, c.trim));
      case 'BreakSeal':
        return this.run((e) => breakSeal(s(), s().empire.selectedSiteId, c.index, e));
      case 'TakeBargain':
        return this.run((e) => takeBargain(s(), s().empire.selectedSiteId, c.bargainId, e));
      case 'Vent':
        return this.run((e) => vent(s(), s().empire.selectedSiteId, e));
      case 'SetVentAt':
        return this.run(() => setVentAt(s(), s().empire.selectedSiteId, c.heat));
      case 'Drill':
        return this.run(() => drill(s(), s().empire.selectedSiteId));
      case 'Patch':
        return this.run((e) => patch(s(), s().empire.selectedSiteId, e));
      case 'SetJarTarget':
        return this.run(() => setJarTarget(s(), s().empire.selectedSiteId, c.level));
      case 'SetSplit':
        return this.run(() => setSplit(s(), s().empire.selectedSiteId, c.split));
      case 'PourNext':
        return this.run(() => pourNext(s(), s().empire.selectedSiteId, c.deviceId));
      case 'TurnSky':
        return this.run((e) => turnSky(s(), s().empire.selectedSiteId, e));
      case 'Mount':
        return this.run(() => mount(s(), s().empire.selectedSiteId, c.deviceId, c.house));
      case 'FileAppeal':
        return this.run((e) => fileAppeal(s(), e));
      case 'Remember':
        return this.run((e) => remember(s(), c.siteId, e));
      case 'BuyScorn':
        return this.run((e) => buyScorn(s(), e));
      case 'KeepOnFile':
        return this.run(() => keepOnFile(s(), c.siteId, c.deviceId));
      case 'Unseal':
        return this.run(() => unseal(s(), s().empire.selectedSiteId, c.index));
      case 'Summon':
        return this.run((e) => summonVisitor(s(), s().empire.selectedSiteId, e));
      case 'HireClerk':
        return this.run(() => hireClerk(s(), s().empire.selectedSiteId));
      case 'SetOnDuty':
        return this.run(() => setOnDuty(s(), s().empire.selectedSiteId, c.clerks));
    }
  }

  private send(command: Command, requestId = newRequestId()): CommandResult {
    return this.dispatch({ requestId, at: Date.now(), command });
  }

  hireSteward(paidWith: 'local' | 'insight', requestId?: string) {
    return this.send({ type: 'HireSteward', paidWith }, requestId);
  }
  /** Flip the viewed hill's standing order between reinvest and hold. */
  setStewardOrder(requestId?: string) {
    const site = this.state.empire.sites.find((x) => x.id === this.state.empire.selectedSiteId);
    return this.send({ type: 'SetStewardOrder', reinvest: !site?.steward?.reinvest }, requestId);
  }
  installCounterweight(requestId?: string) {
    return this.send({ type: 'InstallCounterweight' }, requestId);
  }
  /** Add or take out stones (`delta`) on the viewed hill's counterweight. */
  trimCounterweight(delta: number, requestId?: string) {
    const site = this.state.empire.sites.find((x) => x.id === this.state.empire.selectedSiteId);
    return this.send({ type: 'SetTrim', trim: (site?.counterweight ?? 0) + delta }, requestId);
  }
  vent(requestId?: string) {
    return this.send({ type: 'Vent' }, requestId);
  }
  /** Move the steward's vent point by `steps` of 5 percent. */
  nudgeVentAt(steps: number, requestId?: string) {
    const site = this.state.empire.sites.find((x) => x.id === this.state.empire.selectedSiteId);
    return this.send({ type: 'SetVentAt', heat: (site?.furnace?.ventAt ?? 0) + steps * 0.05 }, requestId);
  }
  fileAppeal(requestId?: string) {
    return this.send({ type: 'FileAppeal' }, requestId);
  }
  buyScorn(requestId?: string) {
    return this.send({ type: 'BuyScorn' }, requestId);
  }
  remember(siteId: string, requestId?: string) {
    return this.send({ type: 'Remember', siteId }, requestId);
  }
  keepOnFile(siteId: string, deviceId: string | null, requestId?: string) {
    return this.send({ type: 'KeepOnFile', siteId, deviceId }, requestId);
  }
  unseal(index: number, requestId?: string) {
    return this.send({ type: 'Unseal', index }, requestId);
  }
  summonVisitor(requestId?: string) {
    return this.send({ type: 'Summon' }, requestId);
  }
  hireClerk(requestId?: string) {
    return this.send({ type: 'HireClerk' }, requestId);
  }
  /** Move `steps` clerks to (or from) their desks on the Mill. */
  nudgeOnDuty(steps: number, requestId?: string) {
    const b = this.state.empire.sites.find((x) => x.id === this.state.empire.selectedSiteId)?.bureau;
    return this.send({ type: 'SetOnDuty', clerks: b ? b.onDuty + steps : -1 }, requestId);
  }
  turnSky(requestId?: string) {
    return this.send({ type: 'TurnSky' }, requestId);
  }
  /**
   * Move the `index`th revealed constellation `delta` houses (swapping with
   * whatever hangs there); 0 mounts it in the first dark house, or takes it down.
   */
  moveConstellation(index: number, delta: number, requestId?: string) {
    const site = this.state.empire.sites.find((x) => x.id === this.state.empire.selectedSiteId);
    const sky = site?.sky;
    const id = site?.devices.filter(isConstellation)[index];
    if (!sky || !id) return this.send({ type: 'Mount', deviceId: '', house: null }, requestId);
    const n = sky.houses.length;
    const at = sky.houses.indexOf(id);
    const house = delta === 0 ? (at >= 0 ? null : sky.houses.indexOf(null)) : (((at + delta) % n) + n) % n;
    return this.send({ type: 'Mount', deviceId: id, house }, requestId);
  }
  /** Move the Foundry split by `steps` tenths. */
  nudgeSplit(steps: number, requestId?: string) {
    const site = this.state.empire.sites.find((x) => x.id === this.state.empire.selectedSiteId);
    return this.send({ type: 'SetSplit', split: (site?.foundry?.split ?? 0) + steps * 0.1 }, requestId);
  }
  /** Pour the blueprint at `index` in the queue next. */
  pourNext(index: number, requestId?: string) {
    const site = this.state.empire.sites.find((x) => x.id === this.state.empire.selectedSiteId);
    return this.send({ type: 'PourNext', deviceId: site?.foundry?.queue[index] ?? '' }, requestId);
  }
  /** +1 drills a hole, -1 patches one. */
  tendJar(delta: number, requestId?: string) {
    return this.send({ type: delta > 0 ? 'Drill' : 'Patch' }, requestId);
  }
  /** Move the jar level the steward holds by `steps` of 5 percent. */
  nudgeJarTarget(steps: number, requestId?: string) {
    const site = this.state.empire.sites.find((x) => x.id === this.state.empire.selectedSiteId);
    return this.send({ type: 'SetJarTarget', level: (site?.jar?.target ?? 0) + steps * 0.05 }, requestId);
  }
  breakSeal(index: number, requestId?: string) {
    return this.send({ type: 'BreakSeal', index }, requestId);
  }
  /** Take the visitor's bargain at `index` (0 or 1). */
  takeBargain(index: number, requestId?: string) {
    const v = visitorFor(this.state.empire.selectedSiteId);
    const id = v?.bargains[index];
    if (!id) return { ok: false as const, reason: 'no-visitor' };
    return this.send({ type: 'TakeBargain', bargainId: id }, requestId);
  }
  buyLevels(track: LevelTrack, count: number, requestId?: string) {
    return this.send({ type: 'BuyLevels', track, count }, requestId);
  }
  buyPreludeUpgrade(id: string, requestId?: string) {
    return this.send({ type: 'BuyPreludeUpgrade', upgradeId: id }, requestId);
  }
  buyFlywheel(requestId?: string) {
    return this.send({ type: 'BuyFlywheel' }, requestId);
  }
  hireForeman(requestId?: string) {
    return this.send({ type: 'HireForeman' }, requestId);
  }
  buyWork(id: string, requestId?: string) {
    return this.send({ type: 'BuyWork', workId: id }, requestId);
  }
  openSite(id: string, requestId?: string) {
    return this.send({ type: 'OpenSite', siteId: id }, requestId);
  }
  buyUpgrade(id: string, requestId?: string) {
    return this.send({ type: 'BuyInsightUpgrade', upgradeId: id }, requestId);
  }
  selectSite(id: string) {
    this.manualHeld = false;
    const moved = id !== this.state.empire.selectedSiteId;
    const r = this.run(() => selectSite(this.state, id), false);
    if (r.ok && moved) this.bark(arrivals[id] ?? [], Date.now(), 0.5, 20_000);
    return r;
  }

  previewPrestige(): PrestigePreview {
    this.settleNow();
    const preview = previewPrestige(this.state);
    this.telemetry.record(this.state, 'prestige_preview', { detail: preview.award });
    return preview;
  }

  async confirmPrestige(): Promise<CommandResult> {
    this.settleNow();
    await this.store.put({ [PRE_RESET]: serializeSave(this.state) }).catch(() => {});
    this.manualHeld = false;
    const r = this.run((e) => confirmPrestige(this.state, e));
    await this.save();
    return r;
  }

  /** Pin one purchase as the goal (null unpins). Changes only the objective line. */
  pinGoal(key: string | null): void {
    const previous = this.state.pinnedGoal;
    this.state.pinnedGoal = key;
    this.telemetry.record(this.state, key ? (previous ? 'goal_replaced' : 'goal_set') : 'goal_cleared', { detail: key ?? previous ?? '' });
    this.dirty = true;
    this.publishView();
    void this.save();
  }

  /** Record a one-time interface flag (dismissed prompt, seen credits). */
  markSeen(id: string): void {
    markTutorial(this.state, id);
    this.dirty = true;
    this.publishView();
    void this.save();
  }

  /** The player has seen the recovery screen and chosen; backups rotate again. */
  acknowledgeRecovery(): void {
    this.holdBackups = false;
  }

  endSession(): void {
    this.telemetry.record(this.state, 'session_end', { detail: Math.round(this.state.counters.totalActiveSeconds) });
    void this.save();
  }

  setPaused(paused: boolean): void {
    this.settleNow();
    const events: GameEvent[] = [];
    setPausedAt(this.state, paused, Date.now(), events);
    this.state.paused = paused;
    this.manualHeld = false;
    this.state.lastSettledUtc = Math.max(this.state.lastSettledUtc, Date.now());
    this.state.revision += 1;
    this.dirty = true;
    this.publishView();
    void this.save();
    // Pausing always gets a remark (spec §03).
    if (paused) this.bark(barks.pause, Date.now(), 1, 0);
    this.emit(events);
  }

  setOption<K extends keyof Options>(key: K, value: Options[K]): void {
    this.state.options[key] = value;
    this.dirty = true;
    void this.save();
  }

  // ------------------------------------------------------------- persistence

  async save(): Promise<void> {
    if (!this.store || !this.state) return;
    const text = serializeSave(this.state);
    const now = Date.now();
    const entries: Record<string, string> = { [CURRENT]: text };
    if (!this.holdBackups && now - this.lastBackup > BACKUP_INTERVAL_MS) {
      for (let i = catalog.save.backupCount - 1; i > 0; i--) {
        const older = await this.store.get(backupKey(i - 1)).catch(() => null);
        if (older) entries[backupKey(i)] = older;
      }
      entries[backupKey(0)] = text;
      this.lastBackup = now;
    }
    try {
      await this.store.put(entries);
      this.dirty = false;
      this.lastSave = now;
      if (this.saveFailing) {
        this.saveFailing = false;
        this.notify({ kind: 'info', text: 'Saving works again.' });
      }
    } catch (err) {
      // Keep the last good file; retry on the next autosave rather than every frame.
      this.lastSave = now;
      if (this.saveFailing) return;
      this.saveFailing = true;
      const reason = err instanceof Error ? err.message : String(err);
      const full = /quota|space|full|ENOSPC/i.test(reason);
      this.notify({
        kind: 'error',
        text: full
          ? 'Saving failed: the disk or browser storage is full. Free some space; your last save is intact. Export from Settings to be safe.'
          : `Saving failed: ${reason}. Your last save is intact. Export from Settings to be safe.`,
      });
    }
  }

  exportSave(): string {
    this.settleNow();
    return serializeSave(this.state);
  }

  /** Validate an import; the caller confirms before `applyImport`. */
  inspectImport(text: string) {
    return deserializeSave(text.trim());
  }

  async applyImport(state: GameState): Promise<void> {
    await this.store.put({ [PRE_RESET]: serializeSave(this.state) }).catch(() => {});
    this.state = state;
    this.manualHeld = false;
    this.settleAbsence(Date.now(), true);
    this.reconcile();
    this.dirty = true;
    await this.save();
    this.publishView();
    this.emit([{ type: 'SiteOpened', siteId: state.empire.selectedSiteId }]);
  }

  /** Backups and recovery copies that still load, newest first. */
  async recoveryOptions(): Promise<RecoveryOption[]> {
    const keys: [string, string][] = [];
    for (let i = 0; i < catalog.save.backupCount; i++) keys.push([backupKey(i), `Backup ${i + 1}`]);
    keys.push([PRE_RESET, 'Copy kept before the last reset or import']);
    const out: RecoveryOption[] = [];
    for (const [key, label] of keys) {
      const raw = await this.store.get(key).catch(() => null);
      if (!raw) continue;
      const r = deserializeSave(raw);
      if (!r.ok) continue;
      const st = r.state;
      out.push({
        key,
        label,
        savedAt: st.lastSettledUtc,
        runGross: formatMoney(st.wallet.runGross),
        record: formatMoney(st.wallet.bestRunGross),
        insight: st.prestige.lifetimeInsightAwarded,
        sites: st.empire.sites.length,
      });
    }
    return out.sort((a, b) => b.savedAt - a.savedAt);
  }

  async restoreFrom(key: string): Promise<boolean> {
    const raw = await this.store.get(key).catch(() => null);
    const r = raw ? deserializeSave(raw) : null;
    if (!r?.ok) return false;
    await this.applyImport(r.state);
    return true;
  }

  async startFresh(): Promise<void> {
    const options = this.state.options;
    this.state = newGame(Date.now());
    this.state.options = options;
    this.manualHeld = false;
    this.dirty = true;
    await this.save();
    this.publishView();
    this.emit([{ type: 'SiteOpened', siteId: this.state.empire.selectedSiteId }]);
  }

  async resetSave(): Promise<void> {
    await this.store.put({ [PRE_RESET]: serializeSave(this.state) }).catch(() => {});
    const options = this.state.options;
    this.state = newGame(Date.now());
    this.state.options = options;
    this.manualHeld = false;
    this.dirty = true;
    await this.save();
    this.publishView();
    this.emit([{ type: 'SiteOpened', siteId: this.state.empire.selectedSiteId }]);
  }

  // ----------------------------------------------------------------- ambient

  private tickAmbient(now: number): void {
    if (!this.state.options.ambientCaptions) {
      this.exchange = null;
      return;
    }
    if (this.exchange) {
      if (now < this.exchange.next) return;
      const [speaker, text] = this.exchange.lines.shift()!;
      this.notify({ kind: 'info', text, speaker, storyId: 'ambient' });
      this.exchange.next = now + EXCHANGE_LINE_MS;
      this.lastAmbient = now;
      if (!this.exchange.lines.length) this.exchange = null;
      return;
    }
    // Banter begins with the first summit, once the prelude is behind him.
    if (!this.state.prelude.complete) return;
    const e = this.state.empire;
    if (now - this.lastAmbient < (e.foremanOwned ? AMBIENT_INTERVAL_MS : AMBIENT_EARLY_MS)) return;
    this.lastAmbient = now;
    if (now - this.lastExchange >= EXCHANGE_GAP_MS && Math.random() < EXCHANGE_CHANCE && this.startExchange(now)) return;
    const pool = [
      ...(ambient[e.selectedSiteId] ?? []),
      ...shades,
      ...eternity,
      ...(e.foremanOwned ? ambientWorks.foreman : []),
      ...e.purchasedWorkIds.flatMap((id) => ambientWorks[id] ?? []),
    ];
    const line = this.pickLine(pool, now);
    if (line) this.notify({ kind: 'info', text: line, storyId: 'ambient' });
  }

  /** The dead talk among themselves (and back to Sisyphus): unheard exchanges first. */
  private startExchange(now: number): boolean {
    const crew = this.state.empire.foremanOwned;
    const ready = exchanges.filter((x) => !x.crew || crew);
    const key = (id: string) => `exchange:${id}`;
    const pick = this.pickLine(ready.map((x) => key(x.id)), now);
    const chosen = ready.find((x) => key(x.id) === pick);
    if (!chosen) return false;
    this.lastExchange = now;
    this.exchange = { lines: chosen.lines.map(([who, text]) => [who, text]), next: now };
    this.tickAmbient(now);
    return true;
  }

  /**
   * The words for a story beat. A first viewing uses the written exchange; a
   * repeat keeps the god's line and gives Sisyphus a comeback, since he
   * remembers. Thanatos varies his line as the runs pile up.
   */
  private storyLines(id: string, firstTime: boolean): { god: string; sis?: string } {
    if (firstTime) return { god: t(`story.${id}.god`), sis: t(`story.${id}.sis`) };
    let god = t(`story.${id}.god`);
    if (id === 'first_prestige') {
      const k = this.state.counters.totalRuns - 2;
      god = k < 3 ? (thanatos[k] ?? god) : (this.pickLine(thanatos.slice(3), Date.now()) ?? god);
    }
    return { god, sis: this.pickLine(again[id] ?? [], Date.now()) ?? undefined };
  }

  /** Unseen lines first, then any outside the no-repeat window. */
  private pickLine(lines: string[], now: number): string | null {
    const fresh = lines.filter((l) => !this.ambientShown.has(l));
    const pool = fresh.length
      ? fresh
      : lines.filter((l) => now - (this.ambientShown.get(l) ?? 0) > AMBIENT_REPEAT_WINDOW_MS);
    if (!pool.length) return null;
    const line = pool[Math.floor(Math.random() * pool.length)];
    this.ambientShown.set(line, now);
    return line;
  }

  /**
   * Sisyphus's reactions to live play (never to offline settlement): the
   * prelude's falls, and now and then a summit or a flywheel charge on the
   * hill in view. They share the ambient caption and its off switch.
   */
  private react(events: GameEvent[], now: number): void {
    const selected = this.state.empire.selectedSiteId;
    // Before the Foreman every climb is watched: Sisyphus talks more.
    const early = !this.state.empire.foremanOwned;
    for (const e of events) {
      if (e.type === 'StoneSlipped') this.bark(e.record ? barks.slip_record : barks.slip, now, e.record ? 1 : 0.6, 10_000);
      else if (e.type === 'SummitReached' && e.siteId === selected) this.bark(barks.summit, now, early ? 0.35 : 0.2, early ? 30_000 : 45_000);
      else if (e.type === 'FlywheelCharged' && e.siteId === selected) this.bark(barks.flywheel, now, 0.25, 45_000);
      else if (e.type === 'ImpactResolved' && e.siteId === selected && e.targetId !== 'debris') {
        this.bark(barks.impact, now, 0.25, 45_000);
      } else if (e.type === 'PurchaseCompleted' && (e.kind === 'production' || e.kind === 'strength' || e.kind === 'impact')) {
        this.bark(barks.levels, now, early ? 0.25 : 0.12, early ? 30_000 : 60_000);
      }
    }
  }

  private noteInput(): void {
    this.lastInput = Date.now();
    this.idleRemarked = false;
  }

  /** Before the foreman, standing around for a minute gets noticed. Once. */
  private checkIdle(now: number): void {
    const s = this.state;
    if (this.idleRemarked || this.manualHeld || s.empire.foremanOwned) return;
    if (!s.prelude.attempts && !s.prelude.complete) return;
    if (now - this.lastInput < IDLE_BARK_MS) return;
    this.idleRemarked = true;
    this.bark(barks.idle, now, 1, 10_000);
  }

  private bark(lines: string[], now: number, chance: number, gap: number): void {
    if (!this.state.options.ambientCaptions) return;
    // Never talk over an exchange in progress.
    if (this.exchange || now - this.lastBark < gap || Math.random() >= chance) return;
    const line = this.pickLine(lines, now);
    if (!line) return;
    this.lastBark = now;
    // Hold the next ambient line back a little so the two don't trample each other.
    this.lastAmbient = Math.max(this.lastAmbient, now - AMBIENT_INTERVAL_MS + 30_000);
    this.notify({ kind: 'info', text: line, storyId: 'ambient' });
  }

  dispose(): void {
    if (this.viewTimer) clearInterval(this.viewTimer);
  }
}
