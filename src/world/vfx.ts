import { Container, Graphics, type Texture } from 'pixi.js';
import { surfaceY } from './geometry';
import { POTTERY } from './palette';
import { GlowLayer, SpriteLayer } from './glow';
import { DUST_R, dustTextures, obolScale, obolTexture, PEBBLE_R, pebbleTextures, SHERD_R, sherdTextures, type SherdLook } from './painted';
import { BURST_R, burstTexture, type BurstTone, LEAF_LEN, leafTextures, RELIC_R, relicTexture, SEAL_R, sealTexture, STAR_R, starTexture, targetFragments } from './painted-fx';

/**
 * Rich effects in the pottery idiom. The pieces are painted (see painted.ts):
 * glazed sherds, faceted stone chips, struck obols and billows of dust that
 * tumble and bounce on the real slope. Marks are incised the way a vase
 * painter would draw them: black-figure ray bursts crown a summit, and
 * cracks are scratched into the ground. Purely cosmetic: it reads events and
 * positions and never touches the simulation.
 */

const INK = POTTERY.ink;
export const GOLD = 0xd8b25a;
const GOLD_DARK = 0x9c7428;
const GRAVITY = 1400;
const MAX_PARTICLES = 360;

export interface Material {
  fill: number;
  accent: number;
  /** What its pieces look like: stone chips unless said otherwise. */
  kind?: SherdLook['kind'];
  /** What else a blow on this hill throws up. */
  air?: 'cinders' | 'splash' | 'bronze' | 'stars' | 'gilt';
}

/** What each hill's stone breaks into. */
export const SITE_MATERIAL: Record<string, Material> = {
  first_hill: { fill: 0xdccfb2, accent: POTTERY.paleClay },
  tartarus_rim: { fill: 0x3b322c, accent: POTTERY.clay, air: 'cinders' },
  leaking_heights: { fill: 0xeee6d6, accent: POTTERY.shade, air: 'splash' },
  bronze_pass: { fill: POTTERY.bronze, accent: 0xe8c78a, air: 'bronze' },
  skyward_escarpment: { fill: 0x3a3f52, accent: POTTERY.ivory, air: 'stars' },
  olympian_approach: { fill: POTTERY.ivory, accent: GOLD, air: 'gilt' },
};

/** What the bonus targets break into; debris uses the hill's own stone. */
export const TARGET_MATERIAL: Record<string, Material> = {
  coin_amphora: { fill: POTTERY.clay, accent: INK, kind: 'figure' },
  gilded_offering: { fill: GOLD, accent: POTTERY.ivory, kind: 'gold' },
};

type Kind = 'shard' | 'pebble' | 'obol' | 'spark' | 'leaf' | 'star' | 'dust' | 'chunk' | 'drop';

const FIGURE: Material = { fill: POTTERY.clay, accent: INK, kind: 'figure' };
const DUST_TINT = 0xe9c9a4;

interface Particle {
  kind: Kind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  spin: number;
  size: number;
  life: number;
  max: number;
  fill: number;
  accent: number;
  seed: number;
  gravity: number;
  drag: number;
  bounce: number;
  resting: boolean;
  /** The painted piece, for shards, pebbles, dust, leaves and chunks. */
  tex: Texture | null;
  /** A chunk's size in world units. */
  w: number;
  h: number;
}

/** A painted object on show: a relic turning in the light, or Zeus's seal pressed down. */
interface Show {
  kind: 'relic' | 'seal';
  tex: Texture;
  x: number;
  y: number;
  age: number;
  max: number;
  hit: boolean;
}

/** Where a target stood, so it can break into pieces of its own painting. */
export interface TargetAt {
  x: number;
  y: number;
  kind: string;
}

type MarkKind = 'wave' | 'rays' | 'crack' | 'glint' | 'ring';

interface Mark {
  kind: MarkKind;
  x: number;
  y: number;
  age: number;
  max: number;
  size: number;
  color: number;
  seed: number;
  count: number;
  paths: number[][];
}

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T>(list: T[]): T => list[Math.floor(Math.random() * list.length)];
const easeOut = (k: number) => 1 - (1 - k) ** 3;
const easeBack = (k: number) => 1 + 2.4 * (k - 1) ** 3 + 1.4 * (k - 1) ** 2;
const HEAVY: Kind[] = ['shard', 'pebble', 'obol', 'chunk'];
/** Pieces lie where they land for a while; beyond this many, the oldest go first. */
const MAX_RESTING = 70;

