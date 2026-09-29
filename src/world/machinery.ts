import { Container, Graphics, Sprite } from 'pixi.js';
import type { SpriteLayer } from './glow';
import { HILL, PULLEY, UP_NORMAL, type Vec } from './geometry';
import { POTTERY } from './palette';
import { DUST_R, dustTextures, obolScale, obolTexture, plankTexture, postAnchor, postTexture, sheaveLight, sheaveTexture } from './painted';

/**
 * Renderer-built machinery. The delivered install frames read as a gallows
 * and a door at game scale, so the milestone structures are built here on the
 * route geometry from painted timber and cast bronze (see painted.ts): a rope
 * guide along the route (level 10), bronze bracing (level 25) and a running
 * belt (level 50). Also the summit pulley and the hauling rope.
 */
const INK = POTTERY.ink;
const WOOD_DARK = 0x8a5a33;
const BRONZE = POTTERY.bronze;
const BRONZE_LIT = 0xd7b066;

/** Height of the guide rail above the path: clear of the stone and of him. */
const RAIL_H = 140;
const RAIL_FROM = 0.06;
const RAIL_TO = 0.93;
const POSTS = [0.1, 0.3, 0.5, 0.7, 0.9];

const path = (u: number, h: number): Vec => {
  const a = HILL.footLeft;
  const b = HILL.summitLeft;
  return { x: a.x + (b.x - a.x) * u + UP_NORMAL.x * h, y: a.y + (b.y - a.y) * u + UP_NORMAL.y * h };
};

/** A painted plank from `a` to `b`, `w` units thick. */
function plank(a: Vec, b: Vec, w: number, stained: boolean): Sprite {
  const s = new Sprite(plankTexture(stained));
  s.anchor.set(0, 0.5);
  s.position.set(a.x, a.y);
  s.rotation = Math.atan2(b.y - a.y, b.x - a.x);
  s.width = Math.hypot(b.x - a.x, b.y - a.y);
  s.height = (w * 8) / 6;
  return s;
}

/** A bronze sheave that turns under a fixed light. */
class Sheave extends Container {
  private wheel: Sprite;

  constructor(r: number) {
    super();
    this.wheel = new Sprite(sheaveTexture(r));
    this.wheel.anchor.set(0.5);
    const light = new Sprite(sheaveLight(r));
    light.anchor.set(0.5);
    this.addChild(this.wheel, light);
  }

  set turn(a: number) {
    this.wheel.rotation = a;
  }
}

/**
 * Milestone installations along the route, by tier (0 none, 1 timber guide,
 * 2 bronze-braced, 3 with a running belt). `clock` drives the rollers and
 * belt; it only advances while the stone is hauled.
 */
export class Installs extends Container {
  private tier = -1;
  private frame = new Container();
  private rollers: Sheave[] = [];
  private ends: Sheave[] = [];
  private belt = new Graphics();

  constructor() {
    super();
    this.addChild(this.frame, this.belt);
  }

  draw(tier: number, clock: number): void {
    if (tier !== this.tier) this.build(tier);
    for (const r of this.rollers) r.turn = clock * 3;
    for (const r of this.ends) r.turn = clock * 4;
    this.belt.clear();
    if (tier >= 3) drawBelt(this.belt, clock);
  }

  private build(tier: number): void {
    this.tier = tier;
    for (const child of this.frame.removeChildren()) child.destroy({ children: true });
    this.rollers = [];
    this.ends = [];
    if (tier <= 0) return;
    const bronze = tier >= 2;
    // Posts, planted behind the path on the hill shoulder, stand plumb.
    for (const u of POSTS) {
      const base = path(u, 2);
      const head = { x: base.x, y: path(u, RAIL_H + 10).y };
      if (bronze) this.frame.addChild(plank({ x: base.x + 30, y: base.y - 16 }, { x: head.x, y: head.y + 50 }, 5, true));
      const h = base.y - head.y;
      const post = new Sprite(postTexture(h, bronze));
      const anchor = postAnchor(h);
      post.anchor.set(anchor.x, anchor.y);
      post.position.set(base.x, base.y);
      this.frame.addChild(post);
    }
    // Rollers on each post that carry the hauling rope.
    for (const u of POSTS) {
      const r = new Sheave(8.5);
      r.position.set(path(u, 2).x, path(u, RAIL_H + 12).y);
      this.rollers.push(r);
      this.frame.addChild(r);
    }
    if (tier >= 3) {
      for (const u of [RAIL_FROM, RAIL_TO]) {
        const c = path(u, (BELT_LO + BELT_HI) / 2);
        const r = new Sheave(9);
        r.position.set(c.x, c.y);
        this.ends.push(r);
        this.addChild(r);
      }
    }
  }
}

