import { Container, Graphics, Sprite, Texture } from 'pixi.js';
import { GlowLayer } from './glow';
import { GROUND_Y, STAGE_W, surfaceY } from './geometry';
import { POTTERY } from './palette';
import { GOLD } from './vfx';

/**
 * Each hill's air, painted in the pottery idiom: light as soft washes of
 * slip, particles as small incised shapes. The back layer sits over the
 * terrain and under the machines; the front layer drifts over everything.
 * Reduced motion keeps the still light and drops the moving particles.
 */

const INK = POTTERY.ink;

type MoteKind = 'dust' | 'ember' | 'ash' | 'drip' | 'glint' | 'star' | 'goldleaf' | 'meteor';

interface Mote {
  kind: MoteKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  seed: number;
}

interface Splash {
  x: number;
  y: number;
  age: number;
}

interface Emitter {
  kind: MoteKind;
  /** Spawns per second. */
  rate: number;
  make: () => Omit<Mote, 'kind' | 'life' | 'seed'>;
}

interface Air {
  /** Light shafts from the upper right: colour and strength, or none. */
  shafts?: { color: number; alpha: number };
  /** A warm glow rising from below the ground line. */
  glow?: { color: number; alpha: number };
  /** Low mist bands drifting across. */
  mist?: boolean;
  emitters: Emitter[];
}

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const MAX_MOTES = 140;

const AIR: Record<string, Air> = {
  first_hill: {
    shafts: { color: POTTERY.ivory, alpha: 0.42 },
    emitters: [
      { kind: 'dust', rate: 3, make: () => ({ x: rand(500, 1500), y: rand(220, 720), vx: rand(4, 14), vy: rand(-4, 3), max: rand(6, 10), size: rand(1.6, 2.8) }) },
    ],
  },
  tartarus_rim: {
    glow: { color: POTTERY.clay, alpha: 0.32 },
    emitters: [
      { kind: 'ember', rate: 7, make: () => ({ x: rand(-50, STAGE_W + 50), y: rand(GROUND_Y + 20, GROUND_Y + 110), vx: rand(-10, 10), vy: rand(-95, -45), max: rand(3, 6), size: rand(2.2, 4) }) },
      { kind: 'ash', rate: 1.5, make: () => ({ x: rand(0, STAGE_W), y: rand(150, 220), vx: rand(6, 18), vy: rand(16, 34), max: rand(8, 12), size: rand(2.5, 4) }) },
    ],
  },
  leaking_heights: {
    mist: true,
    emitters: [
      { kind: 'drip', rate: 4, make: () => ({ x: rand(150, 1550), y: rand(160, 240), vx: 0, vy: rand(80, 160), max: 4, size: rand(4, 6) }) },
    ],
  },
  bronze_pass: {
    shafts: { color: 0xf3d9a6, alpha: 0.34 },
    emitters: [
      {
        kind: 'glint',
        rate: 2.5,
        make: () => {
          const x = rand(250, 1550);
          return { x, y: surfaceY(x) - rand(4, 40), vx: 0, vy: 0, max: rand(0.6, 1), size: rand(7, 11) };
        },
      },
      { kind: 'dust', rate: 2, make: () => ({ x: rand(400, 1500), y: rand(300, 720), vx: rand(8, 20), vy: rand(-3, 3), max: rand(5, 8), size: rand(1.6, 2.6) }) },
    ],
  },
  skyward_escarpment: {
    emitters: [
      { kind: 'star', rate: 4, make: () => ({ x: rand(0, STAGE_W), y: rand(30, 250), vx: 0, vy: 0, max: rand(2, 4), size: rand(4, 8) }) },
      { kind: 'meteor', rate: 0.08, make: () => ({ x: rand(200, 1100), y: rand(40, 120), vx: rand(700, 900), vy: rand(160, 260), max: 0.7, size: 1 }) },
    ],
  },
  olympian_approach: {
    shafts: { color: 0xf3dfa0, alpha: 0.45 },
    emitters: [
      { kind: 'goldleaf', rate: 2, make: () => ({ x: rand(100, 1600), y: rand(120, 200), vx: rand(-10, 10), vy: rand(22, 40), max: rand(9, 13), size: rand(7, 10) }) },
      {
        kind: 'glint',
        rate: 1.2,
        make: () => {
          const x = rand(300, 1500);
          return { x, y: surfaceY(x) - rand(4, 30), vx: 0, vy: 0, max: rand(0.6, 1), size: rand(7, 10) };
        },
      },
    ],
  },
};