export class PotteryFx extends Container {
  private g = new Graphics();
  private marksBelow = new Graphics();
  private particles: Particle[] = [];
  private marks: Mark[] = [];
  /** Hit-stop: particles hold still for a beat when something lands hard. */
  private freeze = 0;
  /** Speed lines behind a fast stone. */
  private trailVel = { x: 0, y: 0 };
  private trailLast: { x: number; y: number } | null = null;
  private trailLines = new Graphics();
  /** Additive light over the painted particles: sparks, gold and the hit flash shine. */
  private glow = new GlowLayer(220);
  /** Painted pieces: dust behind, sherds and coins in front of the marks. */
  private dustLayer = new SpriteLayer(80);
  private pieces = new SpriteLayer(MAX_PARTICLES);
  /** Painted ray bursts, behind the pieces. */
  private bursts = new SpriteLayer(16);
  /** Objects on show, in front of everything but the light. */
  private showLayer = new SpriteLayer(4);
  private shows: Show[] = [];
  /** How many particles may fly at once (lower on balanced quality). */
  budget = MAX_PARTICLES;

  constructor() {
    super();
    this.addChild(this.marksBelow, this.dustLayer, this.trailLines, this.bursts, this.g, this.pieces, this.showLayer, this.glow);
  }

  // ---------------------------------------------------------------- bursts

  /** The stone lands: a hit frame, a dashed shockwave, cracks, shards and chips. */
  impact(x: number, y: number, force: number, stone: Material, target?: Material, at?: TargetAt): void {
    this.freeze = Math.max(this.freeze, 0.05 + 0.03 * force);
    this.mark('glint', x, y - 30, 0.2, 70 * force, POTTERY.ivory);
    this.mark('wave', x, y, 0.75, 190 * force, INK);
    this.mark('crack', x, y, 2.4, 120 * force, INK, 5 + Math.round(force * 2));
    const shards = target ?? stone;
    if (at) this.breakTarget(x, at, force);
    if (target?.kind === 'gold') {
      // Bronze rings rather than shatters: a chime spreading out, and gold sparks.
      for (let i = 0; i < 3; i++) this.mark('ring', at?.x ?? x, (at?.y ?? y) - 50, 0.7 + i * 0.25, 90 + i * 50, GOLD);
      for (let i = 0; i < 14; i++) {
        this.spawn('spark', at?.x ?? x, (at?.y ?? y) - 50, rand(-0.95, -0.05) * Math.PI, rand(400, 800), { fill: 0xfff0c0, accent: GOLD }, 1);
      }
    }
    for (let i = 0; i < Math.round((at ? 8 : 12) * force); i++) {
      this.spawn('shard', x + rand(-30, 30), y - rand(20, 50), rand(-0.95, 0.35) * Math.PI, rand(380, 780) * force, shards, rand(10, 18));
    }
    // The heap of debris holds old pots as well as stone; a vessel breaks against stone.
    for (let i = 0; i < 4; i++) {
      this.spawn('shard', x + rand(-30, 30), y - rand(10, 40), rand(-0.9, 0.3) * Math.PI, rand(300, 680) * force, target ? stone : FIGURE, target ? rand(6, 10) : rand(7, 12));
    }
    for (let i = 0; i < Math.round(9 * force); i++) {
      this.spawn('pebble', x + rand(-40, 40), y - 8, rand(-0.85, -0.15) * Math.PI, rand(200, 440) * force, stone, rand(3, 6));
    }
    this.dust(x, y, Math.round(9 * force), 100 * force, 1.15);
    for (let i = 0; i < Math.round(8 + 6 * force); i++) {
      this.spawn('spark', x, y - 20, rand(-0.9, -0.1) * Math.PI, rand(500, 900), { fill: POTTERY.ivory, accent: stone.accent }, 1);
    }
    this.hillAir(x, y, force, stone);
  }

