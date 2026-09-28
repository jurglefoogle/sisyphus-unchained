import { Application, Assets, Circle, Container, Graphics, Sprite, Text, Texture } from 'pixi.js';
import type { Game } from '../app/game';
import { catalog } from '../content/catalog';
import { formatMoney } from '../core/format';
import { ascentLimit, ascentRate, slipSeconds } from '../core/formulas';
import { findSite } from '../core/sim';
import type { GameEvent, SiteState } from '../core/state';
import { getAssetState } from './assets';
import type { AssetFrame, AssetState } from './asset-types';
import { Clip } from './clip';
import {
  ASIDE_SPOT,
  descentPoint,
  DRUM,
  FLYWHEEL,
  GROUND_Y,
  HESITATE,
  HILL,
  IMPACT,
  PULLEY,
  returnPoint,
  routePoint,
  SHADE_POST,
  SLOPE_ANGLE,
  STAGE_H,
  STAGE_W,
  STONE_R,
  surfaceY,
  TARGET,
  UP_DIR,
  UP_NORMAL,
  type Vec,
} from './geometry';
import { GREY, POTTERY } from './palette';
import { drawFigure, drawTarget } from './props';
import { DEFAULT_GROUND, paintTerrain, paintVignette, sampleGround } from './terrain';

interface FloatText {
  t: Text;
  life: number;
}

interface Mote {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  life: number;
  max: number;
}

/** A one-shot delivered effect (shatter, coin grant, stamp…) playing once. */
interface Effect {
  clip: Clip;
  state: AssetState;
  start: number;
}

export interface Insets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/*
 * Parent scales. Every delivered layer is sized in stage pixels before parent
 * scaling (delivery.json coordinateSystem); these fit them to the route.
 */
/** Sisyphus ≈ 150 stage px tall, readable at phone scale. */
const SIS_K = 0.62;
/**
 * The stone is drawn larger than its rolling radius so it reads beside him;
 * its centre is lifted along the surface normal to keep it on the ground.
 */
const STONE_VR = 60;
/** Stone art fills ≈ 76% of its canvas; this makes it 2 × STONE_VR across. */
const STONE_K = (2 * STONE_VR) / (256 * 0.76);
const SHADE_K = 0.45;
/** Rotor radius FLYWHEEL.r; the stand then reaches the ground. */
const WHEEL_K = 0.575;
const DRUM_K = 0.35;
const WORK_K = 0.45;
const INSTALL_K = 0.45;
const MARKER_K = 0.42;
/** Feet sit this far behind the stone's contact point, along the route, so his hands meet its back. */
const PUSH_REACH = 136;
/** How much of the slope Sisyphus leans into while pushing. */
const PUSH_LEAN = 0.35;
/** Foot positions in the 256-unit sisyphus_push layer, for the wrap overlay. */
const SIS_FEET = [
  { x: -88, y: -4 },
  { x: 44, y: -4 },
];
/** Works stand on the descent face beside the summit post, then down the route face. */
const WORK_SPOTS = [1140, 1215, 1290, 945, 870, 795, 1365];
/** Milestone installations climb the route (install_level_*). */
const INSTALLS = [
  { level: 10, u: 0.12 },
  { level: 25, u: 0.4 },
  { level: 50, u: 0.66 },
];

/**
 * World renderer. It reads authoritative state and plays the art pipeline's
 * delivery contract (assets.ts → delivery.json) at fixed route anchors. A
 * state that is missing or blocked keeps a greybox stand-in; no other pose is
 * substituted. It never grants rewards.
 */
export class World {
  private app = new Application();
  private stage = new Container();
  private textures = new Map<string, Texture>();
  private pending = new Set<string>();

  private tex = (frame: AssetFrame): Texture | null => this.load(frame);
  private clip = (): Clip => new Clip(this.tex);

  private below = new Graphics();
  private bg = this.clip();
  private installs = new Container();
  private works = new Container();
  private terrain = new Sprite();
  private terrainKey = '';
  private footholds = this.clip();
  private marker = this.clip();
  private ropes = new Graphics();
  private wheel = this.clip();
  private drum = this.clip();
  private target = new Graphics();
  private targetKind = '';
  private shadows = new Graphics();
  private dust = new Graphics();
  private motes: Mote[] = [];
  private moteClock = 0;
  private vignette = new Sprite();
  private shade = this.clip();
  private sis = new Container();
  private sisArt = new Container();
  private sisClip = this.clip();
  private sisGrey = new Graphics();
  private sisWraps = new Graphics();
  private stone = new Container();
  private stoneClip = this.clip();
  private stoneStandIn = new Graphics();
  private knobs = new Graphics();
  private foreground = this.clip();
  private overlay = new Graphics();
  private fx = new Container();
  private hotspot = new Container();

  private effects: Effect[] = [];
  private texts: FloatText[] = [];
  private insets: Insets = { top: 0, right: 0, bottom: 0, left: 0 };