const BELT_LO = RAIL_H + 22;
const BELT_HI = RAIL_H + 34;

/** Belt: an endless leather loop over the rail with cleats that march uphill. */
function drawBelt(g: Graphics, clock: number): void {
  const b0 = path(RAIL_FROM, BELT_LO);
  const b1 = path(RAIL_TO, BELT_LO);
  const c0 = path(RAIL_FROM, BELT_HI);
  const c1 = path(RAIL_TO, BELT_HI);
  for (const [a, b] of [
    [b0, b1],
    [c0, c1],
  ] as const) {
    g.moveTo(a.x, a.y).lineTo(b.x, b.y).stroke({ width: 4.2, color: INK });
    g.moveTo(a.x, a.y).lineTo(b.x, b.y).stroke({ width: 2.4, color: 0x5a3519 });
    g.moveTo(a.x - 0.4, a.y - 0.8).lineTo(b.x - 0.4, b.y - 0.8).stroke({ width: 0.8, color: 0xb98555, alpha: 0.8 });
  }
  const len = Math.hypot(b1.x - b0.x, b1.y - b0.y);
  const gap = 26;
  const off = (clock * 60) % gap;
  for (let d = off; d < len; d += gap) {
    const t = d / len;
    const p = { x: b0.x + (b1.x - b0.x) * t, y: b0.y + (b1.y - b0.y) * t };
    const q = { x: c0.x + (c1.x - c0.x) * (1 - t), y: c0.y + (c1.y - c0.y) * (1 - t) };
    for (const [o, dir] of [
      [p, 1],
      [q, -1],
    ] as const) {
      const e = { x: o.x + UP_NORMAL.x * 5 * dir, y: o.y + UP_NORMAL.y * 5 * dir };
      g.moveTo(o.x, o.y).lineTo(e.x, e.y).stroke({ width: 4, color: INK, cap: 'round' });
      g.moveTo(o.x, o.y).lineTo(e.x, e.y).stroke({ width: 2.4, color: BRONZE, cap: 'round' });
      g.circle(e.x - 0.4, e.y - 0.5, 0.8).fill({ color: BRONZE_LIT });
    }
  }
}

/** The summit A-frame of stained timber and its bronze sheave. */
export class SummitPulley extends Container {
  private sheave = new Sheave(14);

  constructor() {
    super();
    const foot = HILL.summitRight.y + 4;
    const spread = 26;
    const top = { x: PULLEY.x, y: PULLEY.y - 4 };
    this.addChild(
      plank({ x: PULLEY.x - spread * 0.6, y: foot - 28 }, { x: PULLEY.x + spread * 0.6, y: foot - 28 }, 5, false),
      plank({ x: PULLEY.x - spread, y: foot }, top, 8, true),
      plank({ x: PULLEY.x + spread, y: foot }, top, 8, true),
    );
    this.sheave.position.set(PULLEY.x, PULLEY.y);
    this.addChild(this.sheave);
  }

  set spin(a: number) {
    this.sheave.turn = a;
  }
}