  /** Each hill answers a blow in its own way. */
  private hillAir(x: number, y: number, force: number, stone: Material): void {
    const n = Math.round(14 * force);
    switch (stone.air) {
      case 'cinders':
        // Tartarus: glowing cinders that drift up on the pit's heat.
        for (let i = 0; i < n + 6; i++) {
          const p = this.spawn('spark', x + rand(-40, 40), y - rand(0, 20), rand(-0.95, -0.05) * Math.PI, rand(140, 420), { fill: 0xffb45a, accent: 0xff5a1e }, 1);
          if (p) {
            p.gravity = -110;
            p.drag = 1.8;
            p.max = rand(1, 2);
          }
        }
        break;
      case 'splash':
        // The Leaking Heights: water thrown up from the wet ground, and a cool mist.
        for (let i = 0; i < n + 4; i++) {
          const p = this.spawn('drop', x + rand(-30, 30), y - rand(2, 10), rand(-0.92, -0.08) * Math.PI, rand(260, 620) * force, { fill: 0xd8eef6, accent: 0x86b4cc }, rand(1.8, 3.4));
          if (p) {
            p.gravity = 1300;
            p.drag = 0.3;
          }
        }
        this.dust(x, y, 5, 70 * force, 1.1, 0xd0dee8);
        break;
      case 'bronze':
        for (let i = 0; i < n; i++) {
          this.spawn('spark', x, y - 16, rand(-0.95, -0.05) * Math.PI, rand(520, 980), { fill: 0xffe0a0, accent: POTTERY.bronze }, 1);
        }
        break;
      case 'stars':
        // The Skyward Escarpment: the blow knocks loose a few silver stars.
        for (let i = 0; i < 6; i++) {
          this.spawn('star', x + rand(-70, 70), y - rand(30, 120), -Math.PI / 2, rand(20, 60), { fill: POTTERY.ivory, accent: POTTERY.shade }, rand(6, 10));
        }
        break;
      case 'gilt':
        // Olympus: flakes of gold leaf off the marble.
        for (let i = 0; i < 10; i++) this.leaf(x + rand(-30, 30), y - rand(10, 30), rand(-0.9, -0.1) * Math.PI, rand(240, 480) * force, 'gold', rand(10, 15));
        break;
    }
  }

  /** The waiting target comes apart: pieces of its own painting, thrown clear of the blow. */
  private breakTarget(x: number, at: TargetAt, force: number): void {
    const heavy = at.kind === 'gilded_offering';
    for (const f of targetFragments(at.kind)) {
      const px = at.x + f.x;
      const py = at.y + f.y;
      // Up and back toward the hill, so the pieces land where they can be seen.
      const away = (px - at.x) * rand(2, 4) - rand(40, 200);
      const p = this.spawn('chunk', px, py, 0, 0, { fill: 0xffffff, accent: 0xffffff }, Math.max(f.w, f.h) / 2);
      if (!p) return;
      p.tex = f.tex;
      p.w = f.w;
      p.h = f.h;
      p.rot = 0;
      p.vx = away * (heavy ? 0.6 : 1);
      p.vy = -(rand(260, 560) + (at.y - py) * 2.2) * force * (heavy ? 0.75 : 1);
      p.spin = rand(-7, 7) * (heavy ? 0.5 : 1);
    }
  }

  /** A lighter landing: the prelude fall or a slip. */
  slip(x: number, y: number, stone: Material): void {
    this.mark('wave', x, y, 0.6, 110, INK);
    this.dust(x, y, 4, 60, 0.7);
    for (let i = 0; i < 9; i++) {
      this.spawn('pebble', x + rand(-30, 30), y - 6, rand(-0.9, -0.1) * Math.PI, rand(160, 360), stone, rand(3, 6));
    }
  }

  /** Obols spill out, flipping, and bounce down the ground. */
  coins(x: number, y: number, n: number): void {
    for (let i = 0; i < n; i++) {
      const p = this.spawn('obol', x + rand(-12, 12), y, rand(-0.75, -0.25) * Math.PI, rand(380, 620), { fill: GOLD, accent: GOLD_DARK }, rand(9, 12));
      if (p) p.spin = rand(10, 18) * (Math.random() < 0.5 ? -1 : 1);
    }
  }

  /** The first summit: a black-figure ray burst, a laurel shower, gold stars. */
  summit(x: number, y: number): void {
    this.mark('glint', x, y, 0.3, 120, POTTERY.ivory);
    this.mark('rays', x, y, 1.6, 260, POTTERY.clay, 20);
    for (let i = 0; i < 22; i++) {
      this.leaf(x + rand(-60, 60), y - rand(0, 40), rand(-0.95, -0.05) * Math.PI, rand(260, 560), i % 3 === 0 ? 'bay' : 'gold', rand(18, 26));
    }
    for (let i = 0; i < 10; i++) {
      this.spawn('star', x + rand(-150, 150), y + rand(-160, 40), -Math.PI / 2, rand(10, 40), { fill: GOLD, accent: POTTERY.bronze }, rand(9, 15));
    }
    this.coins(x, y, 8);
  }

  /** A level milestone: rays and a few leaves where the new structure went up. */
  milestone(x: number, y: number): void {
    this.mark('rays', x, y, 1.2, 170, POTTERY.bronze, 16);
    for (let i = 0; i < 12; i++) {
      this.leaf(x + rand(-50, 50), y, rand(-0.9, -0.1) * Math.PI, rand(220, 440), i % 2 ? 'bay' : 'gold', rand(15, 21));
    }
    this.coins(x, y, 4);
  }

