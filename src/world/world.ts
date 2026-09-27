import { Application, Circle, Container, Graphics, Text } from 'pixi.js';
import type { Game } from '../app/game';
import { catalog } from '../content/catalog';
import { formatMoney } from '../core/format';
import { ascentRate } from '../core/formulas';
import { findSite } from '../core/sim';
import type { GameEvent, SiteState } from '../core/state';
import {
  descentPoint,
  FLYWHEEL,
  GROUND_Y,
  HESITATE,
  HILL,
  IMPACT,
  PULLEY,
  REST_SPOT,
  returnPoint,
  routePoint,
  STAGE_W,
  STONE_R,
  surfaceY,
  TARGET,
  UP_DIR,
  type Vec,
} from './geometry';
import { GREY } from './palette';

interface Particle {
  g: Graphics;
  vx: number;
  vy: number;
  life: number;
  max: number;
}

interface FloatText {
  t: Text;
  life: number;
}

export interface Insets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/**
 * Greybox world renderer. It reads authoritative state and draws simple
 * stand-ins at fixed route anchors; production art replaces the draw calls
 * behind the same anchors (see assets.ts). It never grants rewards.
 */
export class World {
  private app = new Application();
  private stage = new Container();
  private staticLayer = new Graphics();
  private dynamic = new Graphics();
  private stone = new Container();
  private stoneG = new Graphics();
  private hotspot = new Container();
  private fx = new Container();
  private particles: Particle[] = [];
  private texts: FloatText[] = [];
  private insets: Insets = { top: 0, right: 0, bottom: 0, left: 0 };
  private staticKey = '';
  private lastStone: Vec | null = null;
  private wheelAngle = 0;
  private wheelSpin = 0;
  private stride = 0;
  private sisX = REST_SPOT.x;
  private shadeX = REST_SPOT.x;
  private time = 0;
  private stonePulse = 0;
  private shake = 0;
  private flash = 0;

  constructor(private game: Game) {}

  async mount(el: HTMLElement): Promise<void> {
    await this.app.init({
      resizeTo: el,
      background: GREY.sky,
      antialias: true,
      autoDensity: true,
      resolution: Math.min(2, window.devicePixelRatio || 1),
    });
    el.appendChild(this.app.canvas);
    this.app.canvas.setAttribute('aria-hidden', 'true');

    this.stoneG.circle(0, 0, STONE_R).fill(GREY.stone);
    this.stoneG.moveTo(0, 0).lineTo(STONE_R * 0.85, 0).stroke({ width: 4, color: GREY.sky });
    this.stone.addChild(this.stoneG);
    this.stage.addChild(this.staticLayer, this.dynamic, this.stone, this.fx, this.hotspot);

    this.hotspot.eventMode = 'static';
    this.hotspot.cursor = 'pointer';
    this.hotspot.on('pointerdown', () => this.pushStart());
    this.hotspot.on('pointerup', () => this.pushEnd());
    this.hotspot.on('pointerupoutside', () => this.pushEnd());
    this.app.stage.addChild(this.stage);

    this.game.onEvents((events) => this.onEvents(events));
    this.app.ticker.add((ticker) => {
      this.game.frame(performance.now());
      this.update(ticker.deltaMS / 1000);
    });
  }

  onPush: ((held: boolean) => void) | null = null;
  private pushStart() {
    this.onPush?.(true);
  }
  private pushEnd() {
    this.onPush?.(false);
  }

  setInsets(insets: Insets): void {
    this.insets = insets;
  }

  private layout(): void {
    const w = this.app.screen.width;
    const h = this.app.screen.height;
    const availW = Math.max(100, w - this.insets.left - this.insets.right);
    const availH = Math.max(100, h - this.insets.top - this.insets.bottom);
    const region = { x: 40, y: 190, w: 1600, h: 700 };
    const scale = Math.min(availW / region.w, availH / region.h);
    const target = {
      x: this.insets.left + (availW - region.w * scale) / 2 - region.x * scale,
      y: this.insets.top + (availH - region.h * scale) / 2 - region.y * scale,
    };
    // Ease toward the framing so drawer changes are gentle, not jumpy.
    const k = this.game.state.options.reducedMotion ? 1 : 0.15;
    this.stage.scale.set(this.stage.scale.x + (scale - this.stage.scale.x) * k || scale);
    this.stage.x += (target.x - this.stage.x) * k;
    this.stage.y += (target.y - this.stage.y) * k;
    if (this.shake > 0) {
      this.stage.x += (Math.random() - 0.5) * this.shake;
      this.stage.y += (Math.random() - 0.5) * this.shake;
    }
  }

