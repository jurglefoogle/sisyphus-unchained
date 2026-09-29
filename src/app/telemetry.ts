import type { GameEvent, GameState } from '../core/state';

/**
 * Local playtest event log (spec §06 "Product telemetry"). Recording happens
 * only while the player has opted in; nothing leaves the device except by the
 * manual export in Settings. Entries carry no personal content or device ids.
 */

const KEY = 'sisyphus-unchained-telemetry';
const MAX_ENTRIES = 5000;

/** The choices each hill's machine and the later systems ask for; purchases are logged separately. */
const DECISIONS = new Set([
  'SetStewardOrder', 'SetTrim', 'TakeBargain', 'Vent', 'SetVentAt', 'Drill', 'Patch', 'SetJarTarget', 'SetSplit',
  'PourNext', 'TurnSky', 'Mount', 'HireClerk', 'SetOnDuty', 'FileAppeal', 'Remember', 'KeepOnFile', 'Unseal', 'Summon',
]);

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
      balance: site?.purse.serialize(),
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

  /** An applied command that is a machine or system decision, with its arguments (e.g. `SetTrim trim=3`). */
  decision(state: GameState, command: { type: string }): void {
    if (!this.enabled() || !DECISIONS.has(command.type)) return;
    const args = Object.entries(command)
      .filter(([k]) => k !== 'type')
      .map(([k, v]) => `${k}=${v}`)
      .join(' ');
    this.record(state, 'decision', { detail: args ? `${command.type} ${args}` : command.type });
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
        case 'StoneSlipped':
          this.record(state, 'prelude_fall', { site: e.siteId, detail: `${Math.round(e.height * 100)}%${e.record ? ':record' : ''}` });
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
        case 'ImpactResolved':
          if (e.targetId !== 'debris' && e.targetId !== 'expected') {
            this.record(state, 'bonus_target', { site: e.siteId, detail: e.targetId });
          }
          break;
        case 'MilestoneReached':
          this.record(state, 'milestone', { site: e.siteId, level: e.level });
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
        case 'CharterSigned':
          this.record(state, 'charter_signed');
          break;
        case 'Eruption':
          this.record(state, 'eruption', { site: e.siteId, detail: `heat=${e.heat.toFixed(2)} power=${e.power.toFixed(2)}` });
          break;
        case 'DeviceRevealed':
          this.record(state, 'device_reveal', { site: e.siteId, detail: e.deviceId + (e.firstTime ? ' (new)' : '') });
          break;
        case 'VisitorArrived':
          this.record(state, 'visitor_arrive', { site: e.siteId, detail: e.visitorId });
          break;
        case 'StewardHired':
          this.record(state, 'steward_hire', { site: e.siteId, detail: e.paidWith });
          break;
        case 'Rumour':
          this.record(state, 'rumour', { detail: e.whisperId });
          break;
        case 'Edict':
          this.record(state, 'edict', { detail: e.edictId });
          break;
        case 'AppealFiled':
          this.record(state, 'appeal_filed', { detail: `${e.number}:${e.award}` });
          break;
        case 'LaurelWon':
          this.record(state, 'laurel', { detail: e.number });
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