  /** A relic: it rises turning in the light, before gold rays and a scatter of stars. */
  relic(x: number, y: number, id: string): void {
    this.mark('glint', x, y, 0.3, 100, POTTERY.ivory);
    this.mark('rays', x, y, 3.4, 150, GOLD, 24);
    for (let i = 0; i < 12; i++) {
      this.spawn('star', x, y, rand(0, Math.PI * 2), rand(120, 320), { fill: GOLD, accent: POTTERY.bronze }, rand(8, 14));
    }
    this.shows = this.shows.filter((s) => s.kind !== 'relic');
    this.shows.push({ kind: 'relic', tex: relicTexture(id), x, y, age: 0, max: 3.6, hit: false });
  }

  /** Zeus's seal comes down on the decree: pressed, a crack of light, sparks. */
  stamp(x: number, y: number): void {
    this.shows = this.shows.filter((s) => s.kind !== 'seal');
    this.shows.push({ kind: 'seal', tex: sealTexture(), x, y, age: 0, max: 2.6, hit: false });
  }

  /** A purchase lands on its machine: a quick bronze spark crown. */
  purchase(x: number, y: number): void {
    this.mark('rays', x, y, 0.55, 90, POTTERY.bronze, 12);
    for (let i = 0; i < 10; i++) {
      this.spawn('spark', x, y, (i / 10) * Math.PI * 2 + rand(-0.2, 0.2), rand(260, 420), { fill: POTTERY.ivory, accent: POTTERY.bronze }, 1);
    }
  }

  /** Where Zeus's bolt strikes the far sky: sparks and a few stars. */
  decree(x: number, y: number): void {
    this.mark('glint', x, y, 0.25, 80, POTTERY.ivory);
    for (let i = 0; i < 14; i++) {
      this.spawn('spark', x, y, rand(0, Math.PI * 2), rand(300, 700), { fill: POTTERY.ivory, accent: POTTERY.paleClay }, 1);
    }
    for (let i = 0; i < 5; i++) this.spawn('star', x + rand(-60, 60), y + rand(-40, 40), 0, 0, { fill: POTTERY.ivory, accent: POTTERY.bronze }, rand(7, 11));
  }

  private leaf(x: number, y: number, angle: number, speed: number, kind: 'gold' | 'bay', size: number): void {
    const p = this.spawn('leaf', x, y, angle, speed, { fill: 0xffffff, accent: 0xffffff }, size);
    if (p) p.tex = pick(leafTextures(kind));
  }

  /** Billows of dust rolling out along the ground and rising as they thin. */
  dust(x: number, y: number, n: number, spread: number, scale: number, tint = DUST_TINT): void {
    for (let i = 0; i < n; i++) {
      const out = i % 2 ? rand(-0.35, -0.02) * Math.PI : Math.PI + rand(0.02, 0.35) * Math.PI;
      const p = this.spawn('dust', x + rand(-20, 20), y - rand(4, 18), out, rand(0.4, 1) * spread * 2.2, { fill: tint, accent: tint }, rand(18, 30) * scale);
      if (p) p.spin = rand(-0.6, 0.6);
    }
  }

  // --------------------------------------------------------------- per frame

  /** Feed the stone's drawn centre each frame; fast travel grows speed lines. */
  trail(x: number, y: number, dt: number, radius: number): void {
    const g = this.trailLines;
    g.clear();
    const last = this.trailLast;
    this.trailLast = { x, y };
    if (!last || dt <= 0) return;
    const vx = (x - last.x) / dt;
    const vy = (y - last.y) / dt;
    // A teleport (site switch, reset) is not motion.
    if (Math.hypot(vx, vy) > 6000) return;
    this.trailVel.x += (vx - this.trailVel.x) * Math.min(1, dt * 14);
    this.trailVel.y += (vy - this.trailVel.y) * Math.min(1, dt * 14);
    const speed = Math.hypot(this.trailVel.x, this.trailVel.y);
    const k = Math.min(1, (speed - 520) / 900);
    if (k <= 0) return;
    const dx = this.trailVel.x / speed;
    const dy = this.trailVel.y / speed;
    const nx = -dy;
    const ny = dx;
    const len = 40 + 130 * k;
    // Three incised strokes, the middle one longest, as vase painters draw a rush.
    for (const [o, l] of [
      [-0.55, 0.7],
      [0, 1],
      [0.55, 0.75],
    ] as const) {
      const sx = x - dx * (radius + 8) + nx * o * radius;
      const sy = y - dy * (radius + 8) + ny * o * radius;
      g.moveTo(sx, sy)
        .lineTo(sx - dx * len * l, sy - dy * len * l)
        .stroke({ width: 3.2, color: INK, alpha: 0.55 * k, cap: 'round' });
    }
  }

