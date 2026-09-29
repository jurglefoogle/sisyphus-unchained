/**
 * The level stamp (spec §03): at production levels 100, 150 and 200 a stone
 * painted pinax slams onto the screen and a floating mallet and chisel
 * incise the level through its black glaze in Roman numerals, stroke by
 * stroke, sparks, glaze flakes and dust flying: all painted like the rest of
 * the effects, in the pottery palette. A ray burst opens behind the finished
 * numeral before the pinax shrinks
 * into a cartouche on the hillside, which keeps every stamp the operation has
 * earned. Cosmetic only: it never waits on the simulation.
 */

import { Container, Graphics, Sprite, type Texture } from 'pixi.js';
import { GlowLayer, SpriteLayer } from './glow';
import { bake, css, engrave, glint, ink, innerEdge, LIGHT, model, rng, shape, speckle, texture, wash, type Ctx } from './paint';
import { DUST_R, dustTextures, PEBBLE_R, pebbleTextures, SHERD_R, sherdTextures, type SherdLook } from './painted';
import { BURST_R, burstTexture, STAR_R, starTexture } from './painted-fx';
import { POTTERY } from './palette';

type P = [number, number];
interface Vec {
  x: number;
  y: number;
}

/** Production levels that earn a carved stamp. */
export const STAMP_LEVELS = [100, 150, 200];

export function toRoman(n: number): string {
  const table: [number, string][] = [
    [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'],
    [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I'],
  ];
  let out = '';
  let v = Math.max(0, Math.floor(n));
  for (const [k, s] of table) {
    while (v >= k) {
      out += s;
      v -= k;
    }
  }
  return out;
}

// ------------------------------------------------------------------ letters

/** A chisel stroke in em units (cap height 100): a centre line and its width. */
interface RawStroke {
  pts: P[];
  w: number[];
}

const DEG = Math.PI / 180;
const THICK = 15;
const THIN = 6;
const SERIF = 4.5;

const seg = (x0: number, y0: number, x1: number, y1: number, w0: number, w1 = w0): RawStroke => ({
  pts: [[x0, y0], [x1, y1]],
  w: [w0, w1],
});

function arc(cx: number, cy: number, rx: number, ry: number, a0: number, a1: number, width: (a: number) => number): RawStroke {
  const pts: P[] = [];
  const w: number[] = [];
  const n = 36;
  for (let i = 0; i <= n; i++) {
    const a = (a0 + (a1 - a0) * (i / n)) * DEG;
    pts.push([cx + rx * Math.cos(a), cy + ry * Math.sin(a)]);
    w.push(width(a));
  }
  return { pts, w };
}

function join(...parts: RawStroke[]): RawStroke {
  const out: RawStroke = { pts: [], w: [] };
  for (const p of parts) {
    const skip = out.pts.length ? 1 : 0;
    out.pts.push(...p.pts.slice(skip));
    out.w.push(...p.w.slice(skip));
  }
  return out;
}

/** Square capitals: thick stems, thin hairlines, small serifs. Stems are cut first. */
const GLYPHS: Record<string, { adv: number; strokes: RawStroke[] }> = {
  I: { adv: 30, strokes: [seg(15, 4, 15, 96, THICK), seg(4, 3, 26, 3, SERIF), seg(4, 97, 26, 97, SERIF)] },
  V: {
    adv: 80,
    strokes: [seg(8, 4, 40, 96, THICK), seg(72, 4, 40, 96, THIN), seg(0, 3, 22, 3, SERIF), seg(62, 3, 80, 3, SERIF)],
  },
  X: {
    adv: 80,
    strokes: [
      seg(10, 4, 70, 96, THICK),
      seg(70, 4, 10, 96, THIN),
      seg(0, 3, 22, 3, SERIF),
      seg(60, 3, 80, 3, SERIF),
      seg(0, 97, 20, 97, SERIF),
      seg(58, 97, 80, 97, SERIF),
    ],
  },
  L: {
    adv: 66,
    strokes: [seg(16, 4, 16, 94, THICK), seg(10, 96, 62, 96, 7, 6), seg(4, 3, 28, 3, SERIF), seg(63, 97, 65, 84, SERIF)],
  },
  C: {
    adv: 88,
    strokes: [
      arc(50, 50, 44, 47, -42, -318, (a) => 5 + 11 * Math.max(0, -Math.cos(a))),
      seg(83, 19, 85, 6, SERIF),
      seg(83, 81, 85, 94, SERIF),
    ],
  },
  D: {
    adv: 90,
    strokes: [
      seg(16, 4, 16, 96, THICK),
      join(seg(6, 3, 40, 3, 5), arc(40, 50, 44, 47, -90, 90, (a) => 5 + 10 * Math.max(0, Math.cos(a))), seg(40, 97, 6, 97, 5)),
    ],
  },
  M: {
    adv: 114,
    strokes: [
      seg(12, 96, 16, 4, THIN),
      seg(16, 4, 57, 96, THICK),
      seg(57, 96, 98, 4, THIN),
      seg(98, 4, 102, 96, THICK),
      seg(2, 97, 22, 97, SERIF),
      seg(92, 97, 112, 97, SERIF),
    ],
  },
  /** The interpunct between stamps on the cartouche. */
  '·': { adv: 18, strokes: [seg(9, 40, 9, 60, 11)] },
};
const LETTER_GAP = 8;

/** A stroke sampled every couple of em units, ready to cut. */
interface Groove {
  x: number[];
  y: number[];
  nx: number[];
  ny: number[];
  hw: number[];
  d: number[];
  len: number;
  /** When each sample was cut (seconds), for the fresh chalk of a new cut. */
  cutAt: number[];
  /** Which numeral on a cartouche this stroke belongs to. */
  owner: number;
}

function sample(s: RawStroke, ox: number, owner: number): Groove {
  const STEP = 2;
  const xs: number[] = [];
  const ys: number[] = [];
  const ws: number[] = [];
  for (let i = 0; i < s.pts.length - 1; i++) {
    const [x0, y0] = s.pts[i];
    const [x1, y1] = s.pts[i + 1];
    const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / STEP));
    for (let j = 0; j < n; j++) {
      const t = j / n;
      xs.push(ox + x0 + (x1 - x0) * t);
      ys.push(y0 + (y1 - y0) * t);
      ws.push(s.w[i] + (s.w[i + 1] - s.w[i]) * t);
    }
  }
  const last = s.pts[s.pts.length - 1];
  xs.push(ox + last[0]);
  ys.push(last[1]);
  ws.push(s.w[s.w.length - 1]);

  const n = xs.length;
  const d = [0];
  for (let i = 1; i < n; i++) d.push(d[i - 1] + Math.hypot(xs[i] - xs[i - 1], ys[i] - ys[i - 1]));
  const len = d[n - 1];
  const nx: number[] = [];
  const ny: number[] = [];
  const hw: number[] = [];
  for (let i = 0; i < n; i++) {
    const a = Math.max(0, i - 1);
    const b = Math.min(n - 1, i + 1);
    const tx = xs[b] - xs[a];
    const ty = ys[b] - ys[a];
    const l = Math.hypot(tx, ty) || 1;
    nx.push(-ty / l);
    ny.push(tx / l);
    // A chisel cut ends in a wedge.
    const half = ws[i] / 2;
    const taper = Math.min(1, Math.max(0.25, Math.min(d[i], len - d[i]) / (half * 1.1 + 1)));
    hw.push(half * taper);
  }
  return { x: xs, y: ys, nx, ny, hw, d, len, cutAt: new Array(n).fill(-1), owner };
}

