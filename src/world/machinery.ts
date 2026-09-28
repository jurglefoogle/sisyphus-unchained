import type { Graphics } from 'pixi.js';
import { HILL, PULLEY, UP_NORMAL, type Vec } from './geometry';
import { POTTERY } from './palette';

/**
 * Renderer-drawn machinery. The delivered install frames read as a gallows
 * and a door at game scale, so the milestone structures are drawn here on the
 * route geometry: a timber rope guide along the route (level 10), bronze
 * bracing (level 25) and a running belt with a capstan (level 50). Also the
 * summit pulley and hauling rope.
 */
const INK = POTTERY.ink;
const WOOD = 0xc4935a;
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

function plank(g: Graphics, a: Vec, b: Vec, w: number, fill: number) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const l = Math.hypot(dx, dy) || 1;
  const nx = (-dy / l) * (w / 2);
  const ny = (dx / l) * (w / 2);
  g.poly([a.x + nx, a.y + ny, b.x + nx, b.y + ny, b.x - nx, b.y - ny, a.x - nx, a.y - ny]).fill(fill).stroke({ width: 2, color: INK, join: 'round' });
}

function roller(g: Graphics, c: Vec, r: number, bronze: boolean, spin: number) {
  g.circle(c.x, c.y, r).fill(bronze ? BRONZE : WOOD).stroke({ width: 2.2, color: INK });
  for (let k = 0; k < 3; k++) {
    const a = spin + (k * Math.PI) / 3;
    g.moveTo(c.x - Math.cos(a) * r * 0.8, c.y - Math.sin(a) * r * 0.8)
      .lineTo(c.x + Math.cos(a) * r * 0.8, c.y + Math.sin(a) * r * 0.8)
      .stroke({ width: 1.4, color: INK, alpha: 0.8 });
  }
  g.circle(c.x, c.y, r * 0.3).fill(INK);
}

/**
 * Milestone installations along the route, by tier (0 none, 1 timber guide,
 * 2 bronze-braced, 3 with a running belt). `clock` drives the rollers and
 * belt; it only advances while the stone is hauled.
 */
export function drawInstalls(g: Graphics, tier: number, clock: number): void {
  g.clear();
  if (tier <= 0) return;
  const bronze = tier >= 2;
  const postFill = bronze ? WOOD_DARK : WOOD;
  // Posts, planted behind the path on the hill shoulder.
  for (const u of POSTS) {
    const foot = path(u, 2);
    const top = path(u, RAIL_H + 10);
    const base = { x: foot.x, y: foot.y };
    // Posts stand plumb: the head sits straight above the foot.
    const head = { x: base.x, y: top.y };
    plank(g, base, head, 9, postFill);
    if (bronze) {
      // Diagonal braces and bronze collars.
      const brace = { x: base.x + 30, y: base.y - 16 };
      plank(g, brace, { x: head.x, y: head.y + 50 }, 5, postFill);
      for (const t of [0.25, 0.6]) {
        const y = base.y + (head.y - base.y) * t;
        g.rect(base.x - 7, y - 3, 14, 6).fill(BRONZE).stroke({ width: 1.6, color: INK });
      }
    }
  }
  // Rollers on each post that carry the hauling rope.
  for (const u of POSTS) {
    const c = path(u, RAIL_H + 12);
    c.x = path(u, 2).x;
    roller(g, c, 8.5, bronze, clock * 3);
  }
  if (tier >= 3) {
    // Belt: an endless loop over the rail with cleats that march uphill.
    const lo = RAIL_H + 22;
    const hi = RAIL_H + 34;
    const b0 = path(RAIL_FROM, lo);
    const b1 = path(RAIL_TO, lo);
    const c0 = path(RAIL_FROM, hi);
    const c1 = path(RAIL_TO, hi);
    g.moveTo(b0.x, b0.y).lineTo(b1.x, b1.y).stroke({ width: 3, color: INK });
    g.moveTo(c0.x, c0.y).lineTo(c1.x, c1.y).stroke({ width: 3, color: INK });
    const len = Math.hypot(b1.x - b0.x, b1.y - b0.y);
    const gap = 26;
    const off = (clock * 60) % gap;
    for (let d = off; d < len; d += gap) {
      const t = d / len;
      const p = { x: b0.x + (b1.x - b0.x) * t, y: b0.y + (b1.y - b0.y) * t };
      const q = { x: c0.x + (c1.x - c0.x) * (1 - t), y: c0.y + (c1.y - c0.y) * (1 - t) };
      g.moveTo(p.x, p.y).lineTo(p.x + UP_NORMAL.x * 5, p.y + UP_NORMAL.y * 5).stroke({ width: 3, color: BRONZE });
      g.moveTo(q.x, q.y).lineTo(q.x - UP_NORMAL.x * 5, q.y - UP_NORMAL.y * 5).stroke({ width: 3, color: BRONZE });
    }
    // End wheels.
    for (const u of [RAIL_FROM, RAIL_TO]) {
      const c = path(u, (lo + hi) / 2);
      roller(g, c, 9, true, clock * 4);
    }
  }
}