  update(dt: number): void {
    const step = this.freeze > 0 ? 0 : dt;
    this.freeze = Math.max(0, this.freeze - dt);
    this.stepParticles(step);
    this.marks = this.marks.filter((m) => (m.age += dt) < m.max);
    this.shows = this.shows.filter((s) => (s.age += dt) < s.max);
    this.draw();
  }

  clear(): void {
    this.particles = [];
    this.marks = [];
    this.shows = [];
    this.trailLast = null;
    this.g.clear();
    this.marksBelow.clear();
    this.trailLines.clear();
    this.glow.begin();
    this.glow.end();
    this.pieces.begin();
    this.pieces.end();
    this.dustLayer.begin();
    this.dustLayer.end();
    this.bursts.begin();
    this.bursts.end();
    this.showLayer.begin();
    this.showLayer.end();
  }

  // ----------------------------------------------------------------- internals

  private spawn(kind: Kind, x: number, y: number, angle: number, speed: number, mat: Material, size: number): Particle | null {
    if (this.particles.length >= this.budget) return null;
    const heavy = HEAVY.includes(kind);
    const p: Particle = {
      kind,
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      rot: rand(0, Math.PI * 2),
      spin: rand(-12, 12),
      size,
      life: 0,
      max: kind === 'spark' ? rand(0.25, 0.45) : kind === 'star' ? rand(0.7, 1.2) : kind === 'leaf' ? rand(1.8, 2.6) : kind === 'dust' ? rand(1.1, 1.8) : rand(1.6, 2.4),
      fill: mat.fill,
      accent: mat.accent,
      seed: Math.random(),
      gravity: heavy ? GRAVITY : kind === 'leaf' ? 160 : kind === 'spark' ? 900 : kind === 'dust' ? -40 : 0,
      drag: heavy ? 0.4 : kind === 'leaf' ? 2.6 : kind === 'spark' ? 1.5 : kind === 'dust' ? 3.2 : 3,
      bounce: 0,
      resting: false,
      tex: null,
      w: size * 2,
      h: size * 2,
    };
    const look: SherdLook = { kind: mat.kind ?? 'stone', fill: mat.fill, accent: mat.accent };
    if (kind === 'shard') p.tex = pick(sherdTextures(look));
    else if (kind === 'pebble') p.tex = pick(pebbleTextures(look));
    else if (kind === 'dust') p.tex = pick(dustTextures());
    this.particles.push(p);
    return p;
  }

  private stepParticles(dt: number): void {
    this.particles = this.particles.filter((p) => {
      p.life += dt;
      if (p.life >= p.max) return false;
      if (dt === 0) return true;
      if (!p.resting) {
        p.vy += p.gravity * dt;
        p.vx *= 1 - p.drag * dt;
        p.vy *= 1 - p.drag * dt * (p.gravity > 0 ? 0.2 : 1);
        if (p.kind === 'leaf') {
          // A leaf flutters: it sways across its fall and tilts with the sway.
          p.vx += Math.sin(p.life * 5 + p.seed * 9) * 260 * dt;
          p.rot = Math.sin(p.life * 5 + p.seed * 9) * 0.9 + p.seed * 6;
        } else p.rot += p.spin * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        if (p.kind === 'drop' && p.vy > 0 && p.y > surfaceY(p.x)) {
          if (Math.random() < 0.35) this.mark('wave', p.x, surfaceY(p.x), 0.4, 22, 0x86b4cc);
          return false;
        }
        // Heavy bits bounce on the slope and come to rest.
        if (p.gravity >= GRAVITY) {
          const floor = surfaceY(p.x) - this.footing(p);
          if (p.y > floor && p.vy > 0) {
            p.y = floor;
            p.vy *= -0.38;
            p.vx *= 0.62;
            p.spin *= 0.5;
            p.bounce += 1;
            if (Math.abs(p.vy) < 70 || p.bounce > 3) {
              p.resting = true;
              p.vy = 0;
              // It lies where it fell for a while before it weathers away.
              if (p.kind !== 'pebble') p.max = Math.max(p.max, p.life + rand(4, 7));
            }
          }
        }
      } else {
        // Resting pieces slide a little down the slope, then stop.
        p.vx *= 1 - Math.min(1, dt * 6);
        p.x += p.vx * dt;
        p.y = surfaceY(p.x) - this.footing(p);
        if (p.kind === 'obol') p.spin *= 1 - Math.min(1, dt * 5);
        if (p.kind === 'chunk') {
          // A broken piece settles onto a flat side.
          p.spin = 0;
          const flat = Math.round(p.rot / Math.PI) * Math.PI;
          p.rot += (flat - p.rot) * Math.min(1, dt * 7);
        } else p.rot += p.spin * dt;
      }
      return true;
    });
    // Too many lying about: the oldest weather away first.
    const resting = this.particles.filter((p) => p.resting && p.max - p.life > 0.8);
    for (let i = 0; i < resting.length - MAX_RESTING; i++) resting[i].max = resting[i].life + 0.8;
  }