/** Lay out numerals (joined by interpuncts) as grooves; returns width in em units. */
function layout(words: string[]): { grooves: Groove[]; width: number; slots: [number, number][] } {
  const grooves: Groove[] = [];
  const slots: [number, number][] = [];
  let x = 0;
  words.forEach((word, owner) => {
    if (owner > 0) {
      for (const s of GLYPHS['·'].strokes) grooves.push(sample(s, x, -1));
      x += GLYPHS['·'].adv + LETTER_GAP;
    }
    const start = x;
    for (const ch of word) {
      const g = GLYPHS[ch];
      if (!g) continue;
      for (const s of g.strokes) grooves.push(sample(s, x, owner));
      x += g.adv + LETTER_GAP;
    }
    slots.push([start, x - LETTER_GAP]);
  });
  return { grooves, width: Math.max(0, x - LETTER_GAP), slots };
}

function pointAt(g: Groove, dist: number): Vec {
  const d = Math.max(0, Math.min(g.len, dist));
  let i = 0;
  while (i < g.d.length - 2 && g.d[i + 1] < d) i++;
  const span = g.d[i + 1] - g.d[i] || 1;
  const t = (d - g.d[i]) / span;
  return { x: g.x[i] + (g.x[i + 1] - g.x[i]) * t, y: g.y[i] + (g.y[i + 1] - g.y[i]) * t };
}

const INK = POTTERY.ink;
const CLAY = POTTERY.clay;
const PALE = POTTERY.paleClay;
/** Clay in the shadow of a cut. */
const DEEP = 0x6a2c14;
const FRESH = POTTERY.ivory;

/**
 * Incise grooves through the glaze, cut deep: a V whose lit wall is pale clay
 * and whose shaded wall is deep clay, a bright lip where the far edge catches
 * the light and a dark one where the glaze overhangs the near edge.
 */
function drawGrooves(g: Graphics, grooves: Groove[], cut: (k: number) => number, now: number | null, strength = 1): void {
  grooves.forEach((gr, k) => {
    const upto = cut(k);
    if (upto <= 0) return;
    // The cut so far: its centre line, normals and half-widths.
    const cx: number[] = [];
    const cy: number[] = [];
    const nx: number[] = [];
    const ny: number[] = [];
    const hw: number[] = [];
    for (let i = 0; i < gr.x.length; i++) {
      if (gr.d[i] > upto) {
        const t = (upto - gr.d[i - 1]) / (gr.d[i] - gr.d[i - 1] || 1);
        cx.push(gr.x[i - 1] + (gr.x[i] - gr.x[i - 1]) * t);
        cy.push(gr.y[i - 1] + (gr.y[i] - gr.y[i - 1]) * t);
        nx.push(gr.nx[i - 1]);
        ny.push(gr.ny[i - 1]);
        hw.push(gr.hw[i - 1] + (gr.hw[i] - gr.hw[i - 1]) * t);
        break;
      }
      if (now !== null && gr.cutAt[i] < 0) gr.cutAt[i] = now;
      cx.push(gr.x[i]);
      cy.push(gr.y[i]);
      nx.push(gr.nx[i]);
      ny.push(gr.ny[i]);
      hw.push(gr.hw[i]);
    }
    const n = cx.length;
    if (n < 2) return;
    // Which wall is in shade: +1 the normal's side, −1 the other; it swaps round a curve.
    const shade = cx.map((_, i) => Math.max(-1, Math.min(1, 3 * (nx[i] * LIGHT.x + ny[i] * LIGHT.y))));
    const at = (i: number, s: number): [number, number] => [cx[i] + nx[i] * hw[i] * s, cy[i] + ny[i] * hw[i] * s];
    const band = (s: (i: number) => number): number[] => {
      const pts: number[] = [];
      for (let i = 0; i < n; i++) pts.push(cx[i], cy[i]);
      for (let i = n - 1; i >= 0; i--) pts.push(...at(i, s(i)));
      return pts;
    };

    const outline: number[] = [];
    for (let i = 0; i < n; i++) outline.push(...at(i, 1));
    for (let i = n - 1; i >= 0; i--) outline.push(...at(i, -1));
    g.poly(outline).fill({ color: PALE, alpha: strength });
    // The lit wall darkens toward the crease; the shaded wall is deep.
    g.poly(band((i) => -shade[i] * 0.4)).fill({ color: CLAY, alpha: 0.55 * strength });
    g.poly(band((i) => shade[i])).fill({ color: DEEP, alpha: strength });
    g.poly(band((i) => shade[i] * 0.45)).fill({ color: INK, alpha: 0.25 * strength });

    // Lips, in runs where one wall is clearly the lit one.
    let run: number[] = [];
    let dark: number[] = [];
    let sign = 0;
    const flush = () => {
      if (run.length >= 4) {
        g.poly(run, false).stroke({ width: 1.1, color: FRESH, alpha: 0.6 * strength, join: 'round', cap: 'round' });
        g.poly(dark, false).stroke({ width: 1.4, color: INK, alpha: 0.6 * strength, join: 'round', cap: 'round' });
      }
      run = [];
      dark = [];
    };
    for (let i = 0; i < n; i++) {
      const s = Math.abs(shade[i]) > 0.25 ? Math.sign(shade[i]) : 0;
      if (s !== sign) {
        flush();
        sign = s;
      }
      if (!s) continue;
      run.push(...at(i, -s * 0.94));
      dark.push(...at(i, s * 0.94));
    }
    flush();

    if (now === null) return;
    // A new cut flashes pale, like fresh-scratched clay.
    for (let i = 0; i < n - 1; i++) {
      const fresh = 1 - (now - gr.cutAt[Math.min(i, gr.cutAt.length - 1)]) / 0.5;
      if (fresh <= 0) continue;
      g.poly([...at(i, 1), ...at(i + 1, 1), ...at(i + 1, -1), ...at(i, -1)]).fill({ color: FRESH, alpha: 0.6 * fresh });
    }
  });
}

// ------------------------------------------------------------------ painting

const SLAB_MARGIN = 40;
/** The clay rim round the glazed field: the sides, and the meander bands. */
const RIM_X = 20;
const RIM_Y = 40;

const DILUTE = 'rgba(110, 50, 24, 0.55)';

function resOf(ctx: Ctx): number {
  return ctx.getTransform().a;
}

function across(ctx: Ctx, x0: number, y0: number, x1: number, y1: number, stops: [number, string][]): CanvasGradient {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  for (const [at, c] of stops) g.addColorStop(at, c);
  return g;
}

/** A line of glaze: ink with a thin gloss riding on it. */
function glazeLine(ctx: Ctx, path: Path2D, width: number): void {
  ctx.save();
  ctx.strokeStyle = css(INK);
  ctx.lineWidth = width;
  ctx.stroke(path);
  ctx.translate(-width * 0.18, -width * 0.22);
  ctx.strokeStyle = 'rgba(255, 236, 214, 0.22)';
  ctx.lineWidth = width * 0.35;
  ctx.stroke(path);
  ctx.restore();
}

