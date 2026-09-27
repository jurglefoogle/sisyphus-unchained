import { catalog } from '../content/catalog';
import { ambient } from '../content/strings';
import {
  buyFlywheel,
  buyInsightUpgrade,
  buyLevels,
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
import { settleOffline, type OfflineSummary } from '../core/offline';
import { deserializeSave, serializeSave } from '../core/save';
import { stepSites } from '../core/sim';
import type { GameEvent, GameState, Options } from '../core/state';
import { CURRENT, PRE_RESET, backupKey, openSaveStore, type SaveStore } from '../platform/storage';
import { buildView, type GameView } from './view';

/** Foreground gaps longer than this (hidden tab, sleep) settle as an absence. */
const LARGE_GAP_SECONDS = 5;
const RECAP_MIN_SECONDS = 60;
const BACKUP_INTERVAL_MS = 5 * 60_000;
const AMBIENT_INTERVAL_MS = 90_000;
const AMBIENT_REPEAT_WINDOW_MS = 10 * 60_000;

export interface Notice {
  kind: 'recap' | 'story' | 'relic' | 'info' | 'error';
  storyId?: string;
  firstTime?: boolean;
  relicId?: string;
  text?: string;
  recap?: OfflineSummary;
}

type EventListener = (events: GameEvent[]) => void;

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
  private ambientShown = new Map<string, number>();
  loadProblem: { error: string; raw: string; restored: boolean } | null = null;

  async init(): Promise<void> {
    this.store = await openSaveStore();
    const raw = await this.store.get(CURRENT).catch(() => null);
    if (raw) {
      const loaded = deserializeSave(raw);
      if (loaded.ok) {
        this.state = loaded.state;
      } else {
        // Never silently replace a corrupt save: preserve it and try backups.
        await this.store.put({ [`corrupt-${Date.now()}`]: raw }).catch(() => {});
        const recovered = await this.recoverFromBackups();
        this.loadProblem = { error: loaded.error, raw, restored: !!recovered };
        this.state = recovered ?? newGame(Date.now());
      }
    } else {
      this.state = newGame(Date.now());
    }
    this.settleAbsence(Date.now(), true);
    this.lastFrame = performance.now();
    this.lastAmbient = Date.now();
    this.dirty = true;
    await this.save();
    this.viewTimer = setInterval(() => this.publishView(), 100);
    if (this.loadProblem) {
      this.notify({
        kind: 'error',
        text: `Your latest save could not be loaded (${this.loadProblem.error}). ${
          this.loadProblem.restored ? 'A backup was restored.' : 'No valid backup was found, so a new game was started.'
        } The damaged file was kept and can be exported from Settings.`,
      });
    }
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

  private emit(events: GameEvent[]): void {
    if (!events.length) return;
    this.dirty = true;
    for (const e of events) {
      if (e.type === 'StoryTriggered') this.notify({ kind: 'story', storyId: e.storyId, firstTime: e.firstTime });
      if (e.type === 'RelicGranted') this.notify({ kind: 'relic', relicId: e.relicId });
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
  }

  buyLevels(track: LevelTrack, count: number) {
    return this.run((e) => buyLevels(this.state, this.state.empire.selectedSiteId, track, count, e));
  }
  buyFlywheel() {
    return this.run((e) => buyFlywheel(this.state, this.state.empire.selectedSiteId, e));
  }
  hireForeman() {
    return this.run((e) => hireForeman(this.state, e));
  }
  buyWork(id: string) {
    return this.run((e) => buyWork(this.state, id, e));
  }
  openSite(id: string) {
    const r = this.run((e) => openSite(this.state, id, e));
    if (r.ok) this.selectSite(id);
    return r;
  }
  buyUpgrade(id: string) {
    return this.run((e) => buyInsightUpgrade(this.state, id, e));
  }
  selectSite(id: string) {
    this.manualHeld = false;
    return this.run(() => selectSite(this.state, id), false);
  }

  previewPrestige(): PrestigePreview {
    this.settleNow();
    return previewPrestige(this.state);
  }

  async confirmPrestige(): Promise<CommandResult> {
    this.settleNow();
    await this.store.put({ [PRE_RESET]: serializeSave(this.state) }).catch(() => {});
    this.manualHeld = false;
    const r = this.run((e) => confirmPrestige(this.state, e));
    await this.save();
    return r;
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
    this.dirty = true;
    await this.save();
    this.publishView();
    this.emit([{ type: 'SiteOpened', siteId: state.empire.selectedSiteId }]);
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
