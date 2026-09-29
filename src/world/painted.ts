import type { Texture } from 'pixi.js';
import { bake, canvasOf, css, emboss, engrave, glint, groundShadow, ink, innerEdge, LIGHT, mix, model, rng, shape, speckle, texture, wash, type Ctx } from './paint';

/**
 * The renderer's own painted pieces: struck obols, pottery sherds, stone
 * chips, dust billows, the waiting targets and the timber-and-bronze
 * machinery. Each is painted once, lit from the upper left, with the tooth
 * of fired clay or cast metal, and cached (see paint.ts).
 */

const GLAZE = '#1a1310';
const CLAY = '#c56a3b';
const PURPLE = '#6d2519';
const RES_HI = 5;

type Pt = [number, number];

/** Continue `p` through `pts` with a smooth curve (Catmull-Rom). */
function spline(p: Path2D, pts: Pt[]): void {
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[Math.max(0, i - 1)];
    const b = pts[i];
    const c = pts[i + 1];
    const d = pts[Math.min(pts.length - 1, i + 2)];
    p.bezierCurveTo(b[0] + (c[0] - a[0]) / 6, b[1] + (c[1] - a[1]) / 6, c[0] - (d[0] - b[0]) / 6, c[1] - (d[1] - b[1]) / 6, c[0], c[1]);
  }
}

function circle(x: number, y: number, r: number): Path2D {
  const p = new Path2D();
  p.arc(x, y, r, 0, Math.PI * 2);
  return p;
}

/** A Greek key along a band: hooks off a running base line, with borders. */
function meander(x0: number, x1: number, y: number, h: number): Path2D {
  const p = new Path2D();
  const u = h * 1.15;
  for (let x = x0; x < x1; x += u) {
    p.moveTo(x, y + h);
    p.lineTo(x, y);
    p.lineTo(x + h * 0.82, y);
    p.lineTo(x + h * 0.82, y + h * 0.64);
    p.lineTo(x + h * 0.34, y + h * 0.64);
    p.lineTo(x + h * 0.34, y + h * 0.3);
  }
  p.moveTo(x0, y + h);
  p.lineTo(x1, y + h);
  return p;
}

/** A laurel or olive leaf: an almond from `a` toward `b`. */
function leaf(x: number, y: number, len: number, angle: number, width = 0.32): Path2D {
  const p = new Path2D();
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const w = len * width;
  const tip: Pt = [x + c * len, y + s * len];
  const mid: Pt = [x + c * len * 0.5, y + s * len * 0.5];
  p.moveTo(x, y);
  p.quadraticCurveTo(mid[0] - s * w, mid[1] + c * w, tip[0], tip[1]);
  p.quadraticCurveTo(mid[0] + s * w, mid[1] - c * w, x, y);
  return p;
}

// ------------------------------------------------------------------ obols

const OBOL_BOX = 52;
const OBOL_R = 23;

/** A struck gold obol: owl and olive on the face, Σ in an incuse square behind. */
export function obolTexture(side: 'face' | 'back' = 'face'): Texture {
  return bake(`obol-${side}`, OBOL_BOX, OBOL_BOX + 2, (ctx) => paintObol(ctx, side), RES_HI);
}

/** Scale that makes an obol texture `r` world units in radius. */
export const obolScale = (r: number) => r / OBOL_R;

function paintObol(ctx: Ctx, side: 'face' | 'back'): void {
  const cx = OBOL_BOX / 2;
  const cy = OBOL_BOX / 2;
  const R = OBOL_R;
  const r = rng(side === 'face' ? 3 : 4);
  // A hand-struck flan is never quite round.
  const pts: Pt[] = [];
  for (let i = 0; i < 40; i++) {
    const a = (i / 40) * Math.PI * 2;
    const k = 1 + Math.sin(a * 3 + 1) * 0.014 + Math.sin(a * 5 + 2) * 0.01 + (r() - 0.5) * 0.008;
    pts.push([cx + Math.cos(a) * R * k, cy + Math.sin(a) * R * k]);
  }
  const flan = shape(pts);
  // Its thickness, seen below.
  ctx.save();
  ctx.translate(0.5, 1.9);
  ctx.fillStyle = '#5e3e14';
  ctx.fill(flan);
  ctx.translate(-0.25, -0.9);
  ctx.fillStyle = '#a0712b';
  ctx.fill(flan);
  ctx.restore();
  const field = ctx.createRadialGradient(cx - 8, cy - 9, 1, cx, cy, R * 1.25);
  field.addColorStop(0, '#fff1bd');
  field.addColorStop(0.25, '#f1c96a');
  field.addColorStop(0.6, '#c9963b');
  field.addColorStop(0.88, '#8f6225');
  field.addColorStop(1, '#6c4718');
  ctx.fillStyle = field;
  ctx.fill(flan);
  texture(ctx, flan, 0.32, 0.05, side === 'face' ? 1 : 2);
  // The raised rim, and the groove inside it.
  const rim = ctx.createLinearGradient(cx - R, cy - R, cx + R, cy + R);
  rim.addColorStop(0, '#fff3c8');
  rim.addColorStop(0.5, '#d6a64d');
  rim.addColorStop(1, '#6e4a18');
  ctx.strokeStyle = rim;
  ctx.lineWidth = 2.6;
  ctx.stroke(circle(cx, cy, R - 1.7));
  const groove = ctx.createLinearGradient(cx - R, cy - R, cx + R, cy + R);
  groove.addColorStop(0, 'rgba(90, 58, 18, 0.8)');
  groove.addColorStop(1, 'rgba(255, 238, 190, 0.7)');
  ctx.strokeStyle = groove;
  ctx.lineWidth = 0.7;
  ctx.stroke(circle(cx, cy, R - 3.4));
  // Beaded border.
  for (let i = 0; i < 38; i++) {
    const a = (i / 38) * Math.PI * 2;
    emboss(ctx, circle(cx + Math.cos(a) * (R - 5.2), cy + Math.sin(a) * (R - 5.2), 0.75), '#e9c066', 0.3);
  }
  if (side === 'face') owl(ctx, cx, cy + 0.5);
  else incuse(ctx, cx, cy);
  // Wear: pits and fine scratches.
  speckle(ctx, flan, r, 60, [0.1, 0.32], 'rgba(86, 54, 16, 0.35)', [cx - R, cy - R, cx + R, cy + R]);
  ctx.save();
  ctx.clip(flan);
  ctx.strokeStyle = 'rgba(255, 244, 210, 0.3)';
  ctx.lineWidth = 0.2;
  for (let i = 0; i < 7; i++) {
    const x = cx + (r() - 0.5) * R * 1.6;
    const y = cy + (r() - 0.5) * R * 1.6;
    const a = r() * Math.PI;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + Math.cos(a) * 3, y + Math.sin(a) * 3 + 1, x + Math.cos(a) * 6, y + Math.sin(a) * 6);
    ctx.stroke();
  }
  ctx.restore();
  model(ctx, flan, 44, 0.35, 0.4);
  wash(ctx, flan, cx - 9, cy - 10, 13, 'rgba(255, 252, 235, 0.55)', 'screen');
  ink(ctx, flan, 1.2);
}

