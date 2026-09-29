import type { GameEvent, Options } from '../core/state';
import { audioUrl, siteMusic, siteImpact } from '../world/library';

type Bus = 'effects' | 'music' | 'interface';

/** Seconds between repeats of one sound; bulk settles collapse to one play. */
const MIN_GAP = 0.09;
const MUSIC_FADE = 1.5;
/** While the drawer is open the world keeps sounding, a little quieter (spec §04). */
const DRAWER_DIM = 0.6;
/** Machine ambience and music duck under dialogue and major discoveries. */
const DUCK_MUSIC = 0.35;
const DUCK_EFFECTS = 0.7;
const SCRAPE_GAIN = 0.22;

/**
 * Plays the pottery-v1 audio library (prototype WAVs; mix approval pending).
 * Three buses with separate volumes. Nothing plays until the first user
 * gesture, and only the selected site makes cycle sounds.
 */
export class Sound {
  private ctx: AudioContext | null = null;
  private buses: Partial<Record<Bus, GainNode>> = {};
  private buffers = new Map<string, Promise<AudioBuffer | null>>();
  private lastPlayed = new Map<string, number>();
  private music: { id: string; src: AudioBufferSourceNode; gain: GainNode } | null = null;
  private wantedMusic: string | null = null;
  private volumes: Record<Bus, number> = { effects: 0.7, music: 0.4, interface: 0.5 };
  private drawerOpen = false;
  private ducked = false;
  private duckTimer: ReturnType<typeof setTimeout> | undefined;
  /** The one foreground scrape: loops while Sisyphus pushes, silent over the summit and descent. */
  private scrape: { src: AudioBufferSourceNode; gain: GainNode } | null = null;
  private pushing = false;
  private climbing = true;

