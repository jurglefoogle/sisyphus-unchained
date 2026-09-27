import { Application, Circle, Container, Graphics, Text } from 'pixi.js';
import type { Game } from '../app/game';
import { catalog } from '../content/catalog';
import { formatMoney } from '../core/format';
import { ascentLimit, ascentRate, slipSeconds } from '../core/formulas';
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
  UP_NORMAL,
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
  private stoneKey = '';
  private slipX: number | null = null;
  private summitGlow = 0;

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

  private grip(id: string): boolean {
    const p = this.game.state.prelude;
    return p.complete || p.upgradeIds.includes(id);
  }

  /** The stone starts jagged; prelude upgrades chip and grind it round (stone states in assets.ts). */
  private drawStone(site: SiteState): void {
    const first = site.id === catalog.sites[0].id;
    const shape = !first || this.grip('grind_round') ? 'round' : this.grip('chip_burrs') ? 'chipped' : 'rough';
    if (shape === this.stoneKey) return;
    this.stoneKey = shape;
    const g = this.stoneG;
    g.clear();
    if (shape === 'round') {
      g.circle(0, 0, STONE_R).fill(GREY.stone);
    } else {
      // Fixed irregular outlines so the stone reads the same every frame.
      const radii =
        shape === 'rough'
          ? [1.08, 0.8, 1.02, 0.86, 1.1, 0.78, 0.98, 0.84, 1.06, 0.82, 1.0]
          : [1.02, 0.93, 1.0, 0.95, 1.03, 0.92, 0.99];
      const pts: number[] = [];
      radii.forEach((r, i) => {
        const a = (i / radii.length) * Math.PI * 2;
        pts.push(Math.cos(a) * STONE_R * r, Math.sin(a) * STONE_R * r);
      });
      g.poly(pts).fill(GREY.stone).stroke({ width: 2, color: GREY.line });
    }
    g.moveTo(0, 0).lineTo(STONE_R * 0.7, 0).stroke({ width: 4, color: GREY.sky });
  }

  private drawStatic(site: SiteState): void {
    const s = this.game.state;
    const works = s.empire.purchasedWorkIds.filter((id) => catalog.works.find((w) => w.id === id)?.siteId === site.id);
    const tier = catalog.levels.milestones.filter((m) => m <= site.productionLevel).length;
    const footholds = site.id === catalog.sites[0].id && this.grip('cut_footholds');
    const key = `${site.id}|${tier}|${site.wheelOwned}|${works.join(',')}|${footholds}`;
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

    // Footholds cut into the steep upper route (placeholder for route_footholds).
    if (footholds) {
      for (let u = 0.5; u < 0.97; u += 0.065) {
        const x = a.x + (b.x - a.x) * u;
        const y = surfaceY(x);
        g.poly([x - 16, y + 9, x + 8, y - 4, x + 8, y + 9]).fill(GREY.ground);
      }
    }

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
    if (site.phase === 'slipping') {
      // Rolls back from where grip gave out, gathering speed toward the foot.
      const h = site.snapshot.slipHeight;
      const t = Math.min(1, site.phaseProgress / slipSeconds(h));
      return routePoint(h * (1 - t * t));
    }
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
    this.drawStone(site);

    const reduced = s.options.reducedMotion;
    const held = this.game.manualHeld;
    const limit = ascentLimit(s, site);
    // Near the grip limit the stone shudders and Sisyphus strains.
    const strain =
      site.phase === 'ascending' && limit < 1 && held ? Math.max(0, 1 - (limit - site.phaseProgress) / 0.06) : 0;
    const pos = { ...this.stonePosition(site) };
    if (strain > 0 && !reduced) {
      pos.x += (Math.random() - 0.5) * 6 * strain;
      pos.y += (Math.random() - 0.5) * 4 * strain;
    }
    if (this.lastStone) this.stone.rotation += (pos.x - this.lastStone.x) / STONE_R;
    this.lastStone = pos;
    this.stonePulse = Math.max(0, this.stonePulse - dt * 3);
    this.stone.position.set(pos.x, pos.y);
    this.stone.scale.set(1 + 0.12 * Math.sin(this.stonePulse * Math.PI));
    this.hotspot.hitArea = new Circle(pos.x - 40, pos.y, 130);
    this.shake = reduced ? 0 : Math.max(0, this.shake - dt * 40);
    this.flash = Math.max(0, this.flash - dt * 1.5);
    this.summitGlow = Math.max(0, this.summitGlow - dt * 0.6);

    const automated = s.empire.foremanOwned;
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
    const slipping = site.phase === 'slipping';
    const sisTarget = slipping && this.slipX !== null ? this.slipX : sisPushing ? pusherTarget(40) : REST_SPOT.x;
    const shadeTarget = automated ? pusherTarget(held ? 110 : 40) : REST_SPOT.x - 200;
    const follow = (cur: number, to: number) => {
      const max = 900 * dt;
      return Math.abs(to - cur) <= max ? to : cur + Math.sign(to - cur) * max;
    };
    const prevSis = this.sisX;
    // Glued to the stone while pushing, but after a slip he walks back down first.
    const glued =
      site.phase === 'ascending' && sisPushing && Math.abs(this.sisX - sisTarget) <= Math.max(30, 900 * dt);
    this.sisX = glued ? sisTarget : follow(this.sisX, sisTarget);
    if (!slipping) this.slipX = null;
    this.shadeX = site.phase === 'ascending' && automated ? shadeTarget : follow(this.shadeX, shadeTarget);
    this.stride += Math.abs(this.sisX - prevSis) * 0.08 + rate * dt * 30;

    if (automated) this.drawPerson(g, this.shadeX, GREY.shade, 0.75, site.phase === 'ascending' ? 0.5 : 0);
    // Knocked flat by the slip, leaning into the strain, or upright.
    const lean = slipping ? -1.35 : sisPushing && glued ? 0.5 + 0.25 * strain : 0;
    this.drawPerson(g, this.sisX, GREY.sisyphus, 1, lean, this.grip('wrap_feet'));

    // High-water mark: the best height so far, while the stone still slips.
    if (!s.prelude.complete && s.prelude.bestHeight > 0 && site.id === catalog.sites[0].id) {
      const p = routePoint(s.prelude.bestHeight);
      const base = { x: p.x - UP_NORMAL.x * STONE_R, y: p.y - UP_NORMAL.y * STONE_R };
      g.moveTo(base.x, base.y).lineTo(base.x, base.y - 70).stroke({ width: 3, color: GREY.line });
      g.poly([base.x, base.y - 70, base.x + 34, base.y - 60, base.x, base.y - 50]).fill(GREY.gold);
    }
    if (this.summitGlow > 0) {
      const p = routePoint(1);
      g.circle(p.x, p.y, 60 + 260 * (1 - this.summitGlow)).stroke({ width: 8, color: GREY.gold, alpha: this.summitGlow });
    }

    // First-push affordance.
    if (!s.discoveries.tutorialIds.includes('first_summit') && !held) {
      const r = STONE_R + 14 + Math.sin(this.time * 4) * 6;
      g.circle(pos.x, pos.y, r).stroke({ width: 4, color: GREY.gold, alpha: 0.8 });
    }

    this.updateFx(dt);
  }

  /** Greybox person: a capsule body and head; `lean` in radians (negative = fallen back). */
  private drawPerson(g: Graphics, x: number, color: number, alpha: number, lean: number, wrapped = false): void {
    const y = surfaceY(x);
    const bob = lean < -1 ? 0 : Math.sin(this.stride) * 3;
    const top = { x: x + Math.sin(lean) * 110, y: y - Math.cos(lean) * 110 + bob };
    g.moveTo(x, y).lineTo(top.x, top.y).stroke({ width: 26, color, alpha, cap: 'round' });
    g.circle(top.x + Math.sin(lean) * 26, top.y - Math.cos(lean) * 26, 15).fill({ color, alpha });
    // Rag foot wraps (placeholder for the sisyphus feet_wrapped variant).
    if (wrapped) g.roundRect(x - 17, y - 14, 34, 14, 5).fill({ color: GREY.chute, alpha });
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
        case 'StoneSlipped': {
          const p = routePoint(e.height);
          this.slipX = this.sisX;
          if (e.record) this.floatText(`New height: ${Math.round(e.height * 100)}%`, p.x, p.y - 130, GREY.gold);
          else this.floatText('Slipped', p.x, p.y - 110, GREY.text);
          if (!reduced) {
            this.burst(p.x - 30, p.y + 30, 8, GREY.ground);
            this.shake = 5;
          }
          break;
        }
        case 'FallResolved': {
          const p = routePoint(0);
          this.floatText(`+${formatMoney(e.amount)}`, p.x, p.y - 100, GREY.text);
          if (!reduced) {
            this.burst(p.x, p.y + 20, 6, GREY.gold);
            this.shake = 4;
          }
          break;
        }
        case 'PreludeCompleted': {
          const p = routePoint(1);
          // Beside the summit, clear of the story banner, and held longer than usual.
          this.floatText('THE SUMMIT', p.x - 260, p.y + 40, GREY.gold, 3);
          this.floatText(`+${formatMoney(e.offering)} offering`, p.x - 260, p.y + 90, GREY.text, 3);
          this.summitGlow = 1;
          if (!reduced) {
            this.burst(p.x, p.y - 30, 40, GREY.gold);
            this.shake = 12;
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

  private floatText(text: string, x: number, y: number, color: number, life = 1.4): void {
    const t = new Text({ text, style: { fontFamily: 'Georgia, serif', fontSize: 34, fontWeight: '700', fill: color } });
    t.anchor.set(0.5);
    t.position.set(x, y);
    this.fx.addChild(t);
    this.texts.push({ t, life });
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