/** A running key along a band, as on the rim of a krater. */
function meander(ctx: Ctx, x0: number, y0: number, w: number, h: number): void {
  const u = h * 1.15;
  const n = Math.floor(w / u);
  const ox = x0 + (w - n * u) / 2;
  const p = new Path2D();
  p.moveTo(ox, y0 + h);
  p.lineTo(ox + n * u, y0 + h);
  for (let i = 0; i < n; i++) {
    const x = ox + i * u;
    p.moveTo(x + u * 0.12, y0 + h);
    p.lineTo(x + u * 0.12, y0);
    p.lineTo(x + u * 0.88, y0);
    p.lineTo(x + u * 0.88, y0 + h * 0.7);
    p.lineTo(x + u * 0.42, y0 + h * 0.7);
    p.lineTo(x + u * 0.42, y0 + h * 0.36);
  }
  ctx.save();
  ctx.lineJoin = 'miter';
  ctx.lineCap = 'square';
  glazeLine(ctx, p, h * 0.15);
  ctx.restore();
}

/** Black glaze with depth: dark at the heart, warmer where it thins, and glossy. */
function glaze(ctx: Ctx, path: Path2D, x: number, y: number, w: number, h: number): void {
  const g = ctx.createRadialGradient(x + w * 0.22, y + h * 0.18, 0, x + w * 0.4, y + h * 0.4, Math.max(w, h) * 0.9);
  g.addColorStop(0, '#3e3027');
  g.addColorStop(0.4, '#1e1612');
  g.addColorStop(1, '#0e0a08');
  ctx.fillStyle = g;
  ctx.fill(path);
  texture(ctx, path, 0.18, 0.08, Math.round(w));
  // A long gloss streak across the upper left, as on the sherds.
  ctx.save();
  ctx.clip(path);
  ctx.filter = `blur(${Math.max(2, h * 0.03) * resOf(ctx)}px)`;
  ctx.strokeStyle = 'rgba(255, 244, 226, 0.2)';
  ctx.lineWidth = Math.max(3, h * 0.08);
  ctx.beginPath();
  ctx.moveTo(x - w * 0.05, y + h * 0.7);
  ctx.quadraticCurveTo(x + w * 0.18, y + h * 0.12, x + w * 0.75, y - h * 0.02);
  ctx.stroke();
  ctx.restore();
  wash(ctx, path, x + w * 0.2, y + h * 0.22, Math.max(w, h) * 0.35, 'rgba(255, 236, 210, 0.1)', 'screen');
}