function owl(ctx: Ctx, x: number, y: number): void {
  const relief = ctx.createRadialGradient(x - 4, y - 8, 1, x, y, 16);
  relief.addColorStop(0, '#ffeaa8');
  relief.addColorStop(0.6, '#dcaa4e');
  relief.addColorStop(1, '#b0802f');
  const bird = new Path2D();
  bird.ellipse(x + 1.2, y + 3.5, 7.2, 9.6, 0.08, 0, Math.PI * 2);
  bird.ellipse(x, y - 6.4, 6.6, 5.8, 0, 0, Math.PI * 2);
  bird.moveTo(x - 5.6, y - 8.5);
  bird.lineTo(x - 4.8, y - 13.2);
  bird.lineTo(x - 2.2, y - 11.4);
  bird.closePath();
  bird.moveTo(x + 5.6, y - 8.5);
  bird.lineTo(x + 4.8, y - 13.2);
  bird.lineTo(x + 2.2, y - 11.4);
  bird.closePath();
  emboss(ctx, bird, relief, 0.65);
  // Eyes, beak, the wing and rows of breast feathers.
  for (const ex of [-2.6, 2.6]) {
    engrave(ctx, circle(x + ex, y - 6.6, 2.2), 0.45);
    ctx.fillStyle = 'rgba(60, 36, 10, 0.85)';
    ctx.fill(circle(x + ex, y - 6.6, 0.9));
    ctx.fillStyle = 'rgba(255, 250, 225, 0.9)';
    ctx.fill(circle(x + ex - 0.35, y - 7, 0.3));
  }
  const beak = new Path2D();
  beak.moveTo(x - 0.8, y - 4.6);
  beak.lineTo(x + 0.8, y - 4.6);
  beak.lineTo(x, y - 2.6);
  beak.closePath();
  emboss(ctx, beak, '#c3913b', 0.25);
  const wing = new Path2D();
  wing.moveTo(x + 3, y - 1.5);
  wing.quadraticCurveTo(x + 9.5, y + 3, x + 6.5, y + 12);
  wing.moveTo(x + 4.6, y + 2);
  wing.quadraticCurveTo(x + 7, y + 6, x + 5.6, y + 9.5);
  engrave(ctx, wing, 0.4);
  const breast = new Path2D();
  for (let row = 0; row < 4; row++) {
    for (let k = -1; k <= 1; k++) {
      const fx = x - 0.8 + k * 2.4 + (row % 2) * 1.2;
      const fy = y + 1 + row * 2.4;
      breast.moveTo(fx - 1, fy);
      breast.quadraticCurveTo(fx, fy + 1.1, fx + 1, fy);
    }
  }
  engrave(ctx, breast, 0.3);
  const feet = new Path2D();
  feet.moveTo(x - 1.6, y + 12.6);
  feet.lineTo(x - 1.6, y + 14.2);
  feet.moveTo(x + 2.6, y + 12.8);
  feet.lineTo(x + 2.6, y + 14.2);
  engrave(ctx, feet, 0.45);
  // An olive sprig over the shoulder.
  const stem = new Path2D();
  stem.moveTo(x - 9, y + 9);
  stem.quadraticCurveTo(x - 13.5, y - 1, x - 10.5, y - 11);
  engrave(ctx, stem, 0.45);
  for (const [lx, ly, a] of [
    [-12.4, 2, -2.3],
    [-12.6, -3.4, -0.9],
    [-11.8, -7.6, -2.5],
  ] as const) {
    emboss(ctx, leaf(x + lx, y + ly, 4.6, a), relief, 0.35);
  }
  emboss(ctx, circle(x - 9.2, y - 4.8, 1), relief, 0.3);
  // ΣΙΣ down the right side, as the mints did.
  ctx.font = '700 6px Georgia, "Times New Roman", serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ['Σ', 'Ι', 'Σ'].forEach((ch, i) => {
    const ty = y - 6 + i * 6;
    ctx.fillStyle = 'rgba(80, 50, 14, 0.8)';
    ctx.fillText(ch, x + 13.4, ty + 0.5);
    ctx.fillStyle = 'rgba(255, 244, 205, 0.8)';
    ctx.fillText(ch, x + 12.9, ty - 0.35);
    ctx.fillStyle = '#d9a74c';
    ctx.fillText(ch, x + 13.1, ty);
  });
}

function incuse(ctx: Ctx, x: number, y: number): void {
  const s = 13;
  const sq = new Path2D();
  sq.roundRect(x - s, y - s, s * 2, s * 2, 2);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-0.06);
  ctx.translate(-x, -y);
  ctx.fillStyle = '#a5752e';
  ctx.fill(sq);
  texture(ctx, sq, 0.4, 0.05, 9);
  // Sunk: shade gathers on the upper left inside, light on the lower right.
  innerEdge(ctx, sq, 'rgba(60, 36, 10, 0.8)', 1.4, 1.6, 1.4);
  innerEdge(ctx, sq, 'rgba(255, 236, 180, 0.6)', -0.8, -0.9, 0.8);
  ctx.font = '700 21px Georgia, "Times New Roman", serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(70, 42, 12, 0.85)';
  ctx.fillText('Σ', x + 0.7, y + 1.8);
  ctx.fillStyle = 'rgba(255, 242, 200, 0.85)';
  ctx.fillText('Σ', x - 0.5, y + 0.3);
  const letter = ctx.createLinearGradient(x - 8, y - 8, x + 8, y + 8);
  letter.addColorStop(0, '#fbe29a');
  letter.addColorStop(1, '#bd8a36');
  ctx.fillStyle = letter;
  ctx.fillText('Σ', x, y + 1);
  for (const [dx, dy] of [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ] as const) {
    emboss(ctx, circle(x + dx * (s - 3), y + dy * (s - 3), 1.1), '#e2b75c', 0.3);
  }
  ctx.restore();
}

// ---------------------------------------------------------------- sherds

/** What something breaks into: glazed figure-ware, plain clay, gold or stone. */
export interface SherdLook {
  kind: 'figure' | 'clay' | 'gold' | 'stone';
  fill: number;
  accent: number;
}

const SHERD_BOX = 48;
export const SHERD_R = 17;
const PEBBLE_BOX = 22;
export const PEBBLE_R = 7.5;

export function sherdTextures(look: SherdLook, count = 8): Texture[] {
  const out: Texture[] = [];
  for (let i = 0; i < count; i++) {
    out.push(bake(`sherd-${look.kind}-${look.fill}-${look.accent}-${i}`, SHERD_BOX, SHERD_BOX, (ctx) => paintSherd(ctx, look, i * 7 + 3, SHERD_BOX, SHERD_R), 3));
  }
  return out;
}

export function pebbleTextures(look: SherdLook, count = 5): Texture[] {
  const out: Texture[] = [];
  const stone = { ...look, kind: 'stone' as const };
  for (let i = 0; i < count; i++) {
    out.push(bake(`pebble-${look.fill}-${i}`, PEBBLE_BOX, PEBBLE_BOX, (ctx) => paintSherd(ctx, stone, i * 13 + 5, PEBBLE_BOX, PEBBLE_R), 4));
  }
  return out;
}

/** A broken outline: a few long fractures, each a little jagged. */
function fracture(r: () => number, cx: number, cy: number, R: number, jag: number): Pt[] {
  const n = 5 + Math.floor(r() * 3);
  const stretch = 1 + r() * 0.35;
  const turn = r() * Math.PI;
  const corners: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const a = ((i + (r() - 0.5) * 0.6) / n) * Math.PI * 2;
    const d = R * (0.6 + r() * 0.4);
    const x = Math.cos(a) * d * stretch;
    const y = Math.sin(a) * d;
    corners.push([cx + x * Math.cos(turn) - y * Math.sin(turn), cy + x * Math.sin(turn) + y * Math.cos(turn)]);
  }
  const pts: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const a = corners[i];
    const b = corners[(i + 1) % n];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const nx = -(b[1] - a[1]) / len;
    const ny = (b[0] - a[0]) / len;
    pts.push(a);
    for (const t of [0.33, 0.66]) {
      const j = (r() - 0.5) * jag * R;
      pts.push([a[0] + (b[0] - a[0]) * t + nx * j, a[1] + (b[1] - a[1]) * t + ny * j]);
    }
  }
  return pts;
}