/** Where each shaft falls from, its width at the top and its share of the light. */
const SHAFTS = [
  [1380, 120, 0.9],
  [1120, 150, 0.6],
  [900, 90, 0.75],
] as const;
const SHAFT_TOP = -40;
const SHAFT_BOTTOM = GROUND_Y + 60;
const SHAFT_RUN = 520;
const GLOW_H = 280;
const MISTS = 6;

export class Atmosphere {
  /** Light: over the terrain, under the machines. */
  readonly back = new Container();
  readonly front = new Container();
  private g = new Graphics();
  /** Embers, stars and gold give off light. */
  private light = new GlowLayer(140);
  private shafts: Sprite[] = [];
  private glow: Sprite;
  private mists: Sprite[] = [];
  private motes: Mote[] = [];
  private splashes: Splash[] = [];
  private debt = new Map<Emitter, number>();
  private site = '';
  private time = 0;

  constructor() {
    this.front.addChild(this.g, this.light);
    const glow = washTexture('glow');
    this.glow = new Sprite(glow);
    this.glow.width = 5 * STAGE_W;
    this.glow.height = GLOW_H;
    this.glow.position.set(-2 * STAGE_W, GROUND_Y + 90 - GLOW_H);
    const mist = washTexture('mist');
    for (let i = 0; i < MISTS; i++) {
      const m = new Sprite(mist);
      m.anchor.set(0.5);
      this.mists.push(m);
    }
    const beam = washTexture('beam');
    const h = SHAFT_BOTTOM - SHAFT_TOP;
    const skew = -Math.atan(SHAFT_RUN / h);
    for (const [x, w] of SHAFTS) {
      const s = new Sprite(beam);
      s.anchor.set(0.5, 0);
      s.position.set(x + w / 2, SHAFT_TOP);
      s.skew.x = skew;
      s.scale.set((w * 2.6) / beam.width, h / (Math.cos(skew) * beam.height));
      this.shafts.push(s);
    }
    this.back.addChild(this.glow, ...this.mists, ...this.shafts);
  }

  update(dt: number, siteId: string, enabled: boolean, reduced: boolean): void {
    this.g.clear();
    this.light.begin();
    this.light.end();
    this.back.visible = enabled;
    this.front.visible = enabled;
    if (!enabled) return;
    if (siteId !== this.site) {
      // A new hill starts with its air already settled.
      this.site = siteId;
      this.motes = [];
      this.splashes = [];
      if (!reduced) for (let i = 0; i < 40; i++) this.step(0.25, true);
    }
    this.time += reduced ? 0 : dt;
    const air = AIR[siteId];
    this.drawLight(air);
    if (!air || reduced) return;
    this.step(dt, false);
    this.drawMotes();
  }

  private step(dt: number, prewarm: boolean): void {
    const air = AIR[this.site];
    if (!air) return;
    for (const e of air.emitters) {
      let owed = (this.debt.get(e) ?? Math.random()) + e.rate * dt;
      while (owed >= 1 && this.motes.length < MAX_MOTES) {
        owed -= 1;
        const m: Mote = { kind: e.kind, life: 0, seed: Math.random(), ...e.make() };
        // Prewarmed particles start part-way through their lives.
        if (prewarm) m.life = Math.random() * m.max * 0.8;
        this.motes.push(m);
      }
      this.debt.set(e, Math.min(owed, 2));
    }
    this.motes = this.motes.filter((m) => {
      m.life += dt;
      if (m.life >= m.max) return false;
      switch (m.kind) {
        case 'ember':
          m.vx += Math.sin(m.life * 3 + m.seed * 10) * 30 * dt;
          break;
        case 'ash':
        case 'goldleaf':
          m.vx = Math.sin(m.life * 1.6 + m.seed * 10) * 26;
          break;
        case 'drip': {
          m.vy += 700 * dt;
          const floor = surfaceY(m.x);
          if (m.y + m.vy * dt >= floor) {
            if (!prewarm) this.splashes.push({ x: m.x, y: floor, age: 0 });
            return false;
          }
          break;
        }
      }
      m.x += m.vx * dt;
      m.y += m.vy * dt;
      return true;
    });
    this.splashes = this.splashes.filter((s) => (s.age += dt) < 0.5);
  }