  private drawStatic(site: SiteState): void {
    const s = this.game.state;
    const works = s.empire.purchasedWorkIds.filter((id) => catalog.works.find((w) => w.id === id)?.siteId === site.id);
    const tier = catalog.levels.milestones.filter((m) => m <= site.productionLevel).length;
    const key = `${site.id}|${tier}|${site.wheelOwned}|${works.join(',')}`;
    if (key === this.staticKey) return;
    this.staticKey = key;

    const g = this.staticLayer;
    g.clear();
    const line = { width: 3, color: GREY.line };
    // Ground and foreground return chute.
    g.rect(-4000, GROUND_Y, STAGE_W + 8000, 2000).fill(GREY.ground);
    g.rect(-4000, GROUND_Y, STAGE_W + 8000, 92).fill(GREY.chute);
    g.moveTo(-4000, GROUND_Y).lineTo(STAGE_W + 4000, GROUND_Y).stroke(line);
    // Hill.
    const { footLeft: a, summitLeft: b, summitRight: c, footRight: d } = HILL;
    g.poly([a.x, a.y, b.x, b.y, c.x, c.y, d.x, d.y]).fill(GREY.hill).stroke(line);

    // Installation tiers at milestone anchors (placeholders for install_level_*).
    if (tier >= 1) {
      for (let u = 0.15; u < 0.95; u += 0.2) {
        const p = { x: a.x + (b.x - a.x) * u, y: surfaceY(a.x + (b.x - a.x) * u) };
        g.moveTo(p.x, p.y).lineTo(p.x, p.y - 70).stroke({ width: 4, color: GREY.wheel });
      }
    }
    if (tier >= 2) {
      g.moveTo(a.x + 60, GROUND_Y).lineTo(b.x - 40, b.y + 40).stroke({ width: 8, color: GREY.target, alpha: 0.7 });
    }
    // Pulley post appears with the flywheel.
    if (site.wheelOwned) {
      g.moveTo(PULLEY.x, HILL.summitLeft.y).lineTo(PULLEY.x, PULLEY.y).stroke({ width: 6, color: GREY.line });
      g.circle(PULLEY.x, PULLEY.y, 10).fill(GREY.wheel).stroke({ width: 2, color: GREY.line });
    }
    // Work emblems (placeholders for work_* installations).
    works.forEach((_, i) => {
      g.rect(1110 + i * 44, 250, 34, 34).fill(GREY.gold).stroke({ width: 2, color: GREY.line });
    });
    // Milestone stamps beyond 50.
    for (let i = 3; i < tier; i++) g.circle(930 - (i - 3) * 40, 250, 14).stroke({ width: 3, color: GREY.gold });
  }

  private stonePosition(site: SiteState): Vec {
    const c = catalog.cycle;
    if (site.phase === 'ascending') return routePoint(site.phaseProgress);
    if (site.phase === 'descending') return descentPoint(site.phaseProgress / c.descentSeconds);
    return returnPoint(site.phaseProgress / c.returnSeconds);
  }