  private staticKey = '';
  private stoneKey = '';
  private installClips: { clip: Clip; level: number }[] = [];
  private workClips: { clip: Clip; id: string }[] = [];
  private workEnteredAt = new Map<string, number>();
  private lastStone: Vec | null = null;
  private wheelClock = 0;
  private wheelSpin = 0;
  private chargedAt = -Infinity;
  private drumClock = 0;
  private markerMovedAt = -Infinity;
  private sisPos: Vec = { ...ASIDE_SPOT };
  private facing = 1;
  private stride = 0;
  private time = 0;
  private stonePulse = 0;
  private shake = 0;
  private slipAt: Vec | null = null;
  private summitGlow = 0;
  /** Purchase confirmations: a bronze ring where the money went, and a bounce on that machine. */
  private rings: { x: number; y: number; age: number; r: number }[] = [];
  private bumps: { obj: Container; base: number; age: number }[] = [];
  /** Decree lightning: 1 when struck, fading to 0. */
  private decreeBolt = 0;
  private boltSeed = 0;
  /** A short, gentle push-in toward a milestone's new structure (spec §04). */
  private milestoneShot: { x: number; y: number; at: number } | null = null;
  /** Portrait camera: the stage x it centres on, easing toward the action. */
  private focusX = 400;
  private camX = -1;

  constructor(private game: Game) {}

  async mount(el: HTMLElement): Promise<void> {
    await this.app.init({
      resizeTo: el,
      background: POTTERY.parchment,
      antialias: true,
      autoDensity: true,
      resolution: Math.min(2, window.devicePixelRatio || 1),
    });
    el.appendChild(this.app.canvas);
    this.app.canvas.setAttribute('aria-hidden', 'true');

    this.sisArt.addChild(this.sisClip, this.sisWraps);
    this.sisArt.scale.set(SIS_K);
    this.sis.addChild(this.sisGrey, this.sisArt);
    this.stone.addChild(this.knobs, this.stoneStandIn, this.stoneClip);
    this.stoneClip.scale.set(STONE_K);
    this.stage.addChild(
      this.below,
      this.bg,
      this.installs,
      this.works,
      this.terrain,
      this.footholds,
      this.marker,
      this.ropes,
      this.wheel,
      this.drum,
      this.shadows,
      this.target,
      this.shade,
      this.sis,
      this.stone,
      this.dust,
      this.foreground,
      this.overlay,
      this.fx,
      this.hotspot,
    );
    this.wheel.position.set(FLYWHEEL.x, FLYWHEEL.y);
    this.wheel.scale.set(WHEEL_K);
    this.drum.position.set(DRUM.x, DRUM.y);
    this.drum.scale.set(DRUM_K);
    this.target.position.set(TARGET.x, surfaceY(TARGET.x));
    this.shade.position.set(SHADE_POST.x, SHADE_POST.y);
    this.shade.scale.set(SHADE_K);
    this.marker.scale.set(MARKER_K);
    // Past the stage's bottom edge the ground continues in ink.
    this.below.rect(-4 * STAGE_W, 896, 9 * STAGE_W, 4000).fill(POTTERY.ink);

    this.hotspot.eventMode = 'static';
    this.hotspot.cursor = 'pointer';
    this.hotspot.on('pointerdown', () => this.onPush?.(true));
    this.hotspot.on('pointerup', () => this.onPush?.(false));
    this.hotspot.on('pointerupoutside', () => this.onPush?.(false));
    this.vignette.texture = Texture.from(paintVignette());
    this.app.stage.addChild(this.stage, this.vignette);

    this.game.onEvents((events) => this.onEvents(events));
    this.app.ticker.add((ticker) => {
      this.game.frame(performance.now());
      this.update(Math.min(0.1, ticker.deltaMS / 1000));
    });
  }

  onPush: ((held: boolean) => void) | null = null;

  setInsets(insets: Insets): void {
    this.insets = insets;
  }

  // ------------------------------------------------------------------ assets

  /** Texture for a delivered frame, or null while it loads. */
  private load(frame: AssetFrame): Texture | null {
    const url = `${import.meta.env.BASE_URL}${frame.url.replace(/^\//, '')}`;
    const t = this.textures.get(url);
    if (t) return t;
    if (!this.pending.has(url)) {
      this.pending.add(url);
      const svg = url.endsWith('.svg');
      // Vectors rasterise sharp without huge full-stage textures; source PNGs
      // are large masters, so mipmaps keep them clean at game scale.
      const resolution = Math.min(4, 3200 / Math.max(...frame.dimensions));
      Assets.load<Texture>({ src: url, data: svg ? { resolution } : { autoGenerateMipmaps: true } })
        .then((loaded) => this.textures.set(url, loaded))
        .catch(() => console.warn(`Asset unavailable, keeping stand-in: ${url}`));
    }
    return null;
  }

  // ------------------------------------------------------------------ layout