/** A twisted rope along `pts`; `crawl` slides the twist so it reads as moving. */
export function drawRope(g: Graphics, pts: Vec[], crawl: number, sag = 0, hum = 0, time = 0): void {
  if (pts.length < 2) return;
  // Each span hangs in a shallow curve (`sag` of its length) and, under
  // load, hums with a small travelling tremor.
  const line: Vec[] = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    const l = Math.hypot(b.x - a.x, b.y - a.y);
    const n = sag > 0 || hum > 0 ? Math.max(2, Math.ceil(l / 24)) : 1;
    for (let k = 1; k <= n; k++) {
      const t = k / n;
      const drop = sag * l * 4 * t * (1 - t) + hum * Math.sin(t * Math.PI * 3 - time * 38 + i) * Math.sin(t * Math.PI);
      line.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t + drop });
    }
  }
  const trace = (dx = 0, dy = 0) => {
    g.moveTo(line[0].x + dx, line[0].y + dy);
    for (const p of line.slice(1)) g.lineTo(p.x + dx, p.y + dy);
  };
  trace();
  g.stroke({ width: 5.5, color: INK, cap: 'round', join: 'round' });
  trace();
  g.stroke({ width: 3, color: POTTERY.rope, cap: 'round', join: 'round' });
  trace(-0.5, -0.8);
  g.stroke({ width: 0.9, color: POTTERY.ivory, alpha: 0.55, cap: 'round', join: 'round' });
  // The lay of the rope, crawling as it runs.
  const step = 7;
  let run = 0;
  let next = ((crawl % step) + step) % step;
  for (let i = 1; i < line.length; i++) {
    const a = line[i - 1];
    const b = line[i];
    const l = Math.hypot(b.x - a.x, b.y - a.y);
    if (l < 0.01) continue;
    const ux = (b.x - a.x) / l;
    const uy = (b.y - a.y) / l;
    while (next < run + l) {
      const d = next - run;
      const x = a.x + ux * d;
      const y = a.y + uy * d;
      g.moveTo(x - uy * 1.4 - ux * 1.5, y + ux * 1.4 - uy * 1.5)
        .lineTo(x + uy * 1.4 + ux * 1.5, y - ux * 1.4 + uy * 1.5)
        .stroke({ width: 1, color: WOOD_DARK, alpha: 0.9 });
      next += step;
    }
    run += l;
  }
}

/** Rope path from an anchor over the rail rollers (when installed) to the pulley. */
export function ropeGuides(tier: number): Vec[] {
  if (tier <= 0) return [];
  return POSTS.map((u) => {
    const c = path(u, RAIL_H + 12);
    return { x: path(u, 2).x, y: c.y - 8.5 };
  });
}

// ------------------------------------------------------------------ ambient

export interface Cloud {
  x: number;
  y: number;
  w: number;
  speed: number;
  seed: number;
}

/** A vase-painting cloud: a flat-bottomed row of ivory lobes, ink-lined, with a scroll at one end. */
export function drawCloud(g: Graphics, c: Cloud, tint: number, alpha: number): void {
  const lobes = 4 + (c.seed % 3);
  const base = c.y;
  const pts: number[] = [];
  for (let i = 0; i < lobes; i++) {
    const t = i / (lobes - 1);
    const r = c.w * (0.12 + 0.1 * Math.sin(Math.PI * t) + 0.03 * ((c.seed * (i + 3)) % 5) / 5);
    const x = c.x - c.w / 2 + c.w * t;
    g.circle(x, base - r * 0.55, r).fill({ color: tint, alpha });
    pts.push(x, r);
  }
  g.rect(c.x - c.w / 2 - 4, base - 6, c.w + 8, 6).fill({ color: tint, alpha });
  // Ink underline and scroll.
  g.moveTo(c.x - c.w / 2 - 6, base).lineTo(c.x + c.w / 2 + 2, base).stroke({ width: 2, color: INK, alpha: alpha * 0.45, cap: 'round' });
  const sx = c.x + c.w / 2 + 2;
  g.moveTo(sx, base).arc(sx, base - 7, 7, Math.PI / 2, Math.PI * 1.9, true).stroke({ width: 2, color: INK, alpha: alpha * 0.45, cap: 'round' });
}

/** A bird in flight: two ink arcs, wings beating with `flap`. */
export function drawBird(g: Graphics, x: number, y: number, s: number, flap: number): void {
  const lift = Math.sin(flap) * 5 * s;
  g.moveTo(x - 11 * s, y - lift)
    .quadraticCurveTo(x - 5 * s, y - 6 * s - lift * 0.3, x, y)
    .quadraticCurveTo(x + 5 * s, y - 6 * s - lift * 0.3, x + 11 * s, y - lift)
    .stroke({ width: 2.2 * s, color: INK, alpha: 0.8, cap: 'round', join: 'round' });
}

/** A painted billow of dust, `r` units in radius, tinted pale clay. */
export function drawPuff(layer: SpriteLayer, x: number, y: number, r: number, alpha: number, seed: number): void {
  const textures = dustTextures();
  const tex = textures[Math.floor(seed * textures.length) % textures.length];
  const w = r * (100 / DUST_R) * 0.95;
  layer.put(tex, x, y, w, w * 0.85, seed * 6, alpha, POTTERY.paleClay);
}

/** A struck gold obol, `r` units in radius, for float text. */
export function coinSprite(r: number): Sprite {
  const coin = new Sprite(obolTexture('face'));
  coin.anchor.set(0.5);
  coin.scale.set(obolScale(r));
  return coin;
}