  private update(dt: number): void {
    const s = this.game.state;
    const site = findSite(s, s.empire.selectedSiteId);
    if (!site) return;
    this.time += dt;
    this.layout();
    this.drawStatic(site);

    const reduced = s.options.reducedMotion;
    const pos = this.stonePosition(site);
    if (this.lastStone) this.stone.rotation += (pos.x - this.lastStone.x) / STONE_R;
    this.lastStone = pos;
    this.stonePulse = Math.max(0, this.stonePulse - dt * 3);
    this.stone.position.set(pos.x, pos.y);
    this.stone.scale.set(1 + 0.12 * Math.sin(this.stonePulse * Math.PI));
    this.hotspot.hitArea = new Circle(pos.x - 40, pos.y, 130);
    this.shake = reduced ? 0 : Math.max(0, this.shake - dt * 40);
    this.flash = Math.max(0, this.flash - dt * 1.5);

    const automated = s.empire.foremanOwned;
    const held = this.game.manualHeld;
    const rate = ascentRate(s, site, { manualHeld: held, offline: false });
    const g = this.dynamic;
    g.clear();

    // Flywheel: spins when struck, turns steadily once charged.
    const baseSpin = site.wheelCharged ? (site.phase === 'ascending' ? rate * 12 : 0.6) : 0;
    this.wheelSpin = baseSpin + (this.wheelSpin - baseSpin) * Math.exp(-dt * 1.2);
    this.wheelAngle += this.wheelSpin * dt;
    if (site.wheelOwned) {
      const alpha = site.wheelCharged ? 1 : 0.5;
      g.circle(FLYWHEEL.x, FLYWHEEL.y, FLYWHEEL.r).stroke({ width: 6, color: GREY.wheel, alpha });
      for (let i = 0; i < 6; i++) {
        const a = this.wheelAngle + (i * Math.PI) / 3;
        g.moveTo(FLYWHEEL.x, FLYWHEEL.y)
          .lineTo(FLYWHEEL.x + Math.cos(a) * FLYWHEEL.r, FLYWHEEL.y + Math.sin(a) * FLYWHEEL.r)
          .stroke({ width: 4, color: GREY.wheel, alpha });
      }
      g.circle(FLYWHEEL.x, FLYWHEEL.y, 12).fill({ color: GREY.line, alpha });
      if (this.flash > 0) g.circle(FLYWHEEL.x, FLYWHEEL.y, FLYWHEEL.r + 30 * (1 - this.flash)).stroke({ width: 4, color: GREY.gold, alpha: this.flash });
      // Rope: stored descent energy helping the climb.
      if (site.wheelCharged && site.phase === 'ascending') {
        g.moveTo(FLYWHEEL.x, FLYWHEEL.y).lineTo(PULLEY.x, PULLEY.y).lineTo(pos.x, pos.y).stroke({ width: 2, color: GREY.line });
      }
    }

    // Target waiting at the impact area.
    if (site.phase !== 'returning') {
      const kind = site.snapshot.bonusTargetId;
      const color = kind === 'gilded_offering' ? GREY.gold : kind === 'coin_amphora' ? GREY.target : GREY.shade;
      const h = kind === 'debris' || kind === 'expected' ? 24 : 54;
      g.rect(TARGET.x - 18, TARGET.y - h, 36, h).fill(color).stroke({ width: 2, color: GREY.line });
    }

    // Pushers. The shade works the route once automated; Sisyphus steps aside
    // unless he is helping.
    const sisPushing = !automated || held;
    const behind = (offset: number) => {
      const fx = pos.x - UP_DIR.x * (STONE_R + offset);
      return fx;
    };
    const walkX = (t: number, from: number, to: number) => from + (to - from) * Math.min(1, Math.max(0, t));
    const summitX = behind(40);
    const startX = routePoint(0).x - UP_DIR.x * (STONE_R + 40);
    const pusherTarget = (offset: number): number => {
      if (site.phase === 'ascending') return behind(offset);
      if (site.phase === 'descending') {
        const t = site.phaseProgress / catalog.cycle.descentSeconds;
        return t < HESITATE + 0.05 ? routePoint(1).x - UP_DIR.x * (STONE_R + offset) : walkX((t - 0.15) / 0.8, summitX, startX - offset + 40);
      }
      return startX - offset + 40;
    };
    const sisTarget = sisPushing ? pusherTarget(40) : REST_SPOT.x;
    const shadeTarget = automated ? pusherTarget(held ? 110 : 40) : REST_SPOT.x - 200;
    const follow = (cur: number, to: number) => {
      const max = 900 * dt;
      return Math.abs(to - cur) <= max ? to : cur + Math.sign(to - cur) * max;
    };
    const prevSis = this.sisX;
    this.sisX = site.phase === 'ascending' && sisPushing ? sisTarget : follow(this.sisX, sisTarget);
    this.shadeX = site.phase === 'ascending' && automated ? shadeTarget : follow(this.shadeX, shadeTarget);
    this.stride += Math.abs(this.sisX - prevSis) * 0.08 + rate * dt * 30;

    if (automated) this.drawPerson(g, this.shadeX, GREY.shade, 0.75, site.phase === 'ascending');
    this.drawPerson(g, this.sisX, GREY.sisyphus, 1, sisPushing && site.phase === 'ascending');

    // First-push affordance.
    if (!s.discoveries.tutorialIds.includes('first_summit') && !held) {
      const r = STONE_R + 14 + Math.sin(this.time * 4) * 6;
      g.circle(pos.x, pos.y, r).stroke({ width: 4, color: GREY.gold, alpha: 0.8 });
    }

    this.updateFx(dt);
  }