  private drawLight(air: Air | undefined): void {
    const breathe = 0.75 + 0.25 * Math.sin(this.time * 0.5);
    // Slanted shafts of light from beyond the upper right, soft at every edge.
    this.shafts.forEach((s, i) => {
      s.visible = !!air?.shafts;
      if (!air?.shafts) return;
      s.tint = air.shafts.color;
      s.alpha = air.shafts.alpha * SHAFTS[i][2] * (0.8 + 0.2 * Math.sin(this.time * 0.35 + i * 2.1)) * breathe;
    });
    // Heat from the pit, strongest at the ground.
    this.glow.visible = !!air?.glow;
    if (air?.glow) {
      const flicker = 0.85 + 0.15 * Math.sin(this.time * 2.3) * Math.sin(this.time * 1.7 + 1);
      this.glow.tint = air.glow.color;
      this.glow.alpha = air.glow.alpha * flicker * 0.5;
    }
    // Low mist drifting across in two depths.
    this.mists.forEach((m, j) => {
      m.visible = !!air?.mist;
      if (!air?.mist) return;
      const i = j >> 1;
      const far = j & 1;
      const span = STAGE_W + 800;
      const x = ((this.time * (10 + i * 5) + i * 500 + far * 700) % span) - 400;
      m.position.set(x, 420 + i * 110 + far * 30);
      m.width = far ? 700 : 900;
      m.height = far ? 60 : 80;
      m.tint = POTTERY.ivory;
      m.alpha = far ? 0.22 : 0.3;
    });
  }