function paintSherd(ctx: Ctx, look: SherdLook, seed: number, box: number, R: number): void {
  const r = rng(seed);
  const c = box / 2;
  const stone = look.kind === 'stone';
  const pts = fracture(r, c, c - R * 0.06, R, stone ? 0.16 : 0.1);
  const face = shape(pts, false);
  const depth = R * (stone ? 0.2 : look.kind === 'gold' ? 0.08 : 0.14);
  // The broken edge: the thickness of the wall or the body of the stone.
  const edge = stone ? mix(look.fill, 0x1c140e, 0.55) : look.kind === 'gold' ? 0x7a5420 : 0xd9905e;
  ctx.save();
  ctx.translate(depth * 0.35, depth);
  ctx.fillStyle = css(edge);
  ctx.fill(face);
  texture(ctx, face, 0.5, 0.06, seed);
  ctx.restore();
  ctx.save();
  ctx.translate(depth * 0.35, depth);
  ink(ctx, face, R * 0.06, 0.8);
  ctx.restore();

  if (look.kind === 'stone') paintFacets(ctx, pts, look, r, c, R);
  else if (look.kind === 'gold') paintGold(ctx, face, r, c, R);
  else if (look.kind === 'clay') paintClay(ctx, face, r, c, R);
  else paintFigure(ctx, face, r, c, R, seed);

  texture(ctx, face, stone ? 0.5 : 0.28, stone ? 0.07 : 0.05, seed + 1);
  if (stone) {
    speckle(ctx, face, r, Math.round(R * 2), [R * 0.015, R * 0.05], css(look.accent, 0.5), [c - R, c - R, c + R, c + R]);
    speckle(ctx, face, r, Math.round(R * 1.5), [R * 0.015, R * 0.045], 'rgba(30, 20, 14, 0.45)', [c - R, c - R, c + R, c + R]);
  } else if (look.kind !== 'gold') {
    // Flakes of glaze gone, showing the clay beneath.
    speckle(ctx, face, r, 6, [R * 0.02, R * 0.06], 'rgba(214, 140, 92, 0.6)', [c - R, c - R, c + R, c + R]);
  }
  model(ctx, face, R * 2, stone ? 0.35 : 0.3, 0.5);
  if (!stone) {
    // Gloss: glaze and gold catch a long streak of light across the curve.
    ctx.save();
    ctx.clip(face);
    ctx.filter = `blur(${R * 0.05 * ctx.getTransform().a}px)`;
    ctx.strokeStyle = look.kind === 'gold' ? 'rgba(255, 250, 225, 0.7)' : 'rgba(255, 246, 228, 0.42)';
    ctx.lineWidth = R * 0.12;
    const a = r() * Math.PI;
    ctx.beginPath();
    ctx.moveTo(c + Math.cos(a) * R - R * 0.3, c + Math.sin(a) * R - R * 0.3);
    ctx.quadraticCurveTo(c - R * 0.45, c - R * 0.45, c - Math.cos(a) * R - R * 0.3, c - Math.sin(a) * R - R * 0.3);
    ctx.stroke();
    ctx.restore();
  }
  ink(ctx, face, R * 0.065);
}