  /** Greybox person: a capsule body and head, leaning when pushing. */
  private drawPerson(g: Graphics, x: number, color: number, alpha: number, pushing: boolean): void {
    const y = surfaceY(x);
    const lean = pushing ? 0.5 : 0;
    const bob = Math.sin(this.stride) * 3;
    const top = { x: x + Math.sin(lean) * 110, y: y - Math.cos(lean) * 110 + bob };
    g.moveTo(x, y).lineTo(top.x, top.y).stroke({ width: 26, color, alpha, cap: 'round' });
    g.circle(top.x + Math.sin(lean) * 26, top.y - Math.cos(lean) * 26, 15).fill({ color, alpha });
  }

  // ------------------------------------------------------------------ effects

  private onEvents(events: GameEvent[]): void {
    const s = this.game.state;
    const selected = s.empire.selectedSiteId;
    const reduced = s.options.reducedMotion;
    for (const e of events) {
      if ('siteId' in e && e.siteId && e.siteId !== selected && e.type !== 'SiteOpened') continue;
      switch (e.type) {
        case 'SummitReached': {
          const p = routePoint(1);
          this.floatText(`+${formatMoney(e.amount)}`, p.x, p.y - 80, GREY.text);
          if (!reduced) this.burst(p.x, p.y - 30, 5, GREY.gold);
          break;
        }
        case 'ImpactResolved': {
          this.floatText(`+${formatMoney(e.amount)}`, IMPACT.x, IMPACT.y - 90, GREY.text);
          if (!e.bonus.isZero()) this.floatText(`+${formatMoney(e.bonus)} bonus`, TARGET.x, TARGET.y - 150, GREY.gold);
          this.wheelSpin += 14;
          if (!reduced) {
            this.burst(TARGET.x, TARGET.y - 20, 10, GREY.shade);
            this.shake = 6;
          }
          break;
        }
        case 'FlywheelCharged':
          this.flash = 1;
          break;
        case 'PurchaseCompleted':
          this.stonePulse = 1;
          break;
        case 'MilestoneReached':
          this.floatText(`Level ${e.level} · ×2`, routePoint(0.5).x, routePoint(0.5).y - 140, GREY.gold);
          break;
        case 'SiteOpened':
          this.staticKey = '';
          this.lastStone = null;
          break;
      }
    }
  }

  private floatText(text: string, x: number, y: number, color: number): void {
    const t = new Text({ text, style: { fontFamily: 'Georgia, serif', fontSize: 34, fontWeight: '700', fill: color } });
    t.anchor.set(0.5);
    t.position.set(x, y);
    this.fx.addChild(t);
    this.texts.push({ t, life: 1.4 });
    if (this.texts.length > 8) {
      const old = this.texts.shift()!;
      old.t.destroy();
    }
  }

  private burst(x: number, y: number, n: number, color: number): void {
    for (let i = 0; i < n; i++) {
      const g = new Graphics().rect(-5, -5, 10, 10).fill(color);
      g.position.set(x, y);
      this.fx.addChild(g);
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.2;
      const v = 250 + Math.random() * 250;
      this.particles.push({ g, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.9, max: 0.9 });
    }
    while (this.particles.length > 80) this.particles.shift()!.g.destroy();
  }

  private updateFx(dt: number): void {
    for (const p of this.particles) {
      p.life -= dt;
      p.vy += 900 * dt;
      p.g.x += p.vx * dt;
      p.g.y += p.vy * dt;
      p.g.rotation += dt * 6;
      p.g.alpha = Math.max(0, p.life / p.max);
    }
    this.particles = this.particles.filter((p) => (p.life > 0 ? true : (p.g.destroy(), false)));
    for (const f of this.texts) {
      f.life -= dt;
      f.t.y -= 50 * dt;
      f.t.alpha = Math.min(1, Math.max(0, f.life));
    }
    this.texts = this.texts.filter((f) => (f.life > 0 ? true : (f.t.destroy(), false)));
  }

  destroy(): void {
    this.app.destroy(true);
  }
}