  /** How far a piece's middle sits above the ground it lies on. */
  private footing(p: Particle): number {
    if (p.kind !== 'chunk') return p.size * 0.45;
    return (Math.abs(Math.cos(p.rot)) * p.h + Math.abs(Math.sin(p.rot)) * p.w) * 0.42;
  }

  private mark(kind: MarkKind, x: number, y: number, max: number, size: number, color: number, count = 0): void {
    const m: Mark = { kind, x, y, age: 0, max, size, color, seed: Math.random() * 1000, count, paths: [] };
    if (kind === 'crack') {
      // Jagged scratches radiating from the strike, flattened onto the ground.
      for (let i = 0; i < count; i++) {
        const base = Math.PI + (i / Math.max(1, count - 1)) * Math.PI + rand(-0.2, 0.2);
        const path = [0, 0];
        let a = base;
        let r = 0;
        const segs = 3 + Math.floor(Math.random() * 3);
        for (let s = 0; s < segs; s++) {
          r += (size / segs) * rand(0.6, 1.3);
          a += rand(-0.35, 0.35);
          path.push(Math.cos(a) * r, Math.sin(a) * r * 0.3);
        }
        m.paths.push(path);
      }
      m.y = y + 2;
    }
    this.marks.push(m);
    if (this.marks.length > 24) this.marks.shift();
  }

  private draw(): void {
    const g = this.g;
    const below = this.marksBelow;
    g.clear();
    below.clear();
    this.glow.begin();
    this.pieces.begin();
    this.dustLayer.begin();
    this.bursts.begin();
    this.showLayer.begin();
    for (const m of this.marks) this.drawMark(m.kind === 'crack' ? below : g, m);
    for (const p of this.particles) this.drawParticle(g, p);
    for (const s of this.shows) this.drawShow(s);
    this.glow.end();
    this.pieces.end();
    this.dustLayer.end();
    this.bursts.end();
    this.showLayer.end();
  }

  private drawMark(g: Graphics, m: Mark): void {
    const k = m.age / m.max;
    const e = easeOut(Math.min(1, k));
    switch (m.kind) {
      case 'glint': {
        // A flat disc of added white: the hit frame.
        g.circle(m.x, m.y, m.size * (0.35 + 0.65 * e)).fill({ color: m.color, alpha: 0.45 * (1 - k) ** 2 });
        this.glow.add(m.x, m.y, m.size * (1.4 + 1.6 * e), 0xffe2a8, (1 - k) ** 1.5);
        break;
      }
      case 'wave': {
        // A dashed ring spreading along the ground, like an incised border.
        const rx = m.size * (0.25 + 0.95 * e);
        const ry = rx * 0.22;
        const n = 26;
        const alpha = 0.75 * (1 - k) ** 1.3;
        const width = 1.5 + 5 * (1 - k);
        for (let i = 0; i < n; i++) {
          const a0 = (i / n) * Math.PI * 2 + m.seed;
          const a1 = a0 + ((Math.PI * 2) / n) * 0.55;
          g.moveTo(m.x + Math.cos(a0) * rx, m.y + Math.sin(a0) * ry)
            .lineTo(m.x + Math.cos((a0 + a1) / 2) * rx, m.y + Math.sin((a0 + a1) / 2) * ry)
            .lineTo(m.x + Math.cos(a1) * rx, m.y + Math.sin(a1) * ry)
            .stroke({ width, color: m.color, alpha, cap: 'round' });
        }
        break;
      }
      case 'rays': {
        // The painted ray pattern from a vase's foot, bursting outward and turning.
        const r1 = m.size * (0.4 + 0.75 * e);
        const alpha = 0.95 * Math.min(1, (1 - k) * 2.2);
        const tone: BurstTone = m.color === GOLD ? 'gold' : m.color === POTTERY.bronze ? 'bronze' : 'clay';
        const w = r1 * ((BURST_R + 6) / BURST_R) * 2;
        this.bursts.put(burstTexture(tone, m.count), m.x, m.y, w, w, m.seed + k * 0.5, alpha);
        this.glow.add(m.x, m.y, r1 * 1.2, 0xffd890, alpha * 0.35);
        break;
      }
      case 'ring': {
        // A struck bronze rings: a thin circle of light spreading out.
        const r = m.size * (0.2 + 0.8 * e);
        const alpha = 0.8 * (1 - k) ** 1.5;
        g.circle(m.x, m.y, r).stroke({ width: 1 + 3 * (1 - k), color: m.color, alpha });
        this.glow.add(m.x, m.y, r * 1.1, 0xffe0a0, alpha * 0.25);
        break;
      }
      case 'crack': {
        // Scratched in fast, then weathering away; a pale lip under the dark line.
        const reveal = Math.min(1, m.age / 0.18);
        const alpha = 0.8 * Math.min(1, (1 - k) * 2.2);
        for (const path of m.paths) {
          const pts = Math.max(2, Math.ceil((path.length / 2) * reveal));
          const line: number[] = [];
          const lip: number[] = [];
          for (let i = 0; i < pts; i++) {
            line.push(m.x + path[i * 2], m.y + path[i * 2 + 1]);
            lip.push(m.x + path[i * 2], m.y + path[i * 2 + 1] + 1.8);
          }
          g.poly(lip, false).stroke({ width: 1.4, color: POTTERY.ivory, alpha: alpha * 0.45, join: 'round', cap: 'round' });
          g.poly(line, false).stroke({ width: 2.4, color: m.color, alpha, join: 'round', cap: 'round' });
        }
        break;
      }
    }
  }