/** Stone: planes split from a ridge nearer the light, each lit by its facing. */
function paintFacets(ctx: Ctx, pts: Pt[], look: SherdLook, r: () => number, c: number, R: number): void {
  const peak: Pt = [c + LIGHT.x * R * 0.28 + (r() - 0.5) * R * 0.2, c + LIGHT.y * R * 0.28 + (r() - 0.5) * R * 0.2];
  const dark = mix(look.fill, 0x1c140e, 0.62);
  const lit = mix(look.fill, 0xfff6e6, 0.4);
  const corners = pts.filter((_, i) => i % 3 === 0);
  const facets = new Path2D();
  corners.forEach((a, i) => {
    const b = corners[(i + 1) % corners.length];
    const mx = (a[0] + b[0]) / 2 - peak[0];
    const my = (a[1] + b[1]) / 2 - peak[1];
    const l = Math.hypot(mx, my) || 1;
    const facing = -(mx * LIGHT.x + my * LIGHT.y) / l;
    const base = facing > 0 ? mix(look.fill, lit, facing) : mix(look.fill, dark, -facing * 0.85);
    // The facet itself runs through the jagged points between a and b.
    const tri = new Path2D();
    tri.moveTo(peak[0], peak[1]);
    const start = pts.indexOf(a);
    for (let k = 0; k <= 3; k++) {
      const p = pts[(start + k) % pts.length];
      tri.lineTo(p[0], p[1]);
    }
    tri.closePath();
    const g = ctx.createLinearGradient(peak[0], peak[1], (a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
    g.addColorStop(0, css(mix(base, 0xffffff, 0.12)));
    g.addColorStop(1, css(mix(base, 0x000000, 0.12 + r() * 0.1)));
    ctx.fillStyle = g;
    ctx.fill(tri);
    facets.moveTo(peak[0], peak[1]);
    facets.lineTo(a[0], a[1]);
  });
  ctx.strokeStyle = 'rgba(255, 244, 226, 0.28)';
  ctx.lineWidth = R * 0.035;
  ctx.stroke(facets);
  // A hairline crack.
  ctx.strokeStyle = 'rgba(28, 18, 12, 0.5)';
  ctx.lineWidth = R * 0.03;
  ctx.beginPath();
  let x = c + (r() - 0.5) * R;
  let y = c - R * 0.5;
  ctx.moveTo(x, y);
  for (let i = 0; i < 4; i++) {
    x += (r() - 0.5) * R * 0.4;
    y += R * 0.25;
    ctx.lineTo(x, y);
  }
  ctx.stroke();
}

function paintGold(ctx: Ctx, face: Path2D, r: () => number, c: number, R: number): void {
  const a = r() * Math.PI;
  const g = ctx.createLinearGradient(c - Math.cos(a) * R, c - Math.sin(a) * R, c + Math.cos(a) * R, c + Math.sin(a) * R);
  const stops = ['#fff3c0', '#d9a847', '#8e6220', '#f4d27a', '#b07c2c', '#fce7a6', '#7d5419'];
  stops.forEach((s, i) => g.addColorStop(i / (stops.length - 1), s));
  ctx.fillStyle = g;
  ctx.fill(face);
  ctx.save();
  ctx.clip(face);
  ctx.translate(c, c);
  ctx.rotate(a + Math.PI / 2);
  engrave(ctx, meander(-R * 1.4, R * 1.4, -R * 0.2, R * 0.3), R * 0.03, 'rgba(90, 58, 16, 0.75)', 'rgba(255, 244, 205, 0.6)');
  ctx.restore();
}

function paintClay(ctx: Ctx, face: Path2D, r: () => number, c: number, R: number): void {
  const g = ctx.createLinearGradient(c - R, c - R, c + R, c + R);
  g.addColorStop(0, '#e3a171');
  g.addColorStop(0.5, '#c8764a');
  g.addColorStop(1, '#94492a');
  ctx.fillStyle = g;
  ctx.fill(face);
  ctx.save();
  ctx.clip(face);
  ctx.translate(c, c);
  ctx.rotate(r() * Math.PI);
  ctx.fillStyle = GLAZE;
  ctx.fillRect(-R * 1.5, -R * 0.1, R * 3, R * 0.35);
  ctx.fillRect(-R * 1.5, R * 0.45, R * 3, R * 0.1);
  ctx.restore();
}

/** Black-figure ware: glaze with a piece of whatever band it broke through. */
function paintFigure(ctx: Ctx, face: Path2D, r: () => number, c: number, R: number, seed: number): void {
  const a = r() * Math.PI;
  const g = ctx.createLinearGradient(c - Math.cos(a) * R, c - Math.sin(a) * R, c + Math.cos(a) * R, c + Math.sin(a) * R);
  g.addColorStop(0, '#3d2f25');
  g.addColorStop(0.35, '#1b1411');
  g.addColorStop(0.6, '#120d0b');
  g.addColorStop(0.82, '#33271f');
  g.addColorStop(1, '#4a382b');
  ctx.fillStyle = g;
  ctx.fill(face);
  ctx.save();
  ctx.clip(face);
  ctx.translate(c + (r() - 0.5) * R * 0.5, c + (r() - 0.5) * R * 0.5);
  ctx.rotate(r() * Math.PI * 2);
  const band = seed % 5;
  if (band === 0) {
    // A run of meander.
    ctx.fillStyle = CLAY;
    ctx.fillRect(-R * 2, -R * 0.3, R * 4, R * 0.56);
    ctx.strokeStyle = GLAZE;
    ctx.lineWidth = R * 0.055;
    ctx.lineCap = 'square';
    ctx.stroke(meander(-R * 2, R * 2, -R * 0.24, R * 0.42));
  } else if (band === 1) {
    // Tongues, black and purple by turns.
    ctx.fillStyle = CLAY;
    ctx.fillRect(-R * 2, -R * 0.3, R * 4, R * 0.6);
    for (let i = -6; i <= 6; i++) {
      const x = i * R * 0.3;
      const t = new Path2D();
      t.moveTo(x - R * 0.12, -R * 0.26);
      t.lineTo(x + R * 0.12, -R * 0.26);
      t.lineTo(x + R * 0.12, R * 0.05);
      t.arc(x, R * 0.05, R * 0.12, 0, Math.PI);
      t.closePath();
      ctx.fillStyle = i % 2 ? PURPLE : GLAZE;
      ctx.fill(t);
    }
  } else if (band === 2) {
    // Rays rising from the foot.
    ctx.fillStyle = CLAY;
    ctx.fillRect(-R * 2, 0, R * 4, R * 2);
    ctx.fillStyle = GLAZE;
    for (let i = -5; i <= 5; i++) {
      const x = i * R * 0.34;
      ctx.beginPath();
      ctx.moveTo(x - R * 0.13, R * 2);
      ctx.lineTo(x, R * 0.12);
      ctx.lineTo(x + R * 0.13, R * 2);
      ctx.fill();
    }
  } else if (band === 3) {
    // A piece of the figured panel: a shield rim and a striding leg, incised.
    ctx.fillStyle = CLAY;
    ctx.fillRect(-R * 2, -R * 2, R * 4, R * 2.3);
    ctx.fillStyle = GLAZE;
    ctx.fill(circle(-R * 0.3, -R * 0.4, R * 0.62));
    ctx.strokeStyle = GLAZE;
    ctx.lineWidth = R * 0.2;
    ctx.beginPath();
    ctx.moveTo(R * 0.2, -R * 0.2);
    ctx.quadraticCurveTo(R * 0.6, R * 0.1, R * 0.5, R * 0.6);
    ctx.stroke();
    ctx.strokeStyle = CLAY;
    ctx.lineWidth = R * 0.03;
    ctx.stroke(circle(-R * 0.3, -R * 0.4, R * 0.45));
    ctx.fillStyle = PURPLE;
    ctx.fill(circle(-R * 0.3, -R * 0.4, R * 0.18));
  } else {
    // Reserved lines.
    ctx.strokeStyle = CLAY;
    ctx.lineWidth = R * 0.05;
    for (const y of [-R * 0.2, R * 0.05]) {
      ctx.beginPath();
      ctx.moveTo(-R * 2, y);
      ctx.lineTo(R * 2, y);
      ctx.stroke();
    }
  }
  ctx.restore();
}

// ------------------------------------------------------------------ dust

const DUST_BOX = 100;
/** Radius of a dust billow's body at scale 1, in world units. */
export const DUST_R = 30;

/** Billows of dust, near white so each hill can tint them. */
export function dustTextures(): Texture[] {
  return [0, 1, 2, 3].map((i) => bake(`dust-${i}`, DUST_BOX, DUST_BOX, (ctx) => paintDust(ctx, i * 17 + 2), 2));
}

function paintDust(ctx: Ctx, seed: number): void {
  const r = rng(seed);
  const c = DUST_BOX / 2;
  const res = ctx.getTransform().a;
  const lobes: [number, number, number][] = [];
  for (let i = 0; i < 8; i++) {
    const a = r() * Math.PI * 2;
    const d = r() * 16;
    lobes.push([c + Math.cos(a) * d * 1.3, c + Math.sin(a) * d * 0.8 - 2, 10 + r() * 11]);
  }
  // Bottom lobes first, so the upper ones billow over them.
  lobes.sort((a, b) => b[1] - a[1]);
  const body = new Path2D();
  for (const [x, y, rad] of lobes) body.addPath(circle(x, y, rad));
  ctx.save();
  ctx.filter = `blur(${2.2 * res}px)`;
  ctx.fillStyle = '#c9baa6';
  ctx.fill(body);
  ctx.restore();
  for (const [x, y, rad] of lobes) {
    const g = ctx.createRadialGradient(x + LIGHT.x * rad * 0.45, y + LIGHT.y * rad * 0.45, rad * 0.1, x, y, rad);
    g.addColorStop(0, '#fffdf8');
    g.addColorStop(0.55, '#efe4d4');
    g.addColorStop(1, 'rgba(206, 190, 170, 0.9)');
    ctx.save();
    ctx.filter = `blur(${0.9 * res}px)`;
    ctx.fillStyle = g;
    ctx.fill(circle(x, y, rad));
    ctx.restore();
  }
  // Shade gathers under the billow; the mottle gives it body.
  ctx.save();
  ctx.globalCompositeOperation = 'source-atop';
  const shade = ctx.createLinearGradient(0, c - 20, 0, c + 26);
  shade.addColorStop(0, 'rgba(120, 96, 72, 0)');
  shade.addColorStop(1, 'rgba(120, 96, 72, 0.45)');
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, DUST_BOX, DUST_BOX);
  ctx.restore();
  const all = new Path2D();
  all.rect(0, 0, DUST_BOX, DUST_BOX);
  ctx.save();
  ctx.globalCompositeOperation = 'source-atop';
  texture(ctx, all, 0.3, 0.09, seed, 'source-atop');
  ctx.restore();
}

// ---------------------------------------------------------------- targets

export const TARGET_W = 160;
export const TARGET_H = 160;
/** Where the ground sits in a target texture, as an anchor. */
export const TARGET_ANCHOR = { x: 0.5, y: 150 / TARGET_H };

export function targetTexture(kind: string): Texture {
  return bake(`target-${kind}`, TARGET_W, TARGET_H, (ctx) => {
    ctx.translate(TARGET_W / 2, 150);
    if (kind === 'coin_amphora') amphora(ctx);
    else if (kind === 'gilded_offering') tripod(ctx);
    else {
      ctx.scale(1.2, 1.2);
      heap(ctx);
    }
  }, 3);
}

/** Draw an obol lying at an angle: `tilt` 1 is face-on, near 0 edge-on. */
function coinAt(ctx: Ctx, x: number, y: number, r: number, tilt: number, rot: number, side: 'face' | 'back' = 'face'): void {
  const img = canvasOf(obolTexture(side));
  const k = obolScale(r);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.scale(1, tilt);
  ctx.drawImage(img, -OBOL_BOX / 2 * k, -OBOL_BOX / 2 * k, OBOL_BOX * k, (OBOL_BOX + 2) * k);
  ctx.restore();
}

/** A heap of obols, back rows first. */
function hoard(ctx: Ctx, rows: [number, number, number][], r: () => number): void {
  for (const [y, count, spread] of rows) {
    for (let i = 0; i < count; i++) {
      const x = count === 1 ? 0 : -spread + (i / (count - 1)) * spread * 2 + (r() - 0.5) * 2;
      coinAt(ctx, x, y + (r() - 0.5) * 1.6, 6 + r() * 0.8, 0.42 + r() * 0.5, (r() - 0.5) * 0.9, r() < 0.3 ? 'back' : 'face');
    }
  }
}

/** A black-figure neck amphora, Sisyphus and his stone on the panel, brimming with obols. */
function amphora(ctx: Ctx): void {
  const r = rng(21);
  groundShadow(ctx, 2, -1, 48, 8, 0.5);
  const right: Pt[] = [
    [11, -120],
    [11.5, -109],
    [14.5, -100],
    [27, -92],
    [37.5, -80],
    [41, -64],
    [39, -48],
    [32, -33],
    [22, -21],
    [12.5, -12.5],
    [10, -8],
  ];
  const body = new Path2D();
  body.moveTo(right[0][0], right[0][1]);
  spline(body, right);
  body.lineTo(17, -6.5);
  body.quadraticCurveTo(20, -5.5, 19.5, -1.5);
  body.lineTo(19, 0);
  body.lineTo(-19, 0);
  body.lineTo(-19.5, -1.5);
  body.quadraticCurveTo(-20, -5.5, -17, -6.5);
  body.lineTo(-10, -8);
  spline(
    body,
    [...right].reverse().map(([x, y]) => [-x, y] as Pt),
  );
  body.closePath();

  // Handles behind the shoulders.
  for (const s of [-1, 1]) {
    const h = new Path2D();
    h.moveTo(s * 11, -113);
    h.bezierCurveTo(s * 30, -121, s * 38, -108, s * 31, -90);
    ctx.strokeStyle = 'rgba(33, 27, 23, 1)';
    ctx.lineWidth = 7.5;
    ctx.stroke(h);
    ctx.strokeStyle = GLAZE;
    ctx.lineWidth = 5.2;
    ctx.stroke(h);
    ctx.save();
    ctx.translate(-0.9, -1);
    ctx.strokeStyle = 'rgba(255, 236, 214, 0.28)';
    ctx.lineWidth = 1.2;
    ctx.stroke(h);
    ctx.restore();
  }

  // The glaze: dark and deep, with a broad reflection down the lit side.
  const glaze = ctx.createLinearGradient(-42, 0, 42, 0);
  glaze.addColorStop(0, '#3a2c23');
  glaze.addColorStop(0.16, '#5b473a');
  glaze.addColorStop(0.3, '#221915');
  glaze.addColorStop(0.62, '#110c0a');
  glaze.addColorStop(0.9, '#261b15');
  glaze.addColorStop(1, '#433127');
  ctx.fillStyle = glaze;
  ctx.fill(body);

  ctx.save();
  ctx.clip(body);
  // Shoulder tongues.
  ctx.fillStyle = CLAY;
  ctx.fillRect(-40, -97, 80, 9.5);
  for (let i = -8; i <= 8; i++) {
    const x = i * 4.8;
    const t = new Path2D();
    t.moveTo(x - 1.9, -97);
    t.lineTo(x + 1.9, -97);
    t.lineTo(x + 1.9, -92);
    t.arc(x, -92, 1.9, 0, Math.PI);
    t.closePath();
    ctx.fillStyle = i % 2 ? PURPLE : GLAZE;
    ctx.fill(t);
  }
  ctx.fillStyle = GLAZE;
  ctx.fillRect(-40, -87.8, 80, 1.1);
  // The figured panel.
  const panel = new Path2D();
  panel.moveTo(-26, -81);
  panel.quadraticCurveTo(0, -83.5, 26, -81);
  panel.lineTo(27, -44);
  panel.quadraticCurveTo(0, -41.5, -27, -44);
  panel.closePath();
  const pg = ctx.createLinearGradient(-27, 0, 27, 0);
  pg.addColorStop(0, '#a9532c');
  pg.addColorStop(0.3, '#d98049');
  pg.addColorStop(0.7, '#c46a3a');
  pg.addColorStop(1, '#8f4424');
  ctx.fillStyle = pg;
  ctx.fill(panel);
  ctx.save();
  ctx.clip(panel);
  sisyphusPanel(ctx);
  ctx.restore();
  ctx.strokeStyle = GLAZE;
  ctx.lineWidth = 0.8;
  ctx.stroke(panel);
  // Meander below the panel, then rays above the foot.
  ctx.fillStyle = CLAY;
  ctx.fillRect(-40, -39.5, 80, 6.2);
  ctx.strokeStyle = GLAZE;
  ctx.lineWidth = 0.8;
  ctx.lineCap = 'square';
  ctx.stroke(meander(-40, 40, -38.7, 4.6));
  ctx.lineCap = 'round';
  ctx.fillStyle = CLAY;
  ctx.fillRect(-40, -25, 80, 12);
  ctx.fillStyle = GLAZE;
  for (let i = -8; i <= 8; i++) {
    ctx.beginPath();
    ctx.moveTo(i * 3.6 - 1.5, -13);
    ctx.lineTo(i * 3.6, -24.5);
    ctx.lineTo(i * 3.6 + 1.5, -13);
    ctx.fill();
  }
  ctx.fillRect(-40, -13.2, 80, 1);
  // Reserved foot edge and a lotus on the neck.
  ctx.fillStyle = CLAY;
  ctx.fillRect(-20, -2.2, 40, 1.2);
  const lotus = new Path2D();
  for (let k = -2; k <= 2; k++) lotus.addPath(leaf(0, -101, 7 - Math.abs(k), -Math.PI / 2 + k * 0.38, 0.26));
  ctx.fillStyle = CLAY;
  ctx.fill(lotus);
  ctx.fillRect(-12, -101.5, 24, 1);
  ctx.restore();

  texture(ctx, body, 0.28, 0.06, 21);
  speckle(ctx, body, r, 26, [0.2, 0.6], 'rgba(200, 120, 72, 0.5)', [-40, -120, 40, 0]);
  model(ctx, body, 60, 0.3, 0.6);
  // The reflections that make it glazed: a long streak and a hot spot on
  // the lit shoulder, and warm bounce on the far side.
  ctx.save();
  ctx.clip(body);
  ctx.filter = `blur(${1.6 * ctx.getTransform().a}px)`;
  ctx.strokeStyle = 'rgba(255, 246, 230, 0.55)';
  ctx.lineWidth = 3.2;
  ctx.beginPath();
  ctx.moveTo(-22, -95);
  ctx.quadraticCurveTo(-35, -66, -26, -34);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255, 214, 170, 0.25)';
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(34, -84);
  ctx.quadraticCurveTo(40, -62, 31, -38);
  ctx.stroke();
  ctx.restore();
  wash(ctx, body, -21, -89, 7, 'rgba(255, 252, 240, 0.7)', 'screen');
  ink(ctx, body, 1.3);

  // The lip, with the hoard spilling out of the mouth.
  const lip = new Path2D();
  lip.roundRect(-16.5, -128, 33, 7.5, 2.4);
  const lg = ctx.createLinearGradient(0, -128, 0, -120);
  lg.addColorStop(0, '#5c483a');
  lg.addColorStop(0.4, '#221915');
  lg.addColorStop(1, '#0f0b09');
  ctx.fillStyle = lg;
  ctx.fill(lip);
  ctx.fillStyle = CLAY;
  ctx.fillRect(-16, -122.8, 32, 0.8);
  ink(ctx, lip, 1.1);
  hoard(
    ctx,
    [
      [-129, 5, 11],
      [-133, 4, 8],
      [-137.5, 3, 5],
      [-141.5, 1, 0],
    ],
    r,
  );
  glint(ctx, -4, -139, 7, 0.9);
  glint(ctx, 9, -131, 4.5, 0.7);
}