  private layout(): void {
    const w = this.app.screen.width;
    const h = this.app.screen.height;
    const availW = Math.max(100, w - this.insets.left - this.insets.right);
    const availH = Math.max(100, h - this.insets.top - this.insets.bottom);
    // The whole loop, from the shade's post to the target, with sky enough for
    // the summit flourish; the foreground band may run under the controls.
    const region = { x: -10, y: 190, w: 1640, h: 680 };
    // Portrait phones cannot fit the whole loop at a readable size: frame a
    // narrower slice and pan gently after the stone instead.
    if (availW < availH * 1.1) {
      const w = Math.min(region.w, Math.max(900, (availW / availH) * 1100));
      const lo = region.x + w / 2;
      const hi = region.x + region.w - w / 2;
      const want = Math.min(hi, Math.max(lo, this.focusX));
      this.camX = this.camX < lo || this.camX > hi ? want : this.camX + (want - this.camX) * 0.04;
      region.x = this.camX - w / 2;
      region.w = w;
    }
    const shot = this.milestoneShot;
    if (shot && !this.game.state.options.reducedMotion) {
      const t = (this.time - shot.at) / 2.6;
      if (t >= 1) this.milestoneShot = null;
      else {
        const z = 0.1 * Math.sin(Math.PI * Math.max(0, t));
        region.x = shot.x + (region.x - shot.x) * (1 - z);
        region.y = shot.y + (region.y - shot.y) * (1 - z);
        region.w *= 1 - z;
        region.h *= 1 - z;
      }
    }
    const scale = Math.min(availW / region.w, availH / region.h);
    // Spare height goes to the sky: the ground sits just above the controls.
    const target = {
      x: this.insets.left + (availW - region.w * scale) / 2 - region.x * scale,
      y: this.insets.top + (availH - region.h * scale) - region.y * scale,
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

    // The background plate grows about the hill's foot line to cover any view
    // wider or taller than the stage; the foreground band stretches sideways
    // (its end caps would show as seams if it were tiled).
    const s = this.stage.scale.x;
    const vis = { x: -this.stage.x / s, y: -this.stage.y / s, w: w / s, h: h / s };
    const cx = STAGE_W / 2;
    const cover = Math.max(1, (cx - vis.x) / cx, (vis.x + vis.w - cx) / cx, (GROUND_Y - vis.y) / GROUND_Y);
    this.bg.scale.set(cover);
    this.bg.position.set(cx * (1 - cover), GROUND_Y * (1 - cover));
    const wide = Math.max(1, (cx - vis.x) / cx, (vis.x + vis.w - cx) / cx) * 1.01;
    this.foreground.scale.x = wide;
    this.foreground.x = cx * (1 - wide);
    this.vignette.width = w;
    this.vignette.height = h;
  }

  private grip(id: string): boolean {
    const p = this.game.state.prelude;
    return p.complete || p.upgradeIds.includes(id);
  }

  private siteDef(site: SiteState) {
    return catalog.sites.find((d) => d.id === site.id) ?? catalog.sites[0];
  }

  private drawScene(site: SiteState): void {
    const scene = this.siteDef(site).sceneId;
    const bgState = getAssetState(scene, 'background');
    const bgReady = this.bg.show(bgState, 0);
    this.paintHill(scene, bgReady ? bgState : undefined);
    this.foreground.show(getAssetState(scene, 'foreground'), 0);
    // Footholds cut into the steep upper route (Cut Footholds), at the route foot.
    const first = site.id === catalog.sites[0].id;
    this.footholds.position.set(HILL.footLeft.x, HILL.footLeft.y);
    if (!(first && this.grip('cut_footholds') && this.footholds.show(getAssetState('route_footholds', 'idle'), 0))) {
      this.footholds.visible = false;
    }
  }

  /**
   * The delivered hill layer is a flat shape the same colour as the plain, so
   * the renderer paints its own on the route geometry, tinted from the plate.
   */
  private paintHill(scene: string, bg: AssetState | undefined): void {
    const frame = bg?.layers[0]?.frame;
    const plate = frame ? this.load(frame) : null;
    const key = `${scene}|${plate ? 'plate' : 'default'}`;
    if (key === this.terrainKey) return;
    this.terrainKey = key;
    const source = plate?.source.resource as (CanvasImageSource & { width: number; height: number }) | undefined;
    const ground = (source && sampleGround(source)) || DEFAULT_GROUND;
    const res = 1.5;
    const old = this.terrain.texture;
    this.terrain.texture = Texture.from(paintTerrain(ground, scene.length * 97 + scene.charCodeAt(6), res));
    this.terrain.scale.set(1 / res);
    if (old && old !== Texture.EMPTY) old.destroy(true);
  }

  /** The stone is the site's stone art; during the prelude craggy knobs stick out until it is ground round. */
  private drawStone(site: SiteState): void {
    const id = this.siteDef(site).stoneAssetId;
    const first = site.id === catalog.sites[0].id;
    const shape = !first || this.grip('grind_round') ? 'round' : this.grip('chip_burrs') ? 'chipped' : 'rough';
    // stone_limestone_prelude is blocked: limestone plus drawn burrs stands in.
    const prelude = shape === 'round' ? undefined : getAssetState('stone_limestone_prelude', shape);
    const art = prelude?.status === 'available' ? prelude : getAssetState(id, 'texture');
    const shown = this.stoneClip.show(art, 0);
    const key = `${id}|${shape}|${shown}|${art === prelude}`;
    if (key === this.stoneKey) return;
    this.stoneKey = key;
    this.stoneStandIn.clear();
    if (!shown) this.stoneStandIn.circle(0, 0, STONE_VR).fill(GREY.stone).stroke({ width: 3, color: GREY.line });
    const g = this.knobs;
    g.clear();
    if (shape !== 'round' && art !== prelude) {
      // Craggy lumps of the same rock break the outline until they are chipped
      // off; fixed so the stone reads the same every frame.
      const knobs = shape === 'rough' ? [0.2, 1.05, 1.9, 2.8, 3.6, 4.5, 5.4] : [0.9, 3.1, 5.0];
      for (const a of knobs) {
        const size = shape === 'rough' ? 13 + ((a * 13) % 8) : 8;
        const d = STONE_VR - size * 0.45;
        // A lopsided lump: wider along the rim than it stands proud of it.
        const pts: number[] = [];
        for (let i = 0; i < 12; i++) {
          const t = (i / 12) * Math.PI * 2;
          const wob = 0.85 + 0.3 * Math.abs(Math.sin(i * 2.3 + a * 5));
          const along = Math.cos(t) * size * 1.25 * wob;
          const out = Math.sin(t) * size * 0.8 * wob;
          pts.push(Math.cos(a) * (d + out) - Math.sin(a) * along, Math.sin(a) * (d + out) + Math.cos(a) * along);
        }
        g.poly(pts).fill(0x2a221d).stroke({ width: 2.5, color: POTTERY.ink, join: 'round' });
        const r0 = d + size * 0.2;
        g.moveTo(Math.cos(a - 0.08) * r0, Math.sin(a - 0.08) * r0)
          .lineTo(Math.cos(a + 0.1) * (r0 + size * 0.4), Math.sin(a + 0.1) * (r0 + size * 0.4))
          .stroke({ width: 1.8, color: POTTERY.clay, alpha: 0.85, cap: 'round' });
      }
    }
  }

  /** Where the stone is drawn: lifted along the surface normal to its drawn radius. */
  private stoneDrawn(pos: Vec): Vec {
    const lift = STONE_VR - STONE_R;
    const x = pos.x;
    // On the hill faces the normal leans with the slope; on the plain and in
    // the return chute it is straight up.
    if (surfaceY(x) >= GROUND_Y || pos.y > GROUND_Y - STONE_R + 10) return { x, y: pos.y - lift };
    const slope = (surfaceY(x + 1) - surfaceY(x - 1)) / 2;
    const len = Math.hypot(slope, 1);
    return { x: x + (slope / len) * lift, y: pos.y - lift / len };
  }

  /** Installations and works for this site; rebuilt only when they change. */
  private drawStatic(site: SiteState): void {
    const works = this.game.state.empire.purchasedWorkIds.filter((id) => catalog.works.find((w) => w.id === id)?.siteId === site.id);
    const installs = INSTALLS.filter((i) => site.productionLevel >= i.level);
    const key = `${site.id}|${installs.length}|${works.join(',')}`;
    if (key !== this.staticKey) {
      this.staticKey = key;
      for (const c of this.installs.removeChildren()) c.destroy({ children: true });
      for (const c of this.works.removeChildren()) c.destroy({ children: true });
      this.installClips = installs.map(({ level, u }) => {
        const clip = this.clip();
        // Planted on the route face; the hill layer in front hides the footing.
        const x = routePoint(u).x - UP_NORMAL.x * STONE_R;
        clip.position.set(x, surfaceY(x) + 10);
        clip.scale.set(INSTALL_K);
        this.installs.addChild(clip);
        return { clip, level };
      });
      this.workClips = works.map((id, i) => {
        const clip = this.clip();
        const x = WORK_SPOTS[i % WORK_SPOTS.length];
        clip.position.set(x, surfaceY(x) + 6);
        clip.scale.set(WORK_K);
        this.works.addChild(clip);
        return { clip, id };
      });
    }
    const running = site.phase === 'ascending';
    for (const { clip, level } of this.installClips) {
      const id = `install_level_${level}`;
      const run = running ? getAssetState(id, 'running') : undefined;
      clip.show(run ?? getAssetState(id, 'idle'), this.time, this.reduced);
    }
    for (const { clip, id } of this.workClips) {
      const since = this.time - (this.workEnteredAt.get(id) ?? -Infinity);
      const entrance = getAssetState(`work_${id}`, 'entrance');
      if (entrance && since < entrance.duration) clip.show(entrance, since, this.reduced);
      else clip.show(getAssetState(`work_${id}`, 'idle'), 0);
    }
  }

  private get reduced(): boolean {
    return this.game.state.options.reducedMotion;
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

  /** Where Sisyphus's feet go to push a stone centred at `stone`. */
  private pushFeet(stone: Vec): Vec {
    const foot = { x: stone.x - UP_NORMAL.x * STONE_R, y: stone.y - UP_NORMAL.y * STONE_R };
    const x = foot.x - UP_DIR.x * PUSH_REACH;
    return { x, y: surfaceY(x) };
  }

  private update(dt: number): void {
    const s = this.game.state;
    const site = findSite(s, s.empire.selectedSiteId);
    if (!site) return;
    this.time += dt;
    this.layout();
    this.drawScene(site);
    this.drawStatic(site);
    this.drawStone(site);

    const reduced = this.reduced;
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
    // Rolling: rotation follows distance travelled.
    if (this.lastStone) this.stone.rotation += (pos.x - this.lastStone.x) / STONE_VR;
    this.lastStone = pos;
    this.stonePulse = Math.max(0, this.stonePulse - dt * 3);
    const drawn = this.stoneDrawn(pos);
    this.stone.position.set(drawn.x, drawn.y);
    this.stone.scale.set(1 + 0.08 * Math.sin(this.stonePulse * Math.PI));
    this.hotspot.hitArea = new Circle(drawn.x - 50, drawn.y, 170);
    this.shake = reduced || !s.options.screenShake ? 0 : Math.max(0, this.shake - dt * 40);
    this.summitGlow = Math.max(0, this.summitGlow - dt * 0.6);
    this.decreeBolt = Math.max(0, this.decreeBolt - dt * 1.4);

    const automated = s.empire.foremanOwned;
    const rate = ascentRate(s, site, { manualHeld: held, offline: false });
    const ascending = site.phase === 'ascending';
    const hauled = ascending && (automated || site.wheelCharged);

    this.updateWheel(site, dt, ascending, rate);

    // The shade hauls on the rope drum once hired.
    this.drum.visible = automated;
    if (automated) {
      this.drumClock += hauled ? dt * Math.max(0.5, rate * 10) : 0;
      const turning = getAssetState('rope_drum', 'turning');
      this.drum.show(hauled && turning ? turning : getAssetState('rope_drum', 'idle'), this.drumClock, reduced);
      // Only pull_loop is delivered; between hauls the shade holds its first frame.
      this.shade.show(getAssetState('shade_attendant', 'pull_loop'), hauled ? this.drumClock : 0, reduced);
    } else this.shade.visible = false;

    // Ropes: the stone is hauled over the summit pulley by the drum (shade)
    // or the charged wheel.
    const r = this.ropes;
    r.clear();
    if (site.wheelOwned || automated) {
      r.moveTo(PULLEY.x, HILL.summitRight.y + 4).lineTo(PULLEY.x, PULLEY.y).stroke({ width: 7, color: POTTERY.ink });
      r.circle(PULLEY.x, PULLEY.y, 11).fill(POTTERY.bronze).stroke({ width: 3, color: POTTERY.ink });
    }
    if (hauled) {
      const rope = { width: 3, color: POTTERY.rope };
      const anchor = automated ? { x: DRUM.x, y: DRUM.y - 23 } : { x: FLYWHEEL.x, y: FLYWHEEL.y };
      r.moveTo(anchor.x, anchor.y).lineTo(PULLEY.x, PULLEY.y).lineTo(drawn.x, drawn.y).stroke(rope);
    }

    // Target waiting at the impact area.
    const kind = site.snapshot.bonusTargetId === 'expected' ? 'debris' : site.snapshot.bonusTargetId;
    this.target.visible = site.phase !== 'returning';
    if (kind !== this.targetKind) {
      this.targetKind = kind;
      drawTarget(this.target, kind);
    }

    this.updateSisyphus(site, pos, dt, held, automated, strain);
    this.focusX = drawn.x * 0.7 + this.sisPos.x * 0.3;
    this.updateShadows(drawn);
    this.updateDust(dt, site, drawn, held || automated);

    // High-water mark: the best height so far, while the stone still slips.
    const showMarker = !s.prelude.complete && s.prelude.bestHeight > 0 && site.id === catalog.sites[0].id;
    this.marker.visible = showMarker;
    if (showMarker) {
      const p = routePoint(s.prelude.bestHeight);
      const x = p.x - UP_NORMAL.x * STONE_R;
      this.marker.position.set(x, surfaceY(x) + 2);
      const moved = getAssetState('best_height_marker', 'moved');
      const since = this.time - this.markerMovedAt;
      if (moved && since < moved.duration) this.marker.show(moved, since, reduced);
      else this.marker.show(getAssetState('best_height_marker', 'idle'), 0);
    }

    const o = this.overlay;
    o.clear();
    if (this.summitGlow > 0) {
      const p = routePoint(1);
      o.circle(p.x, p.y, 70 + 260 * (1 - this.summitGlow)).stroke({ width: 8, color: POTTERY.bronze, alpha: this.summitGlow });
    }
    if (this.decreeBolt > 0) this.drawBolt(o, s.options.flashFree);
    this.updateConfirmations(o, dt);
    // First-push affordance: chevrons running up the slope ahead of the stone.
    if (!s.discoveries.tutorialIds.includes('first_summit') && !held && site.phase === 'ascending') {
      for (let i = 0; i < 3; i++) {
        const phase = (this.time * 0.9 + i / 3) % 1;
        const alpha = reduced ? 0.8 - i * 0.2 : Math.sin(phase * Math.PI) * 0.9;
        const along = STONE_VR + 34 + (reduced ? i : phase * 3) * 26;
        const c = { x: drawn.x + UP_DIR.x * along, y: drawn.y + UP_DIR.y * along };
        const n = { x: UP_NORMAL.x * 14, y: UP_NORMAL.y * 14 };
        const tip = { x: c.x + UP_DIR.x * 12, y: c.y + UP_DIR.y * 12 };
        const pts = [c.x + n.x, c.y + n.y, tip.x, tip.y, c.x - n.x, c.y - n.y];
        o.poly(pts, false).stroke({ width: 9, color: POTTERY.ink, alpha: alpha * 0.5, cap: 'round', join: 'round' });
        o.poly(pts, false).stroke({ width: 5, color: POTTERY.ivory, alpha, cap: 'round', join: 'round' });
      }
    }

    this.updateFx(dt);
  }

  /** Soft contact shadows keep the stone and Sisyphus on the ground. */
  private updateShadows(stone: Vec): void {
    const g = this.shadows;
    g.clear();
    const ground = (x: number) => surfaceY(x);
    const sx = stone.x;
    // The stone's shadow shrinks as it leaves the ground during the fall.
    const gap = Math.max(0, ground(sx) - (stone.y + STONE_VR));
    const k = Math.max(0.3, 1 - gap / 160);
    const slope = Math.atan2(ground(sx + 1) - ground(sx - 1), 2);
    // Ellipses tilted to the slope beneath each body.
    const shadowAt = (x: number, y: number, rx: number, ry: number, alpha: number, angle: number) => {
      const c = Math.cos(angle);
      const s = Math.sin(angle);
      const pts: number[] = [];
      for (let i = 0; i < 20; i++) {
        const t = (i / 20) * Math.PI * 2;
        const px = Math.cos(t) * rx;
        const py = Math.sin(t) * ry;
        pts.push(x + px * c - py * s, y + px * s + py * c);
      }
      g.poly(pts).fill({ color: POTTERY.ink, alpha });
    };
    const inChute = stone.y > GROUND_Y - STONE_VR + 10;
    shadowAt(sx + 6, inChute ? stone.y + STONE_VR - 2 : ground(sx) - 1, STONE_VR * 0.95 * k, 8 * k, 0.32 * k, inChute ? 0 : slope);
    if (this.sis.visible) {
      const fx = this.sisPos.x;
      const fy = this.sisPos.y > GROUND_Y ? this.sisPos.y : ground(fx);
      const angle = this.sisPos.y > GROUND_Y ? 0 : Math.atan2(ground(fx + 1) - ground(fx - 1), 2);
      shadowAt(fx - 6, fy, 46, 6, 0.26, angle);
    }
  }

  /** Dust kicked up by effort, slips and impacts; none with reduced motion. */
  private kick(x: number, y: number, count: number, spread: number, power: number): void {
    if (this.reduced) return;
    for (let i = 0; i < count; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * spread;
      const v = power * (0.5 + Math.random() * 0.7);
      this.motes.push({ x: x + (Math.random() - 0.5) * 20, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, r: 5 + Math.random() * 8, life: 0, max: 0.7 + Math.random() * 0.6 });
    }
    if (this.motes.length > 120) this.motes.splice(0, this.motes.length - 120);
  }

  private updateDust(dt: number, site: SiteState, stone: Vec, effort: boolean): void {
    // Scuffs at his heels and under the stone while it is driven uphill.
    const climbing = site.phase === 'ascending' && effort && this.sisArt.visible;
    this.moteClock += dt;
    if (climbing && this.moteClock > 0.16) {
      this.moteClock = 0;
      const heel = { x: this.sisPos.x - 50, y: surfaceY(this.sisPos.x - 50) };
      this.kick(heel.x, heel.y, 1, 1.4, 50);
      if (Math.random() < 0.5) this.kick(stone.x - 10, surfaceY(stone.x - 10), 1, 1.6, 30);
    }
    const g = this.dust;
    g.clear();
    this.motes = this.motes.filter((m) => {
      m.life += dt;
      if (m.life >= m.max) return false;
      m.x += m.vx * dt;
      m.y += m.vy * dt;
      m.vx *= 1 - dt * 1.8;
      m.vy = m.vy * (1 - dt * 1.8) + 8 * dt;
      const t = m.life / m.max;
      g.circle(m.x, m.y, m.r * (0.6 + t * 1.2)).fill({ color: POTTERY.paleClay, alpha: 0.5 * (1 - t) });
      return true;
    });
  }

  /** Flywheel: charging when first installed and each time it charges, then turning. */
  private updateWheel(site: SiteState, dt: number, ascending: boolean, rate: number): void {
    if (!site.wheelOwned) {
      this.wheel.show(getAssetState('flywheel', 'uninstalled'), 0);
      return;
    }
    const charging = getAssetState('flywheel', 'charging');
    const upgraded = this.game.state.prestige.permanentUpgradeIds.includes('deep_reservoir');
    const turning = getAssetState('flywheel', upgraded ? 'upgraded' : 'turning') ?? getAssetState('flywheel', 'turning');
    const sinceCharge = this.time - this.chargedAt;
    if (!site.wheelCharged) {
      this.wheel.show(charging, 0, this.reduced);
      return;
    }
    if (charging && sinceCharge < charging.duration) {
      this.wheel.show(charging, sinceCharge, this.reduced);
      return;
    }
    // Spins faster while it hauls, and kicks when the stone strikes.
    const base = ascending ? Math.max(1, rate * 20) : 0.3;
    this.wheelSpin = base + (this.wheelSpin - base) * Math.exp(-dt * 1.2);
    this.wheelClock += this.wheelSpin * dt;
    this.wheel.show(turning, this.wheelClock, this.reduced);
  }

  /**
   * Only the push loops are delivered. Every other pose (rest, walk, slip,
   * step aside) is blocked, so a greybox figure stands in for it.
   */
  private updateSisyphus(site: SiteState, pos: Vec, dt: number, held: boolean, automated: boolean, strain: number): void {
    const c = catalog.cycle;
    const sisPushing = !automated || held;
    const slipping = site.phase === 'slipping';
    const summitFeet = this.pushFeet(routePoint(1));
    const startFeet = this.pushFeet(routePoint(0));
    let target: Vec;
    if (slipping && this.slipAt) target = this.slipAt;
    else if (!sisPushing) target = ASIDE_SPOT;
    else if (site.phase === 'ascending') target = this.pushFeet(pos);
    else if (site.phase === 'descending') {
      const t = site.phaseProgress / c.descentSeconds;
      if (t < HESITATE + 0.05) target = summitFeet;
      else {
        const k = Math.min(1, (t - 0.15) / 0.8);
        const x = summitFeet.x + (startFeet.x - summitFeet.x) * k;
        target = { x, y: surfaceY(x) };
      }
    } else target = startFeet;

    // Glued to the stone while pushing; otherwise he walks (and after a slip, trudges back down).
    const speed = 900 * dt;
    const dx = target.x - this.sisPos.x;
    const dy = target.y - this.sisPos.y;
    const dist = Math.hypot(dx, dy);
    const glued = site.phase === 'ascending' && sisPushing && dist <= Math.max(30, speed);
    const moving = !glued && dist > 1;
    if (glued || dist <= speed) this.sisPos = { ...target };
    else this.sisPos = { x: this.sisPos.x + (dx / dist) * speed, y: this.sisPos.y + (dy / dist) * speed };
    if (!slipping) this.slipAt = null;
    if (moving && Math.abs(dx) > 4) this.facing = dx < 0 ? -1 : 1;
    else if (!moving) this.facing = 1;
    this.stride += moving ? speed * 0.03 : 0;

    const push = glued ? getAssetState('sisyphus', automated ? 'manual_assist' : 'push_loop') : undefined;
    const art = this.sisClip.show(push, this.time, this.reduced);
    this.sisGrey.visible = !art;
    this.sisArt.visible = art;

    let rotation = 0;
    let bob = 0;
    if (art) {
      rotation = SLOPE_ANGLE * PUSH_LEAN + 0.06 * strain;
    } else if (slipping) {
      rotation = -1.45; // knocked onto his back
    } else if (moving) {
      bob = Math.abs(Math.sin(this.stride)) * -5;
    }
    this.sis.position.set(this.sisPos.x, this.sisPos.y + bob);
    this.sis.rotation = rotation;
    this.sis.scale.set(this.facing, 1);

    // Rag foot wraps (the feet_wrapped variant is blocked; a drawn overlay stands in).
    const wrapped = site.id === catalog.sites[0].id && this.grip('wrap_feet');
    this.sisWraps.visible = wrapped;
    if (wrapped && this.sisWraps.context.instructions.length === 0) {
      for (const f of SIS_FEET) this.sisWraps.roundRect(f.x - 13, f.y - 14, 30, 13, 5).fill(POTTERY.parchment).stroke({ width: 2, color: POTTERY.ink });
    }
    if (!art) drawFigure(this.sisGrey, this.stride, moving, wrapped);
  }

  // ------------------------------------------------------------------ effects

  private onEvents(events: GameEvent[]): void {
    const s = this.game.state;
    const selected = s.empire.selectedSiteId;
    const reduced = s.options.reducedMotion;
    // A long absence settles in one batch: don't replay it on screen.
    if (events.length > 40) return;
    for (const e of events) {
      if ('siteId' in e && e.siteId && e.siteId !== selected && e.type !== 'SiteOpened') continue;
      switch (e.type) {
        case 'SummitReached': {
          const p = routePoint(1);
          this.floatText(`+${formatMoney(e.amount)}`, p.x, p.y - 100);
          if (!reduced) this.effect('fx_coin', 'small_grant', p.x, p.y - 60);
          break;
        }
        case 'ImpactResolved': {
          this.floatText(`+${formatMoney(e.amount)}`, IMPACT.x - 40, IMPACT.y - 110);
          if (!e.bonus.isZero()) this.floatText(`+${formatMoney(e.bonus)} bonus`, TARGET.x - 60, TARGET.y - 170, true);
          this.wheelSpin += 14;
          this.stonePulse = 1;
          // From level 25 the bronze-braced return lands harder (spec §03).
          const level = findSite(s, e.siteId)?.productionLevel ?? 1;
          const force = level >= 50 ? 1.5 : level >= 25 ? 1.3 : 1;
          this.kick(IMPACT.x, GROUND_Y, Math.round(14 * force), 2.6 * force, 160 * force);
          if (!reduced) {
            const kind = e.targetId === 'expected' ? 'debris' : e.targetId;
            this.effect(`target_${kind}`, 'shatter', TARGET.x - 30, TARGET.y - 20, level >= 25 ? 1.12 : 1);
            this.shake = 6 * force;
          }
          break;
        }
        case 'StoneSlipped': {
          const p = routePoint(e.height);
          this.slipAt = { ...this.sisPos };
          if (e.record) {
            this.floatText(`New height: ${Math.round(e.height * 100)}%`, p.x, p.y - 150, true);
            this.markerMovedAt = this.time;
          } else this.floatText('Slipped', p.x, p.y - 130);
          this.kick(this.sisPos.x, this.sisPos.y, 8, 2.2, 110);
          if (!reduced) {
            this.effect('fx_fall', 'dust', p.x - 30, p.y + 30);
            this.shake = 5;
          }
          break;
        }
        case 'FallResolved': {
          const p = routePoint(0);
          this.floatText(`+${formatMoney(e.amount)}`, p.x, p.y - 110);
          this.kick(p.x, GROUND_Y, 10, 2.4, 130);
          if (!reduced) {
            this.effect('fx_fall', 'obol_toss', p.x, p.y - 20);
            this.shake = 4;
          }
          break;
        }
        case 'PreludeCompleted': {
          const p = routePoint(1);
          // Beside the summit, clear of the story banner, and held longer than usual.
          this.floatText('THE SUMMIT', p.x - 300, p.y + 60, true, 3);
          this.floatText(`+${formatMoney(e.offering)} offering`, p.x - 300, p.y + 115, false, 3);
          this.summitGlow = 1;
          if (!reduced) {
            this.effect('fx_first_summit', 'burst', p.x - 40, p.y - 40);
            this.shake = 12;
          }
          break;
        }
        case 'FlywheelCharged':
          this.chargedAt = this.time;
          break;
        case 'PurchaseCompleted':
          this.stonePulse = 1;
          this.confirmPurchase(e.kind);
          break;
        case 'MilestoneReached': {
          const p = routePoint(0.5);
          const install = INSTALLS.find((i) => i.level === e.level);
          const focus = install ? routePoint(install.u) : p;
          this.milestoneShot = { x: focus.x, y: focus.y, at: this.time };
          this.floatText(`Level ${e.level} · ×2`, p.x, p.y - 170, true);
          if (!reduced) this.effect('fx_coin', 'milestone_grant', p.x - 50, p.y - 120);
          break;
        }
        case 'WorkInstalled':
          this.workEnteredAt.set(e.workId, this.time);
          break;
        case 'DecreeAvailable':
          this.effect('decree_stamp', 'stamp', 800, 260, 0.6);
          // A brief sky accent; it never touches the stone or the route.
          if (!reduced) {
            this.decreeBolt = 1;
            this.boltSeed = Math.random() * 1000;
          }
          break;
        case 'RelicGranted':
          this.effect('fx_relic', 'rare_discovery', routePoint(1).x, routePoint(1).y - 160, 0.8);
          break;
        case 'SiteOpened':
          this.staticKey = '';
          this.lastStone = null;
          break;
      }
    }
  }

  /** Show where a purchase went: the machine it bought bounces and a ring spreads from it. */
  private confirmPurchase(kind: string): void {
    const ring = (x: number, y: number, r = 60) => this.rings.push({ x, y, age: 0, r });
    const bump = (obj: Container, base: number) => {
      this.bumps = this.bumps.filter((b) => b.obj !== obj);
      this.bumps.push({ obj, base, age: 0 });
    };
    switch (kind) {
      case 'flywheel':
        ring(FLYWHEEL.x, FLYWHEEL.y, FLYWHEEL.r);
        bump(this.wheel, WHEEL_K);
        break;
      case 'foreman':
        ring(DRUM.x, DRUM.y, 70);
        bump(this.drum, DRUM_K);
        bump(this.shade, SHADE_K);
        break;
      case 'impact':
        ring(TARGET.x, surfaceY(TARGET.x) - 40, 70);
        bump(this.target, 1);
        break;
      case 'strength':
        ring(this.sisPos.x, this.sisPos.y - 70, 70);
        break;
      case 'production': {
        const p = routePoint(0.35);
        ring(p.x, p.y - 30, 90);
        break;
      }
      default: {
        const st = this.stone.position;
        ring(st.x, st.y, STONE_VR + 10);
      }
    }
  }

  private updateConfirmations(o: Graphics, dt: number): void {
    const life = 0.7;
    this.rings = this.rings.filter((r) => (r.age += dt) < life);
    for (const r of this.rings) {
      const k = r.age / life;
      const eased = 1 - (1 - k) * (1 - k);
      o.circle(r.x, r.y, r.r * (0.8 + 0.7 * eased)).stroke({ width: 5 * (1 - k) + 1, color: POTTERY.bronze, alpha: 0.9 * (1 - k) });
    }
    this.bumps = this.bumps.filter((b) => {
      b.age += dt;
      const k = Math.min(1, b.age / 0.45);
      const f = this.reduced ? 1 : 1 + 0.12 * Math.sin(k * Math.PI) * (1 - k * 0.5);
      b.obj.scale.set(b.base * f);
      return k < 1;
    });
  }

  /** Zeus's decree flourish: a jagged bolt in the far sky, with an optional soft flash. */
  private drawBolt(o: Graphics, flashFree: boolean): void {
    const k = this.decreeBolt;
    if (!flashFree && k > 0.8) o.rect(-200, -200, STAGE_W + 400, STAGE_H + 400).fill({ color: POTTERY.ivory, alpha: (k - 0.8) * 0.9 });
    const pts: number[] = [];
    let x = 1180 + (this.boltSeed % 160);
    let y = -20;
    for (let i = 0; y < 250; i++) {
      pts.push(x, y);
      y += 34 + ((this.boltSeed * (i + 3)) % 22);
      x += ((this.boltSeed * (i + 7)) % 60) - 30;
    }
    pts.push(x, y);
    const alpha = Math.min(1, k * 1.6);
    o.poly(pts, false).stroke({ width: 9, color: POTTERY.ink, alpha: alpha * 0.8, join: 'miter' });
    o.poly(pts, false).stroke({ width: 3.5, color: flashFree ? POTTERY.bronze : POTTERY.ivory, alpha, join: 'miter' });
  }

  /** Play a delivered one-shot state at a stage point; blocked states are skipped. */
  private effect(id: string, state: string, x: number, y: number, scale = 1): void {
    const st = getAssetState(id, state);
    if (!st || st.status !== 'available') return;
    const clip = this.clip();
    clip.position.set(x, y);
    clip.scale.set(scale);
    this.fx.addChildAt(clip, 0);
    this.effects.push({ clip, state: st, start: this.time });
    while (this.effects.length > 12) this.effects.shift()!.clip.destroy({ children: true });
  }

  private floatText(text: string, x: number, y: number, highlight = false, life = 1.4): void {
    const t = new Text({
      text,
      style: {
        fontFamily: "'Palatino Linotype', Palatino, Georgia, serif",
        fontSize: highlight ? 40 : 34,
        fontWeight: '700',
        fill: highlight ? POTTERY.clay : POTTERY.ink,
        stroke: { color: POTTERY.ivory, width: 7, join: 'round' },
      },
    });
    t.anchor.set(0.5);
    t.position.set(x, y);
    this.fx.addChild(t);
    this.texts.push({ t, life });
    if (this.texts.length > 8) this.texts.shift()!.t.destroy();
  }

  private updateFx(dt: number): void {
    this.effects = this.effects.filter((f) => {
      const elapsed = this.time - f.start;
      if (elapsed > f.state.duration + 0.05) {
        f.clip.destroy({ children: true });
        return false;
      }
      f.clip.show(f.state, elapsed, this.reduced);
      return true;
    });
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