  private drawParticle(g: Graphics, p: Particle): void {
    const k = p.life / p.max;
    // Everything holds full strength, then fades: pieces on the ground over
    // their last moments, the rest over their last third.
    const alpha = p.gravity >= GRAVITY ? Math.min(1, (p.max - p.life) / 0.8) : Math.min(1, (1 - k) * 3);
    switch (p.kind) {
      case 'shard':
      case 'pebble': {
        // Painted pieces; tumbling shows them edge-on and face-on by turns.
        const w = p.size * (p.kind === 'shard' ? 48 / SHERD_R : 22 / PEBBLE_R);
        const tumble = p.resting ? 0.8 : 0.45 + 0.55 * Math.abs(Math.cos(p.rot * 0.6 + p.seed * 6));
        this.pieces.put(p.tex!, p.x, p.y, w, w * tumble, p.rot, alpha);
        break;
      }
      case 'chunk': {
        this.pieces.put(p.tex!, p.x, p.y, p.w, p.h, p.rot, alpha);
        break;
      }
      case 'drop': {
        // A bead of water, drawn out along its flight, with a bright point.
        const speed = Math.hypot(p.vx, p.vy) || 1;
        const len = Math.min(14, speed * 0.018);
        const dx = p.vx / speed;
        const dy = p.vy / speed;
        g.moveTo(p.x - dx * len, p.y - dy * len)
          .lineTo(p.x, p.y)
          .stroke({ width: p.size * 1.7, color: p.accent, alpha: alpha * 0.7, cap: 'round' });
        g.moveTo(p.x - dx * len * 0.6, p.y - dy * len * 0.6)
          .lineTo(p.x, p.y)
          .stroke({ width: p.size, color: p.fill, alpha, cap: 'round' });
        g.circle(p.x - p.size * 0.25, p.y - p.size * 0.3, p.size * 0.3).fill({ color: 0xffffff, alpha });
        break;
      }
      case 'dust': {
        const grow = 1 - (1 - Math.min(1, k * 2.4)) ** 2;
        const w = p.size * (0.55 + grow * 1.1) * (100 / DUST_R);
        this.dustLayer.put(p.tex!, p.x, p.y, w, w * 0.82, p.rot + p.spin * p.life, 0.95 * (1 - k) ** 1.2, p.fill);
        break;
      }
      case 'obol': {
        // Flipping: the face narrows to its edge and back, then the reverse.
        const face = Math.cos(p.rot);
        const k2 = obolScale(p.size);
        this.pieces.put(obolTexture(face >= 0 ? 'face' : 'back'), p.x, p.y, 52 * k2 * Math.max(0.1, Math.abs(face)), 54 * k2, Math.sin(p.rot * 0.5) * 0.25, alpha);
        // Gold catches the light as it turns face-on.
        this.glow.add(p.x, p.y, p.size * 2.6, 0xffcf6a, alpha * (0.18 + 0.5 * Math.max(0, face) ** 8));
        break;
      }
      case 'spark': {
        const speed = Math.hypot(p.vx, p.vy) || 1;
        const len = Math.min(30, speed * 0.04);
        const dx = p.vx / speed;
        const dy = p.vy / speed;
        g.moveTo(p.x - dx * len, p.y - dy * len)
          .lineTo(p.x, p.y)
          .stroke({ width: 4, color: INK, alpha: alpha * 0.5, cap: 'round' });
        g.moveTo(p.x - dx * len, p.y - dy * len)
          .lineTo(p.x, p.y)
          .stroke({ width: 2, color: p.fill, alpha, cap: 'round' });
        // A white-hot head with a streak of light behind it.
        this.glow.add(p.x - dx * len * 0.4, p.y - dy * len * 0.4, 7 + len * 0.3, 0xffb45a, alpha * 0.9, 1 + len / 14, Math.atan2(dy, dx));
        this.glow.add(p.x, p.y, 5, 0xfff4d8, alpha);
        break;
      }
      case 'leaf': {
        // A painted laurel leaf, turning over as it flutters down.
        const w = p.size * (26 / LEAF_LEN);
        const turn = 0.3 + 0.7 * Math.abs(Math.cos(p.life * 6 + p.seed * 9));
        this.pieces.put(p.tex!, p.x, p.y, w, w * (12 / 26) * turn, p.rot, alpha);
        break;
      }
      case 'star': {
        const tw = Math.sin(k * Math.PI);
        const w = p.size * (0.4 + 0.6 * tw) * (34 / STAR_R);
        this.pieces.put(starTexture(p.fill === GOLD ? 'gold' : 'silver'), p.x, p.y, w, w, p.seed * 2 + p.life * 1.5, alpha);
        this.glow.add(p.x, p.y, p.size * (1.2 + 1.8 * tw), 0xfff0c8, alpha * tw);
        break;
      }
    }
  }