/** Sisyphus and his stone in black figure on the clay panel. */
function sisyphusPanel(ctx: Ctx): void {
  ctx.fillStyle = GLAZE;
  ctx.strokeStyle = GLAZE;
  // The slope he climbs.
  ctx.beginPath();
  ctx.moveTo(-27, -46);
  ctx.lineTo(27, -55);
  ctx.lineTo(27, -40);
  ctx.lineTo(-27, -40);
  ctx.fill();
  // The stone, with an incised spiral.
  ctx.fill(circle(11, -62.5, 8));
  ctx.strokeStyle = CLAY;
  ctx.lineWidth = 0.4;
  ctx.beginPath();
  for (let t = 0; t < 14; t += 0.2) ctx.lineTo(11 + Math.cos(t) * t * 0.45, -62.5 + Math.sin(t) * t * 0.45);
  ctx.stroke();
  // The man, leaning into it.
  ctx.strokeStyle = GLAZE;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-8, -64);
  ctx.lineTo(-13.5, -57.5);
  ctx.lineTo(-19, -49.4);
  ctx.moveTo(-7, -64);
  ctx.lineTo(-3, -58.5);
  ctx.lineTo(-6.5, -51);
  ctx.stroke();
  ctx.lineWidth = 5.2;
  ctx.beginPath();
  ctx.moveTo(-7.5, -64);
  ctx.lineTo(-1, -72.5);
  ctx.stroke();
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(-1, -72.5);
  ctx.lineTo(3.4, -69);
  ctx.lineTo(3.8, -64);
  ctx.moveTo(-0.5, -71.5);
  ctx.lineTo(4.4, -70.5);
  ctx.lineTo(5, -67.5);
  ctx.stroke();
  ctx.fill(circle(1.2, -76.5, 2.9));
  ctx.beginPath();
  ctx.moveTo(2.5, -75);
  ctx.lineTo(5.2, -73.5);
  ctx.lineTo(2.2, -72.6);
  ctx.fill();
  // Incised detail and purple for the fillet and chiton border.
  ctx.strokeStyle = CLAY;
  ctx.lineWidth = 0.35;
  ctx.beginPath();
  ctx.moveTo(-5.5, -67);
  ctx.lineTo(-2.6, -70.4);
  ctx.moveTo(-6.4, -65.5);
  ctx.lineTo(-3.8, -68.6);
  ctx.moveTo(-13.2, -58.3);
  ctx.lineTo(-12.2, -57);
  ctx.moveTo(-3.4, -59.3);
  ctx.lineTo(-2.4, -58);
  ctx.stroke();
  ctx.fillStyle = CLAY;
  ctx.fill(circle(2.4, -77.2, 0.45));
  ctx.strokeStyle = PURPLE;
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(-1.5, -78.2);
  ctx.lineTo(3.5, -77.8);
  ctx.stroke();
}

