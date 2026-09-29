import { Application, Assets, Circle, Container, Graphics, Sprite, Text, Texture, TilingSprite } from 'pixi.js';
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
import {
  ANKLE_H,
  asidePose,
  easePose,
  fallenPose,
  forearmAngle,
  gait,
  plantLeg,
  pullPose,
  reachArm,
  SHADE_LOOK,
  shoulderOf,
  standPose,
  walkCycle,
  type Pose,
} from './figure';
import { FigureRig } from './rig';
import { coinSprite, drawBird, drawCloud, drawPuff, drawRope, Installs, ropeGuides, SummitPulley, type Cloud } from './machinery';
import { SpriteLayer } from './glow';
import { GREY, POTTERY } from './palette';
import { drawTarget } from './props';
import { Atmosphere } from './atmosphere';
import { Kiln } from './kiln';
import { STONE_LIGHT_BOX, stoneLightTexture, warmPaintings } from './painted-fx';
import { pebbleTextures, sherdTextures } from './painted';
import { rng } from './paint';
import { PotteryFx, SITE_MATERIAL, TARGET_MATERIAL } from './vfx';
import { ChiselStamp } from './chisel';
import {
  DEFAULT_GROUND,
  DEFAULT_SKY,
  FRIEZE_H,
  hex,
  mix,
  paintFriezeTile,
  paintTerrain,
  paintVignette,
  sampleGround,
  sampleSky,
  type RGB,
} from './terrain';

interface FloatText {
  t: Container;
  life: number;
  max: number;
  x0: number;
  y0: number;
}

/** Where the scene plates' horizon sits in stage pixels; the plate grows about it. */
const HORIZON_Y = 250;
/** Top of the meander frieze the world stands on. */
const FRIEZE_Y = 846;