/** A painted pinax: a glazed field sunk in a fired clay rim with meander bands. */
function slabTexture(W: number, H: number): Texture {
  return bake(`chisel-pinax-painted-${W}x${H}`, W + SLAB_MARGIN * 2, H + SLAB_MARGIN * 2, (ctx) => {
    const r = rng(W * 7 + H * 13);
    const j = (k = 4) => (r() - 0.5) * k;
    ctx.translate(SLAB_MARGIN, SLAB_MARGIN);
    const slab = shape(
      [
        [j(), j()], [W * 0.5, j(3)], [W + j(), j()],
        [W + j(3), H * 0.5], [W + j(), H + j()],
        [W * 0.5, H + j(3)], [j(), H + j()], [j(3), H * 0.5],
      ],
      false,
    );
    // A soft cast shadow on the scene behind.
    ctx.save();
    ctx.translate(10, 16);
    ctx.filter = `blur(${10 * resOf(ctx)}px)`;
    ctx.fillStyle = 'rgba(28, 16, 8, 0.5)';
    ctx.fill(slab);
    ctx.restore();

    // Fired clay: warm where it faces the light, deeper toward the far corner.
    ctx.fillStyle = across(ctx, 0, 0, W * 0.45, H * 1.1, [[0, '#efbd90'], [0.45, '#dc9d6b'], [1, '#bb7546']]);
    ctx.fill(slab);
    texture(ctx, slab, 0.4, 0.09, W);
    speckle(ctx, slab, r, Math.round((W * H) / 700), [0.4, 1.2], 'rgba(110, 52, 24, 0.35)', [0, 0, W, H]);
    speckle(ctx, slab, r, Math.round((W * H) / 1200), [0.4, 1.1], 'rgba(255, 236, 206, 0.4)', [0, 0, W, H]);

    // Rim bands: two lines with a key between them, top and bottom.
    for (const y0 of [0, H - RIM_Y]) {
      const band = new Path2D();
      for (const y of [y0 + 6, y0 + RIM_Y - 6]) {
        band.moveTo(RIM_X * 0.5, y);
        band.lineTo(W - RIM_X * 0.5, y);
      }
      glazeLine(ctx, band, 2);
      meander(ctx, RIM_X, y0 + 11.5, W - RIM_X * 2, 17);
    }
    // Dots down the side rims, each with a point of gloss.
    for (const x of [RIM_X * 0.5, W - RIM_X * 0.5]) {
      for (let y = RIM_Y + 12; y < H - RIM_Y - 6; y += 14) {
        const dx = x + j(1);
        ctx.fillStyle = css(INK);
        ctx.beginPath();
        ctx.arc(dx, y, 2.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(255, 236, 214, 0.35)';
        ctx.beginPath();
        ctx.arc(dx - 0.8, y - 0.9, 0.8, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // The glazed field, sunk a little below the rim.
    const field = shape(
      [[RIM_X + j(2), RIM_Y + j(2)], [W - RIM_X + j(2), RIM_Y + j(2)], [W - RIM_X + j(2), H - RIM_Y + j(2)], [RIM_X + j(2), H - RIM_Y + j(2)]],
      false,
    );
    glaze(ctx, field, RIM_X, RIM_Y, W - RIM_X * 2, H - RIM_Y * 2);
    ctx.save();
    ctx.clip(field);
    ctx.lineWidth = 7;
    for (let y = RIM_Y + 4; y < H - RIM_Y; y += 9 + r() * 6) {
      ctx.strokeStyle = `rgba(74, 58, 46, ${0.06 + r() * 0.08})`;
      ctx.beginPath();
      ctx.moveTo(RIM_X, y);
      ctx.bezierCurveTo(W * 0.3, y + j(6), W * 0.7, y + j(6), W - RIM_X, y + j(3));
      ctx.stroke();
    }
    ctx.restore();
    innerEdge(ctx, field, 'rgba(0, 0, 0, 0.8)', 3, 4, 6);
    innerEdge(ctx, field, 'rgba(255, 214, 170, 0.3)', -1.5, -2, 2);
    // A reserved line inside the field, scratched through to the clay.
    const inner = new Path2D();
    inner.rect(RIM_X + 8, RIM_Y + 8, W - RIM_X * 2 - 16, H - RIM_Y * 2 - 16);
    ctx.save();
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.lineWidth = 2;
    ctx.translate(0.6, 0.8);
    ctx.stroke(inner);
    ctx.restore();
    ctx.strokeStyle = '#d99c6c';
    ctx.lineWidth = 1.6;
    ctx.stroke(inner);

    // A chipped corner, showing the rougher body.
    const chip = shape([[W - 30, H + 0.5], [W - 20, H - 12], [W - 8, H - 16], [W + 0.5, H - 30], [W + 0.5, H + 0.5]], false);
    ctx.fillStyle = '#a45d34';
    ctx.fill(chip);
    texture(ctx, chip, 0.5, 0.06, 9);
    innerEdge(ctx, chip, 'rgba(40, 20, 8, 0.6)', 1.5, 2, 2);

    model(ctx, slab, Math.min(W, H) * 0.5, 0.45, 0.5);
    ink(ctx, slab, 2.6, 0.9);
  }, 2.5);
}

const CHISEL_W = 44;
const CHISEL_H = 284;
const CHISEL_X = 22;
/** Tip of the chisel within its painting. */
const CHISEL_TIP = 279;
/** From the tip to the struck end. */
const CHISEL_LEN = CHISEL_TIP - 4;

/** A mason's chisel: ash handle, bronze ferrule, iron blade, in the pottery palette. */
function chiselTexture(): Texture {
  return bake('chisel-tool-painted', CHISEL_W, CHISEL_H, (ctx) => {
    const X = CHISEL_X;
    const handle = shape([[X - 11, 16], [X + 11, 16], [X + 12, 156], [X - 12, 156]], false);
    ctx.fillStyle = across(ctx, X - 12, 0, X + 12, 0, [[0, '#7a3a1c'], [0.28, '#d58b56'], [0.55, '#b0643a'], [1, '#62301a']]);
    ctx.fill(handle);
    texture(ctx, handle, 0.35, 0.06, 5);
    const grain = new Path2D();
    for (const dx of [-6, -1, 5]) {
      grain.moveTo(X + dx, 20);
      grain.bezierCurveTo(X + dx + 3, 60, X + dx - 3, 110, X + dx, 152);
    }
    ctx.strokeStyle = DILUTE;
    ctx.lineWidth = 1;
    ctx.stroke(grain);
    model(ctx, handle, 24, 0.35, 0.45);
    ink(ctx, handle, 1.8);

    // The butt, mushroomed by years of blows.
    const butt = shape([[X - 16, 21], [X - 15, 11], [X - 9, 4], [X, 2], [X + 9, 4], [X + 15, 11], [X + 16, 21]], false);
    ctx.fillStyle = across(ctx, X - 16, 0, X + 16, 0, [[0, '#7a3a1c'], [0.3, '#d28a58'], [1, '#5a2a14']]);
    ctx.fill(butt);
    const burrs = new Path2D();
    for (const dx of [-11, -4, 4, 11]) {
      burrs.moveTo(X + dx, 5);
      burrs.lineTo(X + dx * 1.1, 11);
    }
    ctx.strokeStyle = 'rgba(40, 18, 8, 0.5)';
    ctx.lineWidth = 0.9;
    ctx.stroke(burrs);
    model(ctx, butt, 22, 0.5, 0.45);
    ink(ctx, butt, 1.8);

    const ferrule = new Path2D();
    ferrule.roundRect(X - 14, 152, 28, 18, 3);
    ctx.fillStyle = across(ctx, X - 14, 0, X + 14, 0, [[0, '#5e3f18'], [0.3, '#ecc57e'], [0.6, '#a57b3b'], [1, '#4e3412']]);
    ctx.fill(ferrule);
    const rings = new Path2D();
    for (const y of [158, 164]) {
      rings.moveTo(X - 14, y);
      rings.lineTo(X + 14, y);
    }
    engrave(ctx, rings, 1.1, 'rgba(50, 30, 10, 0.8)', 'rgba(255, 236, 180, 0.5)');
    ink(ctx, ferrule, 1.6);
    glint(ctx, X - 7, 156, 6, 0.8);

    const blade = shape([[X - 9, 170], [X + 9, 170], [X + 8, 244], [X + 12, 264], [X, CHISEL_TIP], [X - 12, 264], [X - 8, 244]], false);
    ctx.fillStyle = across(ctx, X - 12, 0, X + 12, 0, [[0, '#6d6a63'], [0.32, '#efe8da'], [0.6, '#b7afa0'], [1, '#55524c']]);
    ctx.fill(blade);
    texture(ctx, blade, 0.25, 0.05, 3);
    // The ground bevel of the edge, and the edge itself catching the light.
    const bevel = shape([[X - 8, 244], [X + 8, 244], [X + 12, 264], [X, CHISEL_TIP], [X - 12, 264]], false);
    ctx.fillStyle = 'rgba(255, 252, 240, 0.4)';
    ctx.fill(bevel);
    ctx.strokeStyle = 'rgba(40, 36, 30, 0.45)';
    ctx.lineWidth = 0.9;
    ctx.stroke(bevel);
    model(ctx, blade, 18, 0.3, 0.4);
    ink(ctx, blade, 1.6);
    glint(ctx, X - 4, 266, 7, 0.9);
  }, 3);
}

const MALLET_W = 300;
const MALLET_H = 128;
/** The pivot of each swing, on the bound grip. */
const MALLET_GRIP: Vec = { x: 50, y: 64 };
/** From the grip to the centre of the head. */
const MALLET_REACH = 206;
const MALLET_HALF_HEAD = 30;

/** A round mallet: timber shaft, a cord-bound grip and a head banded in glaze. */
function malletTexture(): Texture {
  return bake('chisel-mallet-painted', MALLET_W, MALLET_H, (ctx) => {
    const hx = MALLET_GRIP.x + MALLET_REACH;
    const shaft = new Path2D();
    shaft.roundRect(16, 57, hx - 40, 14, 5);
    ctx.fillStyle = across(ctx, 0, 57, 0, 71, [[0, '#d88e5a'], [0.45, '#b0643a'], [1, '#62301a']]);
    ctx.fill(shaft);
    texture(ctx, shaft, 0.3, 0.06, 8);
    ink(ctx, shaft, 1.6);

    // The grip, bound in cord.
    const grip = new Path2D();
    grip.roundRect(12, 53, 76, 22, 7);
    ctx.fillStyle = across(ctx, 0, 53, 0, 75, [[0, '#6a4630'], [0.4, '#3a2416'], [1, '#1f130b']]);
    ctx.fill(grip);
    ctx.save();
    ctx.clip(grip);
    for (let x = 14; x < 90; x += 6) {
      ctx.strokeStyle = 'rgba(236, 200, 150, 0.55)';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(x, 53);
      ctx.lineTo(x + 6, 75);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(10, 6, 2, 0.6)';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(x + 2, 53);
      ctx.lineTo(x + 8, 75);
      ctx.stroke();
    }
    ctx.restore();
    model(ctx, grip, 22, 0.35, 0.5);
    ink(ctx, grip, 1.6);

    const head = new Path2D();
    head.roundRect(hx - MALLET_HALF_HEAD, 6, MALLET_HALF_HEAD * 2, 116, 16);
    ctx.fillStyle = across(ctx, hx - 30, 0, hx + 30, 0, [[0, '#7a3a1c'], [0.3, '#dc955f'], [0.6, '#b0643a'], [1, '#5a2812']]);
    ctx.fill(head);
    texture(ctx, head, 0.35, 0.07, 12);
    ctx.save();
    ctx.clip(head);
    const grain = new Path2D();
    for (const dx of [-16, -4, 8, 18]) {
      grain.moveTo(hx + dx, 8);
      grain.bezierCurveTo(hx + dx + 4, 40, hx + dx - 4, 88, hx + dx, 120);
    }
    ctx.strokeStyle = DILUTE;
    ctx.lineWidth = 1;
    ctx.stroke(grain);
    // Two bands of glaze with reserved beads, glossy where they turn to the light.
    for (const y of [22, 96]) {
      ctx.fillStyle = across(ctx, hx - 30, 0, hx + 30, 0, [[0, '#15100c'], [0.3, '#4a3a30'], [0.55, '#1c1511'], [1, '#0c0806']]);
      ctx.fillRect(hx - 40, y, 80, 10);
      ctx.fillStyle = css(PALE);
      for (let x = hx - 22; x <= hx + 22; x += 11) {
        ctx.beginPath();
        ctx.arc(x, y + 5, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
    model(ctx, head, 60, 0.4, 0.5);
    ink(ctx, head, 2.2);
    glint(ctx, hx - 15, 20, 8, 0.6);
  }, 3);
}

// ------------------------------------------------------------------ the stamp

const NS = 1.5; // em units → slab units
const PAD_X = 72;
const PAD_Y = 62;

const SLAM = 0.24;
const TOOLS_IN = 0.3;
const TOOLS_IN_END = 0.56;
const STRIKE = 0.095;
const TRAVEL = 0.16;
const MAX_STRIKES = 18;
const FLY = 0.7;

const LEAN = 0.42;
const AXIS: Vec = { x: Math.sin(LEAN), y: -Math.cos(LEAN) };
const PERP: Vec = { x: Math.cos(LEAN), y: Math.sin(LEAN) };
const TOOL_K = 0.72;

type Step =
  | { kind: 'travel'; t0: number; t1: number; from: Vec; to: Vec }
  | { kind: 'strike'; t0: number; t1: number; stroke: number; from: number; to: number };

type BitKind = 'sherd' | 'pebble' | 'dust' | 'spark';

/** A flying piece, in pinax units. */
interface Bit {
  kind: BitKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  spin: number;
  size: number;
  life: number;
  max: number;
  tex: Texture | null;
}

/** A short-lived mark: a hit glint, the slam's ring, strike ticks or the finishing star. */
interface Mark {
  kind: 'glint' | 'wave' | 'ticks' | 'star';
  x: number;
  y: number;
  size: number;
  angle: number;
  age: number;
  max: number;
}

interface Play {
  siteId: string;
  level: number;
  grooves: Groove[];
  width: number;
  W: number;
  H: number;
  steps: Step[];
  carveEnd: number;
  t: number;
  hits: number;
  landed: boolean;
  finished: boolean;
  done: boolean;
}

/** What the world tells the stamp each frame. */
export interface ChiselFrame {
  siteId: string;
  level: number;
  /** The unobstructed part of the screen, in screen pixels. */
  area: { x: number; y: number; w: number; h: number };
  toScreen: (p: Vec) => Vec;
  worldScale: number;
  rich: boolean;
  reduced: boolean;
}

/** The cartouche in the hillside, in world units (centre). */
export const PLAQUE_AT: Vec = { x: 760, y: 600 };
/** Cap height of the numerals on the cartouche, in world units. */
const PLAQUE_EM = 30;
const PLAQUE_PAD = { x: 16, y: 11 };
const PLAQUE_MARGIN = 8;

/** A small glazed panel for the hillside, with a scratched frame line. */
function cartoucheTexture(w: number, h: number): Texture {
  return bake(`chisel-cartouche-${w}x${h}`, w + PLAQUE_MARGIN * 2, h + PLAQUE_MARGIN * 2, (ctx) => {
    ctx.translate(PLAQUE_MARGIN, PLAQUE_MARGIN);
    const panel = new Path2D();
    panel.roundRect(0, 0, w, h, 3);
    ctx.save();
    ctx.translate(2, 3);
    ctx.filter = `blur(${2.5 * resOf(ctx)}px)`;
    ctx.fillStyle = 'rgba(28, 16, 8, 0.55)';
    ctx.fill(panel);
    ctx.restore();
    glaze(ctx, panel, 0, 0, w, h);
    const frame = new Path2D();
    frame.rect(3.5, 3.5, w - 7, h - 7);
    ctx.strokeStyle = '#d99c6c';
    ctx.lineWidth = 1.2;
    ctx.stroke(frame);
    model(ctx, panel, h, 0.35, 0.5);
    ink(ctx, panel, 1.2, 0.9);
  }, 3);
}

/** The cartouche on the hillside: every stamp this operation has earned. */
class Plaque extends Container {
  private panel = new Sprite();
  private numerals = new Graphics();
  private key = '';
  private slotsAt = new Map<number, Vec>();
  private bumpAge = 1;

  constructor() {
    super();
    this.panel.anchor.set(0.5);
    this.addChild(this.panel, this.numerals);
    this.position.set(PLAQUE_AT.x, PLAQUE_AT.y);
  }

  bump(): void {
    this.bumpAge = 0;
  }

  /** Where a level's numeral sits, in world units. */
  slot(level: number): Vec | undefined {
    return this.slotsAt.get(level);
  }

  update(dt: number, level: number, hidden: number[]): void {
    this.bumpAge += dt;
    const k = this.bumpAge < 0.35 ? 1 + 0.12 * Math.sin((this.bumpAge / 0.35) * Math.PI) : 1;
    this.scale.set(k);
    const levels = STAMP_LEVELS.filter((l) => level >= l);
    const key = `${levels.join(',')}|${hidden.join(',')}`;
    if (key === this.key) return;
    this.key = key;
    this.numerals.clear();
    this.slotsAt.clear();
    this.visible = levels.length > 0;
    if (!levels.length) return;

    const { grooves, width, slots } = layout(levels.map(toRoman));
    const s = PLAQUE_EM / 100;
    const w = Math.round(width * s + PLAQUE_PAD.x * 2);
    const h = PLAQUE_EM + PLAQUE_PAD.y * 2;
    const x = -w / 2;
    const y = -h / 2;
    this.panel.texture = cartoucheTexture(w, h);

    const hide = new Set(hidden.map((l) => levels.indexOf(l)));
    this.numerals.position.set(x + PLAQUE_PAD.x, y + PLAQUE_PAD.y);
    this.numerals.scale.set(s);
    drawGrooves(this.numerals, grooves, (k) => (grooves[k].owner >= 0 && hide.has(grooves[k].owner) ? 0 : grooves[k].len), null);
    // Numeral slots for the flight into the wall.
    levels.forEach((l, i) => {
      const [a, b] = slots[i];
      this.slotsAt.set(l, { x: PLAQUE_AT.x + x + PLAQUE_PAD.x + ((a + b) / 2) * s, y: PLAQUE_AT.y + y + PLAQUE_PAD.y + 50 * s });
    });
  }
}

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T>(list: T[]): T => list[Math.floor(Math.random() * list.length)];
const easeOut = (k: number) => 1 - (1 - k) ** 3;

/** Glaze flakes and clay grit from the pinax. */
const GLAZE_LOOK: SherdLook = { kind: 'figure', fill: POTTERY.clay, accent: INK };
const CLAY_LOOK: SherdLook = { kind: 'clay', fill: PALE, accent: CLAY };
const DUST_TINT = 0xe9c9a4;

export class ChiselStamp extends Container {
  /** Add to the world stage, over the terrain. */
  readonly plaque = new Plaque();
  /**
   * Each slam (2), blow (1) and arrival (0.5), with its weight for sound and
   * shake, and where it happened in global coordinates when effects are rich.
   */
  onStrike: ((weight: number, at?: Vec) => void) | null = null;

  /** The ray burst behind the finished pinax, in screen space. */
  private rays = new SpriteLayer(2);
  private raysGlow = new GlowLayer(2);
  private board = new Container();
  private slab = new Sprite();
  private groove = new Graphics();
  private dustLayer = new SpriteLayer(40);
  private marksG = new Graphics();
  private chisel = new Sprite();
  private mallet = new Sprite();
  private pieces = new SpriteLayer(90);
  private sparksG = new Graphics();
  private glow = new GlowLayer(160);
  private queue: { siteId: string; level: number }[] = [];
  private play_: Play | null = null;
  private bits: Bit[] = [];
  private marks: Mark[] = [];
  /** Hit-stop: the flying pieces hold still for a beat after a blow. */
  private freeze = 0;
  /** Where the mallet meets the chisel, in pinax units. */
  private butt: Vec = { x: 0, y: 0 };

  constructor() {
    super();
    this.groove.position.set(PAD_X, PAD_Y);
    this.groove.scale.set(NS);
    this.chisel.anchor.set(CHISEL_X / CHISEL_W, CHISEL_TIP / CHISEL_H);
    this.mallet.anchor.set(MALLET_GRIP.x / MALLET_W, MALLET_GRIP.y / MALLET_H);
    this.chisel.scale.set(TOOL_K);
    this.mallet.scale.set(TOOL_K);
    this.board.addChild(this.slab, this.groove, this.dustLayer, this.marksG, this.chisel, this.mallet, this.pieces, this.sparksG, this.glow);
    this.addChild(this.raysGlow, this.rays, this.board);
    this.visible = false;
  }

  /** Queue the stamp for a milestone; plays one at a time. */
  play(siteId: string, level: number): void {
    if (!STAMP_LEVELS.includes(level)) return;
    this.queue.push({ siteId, level });
  }

  /** Levels still on their way to the wall, hidden on the cartouche until they land. */
  private pending(siteId: string): number[] {
    const out = this.queue.filter((q) => q.siteId === siteId).map((q) => q.level);
    if (this.play_ && this.play_.siteId === siteId) out.push(this.play_.level);
    return out;
  }

  private start(siteId: string, level: number): Play {
    const { grooves, width } = layout([toRoman(level)]);
    const W = Math.round(width * NS + PAD_X * 2);
    const H = Math.round(100 * NS + PAD_Y * 2);
    const total = grooves.reduce((a, g) => a + g.len, 0);
    const step = Math.max(24, total / MAX_STRIKES);
    const steps: Step[] = [];
    let t = TOOLS_IN_END;
    grooves.forEach((g, k) => {
      if (k > 0) {
        const prev = grooves[k - 1];
        steps.push({ kind: 'travel', t0: t, t1: t + TRAVEL, from: pointAt(prev, prev.len), to: pointAt(g, 0) });
        t += TRAVEL;
      }
      const n = Math.max(1, Math.ceil(g.len / step));
      for (let i = 0; i < n; i++) {
        steps.push({ kind: 'strike', t0: t, t1: t + STRIKE, stroke: k, from: (i / n) * g.len, to: ((i + 1) / n) * g.len });
        t += STRIKE;
      }
    });
    this.slab.texture = slabTexture(W, H);
    this.slab.position.set(-SLAB_MARGIN, -SLAB_MARGIN);
    this.chisel.texture = chiselTexture();
    this.mallet.texture = malletTexture();
    this.board.pivot.set(W / 2, H / 2);
    this.bits = [];
    this.marks = [];
    return { siteId, level, grooves, width, W, H, steps, carveEnd: t, t: 0, hits: 0, landed: false, finished: false, done: false };
  }

  /** How far each stroke is cut at time `t`. */
  private cutOf(p: Play, k: number, t: number): number {
    let cut = 0;
    for (const s of p.steps) {
      if (s.kind !== 'strike' || s.stroke !== k || t < s.t1) continue;
      const e = Math.min(1, (t - s.t1) / 0.06);
      cut = s.from + (s.to - s.from) * (1 - (1 - e) * (1 - e));
    }
    return cut;
  }

  update(dt: number, f: ChiselFrame): void {
    this.plaque.update(dt, f.level, this.pending(f.siteId));
    if (!this.play_ && this.queue.length) {
      const next = this.queue.shift()!;
      this.play_ = this.start(next.siteId, next.level);
      this.visible = true;
    }
    const p = this.play_;
    if (!p) {
      this.visible = false;
      this.bits = [];
      this.marks = [];
      return;
    }
    p.t += dt;
    this.glow.begin();
    this.raysGlow.begin();
    this.rays.begin();
    if (f.reduced) this.drawReduced(p, f);
    else this.drawFull(p, f);
    this.stepEffects(dt);
    this.drawEffects();
    this.glow.end();
    this.raysGlow.end();
    this.rays.end();
    if (p.done) {
      this.play_ = null;
      this.plaque.bump();
    }
  }

  /** Reduced motion: the finished stamp fades in, holds and fades out. */
  private drawReduced(p: Play, f: ChiselFrame): void {
    const t = p.t;
    this.chisel.visible = this.mallet.visible = false;
    this.place(f, p, null, 0);
    this.board.alpha = t < 0.25 ? t / 0.25 : t > 2 ? Math.max(0, 1 - (t - 2) / 0.4) : 1;
    this.groove.clear();
    drawGrooves(this.groove, p.grooves, (k) => p.grooves[k].len, null);
    if (t > 2.4) p.done = true;
  }

  private drawFull(p: Play, f: ChiselFrame): void {
    const t = p.t;
    const flyStart = p.carveEnd + 1.0;
    const u = Math.max(0, Math.min(1, (t - flyStart) / FLY));
    const slamS = t < SLAM ? 1 + 0.55 * (1 - (t / SLAM) ** 2) : 1 + 0.035 * Math.exp(-(t - SLAM) * 12) * Math.cos((t - SLAM) * 42);
    this.place(f, p, u > 0 ? u : null, slamS);
    this.board.alpha = t < SLAM ? Math.min(1, t / (SLAM * 0.6)) : u > 0.55 ? Math.max(0, 1 - (u - 0.55) / 0.45) : 1;

    // Slam: a hit frame in the kiln, a ring along the foot, billows of dust.
    if (!p.landed && t >= SLAM) {
      p.landed = true;
      this.onStrike?.(2, f.rich ? this.board.toGlobal({ x: p.W / 2, y: p.H }) : undefined);
      if (f.rich) this.slammed(p);
    }

    // Blows land at the end of each strike slot.
    let hits = 0;
    for (const s of p.steps) {
      if (s.kind !== 'strike' || t < s.t1) continue;
      hits++;
      if (hits > p.hits) {
        this.onStrike?.(1);
        if (f.rich) {
          const tip = pointAt(p.grooves[s.stroke], s.to);
          this.blow(PAD_X + tip.x * NS, PAD_Y + tip.y * NS);
        }
      }
    }
    p.hits = hits;

    this.groove.clear();
    drawGrooves(this.groove, p.grooves, (k) => this.cutOf(p, k, t), t);
    this.drawTools(p, t);

    if (f.rich) {
      // A fresh cut glows a moment, like hot metal on stone.
      for (const gr of p.grooves) {
        for (let i = 0; i < gr.cutAt.length; i += 3) {
          const age = t - gr.cutAt[i];
          if (gr.cutAt[i] < 0 || age > 0.3) continue;
          this.glow.add(PAD_X + gr.x[i] * NS, PAD_Y + gr.y[i] * NS, 6 + gr.hw[i] * NS * 0.6, 0xffcf8a, 0.28 * (1 - age / 0.3));
        }
      }
      this.finish(p, f, t, u);
    }

    if (u >= 1) {
      p.done = true;
      const slot = this.plaque.slot(p.level);
      this.onStrike?.(0.5, f.rich && slot ? f.toScreen(slot) : undefined);
    }
  }

  /** The finished numeral catches the light, and a ray burst opens behind it. */
  private finish(p: Play, f: ChiselFrame, t: number, u: number): void {
    const since = t - p.carveEnd - 0.1;
    if (since < 0) return;
    if (!p.finished) {
      p.finished = true;
      const top = p.grooves.reduce((best, g) => (g.x[0] > best.x ? { x: g.x[0], y: g.y[0] } : best), { x: 0, y: 0 });
      this.mark('star', PAD_X + top.x * NS, PAD_Y + top.y * NS, 34, 0.8);
    }
    // A band of light sweeps across the cut.
    const sweep = since / 0.55;
    if (sweep < 1) {
      const sx = -20 + sweep * (p.width + 40);
      for (const gr of p.grooves) {
        for (let i = 0; i < gr.x.length; i += 3) {
          const d = Math.abs(gr.x[i] - sx);
          if (d > 22) continue;
          this.glow.add(PAD_X + gr.x[i] * NS, PAD_Y + gr.y[i] * NS, 16, 0xffe2a8, 0.55 * (1 - d / 22));
        }
      }
    }
    // Rays behind the pinax, turning slowly, gone as it flies away.
    const grow = easeOut(Math.min(1, since / 0.5));
    const fade = Math.min(1, since / 0.2) * (1 - u);
    const size = Math.max(p.W, p.H) * this.board.scale.x * (1.1 + 0.5 * grow);
    const { x, y } = this.board.position;
    this.rays.put(burstTexture('bronze', 18), x, y, size * ((BURST_R + 6) / BURST_R), size * ((BURST_R + 6) / BURST_R), since * 0.25, 0.9 * fade);
    this.raysGlow.add(x, y, size * 0.55, 0xffd890, 0.3 * fade);
  }

  /** Size the slab to the screen, or fly it into its slot on the hillside. */
  private place(f: ChiselFrame, p: Play, fly: number | null, slam: number): void {
    const { area } = f;
    const k = Math.min((area.h * 0.56) / p.H, (area.w * 0.8) / (p.W + 160));
    const cx = area.x + area.w / 2;
    const cy = area.y + area.h * 0.6;
    let x = cx;
    let y = cy;
    let s = k * (slam || 1);
    let rot = 0;
    if (fly !== null) {
      const slot = this.plaque.slot(p.level) ?? { x: PLAQUE_AT.x, y: PLAQUE_AT.y };
      const to = f.toScreen(slot);
      const e = fly < 0.5 ? 4 * fly ** 3 : 1 - (-2 * fly + 2) ** 3 / 2;
      // The numeral lands at the size it is cut on the cartouche.
      const end = (PLAQUE_EM * f.worldScale) / (100 * NS);
      x = cx + (to.x - cx) * e;
      y = cy + (to.y - cy) * e - Math.sin(e * Math.PI) * area.h * 0.08;
      s = k * Math.pow(end / k, e);
      rot = -0.12 * Math.sin(e * Math.PI);
      // Centre on the numeral rather than the slab as it shrinks into the wall.
      const nx = PAD_X + (p.width * NS) / 2;
      const ny = PAD_Y + 50 * NS;
      this.board.pivot.set(p.W / 2 + (nx - p.W / 2) * e, p.H / 2 + (ny - p.H / 2) * e);
    } else {
      this.board.pivot.set(p.W / 2, p.H / 2);
    }
    this.board.position.set(x, y);
    this.board.scale.set(s);
    this.board.rotation = rot;
  }

  private drawTools(p: Play, t: number): void {
    const out = p.carveEnd + 0.05;
    const enter = t < TOOLS_IN ? 0 : Math.min(1, (t - TOOLS_IN) / (TOOLS_IN_END - TOOLS_IN));
    const leave = t < out ? 0 : Math.min(1, (t - out) / 0.25);
    const shown = enter > 0 && leave < 1;
    this.chisel.visible = this.mallet.visible = shown;
    if (!shown) return;

    // Where the edge is and how high the mallet is raised.
    let tip: Vec;
    let raise = 0.6;
    let lift = 0;
    let recoil = 0;
    const first = p.steps[0];
    const firstTip = first.kind === 'strike' ? pointAt(p.grooves[first.stroke], 0) : first.from;
    const step = p.steps.find((s) => t >= s.t0 && t < s.t1);
    if (!step) {
      const last = p.steps[p.steps.length - 1];
      tip = t < TOOLS_IN_END ? firstTip : last.kind === 'strike' ? pointAt(p.grooves[last.stroke], last.to) : last.to;
      raise = t < TOOLS_IN_END ? 0.6 : 0.2;
    } else if (step.kind === 'travel') {
      const e = (t - step.t0) / (step.t1 - step.t0);
      const s = e * e * (3 - 2 * e);
      tip = { x: step.from.x + (step.to.x - step.from.x) * s, y: step.from.y + (step.to.y - step.from.y) * s };
      lift = Math.sin(e * Math.PI) * 14;
    } else {
      const e = (t - step.t0) / (step.t1 - step.t0);
      tip = pointAt(p.grooves[step.stroke], this.cutOf(p, step.stroke, t));
      // Up steadily, down hard.
      raise = e < 0.65 ? 1 - (1 - e / 0.65) ** 2 : 1 - ((e - 0.65) / 0.35) ** 2;
      recoil = Math.exp(-(t - step.t0) * 40);
    }

    const off = (1 - enter * enter * (3 - 2 * enter)) * (p.W * 0.9) + leave * leave * p.W * 0.9;
    const tx = PAD_X + tip.x * NS + off + AXIS.x * lift;
    const ty = PAD_Y + tip.y * NS - off * 0.3 + AXIS.y * lift;
    // The blow drives the edge in a hair.
    this.chisel.position.set(tx - AXIS.x * 4 * recoil, ty - AXIS.y * 4 * recoil);
    this.chisel.rotation = LEAN;

    const len = CHISEL_LEN * TOOL_K;
    const butt = { x: tx + AXIS.x * len, y: ty + AXIS.y * len };
    this.butt = butt;
    const head = { x: butt.x + AXIS.x * MALLET_HALF_HEAD * TOOL_K, y: butt.y + AXIS.y * MALLET_HALF_HEAD * TOOL_K };
    const grip = { x: head.x + PERP.x * MALLET_REACH * TOOL_K, y: head.y + PERP.y * MALLET_REACH * TOOL_K };
    this.mallet.position.set(grip.x, grip.y);
    this.mallet.rotation = Math.atan2(-PERP.y, -PERP.x) + 0.85 * raise;
  }

  // ------------------------------------------------------------------ effects

  private spawn(kind: BitKind, x: number, y: number, angle: number, speed: number, size: number, tex: Texture | null): void {
    if (this.bits.length >= 110) return;
    this.bits.push({
      kind,
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      rot: rand(0, Math.PI * 2),
      spin: kind === 'dust' ? rand(-0.6, 0.6) : rand(-12, 12),
      size,
      life: 0,
      max: kind === 'spark' ? rand(0.25, 0.45) : kind === 'dust' ? rand(1.1, 1.6) : rand(0.9, 1.3),
      tex,
    });
  }

  private mark(kind: Mark['kind'], x: number, y: number, size: number, max: number, angle = 0): void {
    this.marks.push({ kind, x, y, size, angle, age: 0, max });
  }

  /** The pinax lands: a ring along its foot, dust rolling out, grit thrown up. */
  private slammed(p: Play): void {
    this.freeze = 0.07;
    this.mark('wave', p.W / 2, p.H, p.W * 0.75, 0.7);
    for (let i = 0; i < 10; i++) {
      const left = i % 2 === 0;
      const x = p.W * (left ? rand(0, 0.35) : rand(0.65, 1));
      this.spawn('dust', x, p.H - rand(0, 10), left ? Math.PI + rand(0.02, 0.35) * Math.PI : rand(-0.35, -0.02) * Math.PI, rand(90, 220), rand(24, 36), pick(dustTextures()));
    }
    for (let i = 0; i < 8; i++) {
      this.spawn('pebble', rand(0, p.W), p.H - 4, rand(-0.9, -0.1) * Math.PI, rand(200, 420), rand(3, 6), pick(pebbleTextures(CLAY_LOOK)));
    }
  }

  /** A blow at the cutting edge: a hit glint, sparks, flakes of glaze and grit. */
  private blow(x: number, y: number): void {
    this.freeze = Math.max(this.freeze, 0.04);
    this.mark('glint', x, y, 26, 0.18);
    this.mark('ticks', this.butt.x, this.butt.y, 22, 0.16, LEAN);
    for (let i = 0; i < 4; i++) this.spawn('spark', x, y, rand(-0.95, -0.05) * Math.PI, rand(320, 680), 1, null);
    for (let i = 0; i < 3; i++) this.spawn('sherd', x, y, rand(-0.95, -0.1) * Math.PI, rand(260, 520), rand(7, 11), pick(sherdTextures(GLAZE_LOOK)));
    for (let i = 0; i < 3; i++) this.spawn('pebble', x, y, rand(-0.9, -0.1) * Math.PI, rand(200, 420), rand(2.5, 4.5), pick(pebbleTextures(CLAY_LOOK)));
    this.spawn('dust', x, y, rand(-0.8, -0.2) * Math.PI, rand(40, 90), rand(10, 14), pick(dustTextures()));
  }

  private stepEffects(dt: number): void {
    const step = this.freeze > 0 ? 0 : dt;
    this.freeze = Math.max(0, this.freeze - dt);
    this.marks = this.marks.filter((m) => (m.age += dt) < m.max);
    this.bits = this.bits.filter((b) => {
      b.life += step;
      if (b.life >= b.max) return false;
      const gravity = b.kind === 'spark' ? 900 : b.kind === 'dust' ? -40 : 1400;
      const drag = b.kind === 'spark' ? 1.5 : b.kind === 'dust' ? 3.2 : 0.4;
      b.vy += gravity * step;
      b.vx *= 1 - drag * step;
      b.vy *= 1 - drag * step * (gravity > 0 ? 0.2 : 1);
      b.x += b.vx * step;
      b.y += b.vy * step;
      b.rot += b.spin * step;
      return true;
    });
  }

  private drawEffects(): void {
    const g = this.sparksG;
    const m = this.marksG;
    g.clear();
    m.clear();
    this.pieces.begin();
    this.dustLayer.begin();
    for (const b of this.bits) {
      const k = b.life / b.max;
      const alpha = b.kind === 'sherd' || b.kind === 'pebble' ? Math.min(1, (b.max - b.life) / 0.3) : Math.min(1, (1 - k) * 3);
      if (b.kind === 'sherd' || b.kind === 'pebble') {
        const w = b.size * (b.kind === 'sherd' ? 48 / SHERD_R : 22 / PEBBLE_R);
        const tumble = 0.45 + 0.55 * Math.abs(Math.cos(b.rot * 0.6));
        this.pieces.put(b.tex!, b.x, b.y, w, w * tumble, b.rot, alpha);
      } else if (b.kind === 'dust') {
        const grow = 1 - (1 - Math.min(1, k * 2.4)) ** 2;
        const w = b.size * (0.55 + grow * 1.1) * (100 / DUST_R);
        this.dustLayer.put(b.tex!, b.x, b.y, w, w * 0.82, b.rot, 0.9 * (1 - k) ** 1.2, DUST_TINT);
      } else {
        const speed = Math.hypot(b.vx, b.vy) || 1;
        const len = Math.min(26, speed * 0.04);
        const dx = b.vx / speed;
        const dy = b.vy / speed;
        g.moveTo(b.x - dx * len, b.y - dy * len).lineTo(b.x, b.y).stroke({ width: 4, color: INK, alpha: alpha * 0.5, cap: 'round' });
        g.moveTo(b.x - dx * len, b.y - dy * len).lineTo(b.x, b.y).stroke({ width: 2, color: FRESH, alpha, cap: 'round' });
        this.glow.add(b.x - dx * len * 0.4, b.y - dy * len * 0.4, 7 + len * 0.3, 0xffb45a, alpha * 0.9, 1 + len / 14, Math.atan2(dy, dx));
        this.glow.add(b.x, b.y, 5, 0xfff4d8, alpha);
      }
    }
    for (const mk of this.marks) {
      const k = mk.age / mk.max;
      const e = easeOut(k);
      if (mk.kind === 'glint') {
        m.circle(mk.x, mk.y, mk.size * (0.3 + 0.5 * e)).fill({ color: FRESH, alpha: 0.5 * (1 - k) ** 2 });
        this.glow.add(mk.x, mk.y, mk.size * (1.4 + 1.4 * e), 0xffe2a8, (1 - k) ** 1.5);
      } else if (mk.kind === 'wave') {
        // A dashed ring spreading along the foot, like an incised border.
        const rx = mk.size * (0.55 + 0.6 * e);
        const ry = rx * 0.16;
        const n = 30;
        const alpha = 0.75 * (1 - k) ** 1.3;
        for (let i = 0; i < n; i++) {
          const a0 = (i / n) * Math.PI * 2;
          const a1 = a0 + ((Math.PI * 2) / n) * 0.55;
          m.moveTo(mk.x + Math.cos(a0) * rx, mk.y + Math.sin(a0) * ry)
            .lineTo(mk.x + Math.cos(a1) * rx, mk.y + Math.sin(a1) * ry)
            .stroke({ width: 1.5 + 5 * (1 - k), color: INK, alpha, cap: 'round' });
        }
      } else if (mk.kind === 'ticks') {
        // Three incised strokes flying off the struck butt, as a vase painter draws a blow.
        const alpha = 0.8 * (1 - k);
        for (const o of [-0.7, 0, 0.7]) {
          const a = mk.angle - Math.PI / 2 + o;
          const r0 = mk.size * (0.4 + 0.5 * e);
          const r1 = r0 + mk.size * 0.6;
          const x0 = mk.x + Math.sin(a) * r0;
          const y0 = mk.y - Math.cos(a) * r0;
          m.moveTo(x0, y0)
            .lineTo(mk.x + Math.sin(a) * r1, mk.y - Math.cos(a) * r1)
            .stroke({ width: 3, color: INK, alpha, cap: 'round' });
        }
        this.glow.add(mk.x, mk.y, mk.size * 0.9, 0xffe2a8, 0.6 * (1 - k));
      } else {
        const tw = Math.sin(k * Math.PI);
        const w = mk.size * (0.4 + 0.6 * tw) * (34 / STAR_R);
        this.pieces.put(starTexture('gold'), mk.x, mk.y, w, w, k * 1.5, tw);
        this.glow.add(mk.x, mk.y, mk.size * (1 + 1.6 * tw), 0xfff0c8, tw);
      }
    }
    this.pieces.end();
    this.dustLayer.end();
  }
}