/** A bronze tripod cauldron, heaped with gold. */
function tripod(ctx: Ctx): void {
  const r = rng(33);
  groundShadow(ctx, 0, -1, 54, 8, 0.5);
  const bronze = (x0: number, x1: number) => {
    const g = ctx.createLinearGradient(x0, 0, x1, 0);
    g.addColorStop(0, '#f1c878');
    g.addColorStop(0.35, '#b5823a');
    g.addColorStop(0.75, '#6e4719');
    g.addColorStop(1, '#3d2610');
    return g;
  };
  // Legs, the back one first; each ends in a lion's paw.
  for (const [top, foot, back] of [
    [[0, -40], [2, -3], true],
    [[-27, -46], [-44, -2], false],
    [[27, -46], [44, -2], false],
  ] as [Pt, Pt, boolean][]) {
    const w0 = 3.2;
    const w1 = 2.2;
    const leg = new Path2D();
    leg.moveTo(top[0] - w0, top[1]);
    leg.lineTo(top[0] + w0, top[1]);
    leg.lineTo(foot[0] + w1, foot[1] - 3);
    leg.lineTo(foot[0] - w1, foot[1] - 3);
    leg.closePath();
    ctx.fillStyle = bronze(Math.min(top[0], foot[0]) - 3, Math.max(top[0], foot[0]) + 3);
    ctx.fill(leg);
    if (back) {
      ctx.fillStyle = 'rgba(30, 18, 8, 0.45)';
      ctx.fill(leg);
    }
    const paw = new Path2D();
    paw.ellipse(foot[0], foot[1] - 2, 5.2, 2.8, 0, 0, Math.PI * 2);
    ctx.fillStyle = bronze(foot[0] - 5, foot[0] + 5);
    ctx.fill(paw);
    engrave(ctx, new Path2D(`M ${foot[0] - 1.8} ${foot[1] - 3.5} l 0 2.5 M ${foot[0] + 0.2} ${foot[1] - 4} l 0 3 M ${foot[0] + 2.2} ${foot[1] - 3.5} l 0 2.5`), 0.35);
    texture(ctx, leg, 0.4, 0.06, 5);
    ink(ctx, leg, 0.9);
    ink(ctx, paw, 0.9);
  }
  // Ring handles standing on the rim.
  for (const x of [-31, 31]) {
    const ring = circle(x, -93, 9);
    ctx.strokeStyle = 'rgba(33, 27, 23, 1)';
    ctx.lineWidth = 5;
    ctx.stroke(ring);
    const rg = ctx.createLinearGradient(x - 9, -102, x + 9, -84);
    rg.addColorStop(0, '#ffe2a0');
    rg.addColorStop(0.5, '#b07a34');
    rg.addColorStop(1, '#4e3212');
    ctx.strokeStyle = rg;
    ctx.lineWidth = 3.2;
    ctx.stroke(ring);
    ctx.strokeStyle = 'rgba(255, 248, 225, 0.7)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.arc(x, -93, 9, Math.PI * 1.05, Math.PI * 1.45);
    ctx.stroke();
  }
  // The gold, heaped above the rim.
  hoard(
    ctx,
    [
      [-84, 9, 36],
      [-89, 8, 30],
      [-94.5, 6, 22],
      [-100, 4, 14],
      [-105, 2, 6],
      [-109, 1, 0],
    ],
    r,
  );
  // The bowl.
  const bowl = new Path2D();
  bowl.moveTo(-46, -81);
  bowl.lineTo(46, -81);
  bowl.bezierCurveTo(46, -55, 28, -37, 0, -37);
  bowl.bezierCurveTo(-28, -37, -46, -55, -46, -81);
  bowl.closePath();
  const bg = ctx.createRadialGradient(-17, -71, 2, -4, -60, 58);
  bg.addColorStop(0, '#ffe3a4');
  bg.addColorStop(0.18, '#dca651');
  bg.addColorStop(0.48, '#a8742f');
  bg.addColorStop(0.78, '#664117');
  bg.addColorStop(1, '#3a240e');
  ctx.fillStyle = bg;
  ctx.fill(bowl);
  texture(ctx, bowl, 0.45, 0.06, 33);
  // Patina in the hollows and the engraved band under the rim.
  speckle(ctx, bowl, r, 90, [0.3, 1.2], 'rgba(92, 142, 122, 0.4)', [-46, -62, 46, -37]);
  speckle(ctx, bowl, r, 40, [0.2, 0.7], 'rgba(92, 142, 122, 0.3)', [-46, -80, 46, -60]);
  ctx.save();
  ctx.clip(bowl);
  engrave(ctx, meander(-44, 44, -76.5, 5.2), 0.55);
  engrave(ctx, new Path2D('M -46 -70 L 46 -70 M -46 -77.5 L 46 -77.5'), 0.45);
  ctx.restore();
  model(ctx, bowl, 60, 0.35, 0.55);
  wash(ctx, bowl, -20, -70, 9, 'rgba(255, 250, 230, 0.75)', 'screen');
  ink(ctx, bowl, 1.3);
  // The thick rim.
  const lip = new Path2D();
  lip.roundRect(-49.5, -85, 99, 5.5, 2.7);
  const rg = ctx.createLinearGradient(0, -85, 0, -79.5);
  rg.addColorStop(0, '#ffe7ae');
  rg.addColorStop(0.45, '#c08a3c');
  rg.addColorStop(1, '#5a3814');
  ctx.fillStyle = rg;
  ctx.fill(lip);
  texture(ctx, lip, 0.35, 0.05, 34);
  ink(ctx, lip, 1);
  glint(ctx, -6, -104, 8, 0.95);
  glint(ctx, 18, -92, 5, 0.75);
  glint(ctx, -24, -79, 5.5, 0.8);
}

