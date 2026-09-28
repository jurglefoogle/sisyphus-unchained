import { catalog } from '../content/catalog';
import { ambient, t } from '../content/strings';
import { formatMoney } from '../core/format';
import {
  buyFlywheel,
  buyInsightUpgrade,
  buyLevels,
  buyPreludeUpgrade,
  buyWork,
  confirmPrestige,
  hireForeman,
  newGame,
  openSite,
  previewPrestige,
  selectSite,
  type CommandResult,
  type PrestigePreview,
} from '../core/commands';
import type { LevelTrack } from '../core/formulas';
import { reconcileAchievements } from '../core/achievements';
import { settleOffline, type OfflineSummary } from '../core/offline';
import { deserializeSave, serializeSave } from '../core/save';
import { markTutorial, stepSites } from '../core/sim';
import type { GameEvent, GameState, Options } from '../core/state';
import { CURRENT, PRE_RESET, backupKey, openSaveStore, type SaveStore } from '../platform/storage';
import { Telemetry } from './telemetry';
import { buildView, type GameView } from './view';

/** Foreground gaps longer than this (hidden tab, sleep) settle as an absence. */
const LARGE_GAP_SECONDS = 5;
const RECAP_MIN_SECONDS = 60;
const BACKUP_INTERVAL_MS = 5 * 60_000;
const AMBIENT_INTERVAL_MS = 90_000;
const AMBIENT_REPEAT_WINDOW_MS = 10 * 60_000;

export interface Notice {
  kind: 'recap' | 'story' | 'relic' | 'info' | 'error' | 'toast' | 'achievement';
  storyId?: string;
  achievementIds?: string[];
  firstTime?: boolean;
  relicId?: string;
  text?: string;
  recap?: OfflineSummary;
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
  | { type: 'BuyInsightUpgrade'; upgradeId: string };

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
  private dirty = false;
  private lastSave = 0;
  private lastBackup = 0;
  private listeners = new Set<EventListener>();
  private noticeListeners = new Set<(n: Notice) => void>();
  /** Notices raised before the UI subscribes (load problems, the offline recap). */
  private pendingNotices: Notice[] = [];
  private viewListeners = new Set<(v: GameView) => void>();
  private viewTimer: ReturnType<typeof setInterval> | null = null;
  private lastAmbient = 0;
  private seenRequests: string[] = [];
  private ambientShown = new Map<string, number>();
  loadProblem: { error: string; raw: string; restored: boolean } | null = null;
  readonly telemetry = new Telemetry(() => !!this.state?.options.telemetry);