/** The summit A-frame and its sheave. `spin` turns the sheave while hauling. */
export function drawPulley(g: Graphics, spin: number): void {
  const foot = HILL.summitRight.y + 4;
  const spread = 26;
  plank(g, { x: PULLEY.x - spread, y: foot }, { x: PULLEY.x, y: PULLEY.y - 4 }, 8, WOOD_DARK);
  plank(g, { x: PULLEY.x + spread, y: foot }, { x: PULLEY.x, y: PULLEY.y - 4 }, 8, WOOD_DARK);
  plank(g, { x: PULLEY.x - spread * 0.6, y: foot - 28 }, { x: PULLEY.x + spread * 0.6, y: foot - 28 }, 5, WOOD);
  g.circle(PULLEY.x, PULLEY.y, 14).fill(BRONZE).stroke({ width: 2.6, color: INK });
  g.circle(PULLEY.x, PULLEY.y, 9).stroke({ width: 1.4, color: INK, alpha: 0.8 });
  for (let k = 0; k < 4; k++) {
    const a = spin + (k * Math.PI) / 2;
    g.moveTo(PULLEY.x, PULLEY.y)
      .lineTo(PULLEY.x + Math.cos(a) * 9, PULLEY.y + Math.sin(a) * 9)
      .stroke({ width: 2, color: INK });
  }
  g.circle(PULLEY.x, PULLEY.y, 3.5).fill(BRONZE_LIT).stroke({ width: 1.2, color: INK });
}

/** A twisted rope along `pts`; `crawl` slides the twist so it reads as moving. */
export function drawRope(g: Graphics, pts: Vec[], crawl: number): void {
  if (pts.length < 2) return;
  g.moveTo(pts[0].x, pts[0].y);
  for (const p of pts.slice(1)) g.lineTo(p.x, p.y);
  g.stroke({ width: 5.5, color: INK, cap: 'round', join: 'round' });
  g.moveTo(pts[0].x, pts[0].y);
  for (const p of pts.slice(1)) g.lineTo(p.x, p.y);
  g.stroke({ width: 3, color: POTTERY.rope, cap: 'round', join: 'round' });
  const step = 7;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    const l = Math.hypot(b.x - a.x, b.y - a.y);
    if (l < 1) continue;
    const ux = (b.x - a.x) / l;
    const uy = (b.y - a.y) / l;
    for (let d = ((crawl % step) + step) % step; d < l; d += step) {
      const x = a.x + ux * d;
      const y = a.y + uy * d;
      g.moveTo(x - uy * 1.4 - ux * 1.5, y + ux * 1.4 - uy * 1.5)
        .lineTo(x + uy * 1.4 + ux * 1.5, y - ux * 1.4 + uy * 1.5)
        .stroke({ width: 1, color: WOOD_DARK, alpha: 0.9 });
    }
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

/** A dust puff in the pottery style: pale clay lobes with an ink outline. */
export function drawPuff(g: Graphics, x: number, y: number, r: number, alpha: number, seed: number): void {
  const lobes = [
    [0, 0, 1],
    [-0.7, 0.2, 0.7],
    [0.7, 0.25, 0.65],
  ] as const;
  for (const [dx, dy, k] of lobes) {
    g.circle(x + dx * r, y + dy * r, r * k).stroke({ width: 2.2, color: INK, alpha: alpha * 0.55 });
  }
  for (const [dx, dy, k] of lobes) g.circle(x + dx * r, y + dy * r, r * k).fill({ color: POTTERY.paleClay, alpha });
  // A small incised swirl on the largest lobe.
  const a0 = seed * 6;
  g.arc(x, y, r * 0.45, a0, a0 + 2.4).stroke({ width: 1.3, color: INK, alpha: alpha * 0.4, cap: 'round' });
}

/** A gold obol, for float text. */
export function drawCoin(g: Graphics, x: number, y: number, r: number): void {
  g.circle(x, y + 2, r).fill(INK);
  g.circle(x, y, r).fill(0xd8b25a).stroke({ width: 2.4, color: INK });
  g.circle(x, y, r * 0.62).stroke({ width: 1.6, color: 0x9c7428 });
  g.moveTo(x - r * 0.35, y - r * 0.5).quadraticCurveTo(x - r * 0.7, y, x - r * 0.3, y + r * 0.45).stroke({ width: 1.6, color: POTTERY.ivory, alpha: 0.7, cap: 'round' });
}