/** A heap of broken stone and pot sherds. */
function heap(ctx: Ctx): void {
  const r = rng(51);
  groundShadow(ctx, 0, -1, 62, 9, 0.5);
  const stone: SherdLook = { kind: 'stone', fill: 0x927a5e, accent: 0xd8c29e };
  const rock = (x: number, y: number, R: number, seed: number, squash = 0.72) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(1, squash);
    ctx.translate(-R * 1.4, -R * 1.4);
    // Paint at this size with the sherd painter, into a fitted box.
    paintSherd(ctx, stone, seed, R * 2.8, R);
    ctx.restore();
  };
  const sherd = (x: number, y: number, R: number, seed: number, rot: number, kind: SherdLook['kind']) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.scale(1, 0.62);
    ctx.translate(-R * 1.4, -R * 1.4);
    paintSherd(ctx, { kind, fill: 0, accent: 0 }, seed, R * 2.8, R);
    ctx.restore();
  };
  rock(-30, -14, 21, 4);
  rock(34, -11, 16, 9);
  sherd(-52, -6, 10, 13, -0.3, 'figure');
  rock(4, -20, 26, 2);
  rock(-14, -38, 17, 7, 0.8);
  sherd(22, -34, 11, 5, 0.5, 'figure');
  rock(46, -26, 9, 12, 0.85);
  sherd(-40, -34, 8, 8, 1.2, 'clay');
  for (let i = 0; i < 9; i++) {
    const x = -56 + r() * 112;
    rock(x, -2 - r() * 3, 3 + r() * 2.5, 30 + i, 0.8);
  }
}

// -------------------------------------------------------------- machinery

/** A timber post `h` tall (world units), plumb; stained and bronze-collared once braced. */
export function postTexture(h: number, braced: boolean): Texture {
  return bake(`post-${Math.round(h)}-${braced}`, 18, h + 6, (ctx) => paintPost(ctx, h, braced), 3);
}

/** Anchor that puts a post's foot on its point. */
export const postAnchor = (h: number) => ({ x: 0.5, y: (h + 3) / (h + 6) });

function woodGrad(ctx: Ctx, x0: number, x1: number, stained: boolean): CanvasGradient {
  const g = ctx.createLinearGradient(x0, 0, x1, 0);
  const tone = (c: number) => css(stained ? mix(c, 0x2c1a0e, 0.42) : c);
  g.addColorStop(0, tone(0x5a351b));
  g.addColorStop(0.18, tone(0xa06a3b));
  g.addColorStop(0.38, tone(0xd6a066));
  g.addColorStop(0.62, tone(0xb07a45));
  g.addColorStop(0.86, tone(0x7a4a26));
  g.addColorStop(1, tone(0x472813));
  return g;
}