  private drawMotes(): void {
    const g = this.g;
    const light = this.light;
    light.begin();
    for (const m of this.motes) {
      const k = m.life / m.max;
      const fade = Math.min(1, k * 5, (1 - k) * 3);
      switch (m.kind) {
        case 'dust':
          g.circle(m.x, m.y, m.size).fill({ color: POTTERY.ivory, alpha: 0.7 * fade * (0.6 + 0.4 * Math.sin(m.life * 2 + m.seed * 9)) });
          break;
        case 'ember': {
          const hot = 0.6 + 0.4 * Math.sin(m.life * 11 + m.seed * 20);
          g.circle(m.x, m.y, m.size + 1.6).fill({ color: POTTERY.clay, alpha: 0.55 * fade });
          g.circle(m.x, m.y, m.size * 0.6).fill({ color: 0xf3c48f, alpha: fade * hot });
          light.add(m.x, m.y, m.size * 5, 0xff8a3c, 0.8 * fade * hot);
          break;
        }
        case 'ash': {
          const r = m.size;
          const a = m.life * 2 + m.seed * 6;
          g.poly([m.x + Math.cos(a) * r, m.y + Math.sin(a) * r * 0.5, m.x - Math.cos(a) * r, m.y - Math.sin(a) * r * 0.5, m.x + Math.sin(a) * r * 0.4, m.y + r * 0.3]).fill({
            color: INK,
            alpha: 0.6 * fade,
          });
          break;
        }
        case 'drip': {
          // A teardrop, stretched by its fall.
          const r = m.size;
          const tail = Math.min(18, 4 + m.vy * 0.03);
          g.moveTo(m.x, m.y - r - tail)
            .quadraticCurveTo(m.x + r, m.y - r * 0.2, m.x, m.y + r)
            .quadraticCurveTo(m.x - r, m.y - r * 0.2, m.x, m.y - r - tail)
            .fill({ color: POTTERY.shade, alpha: 0.9 * fade })
            .stroke({ width: 1.3, color: INK, alpha: 0.7 * fade });
          break;
        }
        case 'glint':
          star(g, m.x, m.y, m.size * Math.sin(k * Math.PI), POTTERY.ivory, POTTERY.bronze, 1);
          light.add(m.x, m.y, m.size * 2.5, 0xfff0d0, 0.7 * Math.sin(k * Math.PI));
          break;
        case 'star': {
          const tw = Math.sin(k * Math.PI) * (0.7 + 0.3 * Math.sin(m.life * 7 + m.seed * 10));
          star(g, m.x, m.y, m.size * tw, POTTERY.ivory, GOLD, 0.9);
          light.add(m.x, m.y, m.size * 3, 0xdfe6ff, 0.6 * tw);
          break;
        }
        case 'goldleaf': {
          // A square of leaf, turning: it narrows to an edge and back.
          const turn = Math.cos(m.life * 3 + m.seed * 8);
          const w = m.size * Math.max(0.12, Math.abs(turn));
          const tilt = Math.sin(m.life * 1.6 + m.seed * 10) * 0.6;
          const c = Math.cos(tilt);
          const s = Math.sin(tilt);
          const h = m.size * 0.7;
          const corner = (x: number, y: number) => [m.x + x * c - y * s, m.y + x * s + y * c];
          g.poly([...corner(-w / 2, -h / 2), ...corner(w / 2, -h / 2), ...corner(w / 2, h / 2), ...corner(-w / 2, h / 2)])
            .fill({ color: turn > 0 ? GOLD : 0xb89040, alpha: fade })
            .stroke({ width: 1, color: INK, alpha: 0.6 * fade });
          light.add(m.x, m.y, m.size * 2.2, 0xffcf6a, fade * (0.15 + 0.6 * Math.max(0, turn) ** 6));
          break;
        }
        case 'meteor': {
          const speed = Math.hypot(m.vx, m.vy);
          const dx = m.vx / speed;
          const dy = m.vy / speed;
          g.moveTo(m.x - dx * 140, m.y - dy * 140)
            .lineTo(m.x, m.y)
            .stroke({ width: 2.4, color: POTTERY.ivory, alpha: 0.8 * fade, cap: 'round' });
          star(g, m.x, m.y, 6, POTTERY.ivory, GOLD, fade);
          light.add(m.x - dx * 50, m.y - dy * 50, 22, 0xe8eeff, 0.5 * fade, 5, Math.atan2(dy, dx));
          light.add(m.x, m.y, 16, 0xffffff, fade);
          break;
        }
      }
    }
    for (const s of this.splashes) {
      const k = s.age / 0.5;
      g.ellipse(s.x, s.y, 4 + 18 * k, (4 + 18 * k) * 0.3).stroke({ width: 1.6, color: INK, alpha: 0.6 * (1 - k) });
    }
    light.end();
  }
}

function star(g: Graphics, x: number, y: number, r: number, fill: number, line: number, alpha: number): void {
  if (r <= 0.3) return;
  const i = r * 0.28;
  g.poly([x, y - r, x + i, y - i, x + r, y, x + i, y + i, x, y + r, x - i, y + i, x - r, y, x - i, y - i])
    .fill({ color: fill, alpha })
    .stroke({ width: 1.1, color: line, alpha });
}

/**
 * Soft washes, painted once to a canvas: a beam that widens as it falls and
 * fades at both ends, a glow that rises from the ground, a lens of mist.
 * White, so each hill can tint them.
 */
function washTexture(kind: 'beam' | 'glow' | 'mist'): Texture {
  const w = kind === 'glow' ? 4 : 128;
  const h = kind === 'mist' ? 32 : 128;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(w, h);
  for (let y = 0; y < h; y++) {
    const t = y / (h - 1);
    for (let x = 0; x < w; x++) {
      const u = x / (w - 1) - 0.5;
      let a: number;
      if (kind === 'beam') {
        const half = 0.32 + 0.18 * t;
        const across = Math.max(0, 1 - (Math.abs(u) / half) ** 2) ** 2;
        a = across * Math.sin(Math.PI * Math.min(1, t * 1.15)) ** 1.2;
      } else if (kind === 'glow') {
        a = t * t;
      } else {
        const r = Math.hypot(u * 2, (t - 0.5) * 2);
        a = Math.max(0, 1 - r * r) ** 1.5;
      }
      const i = (y * w + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = 255;
      img.data[i + 3] = Math.round(a * 255);
    }
  }
  ctx.putImageData(img, 0, 0);
  return Texture.from(canvas);
}