  async init(): Promise<void> {
    this.store = await openSaveStore();
    const raw = await this.store.get(CURRENT).catch(() => null);
    if (raw) {
      const loaded = deserializeSave(raw);
      if (loaded.ok) {
        this.state = loaded.state;
        if (loaded.migratedFrom !== undefined) {
          await this.store.put({ [`pre-migration-v${loaded.migratedFrom}`]: raw }).catch(() => {});
        }
      } else {
        // Never silently replace a corrupt save: preserve it and try backups.
        await this.store.put({ [`corrupt-${Date.now()}`]: raw }).catch(() => {});
        const recovered = await this.recoverFromBackups();
        this.loadProblem = { error: loaded.error, raw, restored: !!recovered };
        // Don't rotate backups until the player has chosen how to recover.
        this.lastBackup = Date.now();
        this.state = recovered ?? newGame(Date.now());
      }
    } else {
      this.state = newGame(Date.now());
    }
    this.settleAbsence(Date.now(), true);
    this.reconcile();
    this.lastFrame = performance.now();
    this.lastAmbient = Date.now();
    this.dirty = true;
    await this.save();
    this.viewTimer = setInterval(() => this.publishView(), 100);
    this.telemetry.record(this.state, 'session_start');
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
    if (achieved.length) this.notify({ kind: 'achievement', achievementIds: achieved });
    for (const e of events) {
      if (e.type === 'StoryTriggered') this.notify({ kind: 'story', storyId: e.storyId, firstTime: e.firstTime });
      if (e.type === 'RelicGranted') this.notify({ kind: 'relic', relicId: e.relicId });
      if (e.type === 'PreludeCompleted') {
        this.notify({ kind: 'toast', text: `${t('prelude.offering')}: +${formatMoney(e.offering)} Obols` });
      }
      if (e.type === 'FeatureUnlocked') this.notify({ kind: 'toast', text: t(`unlock.${e.feature}`) });
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
    this.emit(events);
    if (showRecap && elapsed >= RECAP_MIN_SECONDS && !summary.earned.isZero()) {
      this.notify({ kind: 'recap', recap: summary });
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
      s.counters.totalActiveSeconds += dt;
      s.lastSettledUtc = Math.max(s.lastSettledUtc, utc);
      this.emit(events);
    }

    this.tickAmbient(utc);
    if (this.dirty && utc - this.lastSave > catalog.save.autosaveSeconds * 1000) void this.save();
  }

  private settleNow(): void {
    this.frame(performance.now());
  }

  // ---------------------------------------------------------------- commands

  private run(fn: (events: GameEvent[]) => CommandResult, saveAfter = true): CommandResult {
    this.settleNow();
    const events: GameEvent[] = [];
    const result = fn(events);
    if (result.ok) {
      this.dirty = true;
      this.emit(events);
      this.publishView();
      if (saveAfter) void this.save();
    }
    return result;
  }

  setManual(held: boolean): void {
    if (this.manualHeld === held) return;
    this.settleNow();
    this.manualHeld = held && !this.state.paused;
    if (this.manualHeld) this.telemetry.push(this.state);
  }

  /**
   * Apply a command at the settled present. A repeated request id (a double
   * click on the same offer, a retried message) is ignored.
   */
  dispatch(req: CommandRequest): CommandResult {
    if (this.seenRequests.includes(req.requestId)) return { ok: false, reason: 'duplicate-request' };
    const result = this.apply(req.command);
    // Only applied requests are remembered, so a refused one can be retried later.
    if (result.ok) {
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
    }
  }

  private send(command: Command, requestId = newRequestId()): CommandResult {
    return this.dispatch({ requestId, at: Date.now(), command });
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
    return this.run(() => selectSite(this.state, id), false);
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
    this.state.pinnedGoal = key;
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

  endSession(): void {
    this.telemetry.record(this.state, 'session_end', { detail: Math.round(this.state.counters.totalActiveSeconds) });
    void this.save();
  }

  setPaused(paused: boolean): void {
    this.settleNow();
    this.state.paused = paused;
    this.manualHeld = false;
    this.state.lastSettledUtc = Math.max(this.state.lastSettledUtc, Date.now());
    this.state.revision += 1;
    this.dirty = true;
    this.publishView();
    void this.save();
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
    if (now - this.lastBackup > BACKUP_INTERVAL_MS) {
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
    } catch (err) {
      this.notify({ kind: 'error', text: `Saving failed: ${(err as Error).message}. Export your save from Settings.` });
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
    if (!this.state.options.ambientCaptions) return;
    if (!this.state.discoveries.tutorialIds.includes('first_level')) return;
    if (now - this.lastAmbient < AMBIENT_INTERVAL_MS) return;
    this.lastAmbient = now;
    const lines = ambient[this.state.empire.selectedSiteId] ?? [];
    const fresh = lines.filter((l) => !this.ambientShown.has(l));
    const pool = fresh.length
      ? fresh
      : lines.filter((l) => now - (this.ambientShown.get(l) ?? 0) > AMBIENT_REPEAT_WINDOW_MS);
    if (!pool.length) return;
    const line = pool[Math.floor(Math.random() * pool.length)];
    this.ambientShown.set(line, now);
    this.notify({ kind: 'info', text: line, storyId: 'ambient' });
  }

  dispose(): void {
    if (this.viewTimer) clearInterval(this.viewTimer);
  }
}