  /** Call from a user gesture; browsers keep audio locked until then. */
  unlock(): void {
    if (!this.ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      this.ctx = new Ctor();
      for (const bus of ['effects', 'music', 'interface'] as Bus[]) {
        const g = this.ctx.createGain();
        g.gain.value = this.busLevel(bus);
        g.connect(this.ctx.destination);
        this.buses[bus] = g;
      }
      if (this.wantedMusic) this.setMusic(this.wantedMusic);
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  /** Pause output while the tab is hidden. */
  setHidden(hidden: boolean): void {
    if (!this.ctx) return;
    if (hidden) void this.ctx.suspend();
    else void this.ctx.resume();
  }

  setVolumes(o: Pick<Options, 'effectsVolume' | 'musicVolume' | 'interfaceVolume'>): void {
    this.volumes = { effects: o.effectsVolume, music: o.musicVolume, interface: o.interfaceVolume };
    this.applyLevels(0.05);
  }

  private busLevel(bus: Bus): number {
    let level = this.volumes[bus];
    if (bus === 'interface') return level;
    if (this.drawerOpen) level *= DRAWER_DIM;
    if (this.ducked) level *= bus === 'music' ? DUCK_MUSIC : DUCK_EFFECTS;
    return level;
  }

  private applyLevels(timeConstant: number): void {
    if (!this.ctx) return;
    for (const bus of Object.keys(this.volumes) as Bus[]) {
      this.buses[bus]?.gain.setTargetAtTime(this.busLevel(bus), this.ctx.currentTime, timeConstant);
    }
  }

  setDrawerOpen(open: boolean): void {
    if (this.drawerOpen === open) return;
    this.drawerOpen = open;
    this.applyLevels(0.12);
  }

  /** Lower music and machine ambience while dialogue or a discovery has the stage. */
  duck(seconds: number): void {
    this.ducked = true;
    this.applyLevels(0.15);
    clearTimeout(this.duckTimer);
    this.duckTimer = setTimeout(() => {
      this.ducked = false;
      this.applyLevels(0.6);
    }, seconds * 1000);
  }

  /** Manual effort on the selected site: a restrained scrape while the stone climbs. */
  setPushing(on: boolean): void {
    this.pushing = on;
    this.updateScrape();
  }

  private updateScrape(): void {
    const want = this.pushing && this.climbing;
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running') return;
    if (!want) {
      if (this.scrape) {
        const { src, gain } = this.scrape;
        gain.gain.setTargetAtTime(0, ctx.currentTime, 0.08);
        src.stop(ctx.currentTime + 0.5);
        this.scrape = null;
      }
      return;
    }
    if (this.scrape || this.volumes.effects <= 0) return;
    const pending = { src: ctx.createBufferSource(), gain: ctx.createGain() };
    this.scrape = pending;
    void this.load('sfx_scrape').then((buffer) => {
      if (!buffer || !this.ctx || this.scrape !== pending) return;
      pending.src.buffer = buffer;
      pending.src.loop = true;
      pending.gain.gain.value = 0;
      pending.gain.gain.setTargetAtTime(SCRAPE_GAIN, this.ctx.currentTime, 0.1);
      pending.src.connect(pending.gain).connect(this.buses.effects!);
      pending.src.start();
    });
  }

  private load(id: string): Promise<AudioBuffer | null> {
    let p = this.buffers.get(id);
    if (!p) {
      const ctx = this.ctx!;
      p = fetch(audioUrl(id))
        .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))))
        .then((data) => ctx.decodeAudioData(data))
        .catch(() => {
          console.warn(`Audio unavailable: ${id}`);
          return null;
        });
      this.buffers.set(id, p);
    }
    return p;
  }

  play(id: string, bus: Bus = 'effects', gain = 1, delay = 0): void {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running' || this.volumes[bus] <= 0) return;
    const now = ctx.currentTime;
    if (now - (this.lastPlayed.get(id) ?? -1) < MIN_GAP) return;
    this.lastPlayed.set(id, now);
    void this.load(id).then((buffer) => {
      if (!buffer || !this.ctx) return;
      const src = this.ctx.createBufferSource();
      src.buffer = buffer;
      const g = this.ctx.createGain();
      g.gain.value = gain;
      src.connect(g).connect(this.buses[bus]!);
      src.start(Math.max(this.ctx.currentTime, now + delay));
    });
  }

  private noise: AudioBuffer | null = null;

  /**
   * The level stamp's chisel: a dry tock of iron on stone for each blow
   * (weight 1), a deep thud as the slab lands (2), a soft set as the stamp
   * joins the wall (0.5). Synthesised so rapid blows never sound identical.
   */
  chisel(weight: number): void {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running' || this.volumes.effects <= 0) return;
    const now = ctx.currentTime;
    if (!this.noise) {
      const len = Math.floor(ctx.sampleRate * 0.4);
      this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    }
    const out = ctx.createGain();
    out.connect(this.buses.effects!);
    const heavy = weight >= 2;
    const soft = weight < 1;
    // Grit: filtered noise, bright for a blow, low for the slab.
    const grit = ctx.createBufferSource();
    grit.buffer = this.noise;
    grit.playbackRate.value = 0.9 + Math.random() * 0.2;
    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = heavy ? 380 : soft ? 1200 : 2600 + Math.random() * 900;
    band.Q.value = heavy ? 0.7 : 1.3;
    const gg = ctx.createGain();
    const decay = heavy ? 0.35 : soft ? 0.12 : 0.07;
    gg.gain.setValueAtTime(0, now);
    gg.gain.linearRampToValueAtTime(heavy ? 0.9 : soft ? 0.25 : 0.55, now + 0.003);
    gg.gain.exponentialRampToValueAtTime(0.0001, now + decay);
    grit.connect(band).connect(gg).connect(out);
    grit.start(now);
    grit.stop(now + decay + 0.02);
    // Body: a short pitched knock (iron on stone) or the slab's boom.
    const o = ctx.createOscillator();
    o.type = 'sine';
    const f = heavy ? 70 : soft ? 240 : 330 + Math.random() * 90;
    o.frequency.setValueAtTime(f * 1.6, now);
    o.frequency.exponentialRampToValueAtTime(f, now + 0.03);
    const og = ctx.createGain();
    const body = heavy ? 0.45 : soft ? 0.1 : 0.09;
    og.gain.setValueAtTime(0, now);
    og.gain.linearRampToValueAtTime(heavy ? 0.8 : 0.35, now + 0.004);
    og.gain.exponentialRampToValueAtTime(0.0001, now + body);
    o.connect(og).connect(out);
    o.start(now);
    o.stop(now + body + 0.02);
  }

  /**
   * A coin dropping into the purse: a short bright tink, synthesised rather
   * than sampled so rapid landings can each take a slightly different pitch.
   */
  tink(): void {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running' || this.volumes.interface <= 0) return;
    const now = ctx.currentTime;
    if (now - (this.lastPlayed.get('tink') ?? -1) < 0.06) return;
    this.lastPlayed.set('tink', now);
    const f = 2300 + Math.random() * 700;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(0.09, now + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
    g.connect(this.buses.interface!);
    // A struck metal disc: the fundamental and an inharmonic partial.
    for (const [ratio, level] of [
      [1, 1],
      [2.76, 0.35],
    ] as const) {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = f * ratio;
      const og = ctx.createGain();
      og.gain.value = level;
      o.connect(og).connect(g);
      o.start(now);
      o.stop(now + 0.25);
    }
  }

  /** Crossfade to a looping track (the 24 s loops wrap their note tails). */
  setMusic(id: string | null): void {
    this.wantedMusic = id;
    const ctx = this.ctx;
    if (!ctx || this.music?.id === id) return;
    const old = this.music;
    this.music = null;
    if (old) {
      old.gain.gain.setTargetAtTime(0, ctx.currentTime, MUSIC_FADE / 4);
      old.src.stop(ctx.currentTime + MUSIC_FADE * 2);
    }
    if (!id) return;
    void this.load(id).then((buffer) => {
      if (!buffer || !this.ctx || this.wantedMusic !== id || this.music) return;
      const src = this.ctx.createBufferSource();
      src.buffer = buffer;
      src.loop = true;
      const g = this.ctx.createGain();
      g.gain.value = 0;
      g.gain.setTargetAtTime(1, this.ctx.currentTime, MUSIC_FADE / 4);
      src.connect(g).connect(this.buses.music!);
      src.start();
      this.music = { id, src, gain: g };
    });
  }

  followSite(siteId: string): void {
    this.setMusic(siteMusic(siteId));
  }

  onEvents(events: GameEvent[], selectedSiteId: string, automated = false): void {
    // A long absence settles in one batch: acknowledge it, don't replay it.
    const bulk = events.length > 40;
    for (const e of events) {
      if ('siteId' in e && e.siteId && e.siteId !== selectedSiteId && e.type !== 'SiteOpened') continue;
      if (bulk && e.type !== 'RelicGranted' && e.type !== 'DecreeAvailable') continue;
      switch (e.type) {
        case 'CycleStarted':
          this.climbing = true;
          this.updateScrape();
          // Automation's soft mechanical pulse, once per climb of the selected site.
          if (automated) this.play('sfx_machine_pulse', 'effects', 0.28);
          break;
        case 'SummitReached':
          this.climbing = false;
          this.updateScrape();
          this.play('sfx_summit', 'effects', 0.8);
          this.play('sfx_roll', 'effects', 0.55, 0.45);
          break;
        case 'ImpactResolved':
          this.play(siteImpact(e.siteId));
          if (!e.bonus.isZero()) this.play('sfx_coin', 'effects', 0.8, 0.12);
          break;
        case 'StoneSlipped':
          this.climbing = false;
          this.updateScrape();
          this.play('sfx_scrape', 'effects', 0.9);
          break;
        case 'FallResolved':
          this.play('sfx_impact_pottery', 'effects', 0.6);
          this.play('sfx_coin', 'effects', 0.6, 0.1);
          break;
        case 'PreludeCompleted':
          this.play('sfx_milestone', 'effects', 1, 0.3);
          break;
        case 'FeatureUnlocked':
        case 'WorkInstalled':
          this.play('sfx_machine_pulse');
          break;
        case 'FlywheelCharged':
          this.play('sfx_wheel_charge', 'effects', 0.8);
          break;
        case 'MilestoneReached':
          this.play('sfx_milestone');
          // Later milestones get a richer sound instead of a new structure.
          if (e.level >= 100) this.play('sfx_coin', 'effects', 0.9, 0.25);
          if (e.level >= 150) this.play('sfx_summit', 'effects', 0.7, 0.45);
          break;
        case 'PurchaseCompleted':
          if (e.kind === 'foreman') this.play('sfx_foreman');
          else if (e.kind !== 'site') this.play('sfx_ui_buy', 'interface');
          break;
        case 'SiteOpened':
          this.play('sfx_site_unlock');
          break;
        case 'DecreeAvailable':
          this.play('sfx_decree');
          break;
        case 'RelicGranted':
          this.duck(3);
          this.play('sfx_relic');
          break;
        case 'PrestigeCompleted':
          this.play('sfx_prestige');
          break;
        case 'CharterSigned':
          this.duck(8);
          this.play('sfx_charter');
          break;
        case 'AchievementUnlocked':
          // The stamp: one thud per batch (the minimum gap swallows repeats).
          this.play('sfx_decree', 'interface', 0.6, 0.2);
          break;
      }
    }
  }
}
