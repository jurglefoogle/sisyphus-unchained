import type { GameEvent, GameState } from '../core/state';

/**
 * Local playtest event log (spec §06 "Product telemetry"). Recording happens
 * only while the player has opted in; nothing leaves the device except by the
 * manual export in Settings. Entries carry no personal content or device ids.
 */

const KEY = 'sisyphus-unchained-telemetry';
const MAX_ENTRIES = 5000;

export interface TelemetryEntry {
  /** Milliseconds since the Unix epoch. */
  t: number;
  event: string;
  site?: string;
  level?: number;
  price?: string;
  balance?: string;
  detail?: string | number;
}

export class Telemetry {
  private entries: TelemetryEntry[] = [];
  private pushedThisSession = false;
  private loaded = false;

  constructor(private enabled: () => boolean) {}

  private load(): void {
    if (this.loaded) return;
    this.loaded = true;
    try {
      const raw = localStorage.getItem(KEY);
      const parsed: unknown = raw ? JSON.parse(raw) : [];
      if (Array.isArray(parsed)) this.entries = parsed.filter((e) => e && typeof e.event === 'string');
    } catch {
      this.entries = [];
    }
  }

  private persist(): void {
    try {
      localStorage.setItem(KEY, JSON.stringify(this.entries));
    } catch {
      // A full or blocked storage only loses the playtest log, never progress.
    }
  }

  record(state: GameState, event: string, extra: Partial<TelemetryEntry> = {}): void {
    if (!this.enabled()) return;
    this.load();
    const site = state.empire.sites.find((s) => s.id === state.empire.selectedSiteId);
    this.entries.push({
      t: Date.now(),
      event,
      site: site?.id,
      level: site?.productionLevel,
      balance: state.wallet.obols.serialize(),
      ...extra,
    });
    if (this.entries.length > MAX_ENTRIES) this.entries.splice(0, this.entries.length - MAX_ENTRIES);
    this.persist();
  }

  push(state: GameState): void {
    if (this.pushedThisSession) return;
    this.pushedThisSession = true;
    this.record(state, 'first_push');
  }

  onEvents(state: GameState, events: GameEvent[]): void {
    if (!this.enabled()) return;
    for (const e of events) {
      switch (e.type) {
        case 'SummitReached':
          if (state.counters.totalClimbs <= 1) this.record(state, 'first_summit', { site: e.siteId });
          break;
        case 'PreludeCompleted':
          this.record(state, 'first_summit', { price: e.offering.serialize(), detail: 'prelude' });
          break;
        case 'PurchaseCompleted':
          this.record(state, e.kind === 'flywheel' ? 'wheel_purchase' : e.kind === 'foreman' ? 'foreman_purchase' : 'purchase', {
            site: e.siteId ?? state.empire.selectedSiteId,
            price: e.cost.serialize(),
            detail: e.count ? `${e.kind}×${e.count}` : e.kind,
          });
          break;
        case 'FlywheelCharged':
          this.record(state, 'wheel_charge', { site: e.siteId });
          break;
        case 'SiteOpened':
          this.record(state, 'site_open', { site: e.siteId });
          break;
        case 'WorkInstalled':
          this.record(state, 'work_purchase', { detail: e.workId + (e.free ? ' (restored)' : '') });
          break;
        case 'RelicGranted':
          this.record(state, 'relic_grant', { detail: e.relicId });
          break;
        case 'PrestigeCompleted':
          this.record(state, 'prestige_confirm', { detail: e.award });
          break;
      }
    }
  }

  count(): number {
    this.load();
    return this.entries.length;
  }

  export(): string {
    this.load();
    return JSON.stringify({ format: 'sisyphus-unchained-telemetry', entries: this.entries }, null, 1);
  }

  clear(): void {
    this.entries = [];
    this.loaded = true;
    try {
      localStorage.removeItem(KEY);
    } catch {
      /* nothing to clear */
    }
  }
}