function paintPost(ctx: Ctx, h: number, braced: boolean): void {
  const r = rng(Math.round(h) + (braced ? 1 : 0));
  const x0 = 4;
  const w = 10;
  const body = new Path2D();
  body.roundRect(x0, 3, w, h, [3.5, 3.5, 0.5, 0.5]);
  ctx.fillStyle = woodGrad(ctx, x0, x0 + w, braced);
  ctx.fill(body);
  // Grain: long wavering lines, a knot, and checks where it dried.
  ctx.save();
  ctx.clip(body);
  for (let i = 0; i < 11; i++) {
    const x = x0 + 0.6 + r() * (w - 1.2);
    ctx.strokeStyle = r() < 0.7 ? `rgba(55, 28, 10, ${0.2 + r() * 0.25})` : `rgba(255, 222, 170, ${0.12 + r() * 0.15})`;
    ctx.lineWidth = 0.25 + r() * 0.5;
    ctx.beginPath();
    ctx.moveTo(x, 3);
    let y = 3;
    let xx = x;
    while (y < h + 3) {
      const step = 8 + r() * 14;
      xx += (r() - 0.5) * 0.8;
      ctx.quadraticCurveTo(xx + (r() - 0.5) * 1.2, y + step / 2, xx, y + step);
      y += step;
    }
    ctx.stroke();
  }
  for (let k = 0; k < 2; k++) {
    const ky = 20 + r() * (h - 40);
    const kx = x0 + 3 + r() * 4;
    ctx.fillStyle = 'rgba(58, 30, 12, 0.55)';
    ctx.beginPath();
    ctx.ellipse(kx, ky, 1.3, 2.4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(58, 30, 12, 0.35)';
    ctx.lineWidth = 0.35;
    ctx.beginPath();
    ctx.ellipse(kx, ky, 2.3, 4.6, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(30, 14, 4, 0.55)';
  ctx.lineWidth = 0.35;
  for (let k = 0; k < 3; k++) {
    const cy = 10 + r() * (h - 20);
    const cx = x0 + 2 + r() * 6;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + (r() - 0.5), cy + 6 + r() * 10);
    ctx.stroke();
  }
  ctx.restore();
  texture(ctx, body, 0.42, 0.06, h);
  // End grain on the weathered top.
  const top = new Path2D();
  top.ellipse(x0 + w / 2, 4.6, w / 2 - 0.6, 1.5, 0, 0, Math.PI * 2);
  ctx.fillStyle = css(braced ? 0x9a7048 : 0xe0b07a);
  ctx.fill(top);
  ctx.strokeStyle = 'rgba(80, 44, 18, 0.5)';
  ctx.lineWidth = 0.25;
  ctx.stroke(new Path2D(`M ${x0 + 2} 4.6 a 3 0.8 0 1 0 6 0 a 3 0.8 0 1 0 -6 0`));
  model(ctx, body, w, 0.25, 0.45);
  ink(ctx, body, 0.9);
  if (braced) {
    for (const t of [0.25, 0.6]) {
      const y = 3 + h - h * t;
      const band = new Path2D();
      band.roundRect(x0 - 0.8, y - 2.4, w + 1.6, 4.8, 1.2);
      const g = ctx.createLinearGradient(x0 - 1, 0, x0 + w + 1, 0);
      g.addColorStop(0, '#6a4416');
      g.addColorStop(0.3, '#f0c877');
      g.addColorStop(0.55, '#b8843b');
      g.addColorStop(1, '#4a2e10');
      ctx.fillStyle = g;
      ctx.fill(band);
      texture(ctx, band, 0.4, 0.05, y);
      speckle(ctx, band, r, 8, [0.2, 0.5], 'rgba(92, 142, 122, 0.45)', [x0, y - 2.4, x0 + w, y + 2.4]);
      for (const rx of [x0 + 2.2, x0 + w - 2.2]) emboss(ctx, circle(rx, y, 0.9), '#e6b862', 0.3);
      ink(ctx, band, 0.7);
    }
  }
}

/** A plank, 100 × 8 units along x, to stretch and turn into braces and legs. */
export function plankTexture(stained: boolean): Texture {
  return bake(`plank-${stained}`, 100, 8, (ctx) => {
    const r = rng(stained ? 71 : 72);
    const board = new Path2D();
    board.roundRect(0.5, 1, 99, 6, 1.2);
    const g = ctx.createLinearGradient(0, 1, 0, 7);
    const tone = (c: number) => css(stained ? mix(c, 0x2c1a0e, 0.42) : c);
    g.addColorStop(0, tone(0xd9a46a));
    g.addColorStop(0.45, tone(0xb07a45));
    g.addColorStop(1, tone(0x5a351b));
    ctx.fillStyle = g;
    ctx.fill(board);
    ctx.save();
    ctx.clip(board);
    for (let i = 0; i < 7; i++) {
      const y = 1.4 + r() * 5.2;
      ctx.strokeStyle = `rgba(55, 28, 10, ${0.2 + r() * 0.25})`;
      ctx.lineWidth = 0.2 + r() * 0.35;
      ctx.beginPath();
      ctx.moveTo(0, y);
      for (let x = 10; x <= 100; x += 10) ctx.lineTo(x, y + (r() - 0.5) * 0.5);
      ctx.stroke();
    }
    ctx.restore();
    texture(ctx, board, 0.4, 0.06, stained ? 3 : 4);
    ink(ctx, board, 0.7);
  }, 3);
}

/** A cast bronze sheave of radius `R`: grooved rim, spokes and a riveted hub. */
export function sheaveTexture(R: number): Texture {
  const box = R * 2 + 4;
  return bake(`sheave-${R}`, box, box, (ctx) => paintSheave(ctx, R, box / 2), 6);
}

/** Fixed light over a turning sheave, so its shading does not turn with it. */
export function sheaveLight(R: number): Texture {
  const box = R * 2 + 4;
  return bake(`sheave-light-${R}`, box, box, (ctx) => {
    const c = box / 2;
    const disc = circle(c, c, R);
    ctx.save();
    ctx.clip(disc);
    const g = ctx.createLinearGradient(c + LIGHT.x * R, c + LIGHT.y * R, c - LIGHT.x * R, c - LIGHT.y * R);
    g.addColorStop(0, 'rgba(255, 246, 214, 0.5)');
    g.addColorStop(0.45, 'rgba(255, 246, 214, 0)');
    g.addColorStop(0.6, 'rgba(33, 20, 10, 0)');
    g.addColorStop(1, 'rgba(33, 20, 10, 0.55)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, box, box);
    ctx.restore();
    wash(ctx, disc, c - R * 0.45, c - R * 0.5, R * 0.35, 'rgba(255, 252, 235, 0.6)', 'screen');
  }, 6);
}

function paintSheave(ctx: Ctx, R: number, c: number): void {
  const r = rng(R * 10);
  const metal = (inner: number) => {
    const g = ctx.createRadialGradient(c, c, R * inner, c, c, R);
    g.addColorStop(0, '#e8bb66');
    g.addColorStop(0.5, '#b4823b');
    g.addColorStop(1, '#6b4417');
    return g;
  };
  const rim = new Path2D();
  rim.arc(c, c, R, 0, Math.PI * 2);
  rim.arc(c, c, R * 0.66, 0, Math.PI * 2, true);
  ctx.fillStyle = metal(0.6);
  ctx.fill(rim, 'evenodd');
  // The rope groove.
  ctx.strokeStyle = 'rgba(40, 24, 8, 0.85)';
  ctx.lineWidth = R * 0.13;
  ctx.stroke(circle(c, c, R * 0.84));
  ctx.strokeStyle = 'rgba(255, 232, 170, 0.45)';
  ctx.lineWidth = R * 0.04;
  ctx.stroke(circle(c, c, R * 0.76));
  // Spokes and hub.
  const spokes = new Path2D();
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2;
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    const w0 = R * 0.1;
    const w1 = R * 0.07;
    spokes.moveTo(c + ca * R * 0.25 - sa * w0, c + sa * R * 0.25 + ca * w0);
    spokes.lineTo(c + ca * R * 0.7 - sa * w1, c + sa * R * 0.7 + ca * w1);
    spokes.lineTo(c + ca * R * 0.7 + sa * w1, c + sa * R * 0.7 - ca * w1);
    spokes.lineTo(c + ca * R * 0.25 + sa * w0, c + sa * R * 0.25 - ca * w0);
    spokes.closePath();
  }
  ctx.fillStyle = metal(0.2);
  ctx.fill(spokes);
  const hub = circle(c, c, R * 0.3);
  ctx.fillStyle = metal(0);
  ctx.fill(hub);
  const all = new Path2D();
  all.addPath(rim);
  all.addPath(spokes);
  all.addPath(hub);
  texture(ctx, circle(c, c, R), 0.4, 0.04, R);
  speckle(ctx, rim, r, Math.round(R * 3), [R * 0.02, R * 0.06], 'rgba(92, 142, 122, 0.45)', [c - R, c - R, c + R, c + R]);
  ink(ctx, rim, R * 0.07);
  ink(ctx, spokes, R * 0.05);
  ink(ctx, hub, R * 0.06);
  emboss(ctx, circle(c, c, R * 0.13), '#f1c878', R * 0.035);
  for (let k = 0; k < 6; k++) {
    const a = ((k + 0.5) / 6) * Math.PI * 2;
    emboss(ctx, circle(c + Math.cos(a) * R * 0.2, c + Math.sin(a) * R * 0.2, R * 0.04), '#dcae5c', R * 0.02);
  }
}