  private drawShow(s: Show): void {
    const t = s.age;
    const fade = Math.min(1, (s.max - t) / 0.5);
    if (s.kind === 'relic') {
      // It rises into the heart of the burst, grows in, and turns to face
      // the viewer as it slows.
      const lift = 40 * (1 - easeOut(Math.min(1, t / 0.9)));
      const grow = easeBack(Math.min(1, t / 0.55));
      const turn = (1 - easeOut(Math.min(1, t / 1.8))) * Math.PI * 4;
      const size = 84 * (96 / (RELIC_R * 2)) * grow;
      const y = s.y + lift + Math.sin(t * 2.4) * 3;
      const pulse = 0.75 + 0.25 * Math.sin(t * 5);
      this.glow.add(s.x, y, 60 * grow, 0xffc870, 0.22 * fade * pulse);
      this.showLayer.put(s.tex, s.x, y, size * Math.max(0.08, Math.abs(Math.cos(turn))), size, Math.sin(t * 1.6) * 0.06, fade);
      // One glint as it settles to face the viewer.
      if (t > 1.7 && !s.hit) {
        s.hit = true;
        this.mark('glint', s.x - 16, y - 18, 0.3, 16, POTTERY.ivory);
      }
      return;
    }
    // The seal comes down hard, squashes, recovers, then lifts away.
    const drop = 0.16;
    if (t >= drop && !s.hit) {
      s.hit = true;
      this.mark('glint', s.x, s.y, 0.18, 36, POTTERY.ivory);
      this.mark('ring', s.x, s.y, 0.6, 150, 0xe8603c);
      this.mark('ring', s.x, s.y, 0.9, 230, POTTERY.ivory);
      for (let i = 0; i < 16; i++) {
        this.spawn('spark', s.x, s.y, (i / 16) * Math.PI * 2 + rand(-0.2, 0.2), rand(360, 640), { fill: 0xfff0d8, accent: 0xe8603c }, 1);
      }
    }
    const scale = t < drop ? 2.4 - 1.4 * (t / drop) ** 2 : 1 + 0.12 * Math.exp(-(t - drop) * 9) * Math.cos((t - drop) * 34);
    const squash = t < drop ? 1 : 1 - 0.1 * Math.exp(-(t - drop) * 12);
    const size = (SEAL_R * 2 + 40) * scale;
    const alpha = Math.min(1, t / 0.08) * fade;
    this.showLayer.put(s.tex, s.x, s.y, size / squash, size * squash, -0.08, alpha);
  }
}