interface Mote {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  life: number;
  max: number;
  seed: number;
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
/**
 * The stone is drawn larger than its rolling radius so it reads beside him;
 * its centre is lifted along the surface normal to keep it on the ground.
 */
const STONE_VR = 60;
/** Stone art fills ≈ 76% of its canvas; this makes it 2 × STONE_VR across. */
const STONE_K = (2 * STONE_VR) / (256 * 0.76);
/** Rotor radius FLYWHEEL.r; the stand then reaches the ground. */
const WHEEL_K = 0.575;
const DRUM_K = 0.35;
const SHADE_RIG_K = 0.92;
const WORK_K = 0.45;
const MARKER_K = 0.42;
/** The hill's signature workshop stands on the far shoulder behind the route. */
const MACHINE_X = 1285;
const MACHINE_HEIGHT = 285;
const MACHINE_ASSET: Record<string, string> = {
  first_hill: 'machine_counterweight',
  tartarus_rim: 'machine_furnace_wheel',
  leaking_heights: 'machine_leaking_jar',
  bronze_pass: 'machine_foundry',
  skyward_escarpment: 'machine_orrery',
  olympian_approach: 'machine_bureau',
};
/** Feet sit this far behind the stone's contact point, along the route, so his hands meet its back. */
const PUSH_REACH = 166;
/** Works stand on the descent face beside the summit post, then down the route face. */
const WORK_SPOTS = [1140, 1215, 1290, 945, 870, 795, 1365];
/** Milestone installations along the route: guide rail, bronze bracing, running belt. */
const INSTALLS = [
  { level: 10, u: 0.3 },
  { level: 25, u: 0.5 },
  { level: 50, u: 0.7 },
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
  private pending = new Map<string, Promise<Texture | null>>();
  private failed = new Set<string>();

  private tex = (frame: AssetFrame): Texture | null => this.load(frame);
  private clip = (): Clip => new Clip(this.tex);

  private below = new Graphics();
  private sky = new Graphics();
  private bg = this.clip();
  private ambient = new Graphics();
  private clouds: Cloud[] = [];
  private birds = { x: -400, y: 160, t: 0, next: 6 };
  private skyTint = 0xf6ecdc;
  private installs = new Installs();
  private installTier = -1;
  private installClock = 0;
  private works = new Container();
  private machine = this.clip();
  private machineScale = 1;
  private terrain = new Sprite();
  private terrainKey = '';
  private frieze = new TilingSprite();
  private marker = this.clip();
  private ropes = new Graphics();
  private pulley = new SummitPulley();
  private ropeCrawl = 0;
  /** How far the rope hangs: taut while it hauls, slack otherwise. */
  private ropeSag = 0.03;
  private wheel = this.clip();
  private drum = this.clip();
  private target = new Container();
  private targetKind = '';
  /** When the waiting target was last set down, for its drop-in. */
  private targetShownAt = -Infinity;
  private targetWasShown = true;
  private targetSettling = false;
  /** Broken pieces of earlier targets lying about the impact ground. */
  private litter = new Container();
  private litterKey = '';
  private shadows = new Graphics();
  private dust = new SpriteLayer(120);
  private motes: Mote[] = [];
  private moteClock = 0;
  private vignette = new Sprite();
  private shade = new Container();
  private shadeRig = new FigureRig(SHADE_LOOK);
  private shadePose: Pose = pullPose(0);
  private sis = new Container();
  private sisRig = new FigureRig();
  private pose: Pose = standPose();
  private pushClock = 0;
  /** Stepping gait: cycles walked (or pushed) so far, advanced by ground covered. */
  private gaitPhase = 0;
  private fallenAt = -Infinity;
  private stone = new Container();
  private stoneSpin = new Container();
  /** The hill's light on the stone: it stays put while the stone rolls under it. */
  private stoneLight = new Sprite();
  /** Which effects set is applied to the stage: off, balanced or full. */
  private richKey = '';
  private stoneClip = this.clip();
  private stoneStandIn = new Graphics();
  private knobs = new Graphics();
  /** Impact squash: 1 on landing, easing back to round. */
  private squash = 10;
  private overlay = new Graphics();
  private fx = new Container();
  private hotspot = new Container();
  /** Rich effects: pottery-style particles, each hill's air, and the kiln's post pipeline. */
  private vfx = new PotteryFx();
  /** The level stamp: a giant chisel cuts the Roman numeral, then it joins the hillside cartouche. */
  private chisel = new ChiselStamp();
  private atmosphere = new Atmosphere();
  private kiln: Kiln | null = null;

  private effects: Effect[] = [];
  private texts: FloatText[] = [];
  private insets: Insets = { top: 0, right: 0, bottom: 0, left: 0 };

  private staticKey = '';
  private stoneKey = '';
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
  /** The figure's drawn width, signed by the side shown: it narrows through a turn instead of flipping. */
  private turnScale = 1;
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
  private offEvents: (() => void) | null = null;
  /** The stone's x this frame, which the portrait camera keeps in frame. */
  private stoneX = 400;
  private camX = -1;
  /** The first frame snaps to its final camera; later inset changes ease. */
  private cameraReady = false;
  /** The eased framing, before shake and punch are laid over it. */
  private cam = { x: 0, y: 0, s: 1 };
  /** A brief push of the camera toward a heavy moment, 0 to 1. */
  private punch = 0;
  private punchAt: Vec = { x: 0, y: 0 };

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

    this.shade.addChild(this.shadeRig);
    this.sis.addChild(this.sisRig);
    this.stoneSpin.addChild(this.knobs, this.stoneStandIn, this.stoneClip);
    this.stoneLight.anchor.set(0.5);
    this.stone.addChild(this.stoneSpin, this.stoneLight);
    this.stoneClip.scale.set(STONE_K);
    this.stage.addChild(
      this.below,
      this.sky,
      this.bg,
      this.ambient,
      this.works,
      this.machine,
      this.terrain,
      this.litter,
      this.chisel.plaque,
      this.installs,
      this.frieze,
      this.atmosphere.back,
      this.marker,
      this.ropes,
      this.pulley,
      this.wheel,
      this.drum,
      this.shadows,
      this.target,
      this.shade,
      // Sisyphus in front of the stone, as on the vases: his arms cross its face.
      this.stone,
      this.sis,
      this.dust,
      this.vfx,
      this.atmosphere.front,
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
    this.shade.scale.set(SHADE_RIG_K);
    this.marker.scale.set(MARKER_K);
    // Past the stage's bottom edge the ground continues in ink.
    this.below.rect(-4 * STAGE_W, 896, 9 * STAGE_W, 4000).fill(POTTERY.ink);
    this.frieze.y = FRIEZE_Y;
    this.frieze.height = FRIEZE_H;
    this.paintSky(DEFAULT_SKY);
    this.paintFrieze(DEFAULT_GROUND);
    // A few slow clouds, spread across the sky band.
    for (let i = 0; i < 3; i++) {
      this.clouds.push({ x: -100 + i * 700, y: 60 + ((i * 53) % 90), w: 90 + ((i * 71) % 60), speed: 5 + ((i * 7) % 5), seed: i * 3 + 1 });
    }

    this.hotspot.eventMode = 'static';
    this.hotspot.cursor = 'pointer';
    this.hotspot.on('pointerdown', () => this.onPush?.(true));
    this.hotspot.on('pointerup', () => this.onPush?.(false));
    this.hotspot.on('pointerupoutside', () => this.onPush?.(false));
    this.vignette.texture = Texture.from(paintVignette());
    this.app.stage.addChild(this.stage, this.chisel, this.vignette);
    this.chisel.onStrike = (weight, at) => {
      this.onChisel?.(weight);
      if (weight >= 1) this.shake = Math.max(this.shake, weight >= 2 ? 7 : 2.5);
      if (!at || this.reduced) return;
      // The slam rings through the kiln; the numeral's arrival sparks like a purchase.
      const p = this.stage.toLocal(at);
      if (weight >= 2) {
        this.kiln?.shockwave(p.x, p.y, 8, 1000, 0.7);
        this.kiln?.flash(0.12);
      } else if (weight < 1) this.vfx.purchase(p.x, p.y);
    };
    // The kiln is a set of GLSL passes; a renderer without WebGL simply goes without.
    try {
      if (Kiln.supported(this.app.renderer)) this.kiln = new Kiln();
    } catch (err) {
      console.warn('Kiln unavailable', err);
    }

    // Keep App's loading cover up until the first playable frame is complete.
    // Later chapter assets continue to stream when the player approaches them.
    await this.preloadInitialAssets();
    this.update(0);
    // Paint the effect pieces while idle, before the first blow needs them.
    const looks = [...Object.values(SITE_MATERIAL), ...Object.values(TARGET_MATERIAL), { fill: POTTERY.clay, accent: POTTERY.ink, kind: 'figure' as const }];
    warmPaintings(
      catalog.sites.map((site) => site.id),
      looks.map((m) => ({ kind: m.kind ?? 'stone', fill: m.fill, accent: m.accent })),
    );

    this.offEvents = this.game.onEvents((events) => this.onEvents(events));
    this.app.ticker.add((ticker) => {
      this.game.frame(performance.now());
      this.update(Math.min(0.1, ticker.deltaMS / 1000));
    });
  }

  onPush: ((held: boolean) => void) | null = null;
  /** Obols were earned on screen: where (in page pixels) and how grand. */
  onPayout: ((x: number, y: number, grand: boolean) => void) | null = null;
  /** A chisel blow (1), the slab landing (2) or the stamp setting into the wall (0.5), for sound. */
  onChisel: ((weight: number) => void) | null = null;

  setInsets(insets: Insets): void {
    this.insets = insets;
  }

  // ------------------------------------------------------------------ assets

  private frameUrl(frame: AssetFrame): string {
    // Absolute, because Pixi resolves root-relative paths only against http(s)
    // origins; the desktop shell serves the game from app://game/.
    return new URL(`${import.meta.env.BASE_URL}${frame.url.replace(/^\//, '')}`, location.href).href;
  }

  private requestTexture(frame: AssetFrame): Promise<Texture | null> {
    const url = this.frameUrl(frame);
    const ready = this.textures.get(url);
    if (ready) return Promise.resolve(ready);
    if (this.failed.has(url)) return Promise.resolve(null);
    const inFlight = this.pending.get(url);
    if (inFlight) return inFlight;

    const svg = url.endsWith('.svg');
    // Vectors rasterise sharp without huge full-stage textures; source PNGs
    // are large masters, so mipmaps keep them clean at game scale.
    const resolution = Math.min(4, 3200 / Math.max(...frame.dimensions));
    const request = Assets.load<Texture>({ src: url, data: svg ? { resolution } : { autoGenerateMipmaps: true } })
      .then((loaded) => {
        this.textures.set(url, loaded);
        return loaded;
      })
      .catch(() => {
        this.failed.add(url);
        console.warn(`Asset unavailable, keeping stand-in: ${url}`);
        return null;
      })
      .finally(() => this.pending.delete(url));
    this.pending.set(url, request);
    return request;
  }

  private async preloadInitialAssets(): Promise<void> {
    const site = this.game.state.empire.sites.find((s) => s.id === this.game.state.empire.selectedSiteId) ?? this.game.state.empire.sites[0];
    const def = this.siteDef(site);
    const states = [
      getAssetState(def.sceneId, 'background'),
      getAssetState(`${def.sceneId}_mountain`, 'texture'),
      getAssetState(def.stoneAssetId, 'texture'),
      getAssetState(MACHINE_ASSET[site.id], 'idle'),
    ];
    const frames = states.flatMap((state) => state?.layers.map((layer) => layer.frame) ?? []);
    await Promise.all(frames.map((frame) => this.requestTexture(frame)));
  }

  /** Texture for a delivered frame, or null while it loads. */
  private load(frame: AssetFrame): Texture | null {
    const url = this.frameUrl(frame);
    const t = this.textures.get(url);
    if (t) return t;
    void this.requestTexture(frame);
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
    let cut = false;
    // Portrait phones cannot fit the whole loop at a readable size: frame a
    // narrower slice and follow the stone instead.
    if (availW < availH * 1.1) {
      // Width at which the loop's height fills most of the view, so a tall
      // phone gets a closer hill rather than a band of empty sky; the rest
      // stays sky for the Improve roll to hang in.
      const fill = (availW * region.h) / (availH * 0.8);
      const w = Math.min(region.w, Math.max(620, fill));
      const lo = region.x + w / 2;
      const hi = region.x + region.w - w / 2;
      const bound = (x: number) => Math.min(hi, Math.max(lo, x));
      const want = bound(this.focusX);
      // Cut rather than pan when the stone is out of frame (a new climb
      // starting at the foot); otherwise ease after it, but never let it
      // leave the middle half of the view.
      const lost = Math.abs(this.stoneX - this.camX) > w / 2;
      if (this.camX < lo || this.camX > hi || lost) {
        cut = this.cameraReady;
        // focusX is last frame's; on a reset the stone alone is current.
        this.camX = lost ? bound(this.stoneX) : want;
      } else {
        const eased = this.camX + (want - this.camX) * 0.08;
        const keep = w / 4;
        this.camX = bound(Math.min(this.stoneX + keep, Math.max(this.stoneX - keep, eased)));
      }
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
    const k = !this.cameraReady || cut || this.game.state.options.reducedMotion ? 1 : 0.15;
    const cam = this.cam;
    cam.s = cam.s + (scale - cam.s) * k || scale;
    cam.x += (target.x - cam.x) * k;
    cam.y += (target.y - cam.y) * k;
    this.cameraReady = true;
    let { x, y, s: zoom } = cam;
    if (this.punch > 0) {
      // Lean in toward the blow, keeping its point still on screen.
      const z = 1 + 0.035 * this.punch * this.punch;
      x += this.punchAt.x * zoom * (1 - z);
      y += this.punchAt.y * zoom * (1 - z);
      zoom *= z;
    }
    if (this.shake > 0) {
      // A smooth tremor rather than per-frame noise: two detuned waves an axis.
      const t = this.time;
      x += this.shake * 0.5 * (0.6 * Math.sin(t * 53) + 0.4 * Math.sin(t * 97 + 1.3));
      y += this.shake * 0.5 * (0.6 * Math.sin(t * 61 + 2.1) + 0.4 * Math.sin(t * 89));
    }
    this.stage.scale.set(zoom);
    this.stage.position.set(x, y);

    // The background plate grows about its horizon to cover a view wider than
    // the stage, so the distance keeps its place; above the plate the sky
    // continues in its own colour. The frieze tiles to any width.
    const s = this.stage.scale.x;
    const vis = { x: -this.stage.x / s, y: -this.stage.y / s, w: w / s, h: h / s };
    const cx = STAGE_W / 2;
    const cover = Math.max(1, (cx - vis.x) / cx, (vis.x + vis.w - cx) / cx) * 1.002;
    this.bg.scale.set(cover);
    this.bg.position.set(cx * (1 - cover), HORIZON_Y * (1 - cover));
    this.frieze.x = Math.floor(vis.x / 60) * 60 - 60;
    this.frieze.width = vis.w + 180;
    this.vignette.width = w;
    this.vignette.height = h;
  }

  private paintSky(sky: RGB): void {
    this.skyTint = hex(mix(sky, [0xf6, 0xec, 0xdc], 0.55));
    this.sky.clear().rect(-4 * STAGE_W, -4000, 9 * STAGE_W, 4000 + HORIZON_Y + 40).fill(hex(sky));
  }

  private paintFrieze(ground: RGB): void {
    const res = 2;
    const old = this.frieze.texture;
    this.frieze.texture = Texture.from(paintFriezeTile(ground, res));
    this.frieze.tileScale.set(1 / res);
    if (old && old !== Texture.EMPTY) old.destroy(true);
  }

  /** Clouds drift, and now and then a few birds cross the far sky. */
  private updateAmbient(dt: number): void {
    const g = this.ambient;
    g.clear();
    const reduced = this.reduced;
    const span = STAGE_W + 800;
    for (const c of this.clouds) {
      if (!reduced) c.x += c.speed * dt;
      if (c.x - c.w > STAGE_W + 400) c.x -= span;
      drawCloud(g, c, this.skyTint, 0.55);
    }
    if (reduced) return;
    const b = this.birds;
    b.next -= dt;
    if (b.next <= 0 && b.x < -300) {
      b.x = -260;
      b.y = 120 + Math.random() * 90;
      b.t = 0;
      b.next = 35 + Math.random() * 40;
    }
    if (b.x >= -300 && b.x < STAGE_W + 300) {
      b.x += 70 * dt;
      b.t += dt;
      const flock = [
        [0, 0, 1],
        [-34, 16, 0.8],
        [-58, -8, 0.7],
      ] as const;
      for (const [dx, dy, s] of flock) {
        drawBird(g, b.x + dx, b.y + dy + Math.sin(b.t * 1.3 + dx) * 4, s, b.t * 9 + dx);
      }
    } else if (b.x >= STAGE_W + 300) b.x = -400;
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
    // Footholds cut into the steep upper route (Cut Footholds) are carved into the hill.
    const footholds = site.id === catalog.sites[0].id && this.grip('cut_footholds');
    this.paintHill(scene, bgReady ? bgState : undefined, footholds);
  }

  /**
   * The delivered hill layer is a flat shape the same colour as the plain, so
   * the renderer paints its own on the route geometry, tinted from the plate.
   * The delivered foreground band is replaced by a tiled frieze the same way.
   */
  private paintHill(scene: string, bg: AssetState | undefined, footholds: boolean): void {
    const frame = bg?.layers[0]?.frame;
    const plate = frame ? this.load(frame) : null;
    const authoredState = getAssetState(`${scene}_mountain`, 'texture');
    const authoredFrame = authoredState?.layers[0]?.frame;
    const authored = authoredFrame ? this.load(authoredFrame) : null;
    const key = `${scene}|${plate ? 'plate' : 'default'}|${footholds}|${authored ? 'authored' : authoredFrame ? 'loading' : 'fallback'}`;
    if (key === this.terrainKey) return;
    this.terrainKey = key;
    const source = plate?.source.resource as (CanvasImageSource & { width: number; height: number }) | undefined;
    const ground = (source && sampleGround(source)) || DEFAULT_GROUND;
    this.paintSky((source && sampleSky(source)) || DEFAULT_SKY);
    this.paintFrieze(ground);
    if (authored) {
      this.terrain.visible = true;
      this.terrain.texture = authored;
      this.terrain.scale.set(STAGE_W / authored.width, STAGE_H / authored.height);
      return;
    }
    if (authoredFrame) {
      this.terrain.visible = false;
      return;
    }
    this.terrain.visible = true;
    const res = (window.devicePixelRatio || 1) > 1.25 ? 2 : 1.5;
    const old = this.terrain.texture;
    this.terrain.texture = Texture.from(paintTerrain(ground, scene.length * 97 + scene.charCodeAt(6), res, { footholds }));
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
    this.stoneLight.texture = stoneLightTexture(site.id, STONE_VR);
    this.stoneLight.width = this.stoneLight.height = STONE_LIGHT_BOX;
    this.stoneLight.visible = shown;
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

  /** A fresh target is set down after each return: it drops in, squashes and settles. */
  private settleTarget(): void {
    const t = this.time - this.targetShownAt;
    const base = surfaceY(TARGET.x);
    if (t >= 0.6 || this.reduced) {
      if (this.targetSettling) {
        this.targetSettling = false;
        this.target.position.set(TARGET.x, base);
        this.target.scale.set(1);
        this.target.alpha = 1;
      }
      return;
    }
    const fall = Math.min(1, t / 0.22);
    const land = t - 0.22;
    if (land > 0 && !this.targetSettling) {
      // It lands: a puff of dust at its foot.
      if (this.game.state.options.richEffects) this.vfx.dust(TARGET.x, base, 4, 45, 0.7);
    }
    this.targetSettling = land > 0 || this.targetSettling;
    const q = land > 0 ? Math.exp(-land * 12) * Math.cos(land * 30) * 0.12 : 0;
    this.target.position.set(TARGET.x, base - 34 * (1 - fall * fall));
    this.target.scale.set(1 + q, 1 - q);
    this.target.alpha = Math.min(1, t / 0.12);
  }

  /** Sherds and chips from earlier blows, lying where they fell. Painted once per hill. */
  private drawLitter(siteId: string): void {
    if (siteId === this.litterKey) return;
    this.litterKey = siteId;
    for (const c of this.litter.removeChildren()) c.destroy();
    const r = rng(siteId.length * 31 + siteId.charCodeAt(0));
    const mat = SITE_MATERIAL[siteId] ?? SITE_MATERIAL.first_hill;
    const stone = { kind: 'stone' as const, fill: mat.fill, accent: mat.accent };
    const figure = { kind: 'figure' as const, fill: POTTERY.clay, accent: POTTERY.ink };
    const put = (tex: Texture, x: number, w: number) => {
      const s = new Sprite(tex);
      s.anchor.set(0.5);
      s.width = w;
      // Lying flat: seen at a low angle, so foreshortened.
      s.height = w * (0.45 + r() * 0.2);
      s.rotation = (r() - 0.5) * 0.5;
      s.position.set(x, surfaceY(x) + 1 - s.height * 0.2);
      s.tint = 0xe6ddd2;
      this.litter.addChild(s);
    };
    // Most of it round the impact ground, thinning out up the plain.
    for (let i = 0; i < 18; i++) {
      const x = 1600 - 260 * r() ** 1.6;
      const roll = r();
      if (roll < 0.35) put(sherdTextures(figure)[Math.floor(r() * 8)], x, 12 + r() * 8);
      else if (roll < 0.6) put(sherdTextures(stone)[Math.floor(r() * 8)], x, 10 + r() * 8);
      else put(pebbleTextures(stone)[Math.floor(r() * 5)], x, 6 + r() * 5);
    }
    for (let i = 0; i < 6; i++) put(pebbleTextures(stone)[Math.floor(r() * 5)], 60 + r() * 300, 5 + r() * 4);
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
  private drawStatic(site: SiteState, dt: number): void {
    const works = this.game.state.empire.purchasedWorkIds.filter((id) => catalog.works.find((w) => w.id === id)?.siteId === site.id);
    const tier = INSTALLS.filter((i) => site.productionLevel >= i.level).length;
    const running = site.phase === 'ascending';
    // The rollers and belt only move while the stone is hauled.
    if (running && (this.game.state.empire.foremanOwned || site.wheelCharged || this.game.manualHeld) && !this.reduced) {
      this.installClock += dt;
    }
    if (tier !== this.installTier || (tier > 0 && running)) {
      this.installTier = tier;
      this.installs.draw(tier, this.installClock);
    }
    const key = `${site.id}|${works.join(',')}`;
    if (key !== this.staticKey) {
      this.staticKey = key;
      for (const c of this.works.removeChildren()) c.destroy({ children: true });
      this.workClips = works.map((id, i) => {
        const clip = this.clip();
        const x = WORK_SPOTS[i % WORK_SPOTS.length];
        clip.position.set(x, surfaceY(x) + 6);
        clip.scale.set(WORK_K);
        this.works.addChild(clip);
        return { clip, id };
      });
    }
    for (const { clip, id } of this.workClips) {
      const since = this.time - (this.workEnteredAt.get(id) ?? -Infinity);
      const entrance = getAssetState(`work_${id}`, 'entrance');
      if (entrance && since < entrance.duration) clip.show(entrance, since, this.reduced);
      else clip.show(getAssetState(`work_${id}`, 'idle'), 0);
    }

    // Every later hill opens around its defining machine. The First Hill's
    // counterweight is the exception: it is a crew-25 purchase, so the empty
    // shoulder remains visible until the player actually installs it.
    const machineId = MACHINE_ASSET[site.id];
    const machineState = machineId ? getAssetState(machineId, 'idle') : undefined;
    const installed = site.id !== catalog.sites[0].id || site.counterweight !== null;
    if (installed && machineState) {
      const sourceHeight = machineState.layers[0]?.size[1] ?? MACHINE_HEIGHT;
      this.machineScale = MACHINE_HEIGHT / sourceHeight;
      this.machine.position.set(MACHINE_X, surfaceY(MACHINE_X) + 8);
      this.machine.scale.set(this.machineScale);
      this.machine.show(machineState, this.time, this.reduced);
    } else this.machine.visible = false;
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
    // This frame's stone, so the portrait camera cuts on the frame it resets.
    this.stoneX = this.stonePosition(site).x;
    this.layout();
    const area = this.insets;
    this.chisel.update(dt, {
      siteId: site.id,
      level: site.productionLevel,
      area: { x: area.left, y: area.top, w: this.app.screen.width - area.left - area.right, h: this.app.screen.height - area.top - area.bottom },
      toScreen: (p) => this.stage.toGlobal(p),
      worldScale: this.stage.scale.x,
      rich: s.options.richEffects && !this.reduced,
      reduced: this.reduced,
    });
    this.drawScene(site);
    this.drawStatic(site, dt);
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
    if (this.lastStone) this.stoneSpin.rotation += (pos.x - this.lastStone.x) / STONE_VR;
    this.lastStone = pos;
    this.stonePulse = Math.max(0, this.stonePulse - dt * 3);
    const drawn = this.stoneDrawn(pos);
    // Landing squash: a damped wobble, flattening against the ground.
    this.squash += dt;
    const q = reduced ? 0 : Math.exp(-this.squash * 6) * Math.cos(this.squash * 24) * 0.16;
    const pulse = 1 + 0.08 * Math.sin(this.stonePulse * Math.PI);
    this.stone.scale.set(pulse * (1 + q), pulse * (1 - q));
    this.stone.position.set(drawn.x, drawn.y + q * STONE_VR);
    this.hotspot.hitArea = new Circle(drawn.x - 50, drawn.y, 170);
    this.shake = reduced || !s.options.screenShake ? 0 : Math.max(0, this.shake - dt * 40);
    this.punch = reduced || !s.options.screenShake ? 0 : Math.max(0, this.punch - dt * 3);
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
      this.shade.visible = true;
      this.updateShade(dt, hauled);
    } else this.shade.visible = false;

    // Ropes: the stone is hauled over the summit pulley by the drum (shade)
    // or the charged wheel.
    const r = this.ropes;
    r.clear();
    if (hauled && !reduced) this.ropeCrawl += dt * Math.max(8, rate * 400);
    // A fresh haul takes up the slack: the rope snaps from hanging to taut.
    this.ropeSag += ((hauled ? 0.004 : 0.05) - this.ropeSag) * Math.min(1, dt * (hauled ? 5 : 1));
    if (hauled) {
      // From the drum the rope runs up over the guide rollers (once built);
      // from the wheel it climbs straight to the pulley. It is tied to the
      // stone's uphill side.
      const anchor = automated ? { x: DRUM.x, y: DRUM.y - 23 } : { x: FLYWHEEL.x, y: FLYWHEEL.y };
      const guides = automated ? ropeGuides(this.installTier) : [];
      const tie = { x: drawn.x + UP_DIR.x * STONE_VR * 0.9, y: drawn.y + UP_DIR.y * STONE_VR * 0.9 - 6 };
      const sag = reduced ? 0.01 : this.ropeSag;
      const hum = hauled && !reduced ? 0.7 : 0;
      drawRope(r, [anchor, ...guides, { x: PULLEY.x, y: PULLEY.y - 14 }], -this.ropeCrawl, sag, hum, this.time);
      drawRope(r, [{ x: PULLEY.x - 13, y: PULLEY.y + 2 }, tie], this.ropeCrawl, sag, hum, this.time);
    }
    this.pulley.visible = site.wheelOwned || automated;
    if (!reduced) this.pulley.spin = this.ropeCrawl / 14;

    // Target waiting at the impact area.
    const kind = site.snapshot.bonusTargetId === 'expected' ? 'debris' : site.snapshot.bonusTargetId;
    const showTarget = site.phase !== 'returning';
    if (showTarget && !this.targetWasShown) this.targetShownAt = this.time;
    this.targetWasShown = showTarget;
    this.target.visible = showTarget;
    if (kind !== this.targetKind) {
      this.targetKind = kind;
      drawTarget(this.target, kind);
    }
    this.settleTarget();
    this.drawLitter(site.id);

    this.updateAmbient(dt);
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
    this.updateRich(dt, site, drawn);
  }

  /** Rich effects: speed lines, particles, the hill's air and the glaze finish. */
  private updateRich(dt: number, site: SiteState, stone: Vec): void {
    const rich = this.game.state.options.richEffects;
    const moving = rich && !this.reduced;
    if (moving) {
      this.vfx.trail(stone.x, stone.y, dt, STONE_VR);
      this.vfx.update(dt);
    } else if (this.vfx.visible) this.vfx.clear();
    this.vfx.visible = moving;
    this.atmosphere.update(dt, site.id, rich, this.reduced);
    const full = this.game.state.options.effectsQuality !== 'balanced';
    this.vfx.budget = full ? 360 : 180;
    if (this.kiln) {
      const key = rich ? (full ? 'full' : 'balanced') : 'off';
      if (key !== this.richKey) {
        this.richKey = key;
        this.kiln.lite = !full;
        this.app.stage.filters = rich ? this.kiln.filters : [];
        // Pin the passes to the screen so their pixels are CSS pixels.
        this.app.stage.filterArea = rich ? this.app.screen : undefined;
        // The kiln darkens its own rim.
        this.vignette.visible = !rich;
        // Figures and machines catch the hill's light on their edges.
        const rim = rich && full ? [this.kiln.rim] : [];
        this.sis.filters = rim;
        this.stone.filters = rim;
        this.shade.filters = rim;
        this.wheel.filters = rim;
        this.machine.filters = rim;
        this.kiln.resolution = this.app.renderer.resolution;
      }
      if (rich) {
        const screen = this.app.screen;
        this.kiln.flashFree = this.game.state.options.flashFree;
        this.kiln.update(dt, screen.width, screen.height, this.stage, this.bg, site.id, this.reduced);
      }
    }
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
      this.motes.push({
        x: x + (Math.random() - 0.5) * 20,
        y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v,
        r: 5 + Math.random() * 7,
        life: 0,
        max: 0.6 + Math.random() * 0.6,
        seed: Math.random(),
      });
    }
    if (this.motes.length > 90) this.motes.splice(0, this.motes.length - 90);
  }

  private updateDust(dt: number, site: SiteState, stone: Vec, effort: boolean): void {
    // Scuffs at his heels and under the stone while it is driven uphill.
    const climbing = site.phase === 'ascending' && effort && this.sis.visible;
    this.moteClock += dt;
    if (climbing && this.moteClock > 0.2) {
      this.moteClock = 0;
      const heel = { x: this.sisPos.x - 50, y: surfaceY(this.sisPos.x - 50) };
      this.kick(heel.x, heel.y, 1, 1.4, 45);
      if (Math.random() < 0.4) this.kick(stone.x - 10, surfaceY(stone.x - 10), 1, 1.6, 30);
    }
    const g = this.dust;
    g.begin();
    this.motes = this.motes.filter((m) => {
      m.life += dt;
      if (m.life >= m.max) return false;
      m.x += m.vx * dt;
      m.y += m.vy * dt;
      m.vx *= 1 - dt * 2.2;
      m.vy = m.vy * (1 - dt * 2.2) + 6 * dt;
      const t = m.life / m.max;
      // Puffs swell quickly, then thin out.
      const grow = 1 - (1 - Math.min(1, t * 2.2)) ** 2;
      drawPuff(g, m.x, m.y, m.r * (0.5 + grow * 0.9), 0.85 * (1 - t) ** 1.4, m.seed);
      return true;
    });
    g.end();
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

  /** One articulated figure drives every action so proportions and landmarks stay continuous. */
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
    const dx = target.x - this.sisPos.x;
    const dy = target.y - this.sisPos.y;
    const dist = Math.hypot(dx, dy);
    // The downhill route covers about 920 px in 3.2 moving seconds. Keep a
    // little headroom over that pace, and accelerate only for large catch-ups
    // (initial entry, automation changes, or a new attempt after a short slip).
    const travelRate = dist > 420 ? 420 : 320;
    const speed = travelRate * dt;
    const glued = site.phase === 'ascending' && sisPushing && dist <= Math.max(30, speed);
    const moving = !glued && dist > 1;
    const step = glued || dist <= speed ? dist : speed;
    const before = { ...this.sisPos };
    if (glued || dist <= speed) this.sisPos = { ...target };
    else this.sisPos = { x: this.sisPos.x + (dx / dist) * speed, y: this.sisPos.y + (dy / dist) * speed };
    if (!slipping) this.slipAt = null;
    if (moving && Math.abs(dx) > 4) this.facing = dx < 0 ? -1 : 1;
    else if (glued) this.facing = 1;
    // The push cycle runs only while the stone is actually driven; otherwise
    // Sisyphus holds the planted contact pose and breathes.
    const driving = held || (automated && site.phase === 'ascending');
    if (driving) this.pushClock += dt;
    const wrapped = site.id !== catalog.sites[0].id || this.grip('wrap_feet');
    const reduced = this.reduced;
    const breath = reduced ? 0 : this.time * 1.7;
    const weary = !automated && (site.phase === 'descending' || site.phase === 'returning' || this.time - this.fallenAt < 6) ? 0.6 : 0;

    // Ground under a local x (feet at the origin, facing `facing`). In front
    // of the hill, on the plain, the ground is level with his feet.
    const origin = this.sisPos;
    const onPlain = origin.y > surfaceY(origin.x) + 1;
    const groundAt = (lx: number) => (onPlain ? 0 : surfaceY(origin.x + this.facing * lx) - origin.y);

    let want: Pose;
    let rate = 12;
    let rotation = 0;
    if (slipping) {
      // Knocked down where he stood, lying along the slope.
      want = fallenPose(reduced ? 0 : this.time - this.fallenAt);
      rotation = onPlain ? 0 : Math.atan2(groundAt(10) - groundAt(-10), 20) * this.facing;
      rate = 9;
    } else if (glued || moving) {
      // Stepping gait with the feet planted on the real ground: pushing takes
      // long, low strides; walking short upright ones.
      const push = glued;
      const travelled = Math.abs(this.sisPos.x - before.x);
      const horizontalSpeed = dt > 0 ? travelled / dt : 0;
      // Catch-up motion reads as a purposeful run instead of a sped-up walk:
      // the stride grows with speed while the same skeleton remains on model.
      const step = push ? 30 : 26 + 10 * Math.min(1, Math.max(0, (horizontalSpeed - 180) / 240));
      const stance = push ? 0.66 : 0.6;
      // During stance the foot moves back 2*step locally. Match that to root
      // travel along x (not slope distance) so the planted foot stays still.
      const cycle = (2 * step) / stance;
      if (!reduced) this.gaitPhase += travelled / cycle;
      const feet = gait(this.gaitPhase, stance);
      const centre = push ? -22 : 2;
      const lift = push ? 7 : 9 + (step - 26) * 0.45;
      const ankles = feet.map((f, i) => {
        const lx = centre + step * f.x + (i === 0 ? -3 : 3);
        return { x: lx, y: groundAt(lx) - ANKLE_H - lift * f.lift };
      });
      const sole = (groundAt(ankles[0].x) + groundAt(ankles[1].x)) / 2;
      const bob = (feet[0].lift + feet[1].lift) * (push ? 1.5 : 2.5);
      if (push) {
        const effort = 0.5 + 0.5 * Math.sin(this.pushClock * Math.PI * 2 * 0.9);
        want = standPose(0);
        want.hipX = -14 + effort * 3;
        want.hipY = -66 + sole * 0.85 - bob + strain * 3;
        want.lean = 0.68 + 0.05 * effort + 0.1 * strain;
        want.nod = -0.62 + 0.12 * strain + (reduced ? 0 : (Math.random() - 0.5) * 0.06 * strain);
        plantLeg(want, 'far', ankles[0]);
        plantLeg(want, 'near', ankles[1]);
        // Both palms on the stone's back, the near hand a little higher.
        const stone = this.stoneDrawn(pos);
        for (const [arm, spread] of [
          ['farArm', 0.18],
          ['nearArm', -0.14],
        ] as const) {
          const sh = shoulderOf(want, arm);
          const sw = { x: origin.x + this.facing * sh.x, y: origin.y + sh.y };
          const a = Math.atan2(sw.y - stone.y, sw.x - stone.x) + spread;
          // Palms just inside the rim, pressed on the stone's face.
          const hand = { x: stone.x + Math.cos(a) * (STONE_VR - 6), y: stone.y + Math.sin(a) * (STONE_VR - 6) };
          reachArm(want, arm, { x: (hand.x - origin.x) * this.facing, y: hand.y - origin.y });
          // Palm flat on the stone, fingers up along its curve.
          const tangent = Math.sin(a) > 0 ? { x: Math.sin(a), y: -Math.cos(a) } : { x: -Math.sin(a), y: Math.cos(a) };
          const palm = Math.atan2(tangent.y, tangent.x * this.facing);
          let w = forearmAngle(want, arm) - palm;
          w = Math.atan2(Math.sin(w), Math.cos(w));
          want[arm].w = Math.min(1.5, Math.max(-0.4, w));
          want[arm].open = 1;
        }
        rate = 30;
      } else {
        // The hip rides over the planted leg; arms swing against the legs.
        want = walkCycle(this.gaitPhase, step, weary, groundAt, stance);
        rate = 30;
      }
    } else {
      want = !sisPushing ? asidePose(breath) : standPose(breath);
      const spread = !sisPushing ? [-13, 15] : [-9, 11];
      want.hipY += (groundAt(spread[0]) + groundAt(spread[1])) / 2;
      plantLeg(want, 'far', { x: spread[0], y: groundAt(spread[0]) - ANKLE_H });
      plantLeg(want, 'near', { x: spread[1], y: groundAt(spread[1]) - ANKLE_H });
    }
    // Feet lie along the ground under them (the fall already turns the whole figure).
    want.ground = slipping ? 0 : Math.atan2(groundAt(10) - groundAt(-10), 20);
    // The skirt and belt tie trail against the motion, with a flick each step.
    const vx = dt > 0 ? ((this.sisPos.x - before.x) * this.facing) / dt : 0;
    want.sway = slipping || reduced ? 0 : Math.max(-5, Math.min(5, vx * 0.011)) + (moving ? Math.sin(this.gaitPhase * Math.PI * 4) : 0);
    easePose(this.pose, want, reduced ? 1 : 1 - Math.exp(-dt * rate));
    this.sis.position.set(origin.x, origin.y);
    this.sis.rotation = rotation;
    // Turning round: the body narrows toward three-quarter view, shows its
    // other side at the midpoint, and opens out again (≈ 0.2 s).
    const turnRate = dt / 0.1;
    const shown = Math.sign(this.turnScale);
    const width = Math.abs(this.turnScale);
    if (reduced) this.turnScale = this.facing;
    else if (shown !== this.facing) this.turnScale = width - turnRate <= 0.35 ? this.facing * 0.35 : shown * (width - turnRate);
    else this.turnScale = shown * Math.min(1, width + turnRate);
    this.sis.scale.set(this.turnScale, 1);
    this.sisRig.update(this.pose, wrapped, this.time, this.turnScale < 0);
  }

  /** The shade works the rope drum: hands on the rotor rim, leaning back on each pull. */
  private updateShade(dt: number, hauled: boolean): void {
    const reduced = this.reduced;
    const phase = reduced || !hauled ? 0 : (this.drumClock / 1.3) % 1;
    const want = hauled ? pullPose(phase) : standPose(reduced ? 0 : this.time * 1.3);
    const k = SHADE_RIG_K;
    const local = (x: number, y: number) => ({ x: (x - SHADE_POST.x) / k, y: (y - SHADE_POST.y) / k });
    // He stands a stride from the post, close enough to take the wheel.
    const stroke = hauled ? (phase < 0.7 ? phase / 0.7 : 1 - (phase - 0.7) / 0.3) : 0;
    want.hipX = 21;
    if (hauled) {
      // Reach forward over the rim, then sit back with straight arms.
      want.hipX = 22 - 7 * stroke;
      want.hipY = -71 + 2 * stroke;
      want.lean = 0.46 - 0.32 * stroke;
      want.nod = 0.22 - 0.1 * stroke;
    }
    for (const [leg, x] of [
      ['far', 8],
      ['near', 34],
    ] as const) {
      plantLeg(want, leg, { x, y: -ANKLE_H });
    }
    if (hauled) {
      // Hands on the spokes, dragging the top of the rotor toward him.
      const a = -Math.PI * (0.45 + 0.35 * stroke);
      const r = 22;
      reachArm(want, 'farArm', local(DRUM.x + Math.cos(a + 0.15) * r, DRUM.y + Math.sin(a + 0.15) * r));
      reachArm(want, 'nearArm', local(DRUM.x + Math.cos(a - 0.1) * r, DRUM.y + Math.sin(a - 0.1) * r));
      // Fists curled round the spokes.
      want.farArm.w = 0.5;
      want.nearArm.w = 0.5;
    }
    easePose(this.shadePose, want, reduced ? 1 : 1 - Math.exp(-dt * 14));
    this.shadeRig.update(this.shadePose, false, this.time + 1.7);
    this.shade.alpha = 0.9;
  }

  // ------------------------------------------------------------------ effects

  private onEvents(events: GameEvent[]): void {
    const s = this.game.state;
    const selected = s.empire.selectedSiteId;
    const reduced = s.options.reducedMotion;
    // A long absence settles in one batch: don't replay it on screen.
    if (events.length > 40) return;
    const rich = s.options.richEffects && !reduced;
    const stone = SITE_MATERIAL[selected] ?? SITE_MATERIAL.first_hill;
    for (const e of events) {
      if ('siteId' in e && e.siteId && e.siteId !== selected && e.type !== 'SiteOpened') continue;
      switch (e.type) {
        case 'SummitReached': {
          const p = routePoint(1);
          this.floatText(`+${formatMoney(e.amount)}`, p.x, p.y - 100);
          if (!reduced && !rich) this.effect('fx_coin', 'small_grant', p.x, p.y - 60);
          if (rich) this.vfx.coins(p.x, p.y - 70, 2);
          break;
        }
        case 'ImpactResolved': {
          this.floatText(`+${formatMoney(e.amount)}`, IMPACT.x - 40, IMPACT.y - 110);
          if (!e.bonus.isZero()) this.floatText(`+${formatMoney(e.bonus)} bonus`, TARGET.x - 60, TARGET.y - 215, true);
          this.wheelSpin += 14;
          this.squash = 0;
          // From level 25 the bronze-braced return lands harder (spec §03).
          const level = findSite(s, e.siteId)?.productionLevel ?? 1;
          const force = level >= 50 ? 1.5 : level >= 25 ? 1.3 : 1;
          this.kick(IMPACT.x, GROUND_Y, Math.round(14 * force), 2.6 * force, 160 * force);
          if (!reduced) {
            const kind = e.targetId === 'expected' ? 'debris' : e.targetId;
            if (!rich) this.effect(`target_${kind}`, 'shatter', TARGET.x - 30, TARGET.y - 20, level >= 25 ? 1.12 : 1);
            this.shake = 6 * force;
            this.punchAt = { x: IMPACT.x, y: GROUND_Y };
            this.punch = Math.min(1, 0.55 * force);
            if (rich) {
              this.kiln?.shockwave(IMPACT.x + 25, GROUND_Y - 10, 9 * force, 1000, 0.75);
              this.kiln?.flash(0.16 * force);
              this.vfx.impact(IMPACT.x + 25, GROUND_Y, force, stone, TARGET_MATERIAL[kind], { x: TARGET.x, y: surfaceY(TARGET.x), kind });
              if (!e.bonus.isZero()) this.vfx.coins(TARGET.x - 10, TARGET.y - 60, kind === 'gilded_offering' ? 16 : 12);
            }
          }
          break;
        }
        case 'StoneSlipped': {
          const p = routePoint(e.height);
          this.slipAt = { ...this.sisPos };
          this.fallenAt = this.time;
          if (e.record) {
            this.floatText(`New height: ${Math.round(e.height * 100)}%`, p.x, p.y - 150, true);
            this.markerMovedAt = this.time;
          } else this.floatText('Slipped', p.x, p.y - 130);
          this.kick(this.sisPos.x, this.sisPos.y, 8, 2.2, 110);
          if (!reduced) {
            if (!rich) this.effect('fx_fall', 'dust', p.x - 30, p.y + 30);
            this.shake = 5;
            if (rich) {
              this.kiln?.shockwave(p.x, surfaceY(p.x), 4, 600, 0.5);
              this.vfx.slip(p.x, surfaceY(p.x), stone);
            }
          }
          break;
        }
        case 'FallResolved': {
          const p = routePoint(0);
          this.floatText(`+${formatMoney(e.amount)}`, p.x, p.y - 110);
          this.kick(p.x, GROUND_Y, 10, 2.4, 130);
          if (!reduced) {
            if (!rich) this.effect('fx_fall', 'obol_toss', p.x, p.y - 20);
            this.shake = 4;
            if (rich) {
              this.vfx.dust(p.x, surfaceY(p.x), 5, 70, 0.8);
              this.kiln?.shockwave(p.x, surfaceY(p.x), 5, 700, 0.55);
              this.vfx.slip(p.x, surfaceY(p.x), stone);
              this.vfx.coins(p.x, p.y - 20, 3);
            }
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
            if (!rich) this.effect('fx_first_summit', 'burst', p.x - 40, p.y - 40);
            this.shake = 12;
            this.punchAt = { x: p.x, y: p.y };
            this.punch = 1;
            if (rich) {
              this.kiln?.shockwave(p.x, p.y - 40, 16, 1300, 1.1);
              this.kiln?.flash(0.45, [1, 0.9, 0.62]);
              this.vfx.summit(p.x, p.y - 60);
            }
          }
          break;
        }
        case 'FlywheelCharged':
          this.chargedAt = this.time;
          break;
        case 'PurchaseCompleted':
          this.stonePulse = 1;
          this.confirmPurchase(e.kind);
          if (rich && this.rings.length) {
            const r = this.rings[this.rings.length - 1];
            this.vfx.purchase(r.x, r.y);
          }
          break;
        case 'MilestoneReached': {
          const p = routePoint(0.5);
          const install = INSTALLS.find((i) => i.level === e.level);
          const focus = install ? routePoint(install.u) : p;
          this.milestoneShot = { x: focus.x, y: focus.y, at: this.time };
          this.floatText(`Level ${e.level} · ×2`, p.x, p.y - 170, true);
          this.chisel.play(e.siteId, e.level);
          if (!reduced && !rich) this.effect('fx_coin', 'milestone_grant', p.x - 50, p.y - 120);
          if (rich) this.vfx.milestone(focus.x, focus.y - 40);
          break;
        }
        case 'WorkInstalled':
          this.workEnteredAt.set(e.workId, this.time);
          break;
        case 'DecreeAvailable':
          if (rich) this.vfx.stamp(800, 260);
          else this.effect('decree_stamp', 'stamp', 800, 260, 0.6);
          // A brief sky accent; it never touches the stone or the route.
          if (!reduced) {
            this.decreeBolt = 1;
            this.boltSeed = Math.random() * 1000;
            if (rich) {
              const tip = this.boltTip();
              this.kiln?.flash(0.22, [0.95, 0.93, 1]);
              this.vfx.decree(tip.x, tip.y);
            }
          }
          break;
        case 'RelicGranted': {
          // Out over the sea beside the summit, clear of the header.
          const at = { x: routePoint(1).x + 250, y: routePoint(1).y + 40 };
          if (rich) this.vfx.relic(at.x, at.y, e.relicId);
          else this.effect('fx_relic', 'rare_discovery', at.x, at.y, 0.8);
          break;
        }
        case 'SiteOpened':
          this.staticKey = '';
          this.lastStone = null;
          this.vfx.clear();
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
        bump(this.shade, SHADE_RIG_K);
        break;
      case 'impact':
        ring(TARGET.x, surfaceY(TARGET.x) - 40, 70);
        bump(this.target, 1);
        break;
      case 'counterweight':
        ring(MACHINE_X, surfaceY(MACHINE_X) - MACHINE_HEIGHT * 0.45, 110);
        bump(this.machine, this.machineScale);
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

  /** Where the decree bolt's jagged walk ends (the same walk drawBolt draws). */
  private boltTip(): Vec {
    let x = 1180 + (this.boltSeed % 160);
    let y = -20;
    for (let i = 0; y < 250; i++) {
      y += 34 + ((this.boltSeed * (i + 3)) % 22);
      x += ((this.boltSeed * (i + 7)) % 60) - 30;
    }
    return { x, y };
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
    const box = new Container();
    const t = new Text({
      text,
      style: {
        fontFamily: "'Cormorant Garamond', 'Palatino Linotype', Palatino, Georgia, serif",
        fontSize: highlight ? 46 : 40,
        fontWeight: '700',
        fill: highlight ? POTTERY.clay : POTTERY.ink,
        stroke: { color: POTTERY.ivory, width: 8, join: 'round' },
        dropShadow: { color: POTTERY.ink, alpha: 0.25, blur: 2, distance: 3, angle: Math.PI / 2 },
      },
    });
    t.anchor.set(0.5);
    box.addChild(t);
    // Money gets an obol beside it, and a few more fly to the purse.
    if (text.startsWith('+')) {
      const coin = coinSprite(highlight ? 15 : 13);
      coin.x = -t.width / 2 - 14;
      t.x = 8;
      box.addChild(coin);
      if (this.onPayout && this.game.state.options.richEffects && !this.reduced) {
        const at = this.stage.toGlobal({ x, y });
        const r = this.app.canvas.getBoundingClientRect();
        this.onPayout(r.left + at.x, r.top + at.y, highlight || life > 2);
      }
    }
    box.position.set(x, y);
    this.fx.addChild(box);
    this.texts.push({ t: box, life, max: life, x0: x, y0: y });
    if (this.texts.length > 8) this.texts.shift()!.t.destroy({ children: true });
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
      const age = f.max - f.life;
      if (this.reduced) {
        f.t.scale.set(1);
        f.t.y = f.y0;
      } else {
        // Pop in with a small overshoot, then drift up and ease out.
        const pop = Math.min(1, age / 0.28);
        const s = 1 + 0.18 * Math.sin(pop * Math.PI) - 0.35 * (1 - pop) ** 3;
        f.t.scale.set(s);
        f.t.y = f.y0 - 70 * (1 - Math.exp(-age * 1.6));
      }
      f.t.alpha = Math.min(1, Math.max(0, f.life / 0.45));
      // Keep the whole line in view when the drawer narrows the frame.
      const zoom = this.stage.scale.x;
      const left = (this.insets.left - this.stage.x) / zoom;
      const right = (this.app.screen.width - this.insets.right - this.stage.x) / zoom;
      const half = f.t.width / 2 + 12;
      f.t.x = Math.min(Math.max(f.x0, left + half), Math.max(left + half, right - half));
    }
    this.texts = this.texts.filter((f) => (f.life > 0 ? true : (f.t.destroy({ children: true }), false)));
  }

  destroy(): void {
    // A torn-down world must stop hearing the game, or its next event reads a destroyed renderer.
    this.offEvents?.();
    this.offEvents = null;
    this.app.destroy(true);
  }
}
