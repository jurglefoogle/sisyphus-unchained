import type { Texture } from 'pixi.js';
import { bake, canvasOf, emboss, engrave, glint, ink, innerEdge, LIGHT, mix, model, rng, shape, speckle, texture, wash, type Ctx } from './paint';
import { dustTextures, obolTexture, pebbleTextures, sherdTextures, type SherdLook, TARGET_H, TARGET_W, targetTexture } from './painted';

/**
 * Painted pieces for the reward moments: laurel leaves, gilded stars,
 * black-figure ray bursts, Zeus's decree seal, the six relics, and the
 * fragments a waiting target breaks into (cut from its own painting, so the
 * vase really comes apart). Painted once and cached, like painted.ts.
 */

type Pt = [number, number];

const GLAZE = '#1a1310';

function circle(x: number, y: number, r: number): Path2D {
  const p = new Path2D();
  p.arc(x, y, r, 0, Math.PI * 2);
  return p;
}

/** A band along a polyline, `w0` wide at the start tapering to `w1`. */
function ribbon(pts: Pt[], w0: number, w1: number): Path2D {
  const left: Pt[] = [];
  const right: Pt[] = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(pts.length - 1, i + 1)];
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const l = Math.hypot(dx, dy) || 1;
    const w = (w0 + (w1 - w0) * (i / (pts.length - 1))) / 2;
    left.push([pts[i][0] - (dy / l) * w, pts[i][1] + (dx / l) * w]);
    right.push([pts[i][0] + (dy / l) * w, pts[i][1] - (dx / l) * w]);
  }
  return shape([...left, ...right.reverse()], false);
}

/** Colour a facet by how squarely it faces the light (`a` is its outward angle). */
function facet(a: number, dark: number, mid: number, light: number): string {
  const b = (Math.cos(a) * LIGHT.x + Math.sin(a) * LIGHT.y + 1) / 2;
  const c = b < 0.5 ? mix(dark, mid, b * 2) : mix(mid, light, (b - 0.5) * 2);
  return `#${c.toString(16).padStart(6, '0')}`;
}

/** Zeus's thunderbolt: a spindle pinched at the grip, with forked bolts at each end. */
function keraunos(cx: number, cy: number, len: number, w: number): Path2D {
  const h = len / 2;
  const p = new Path2D();
  p.addPath(
    shape(
      [
        [cx, cy - h],
        [cx + w * 0.45, cy - h * 0.55],
        [cx + w * 0.8, cy - h * 0.18],
        [cx + w * 0.3, cy],
        [cx + w * 0.8, cy + h * 0.18],
        [cx + w * 0.45, cy + h * 0.55],
        [cx, cy + h],
        [cx - w * 0.45, cy + h * 0.55],
        [cx - w * 0.8, cy + h * 0.18],
        [cx - w * 0.3, cy],
        [cx - w * 0.8, cy - h * 0.18],
        [cx - w * 0.45, cy - h * 0.55],
      ],
      false,
    ),
  );
  for (const s of [-1, 1]) {
    for (const side of [-1, 1]) {
      const x = cx + side * w * 0.55;
      const y = cy + s * h * 0.2;
      p.addPath(
        ribbon(
          [
            [x, y],
            [x + side * w * 1.1, y + s * h * 0.18],
            [x + side * w * 0.55, y + s * h * 0.3],
            [x + side * w * 1.55, y + s * h * 0.62],
          ],
          w * 0.34,
          0.1,
        ),
      );
    }
  }
  return p;
}

/** A ring of raised beads, the border of a seal or a coin. */
function beads(ctx: Ctx, cx: number, cy: number, r: number, n: number, size: number, face: string): void {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    emboss(ctx, circle(cx + Math.cos(a) * r, cy + Math.sin(a) * r, size), face, size * 0.4);
  }
}

/** A disc that is not quite round: a flan, a blob of wax, a seal. */
function lumpy(cx: number, cy: number, R: number, r: () => number, amount: number, n = 36): Path2D {
  const pts: Pt[] = [];
  const p1 = r() * 6;
  const p2 = r() * 6;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const k = 1 + (Math.sin(a * 3 + p1) * 0.5 + Math.sin(a * 5 + p2) * 0.35 + (r() - 0.5) * 0.4) * amount;
    pts.push([cx + Math.cos(a) * R * k, cy + Math.sin(a) * R * k]);
  }
  return shape(pts);
}

// ----------------------------------------------------------------- laurel

const LEAF_W = 26;
const LEAF_H = 12;
/** A painted leaf's length in its texture, tip to stem. */
export const LEAF_LEN = 24;

/** Laurel for a victor: hammered gold or dark bay, a few curves of each. */
export function leafTextures(kind: 'gold' | 'bay'): Texture[] {
  return [0, 1, 2, 3].map((i) => bake(`leaf-${kind}-${i}`, LEAF_W, LEAF_H, (ctx) => paintLeaf(ctx, kind, i), 5));
}

function paintLeaf(ctx: Ctx, kind: 'gold' | 'bay', seed: number): void {
  const r = rng(seed * 31 + (kind === 'gold' ? 3 : 5));
  const x0 = 1.5;
  const x1 = 24.5;
  const cy = LEAF_H / 2;
  const bend = (r() - 0.5) * 3.4;
  const w = 3.3 + r() * 0.9;
  const mid = (LEAF_W / 2) * 0.95;
  const tipY = cy + bend * 0.4;
  const body = new Path2D();
  body.moveTo(x0, cy);
  body.bezierCurveTo(6, cy - w * 1.15 + bend * 0.6, 17, cy - w + bend, x1, tipY);
  body.bezierCurveTo(17, cy + w + bend, 6, cy + w * 1.1 + bend * 0.6, x0, cy);
  const upper = new Path2D();
  upper.moveTo(x0, cy);
  upper.quadraticCurveTo(mid, cy + bend, x1, tipY);
  upper.bezierCurveTo(17, cy - w + bend, 6, cy - w * 1.15 + bend * 0.6, x0, cy);
  const gold = kind === 'gold';
  // The leaf is creased along its rib: the upper half takes the light.
  const low = ctx.createLinearGradient(0, cy, 0, cy + w);
  low.addColorStop(0, gold ? '#a86f1e' : '#3a4a20');
  low.addColorStop(1, gold ? '#6a4210' : '#1d2610');
  ctx.fillStyle = low;
  ctx.fill(body);
  const high = ctx.createLinearGradient(0, cy - w, 0, cy);
  high.addColorStop(0, gold ? '#fff2b8' : '#9aab62');
  high.addColorStop(0.55, gold ? '#eec25a' : '#617434');
  high.addColorStop(1, gold ? '#c48a2c' : '#435324');
  ctx.fillStyle = high;
  ctx.fill(upper);
  texture(ctx, body, gold ? 0.35 : 0.45, 0.07, seed + (gold ? 40 : 50));
  // Veins, raked toward the tip.
  const at = (t: number): Pt => {
    const u = 1 - t;
    return [u * u * x0 + 2 * u * t * mid + t * t * x1, u * u * cy + 2 * u * t * (cy + bend) + t * t * tipY];
  };
  const veins = new Path2D();
  for (let i = 1; i <= 5; i++) {
    const t = i / 6.5;
    const [px, py] = at(t);
    const reach = w * 0.75 * Math.sin(Math.PI * Math.min(1, t * 1.1));
    veins.moveTo(px, py);
    veins.quadraticCurveTo(px + 1.4, py - reach * 0.6, px + 2.8, py - reach);
    veins.moveTo(px, py);
    veins.quadraticCurveTo(px + 1.4, py + reach * 0.6, px + 2.8, py + reach);
  }
  ctx.save();
  ctx.clip(body);
  engrave(ctx, veins, 0.28, gold ? 'rgba(96, 58, 12, 0.55)' : 'rgba(12, 18, 6, 0.55)', gold ? 'rgba(255, 240, 190, 0.35)' : 'rgba(190, 210, 140, 0.2)');
  const rib = new Path2D();
  rib.moveTo(x0, cy);
  rib.quadraticCurveTo(mid, cy + bend, x1 - 1, tipY);
  engrave(ctx, rib, 0.5, gold ? 'rgba(96, 58, 12, 0.7)' : 'rgba(10, 14, 4, 0.7)', gold ? 'rgba(255, 244, 200, 0.6)' : 'rgba(200, 220, 150, 0.35)');
  ctx.restore();
  model(ctx, body, 9, 0.35, 0.4);
  // A gloss streak along the lit half.
  ctx.save();
  ctx.clip(upper);
  ctx.globalCompositeOperation = 'screen';
  ctx.filter = `blur(${0.5 * ctx.getTransform().a}px)`;
  ctx.strokeStyle = gold ? 'rgba(255, 250, 225, 0.8)' : 'rgba(220, 235, 190, 0.45)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(5, cy - w * 0.55 + bend * 0.3);
  ctx.quadraticCurveTo(12, cy - w * 0.75 + bend * 0.8, 19, cy - w * 0.35 + bend * 0.7);
  ctx.stroke();
  ctx.restore();
  ink(ctx, body, 0.55, 0.85);
  ctx.strokeStyle = gold ? '#7a4e14' : '#232c12';
  ctx.lineWidth = 0.9;
  ctx.beginPath();
  ctx.moveTo(x0 - 1.2, cy + 0.6);
  ctx.lineTo(x0 + 1.2, cy);
  ctx.stroke();
  if (gold) glint(ctx, 9 + r() * 4, cy - w * 0.5, 2.6, 0.55);
}

// ------------------------------------------------------------------ stars

const STAR_BOX = 34;
/** A star's outer radius in its texture. */
export const STAR_R = 15;

/** An eight-pointed star of gold or silver, each ray bevelled and lit. */
export function starTexture(kind: 'gold' | 'silver' = 'gold'): Texture {
  return bake(`star-${kind}`, STAR_BOX, STAR_BOX, (ctx) => paintStar(ctx, kind), 5);
}

function paintStar(ctx: Ctx, kind: 'gold' | 'silver'): void {
  const c = STAR_BOX / 2;
  const n = 8;
  const [dark, mid, light] = kind === 'gold' ? [0x6e4410, 0xd9a444, 0xfff4c8] : [0x4a4f58, 0xb9bec4, 0xffffff];
  const outline: Pt[] = [];
  const faces: [Path2D, number][] = [];
  const ridges = new Path2D();
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + (i / n) * Math.PI * 2;
    const len = i % 2 === 0 ? STAR_R : STAR_R * 0.62;
    const half = Math.PI / n;
    const base = STAR_R * 0.25;
    const tip: Pt = [c + Math.cos(a) * len, c + Math.sin(a) * len];
    const l: Pt = [c + Math.cos(a - half) * base, c + Math.sin(a - half) * base];
    const rr: Pt = [c + Math.cos(a + half) * base, c + Math.sin(a + half) * base];
    outline.push(l, tip);
    faces.push([shape([[c, c], l, tip], false), a - half * 0.9]);
    faces.push([shape([[c, c], tip, rr], false), a + half * 0.9]);
    ridges.moveTo(c, c);
    ridges.lineTo(tip[0], tip[1]);
  }
  const star = shape(outline, false);
  // Its thickness, below right.
  ctx.save();
  ctx.translate(0.5, 0.7);
  ctx.fillStyle = `#${dark.toString(16).padStart(6, '0')}`;
  ctx.fill(star);
  ctx.restore();
  for (const [face, a] of faces) {
    ctx.fillStyle = facet(a, dark, mid, light);
    ctx.fill(face);
  }
  texture(ctx, star, 0.25, 0.05, kind === 'gold' ? 61 : 62);
  ctx.strokeStyle = kind === 'gold' ? 'rgba(255, 246, 214, 0.7)' : 'rgba(255, 255, 255, 0.7)';
  ctx.lineWidth = 0.35;
  ctx.stroke(ridges);
  const boss = ctx.createRadialGradient(c - 1, c - 1.2, 0.2, c, c, 3.4);
  boss.addColorStop(0, kind === 'gold' ? '#fffbe6' : '#ffffff');
  boss.addColorStop(0.5, `#${mid.toString(16).padStart(6, '0')}`);
  boss.addColorStop(1, `#${dark.toString(16).padStart(6, '0')}`);
  emboss(ctx, circle(c, c, 2.8), boss, 0.5);
  ink(ctx, star, 0.5, 0.8);
  glint(ctx, c - 1, c - 1, 7, 0.75);
}

// ------------------------------------------------------------- ray bursts

const BURST_BOX = 220;
/** A burst's outer radius in its texture. */
export const BURST_R = 104;

export type BurstTone = 'clay' | 'bronze' | 'gold';

const TONES: Record<BurstTone, [string, string, string]> = {
  clay: ['#f0a36a', '#c56a3b', '#7c3317'],
  bronze: ['#f2cf8a', '#b98a45', '#6a4a1c'],
  gold: ['#fff1b4', '#e2b24c', '#8e5f14'],
};

/**
 * The ray pattern from the foot of a vase, as a burst: glaze and coloured
 * rays about a beaded band, glowing warm between them and fading at the tips.
 */
export function burstTexture(tone: BurstTone, n: number): Texture {
  return bake(`burst-${tone}-${n}`, BURST_BOX, BURST_BOX, (ctx) => paintBurst(ctx, tone, n), 2.5);
}

function paintBurst(ctx: Ctx, tone: BurstTone, n: number): void {
  const c = BURST_BOX / 2;
  const [hi, mid, lo] = TONES[tone];
  const r0 = 26;
  // Warm light between the rays.
  wash(ctx, null, c, c, BURST_R, tone === 'clay' ? 'rgba(255, 196, 120, 0.4)' : 'rgba(255, 214, 140, 0.45)');
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 - Math.PI / 2;
    const glaze = i % 2 === 0;
    const len = glaze ? BURST_R : BURST_R * 0.74;
    const hw = (Math.PI / n) * (glaze ? 0.9 : 0.78);
    const tip: Pt = [c + Math.cos(a) * len, c + Math.sin(a) * len];
    const b0: Pt = [c + Math.cos(a - hw) * r0, c + Math.sin(a - hw) * r0];
    const b1: Pt = [c + Math.cos(a + hw) * r0, c + Math.sin(a + hw) * r0];
    const midR = r0 + (len - r0) * 0.45;
    const ray = new Path2D();
    ray.moveTo(b0[0], b0[1]);
    ray.quadraticCurveTo(c + Math.cos(a - hw * 0.8) * midR, c + Math.sin(a - hw * 0.8) * midR, tip[0], tip[1]);
    ray.quadraticCurveTo(c + Math.cos(a + hw * 0.8) * midR, c + Math.sin(a + hw * 0.8) * midR, b1[0], b1[1]);
    ray.closePath();
    const g = ctx.createLinearGradient(c + Math.cos(a) * r0, c + Math.sin(a) * r0, tip[0], tip[1]);
    if (glaze) {
      g.addColorStop(0, '#3a2a20');
      g.addColorStop(0.5, '#1d1410');
      g.addColorStop(1, '#120c09');
    } else {
      g.addColorStop(0, hi);
      g.addColorStop(0.45, mid);
      g.addColorStop(1, lo);
    }
    ctx.fillStyle = g;
    ctx.fill(ray);
    // Glaze is glossy: a lit edge on the side facing the light.
    const lit = Math.cos(a) * LIGHT.x + Math.sin(a) * LIGHT.y;
    ctx.save();
    ctx.clip(ray);
    ctx.strokeStyle = glaze ? `rgba(255, 230, 190, ${0.12 + Math.max(0, lit) * 0.4})` : `rgba(255, 250, 230, ${0.2 + Math.max(0, lit) * 0.4})`;
    ctx.lineWidth = 1.6;
    ctx.stroke(ray);
    ctx.restore();
  }
  const all = circle(c, c, BURST_R + 2);
  texture(ctx, all, 0.3, 0.12, 70);
  // Fade the tips so the burst reads as light as well as paint.
  ctx.save();
  ctx.globalCompositeOperation = 'destination-in';
  const fade = ctx.createRadialGradient(c, c, r0, c, c, BURST_R);
  fade.addColorStop(0, 'rgba(0, 0, 0, 1)');
  fade.addColorStop(0.55, 'rgba(0, 0, 0, 0.95)');
  fade.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = fade;
  ctx.fillRect(0, 0, BURST_BOX, BURST_BOX);
  ctx.restore();
  // The beaded band the rays spring from; the middle stays clear.
  const band = new Path2D();
  band.arc(c, c, r0 + 1, 0, Math.PI * 2);
  band.arc(c, c, r0 - 7, 0, Math.PI * 2, true);
  ctx.fillStyle = GLAZE;
  ctx.fill(band);
  ctx.fillStyle = hi;
  for (let i = 0; i < 28; i++) {
    const a = (i / 28) * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(c + Math.cos(a) * (r0 - 3), c + Math.sin(a) * (r0 - 3), 1.25, 0, Math.PI * 2);
    ctx.fill();
  }
  engrave(ctx, circle(c, c, r0 + 1), 0.9, 'rgba(20, 12, 8, 0.9)', 'rgba(255, 230, 180, 0.4)');
  engrave(ctx, circle(c, c, r0 - 7), 0.9, 'rgba(20, 12, 8, 0.9)', 'rgba(255, 230, 180, 0.4)');
}

// ----------------------------------------------------------- decree seal

const SEAL_BOX = 128;
/** The seal's radius in its texture. */
export const SEAL_R = 44;

/** Zeus's decree: a red wax seal on its cords, the thunderbolt pressed into it. */
export function sealTexture(): Texture {
  return bake('decree-seal', SEAL_BOX, SEAL_BOX, paintSeal, 3);
}

function paintSeal(ctx: Ctx): void {
  const r = rng(91);
  const c = SEAL_BOX / 2;
  // The cords run under the wax and trail out below.
  for (const [pts, w] of [
    [
      [
        [c - 20, c + 8],
        [c - 34, c + 30],
        [c - 30, c + 50],
        [c - 40, c + 62],
      ],
      4.4,
    ],
    [
      [
        [c + 18, c + 8],
        [c + 30, c + 32],
        [c + 42, c + 46],
        [c + 40, c + 62],
      ],
      4.4,
    ],
  ] as [Pt[], number][]) {
    const cord = new Path2D();
    cord.moveTo(pts[0][0], pts[0][1]);
    cord.bezierCurveTo(pts[1][0], pts[1][1], pts[2][0], pts[2][1], pts[3][0], pts[3][1]);
    ctx.save();
    ctx.strokeStyle = '#3d2412';
    ctx.lineWidth = w + 1.6;
    ctx.stroke(cord);
    ctx.strokeStyle = '#b8864a';
    ctx.lineWidth = w;
    ctx.stroke(cord);
    // The twist of the ply.
    ctx.strokeStyle = 'rgba(80, 46, 18, 0.8)';
    ctx.setLineDash([1.1, 1.6]);
    ctx.lineWidth = w;
    ctx.stroke(cord);
    ctx.setLineDash([]);
    ctx.strokeStyle = 'rgba(255, 232, 180, 0.45)';
    ctx.lineWidth = 0.8;
    ctx.translate(-0.8, -0.8);
    ctx.stroke(cord);
    ctx.restore();
    // A frayed end.
    const [ex, ey] = pts[3];
    ctx.strokeStyle = '#8e6232';
    ctx.lineWidth = 0.6;
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      ctx.moveTo(ex, ey);
      ctx.lineTo(ex + (r() - 0.5) * 5, ey + 2 + r() * 4);
      ctx.stroke();
    }
  }
  const blob = lumpy(c, c - 4, SEAL_R, r, 0.06, 44);
  // Wax squeezed out under the die.
  ctx.save();
  ctx.translate(1.2, 2.2);
  ctx.fillStyle = 'rgba(40, 8, 4, 0.55)';
  ctx.filter = `blur(${2 * ctx.getTransform().a}px)`;
  ctx.fill(blob);
  ctx.restore();
  const wax = ctx.createRadialGradient(c - 14, c - 20, 2, c, c - 4, SEAL_R * 1.15);
  wax.addColorStop(0, '#e2654a');
  wax.addColorStop(0.35, '#b3321f');
  wax.addColorStop(0.75, '#7c1a10');
  wax.addColorStop(1, '#4c0c06');
  ctx.fillStyle = wax;
  ctx.fill(blob);
  texture(ctx, blob, 0.28, 0.07, 92);
  // The die's impression: a sunken disc.
  const die = circle(c, c - 4, SEAL_R * 0.72);
  ctx.fillStyle = 'rgba(70, 10, 6, 0.35)';
  ctx.fill(die);
  innerEdge(ctx, die, 'rgba(34, 4, 2, 0.85)', 1.6, 2, 2);
  innerEdge(ctx, die, 'rgba(255, 170, 140, 0.55)', -1, -1.2, 1.2);
  // In it, the bolt in relief and a border of pellets.
  const face = ctx.createLinearGradient(c - 20, c - 30, c + 20, c + 20);
  face.addColorStop(0, '#e5725a');
  face.addColorStop(0.5, '#a82c1a');
  face.addColorStop(1, '#6a140a');
  const bolt = keraunos(c, c - 4, SEAL_R * 1.1, 10);
  ctx.save();
  ctx.translate(c, c - 4);
  ctx.rotate(0.35);
  ctx.translate(-c, -(c - 4));
  emboss(ctx, bolt, face, 0.9, 'rgba(40, 6, 2, 0.85)', 'rgba(255, 180, 150, 0.7)');
  ctx.restore();
  beads(ctx, c, c - 4, SEAL_R * 0.62, 30, 0.9, '#b53a24');
  model(ctx, blob, SEAL_R * 2, 0.4, 0.5);
  // Wax is glossy.
  wash(ctx, blob, c - 16, c - 22, 16, 'rgba(255, 220, 200, 0.55)', 'screen');
  ink(ctx, blob, 1.1, 0.85);
  glint(ctx, c - 20, c - 26, 9, 0.7);
}

// ----------------------------------------------------------------- relics

const RELIC_BOX = 96;
/** A relic's rough radius in its texture. */
export const RELIC_R = 38;

/** Each relic painted as itself; an unknown one gets Zeus's seal. */
export function relicTexture(id: string): Texture {
  const paint = RELICS[id] ?? RELICS.zeus_seal;
  return bake(`relic-${RELICS[id] ? id : 'zeus_seal'}`, RELIC_BOX, RELIC_BOX, paint, 4);
}

const RELICS: Record<string, (ctx: Ctx) => void> = {
  hermes_seal: hermesSeal,
  daedalus_pin: daedalusPin,
  danaid_handle: danaidHandle,
  ichor_ampoule: ichorAmpoule,
  atlas_shard: atlasShard,
  zeus_seal: zeusSeal,
};

/** A struck disc of metal: its thickness, field, rim and beaded border. */
function flan(ctx: Ctx, R: number, seed: number, colors: [string, string, string, string], edge: string): Path2D {
  const c = RELIC_BOX / 2;
  const disc = lumpy(c, c, R, rng(seed), 0.025);
  ctx.save();
  ctx.translate(0.9, 2.2);
  ctx.fillStyle = edge;
  ctx.fill(disc);
  ctx.restore();
  const g = ctx.createRadialGradient(c - R * 0.4, c - R * 0.45, 1, c, c, R * 1.2);
  g.addColorStop(0, colors[0]);
  g.addColorStop(0.3, colors[1]);
  g.addColorStop(0.7, colors[2]);
  g.addColorStop(1, colors[3]);
  ctx.fillStyle = g;
  ctx.fill(disc);
  texture(ctx, disc, 0.32, 0.06, seed);
  const rim = ctx.createLinearGradient(c - R, c - R, c + R, c + R);
  rim.addColorStop(0, colors[0]);
  rim.addColorStop(1, colors[3]);
  ctx.strokeStyle = rim;
  ctx.lineWidth = 3;
  ctx.stroke(circle(c, c, R - 2));
  engrave(ctx, circle(c, c, R - 4), 0.6);
  beads(ctx, c, c, R - 6.4, 40, 0.95, colors[1]);
  return disc;
}

function finishFlan(ctx: Ctx, disc: Path2D, R: number, seed: number, pits: string): void {
  const c = RELIC_BOX / 2;
  speckle(ctx, disc, rng(seed + 1), 80, [0.12, 0.4], pits, [c - R, c - R, c + R, c + R]);
  model(ctx, disc, R * 2, 0.35, 0.45);
  wash(ctx, disc, c - R * 0.4, c - R * 0.45, R * 0.6, 'rgba(255, 252, 240, 0.5)', 'screen');
  ink(ctx, disc, 1.2);
  glint(ctx, c - R * 0.45, c - R * 0.5, 10, 0.8);
}

function hermesSeal(ctx: Ctx): void {
  const c = RELIC_BOX / 2;
  const R = 36;
  const disc = flan(ctx, R, 101, ['#ffffff', '#d6d8d2', '#8f938e', '#50544f'], '#3a3d3a');
  const face = ctx.createLinearGradient(c - 20, c - 26, c + 20, c + 26);
  face.addColorStop(0, '#fbfbf6');
  face.addColorStop(0.5, '#b8bbb4');
  face.addColorStop(1, '#6d716b');
  const dark = 'rgba(30, 32, 30, 0.8)';
  const lit = 'rgba(255, 255, 255, 0.85)';
  // The kerykeion: a staff, two snakes twined about it, wings at the head.
  emboss(ctx, ribbon([[c, c - 22], [c, c + 26]], 2.6, 2.2), face, 0.7, dark, lit);
  emboss(ctx, circle(c, c - 23.5, 2.4), face, 0.6, dark, lit);
  for (const s of [-1, 1]) {
    const snake: Pt[] = [];
    for (let i = 0; i <= 24; i++) {
      const t = i / 24;
      snake.push([c + s * Math.sin(t * Math.PI * 2.5) * 8 * (0.55 + 0.45 * t), c + 20 - t * 34]);
    }
    const head = snake[snake.length - 1];
    snake.push([head[0] - s * 4, head[1] - 3]);
    emboss(ctx, ribbon(snake, 1.2, 2.2), face, 0.6, dark, lit);
    emboss(ctx, circle(head[0] - s * 4.6, head[1] - 3.2, 1.7), face, 0.5, dark, lit);
    // A wing, feathered.
    const wing = shape(
      [
        [c + s * 2, c - 17],
        [c + s * 10, c - 24],
        [c + s * 19, c - 26],
        [c + s * 15, c - 21],
        [c + s * 18, c - 19],
        [c + s * 12, c - 16],
        [c + s * 14, c - 13.5],
        [c + s * 5, c - 13],
      ],
      true,
    );
    emboss(ctx, wing, face, 0.6, dark, lit);
    const quills = new Path2D();
    for (let k = 0; k < 3; k++) {
      quills.moveTo(c + s * 5, c - 16 + k * 0.4);
      quills.lineTo(c + s * (12 + k * 2), c - 22 + k * 3);
    }
    ctx.save();
    ctx.clip(wing);
    engrave(ctx, quills, 0.4, 'rgba(40, 42, 40, 0.6)', 'rgba(255, 255, 255, 0.5)');
    ctx.restore();
  }
  finishFlan(ctx, disc, R, 101, 'rgba(40, 44, 42, 0.35)');
}

function zeusSeal(ctx: Ctx): void {
  const c = RELIC_BOX / 2;
  const R = 37;
  const disc = flan(ctx, R, 111, ['#fff4c8', '#eec35c', '#b27c28', '#6c4414'], '#4e3010');
  // Rays engraved behind the bolt.
  const rays = new Path2D();
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    rays.moveTo(c + Math.cos(a) * 9, c + Math.sin(a) * 9);
    rays.lineTo(c + Math.cos(a) * 25, c + Math.sin(a) * 25);
  }
  engrave(ctx, rays, 0.45, 'rgba(90, 56, 14, 0.55)', 'rgba(255, 244, 200, 0.5)');
  const face = ctx.createLinearGradient(c - 16, c - 26, c + 16, c + 26);
  face.addColorStop(0, '#fff8d8');
  face.addColorStop(0.45, '#e2b04a');
  face.addColorStop(1, '#8c5c1a');
  ctx.save();
  ctx.translate(c, c);
  ctx.rotate(0.5);
  ctx.translate(-c, -c);
  emboss(ctx, keraunos(c, c, 52, 10.5), face, 1.1);
  ctx.restore();
  finishFlan(ctx, disc, R, 111, 'rgba(90, 56, 16, 0.35)');
}

function daedalusPin(ctx: Ctx): void {
  const r = rng(121);
  // A long bronze pin, head up and to the right: a small cog for a head, a
  // bead collar, a coil of wire, and a point.
  const head: Pt = [70, 24];
  const point: Pt = [18, 84];
  const dx = point[0] - head[0];
  const dy = point[1] - head[1];
  const len = Math.hypot(dx, dy);
  const ux = dx / len;
  const uy = dy / len;
  const along = (t: number): Pt => [head[0] + ux * t, head[1] + uy * t];
  const bronze = (x0: number, y0: number, x1: number, y1: number) => {
    const g = ctx.createLinearGradient(x0, y0, x1, y1);
    g.addColorStop(0, '#ffe7a8');
    g.addColorStop(0.35, '#d19a48');
    g.addColorStop(0.75, '#8a5a22');
    g.addColorStop(1, '#4e3010');
    return g;
  };
  // Across the shaft, lit from the upper left.
  const nx = -uy;
  const ny = ux;
  const across = (p: Pt, w: number) => bronze(p[0] - nx * w, p[1] - ny * w, p[0] + nx * w, p[1] + ny * w);
  const shaft = ribbon([along(10), along(len * 0.5), point], 4.4, 0.2);
  ctx.save();
  ctx.translate(1, 1.6);
  ctx.fillStyle = 'rgba(40, 26, 10, 0.5)';
  ctx.fill(shaft);
  ctx.restore();
  ctx.fillStyle = across(along(len * 0.4), 3);
  ctx.fill(shaft);
  texture(ctx, shaft, 0.3, 0.05, 122);
  ink(ctx, shaft, 0.7);
  // The coil of wire.
  const coil = new Path2D();
  for (let i = 0; i < 9; i++) {
    const [px, py] = along(22 + i * 2.1);
    coil.moveTo(px - nx * 2.8 - ux * 0.8, py - ny * 2.8 - uy * 0.8);
    coil.quadraticCurveTo(px + ux * 1.6, py + uy * 1.6, px + nx * 2.8 - ux * 0.8, py + ny * 2.8 - uy * 0.8);
  }
  ctx.strokeStyle = '#5a3a14';
  ctx.lineWidth = 1.5;
  ctx.stroke(coil);
  ctx.strokeStyle = '#f0c878';
  ctx.lineWidth = 0.7;
  ctx.stroke(coil);
  // Bead collar: two bicones.
  for (const t of [12.5, 17.5]) {
    const [px, py] = along(t);
    const bead = shape(
      [
        [px - ux * 2.2, py - uy * 2.2],
        [px + nx * 4, py + ny * 4],
        [px + ux * 2.2, py + uy * 2.2],
        [px - nx * 4, py - ny * 4],
      ],
      false,
    );
    ctx.fillStyle = across([px, py], 4);
    ctx.fill(bead);
    ink(ctx, bead, 0.6);
  }
  // The cog: a spoked wheel with square teeth.
  const [hx, hy] = head;
  const teeth: Pt[] = [];
  const n = 10;
  for (let i = 0; i < n * 4; i++) {
    const a = (i / (n * 4)) * Math.PI * 2;
    const out = i % 4 === 1 || i % 4 === 2;
    teeth.push([hx + Math.cos(a) * (out ? 13 : 10.2), hy + Math.sin(a) * (out ? 13 : 10.2)]);
  }
  const cog = shape(teeth, false);
  const hole = new Path2D();
  hole.addPath(cog);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.4;
    const w = new Path2D();
    w.moveTo(hx + Math.cos(a) * 3.2, hy + Math.sin(a) * 3.2);
    w.arc(hx, hy, 7.2, a, a + Math.PI / 2 - 0.55);
    w.lineTo(hx + Math.cos(a + Math.PI / 2 - 0.55) * 3.2, hy + Math.sin(a + Math.PI / 2 - 0.55) * 3.2);
    w.closePath();
    hole.addPath(w);
  }
  ctx.save();
  ctx.translate(1, 1.8);
  ctx.fillStyle = '#4a2e10';
  ctx.fill(hole, 'evenodd');
  ctx.restore();
  ctx.fillStyle = bronze(hx - 12, hy - 12, hx + 12, hy + 12);
  ctx.fill(hole, 'evenodd');
  texture(ctx, cog, 0.3, 0.05, 123);
  emboss(ctx, circle(hx, hy, 2.6), bronze(hx - 3, hy - 3, hx + 3, hy + 3), 0.5);
  // Green patina gathered in the teeth.
  speckle(ctx, cog, r, 30, [0.3, 0.9], 'rgba(86, 150, 120, 0.4)', [hx - 13, hy - 13, hx + 13, hy + 13]);
  model(ctx, cog, 26, 0.35, 0.45);
  ink(ctx, hole, 0.8);
  glint(ctx, hx - 6, hy - 8, 8, 0.8);
  glint(ctx, along(40)[0] - 1.5, along(40)[1] - 1.5, 5, 0.5);
}

function danaidHandle(ctx: Ctx): void {
  const r = rng(131);
  // A curved sherd from a jar's shoulder, its handle still on.
  const sherd = shape(
    [
      [12, 64],
      [22, 55],
      [34, 53],
      [44, 50],
      [58, 51],
      [70, 54],
      [82, 58],
      [86, 66],
      [80, 72],
      [83, 80],
      [70, 84],
      [60, 80],
      [48, 86],
      [36, 82],
      [26, 84],
      [16, 76],
    ],
    false,
  );
  // The broken body: fired clay, a thin darker core.
  ctx.save();
  ctx.translate(1.4, 2.4);
  ctx.fillStyle = '#9c4a24';
  ctx.fill(sherd);
  ctx.translate(-0.6, -1);
  ctx.fillStyle = '#e09a68';
  ctx.fill(sherd);
  ctx.restore();
  const body = ctx.createLinearGradient(0, 50, 0, 86);
  body.addColorStop(0, '#2a1d17');
  body.addColorStop(0.5, '#15100d');
  body.addColorStop(1, '#0c0907');
  ctx.fillStyle = body;
  ctx.fill(sherd);
  // A reserved band with a meander, below the glaze.
  const band = new Path2D();
  band.rect(0, 70, RELIC_BOX, 7);
  ctx.save();
  ctx.clip(sherd);
  ctx.fillStyle = '#c56a3b';
  ctx.fill(band);
  ctx.strokeStyle = '#1a1310';
  ctx.lineWidth = 0.9;
  for (let x = 4; x < 90; x += 7) {
    ctx.beginPath();
    ctx.moveTo(x, 76);
    ctx.lineTo(x, 71.5);
    ctx.lineTo(x + 5, 71.5);
    ctx.lineTo(x + 5, 74.5);
    ctx.lineTo(x + 2.4, 74.5);
    ctx.stroke();
  }
  ctx.restore();
  texture(ctx, sherd, 0.35, 0.08, 132);
  model(ctx, sherd, 40, 0.3, 0.5);
  // The glaze shines along the curve of the shoulder.
  ctx.save();
  ctx.clip(sherd);
  ctx.globalCompositeOperation = 'screen';
  ctx.filter = `blur(${1.2 * ctx.getTransform().a}px)`;
  ctx.strokeStyle = 'rgba(255, 236, 210, 0.45)';
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(18, 62);
  ctx.quadraticCurveTo(48, 54, 80, 62);
  ctx.stroke();
  ctx.restore();
  ink(ctx, sherd, 1);
  // The handle: a thick loop of glazed clay.
  const loop: Pt[] = [];
  for (let i = 0; i <= 20; i++) {
    const t = i / 20;
    const a = Math.PI + t * Math.PI;
    loop.push([48 + Math.cos(a) * 17, 55 + Math.sin(a) * 38 * (0.92 + 0.08 * Math.sin(t * Math.PI))]);
  }
  const handle = ribbon(loop, 9, 8);
  ctx.save();
  ctx.translate(1.4, 2);
  ctx.fillStyle = 'rgba(12, 8, 6, 0.6)';
  ctx.fill(handle);
  ctx.restore();
  const hg = ctx.createLinearGradient(30, 20, 66, 40);
  hg.addColorStop(0, '#3e2c22');
  hg.addColorStop(0.5, '#1a130f');
  hg.addColorStop(1, '#0a0806');
  ctx.fillStyle = hg;
  ctx.fill(handle);
  texture(ctx, handle, 0.3, 0.08, 133);
  const gloss = new Path2D();
  gloss.moveTo(34, 46);
  for (let i = 3; i <= 14; i++) gloss.lineTo(loop[i][0] - 1.4, loop[i][1] + 1);
  ctx.save();
  ctx.clip(handle);
  ctx.globalCompositeOperation = 'screen';
  ctx.filter = `blur(${0.8 * ctx.getTransform().a}px)`;
  ctx.strokeStyle = 'rgba(255, 240, 220, 0.7)';
  ctx.lineWidth = 1.6;
  ctx.stroke(gloss);
  ctx.restore();
  ink(ctx, handle, 0.9);
  // Where it once held water: a dry, pale tide line.
  speckle(ctx, sherd, r, 40, [0.2, 0.6], 'rgba(220, 200, 170, 0.25)', [12, 50, 86, 70]);
  glint(ctx, 40, 22, 7, 0.55);
}

function ichorAmpoule(ctx: Ctx): void {
  const c = RELIC_BOX / 2;
  const cy = 58;
  const R = 23;
  const flask = new Path2D();
  flask.moveTo(c - 5, 26);
  flask.lineTo(c - 5, cy - R + 3);
  flask.bezierCurveTo(c - R - 4, cy - R + 6, c - R - 2, cy + R, c, cy + R);
  flask.bezierCurveTo(c + R + 2, cy + R, c + R + 4, cy - R + 6, c + 5, cy - R + 3);
  flask.lineTo(c + 5, 26);
  flask.closePath();
  // A soft golden glow round it: the ichor shines through.
  wash(ctx, null, c, cy, R * 1.9, 'rgba(255, 200, 90, 0.4)');
  // The ichor: molten gold, brightest at the heart.
  const fill = new Path2D();
  fill.rect(0, cy - R * 0.45, RELIC_BOX, RELIC_BOX);
  ctx.save();
  ctx.clip(flask);
  ctx.clip(fill);
  const ichor = ctx.createRadialGradient(c - 3, cy + 4, 1, c, cy + 2, R * 1.1);
  ichor.addColorStop(0, '#fffbe0');
  ichor.addColorStop(0.3, '#ffd65a');
  ichor.addColorStop(0.7, '#e08e1a');
  ichor.addColorStop(1, '#8a4a08');
  ctx.fillStyle = ichor;
  ctx.fillRect(0, 0, RELIC_BOX, RELIC_BOX);
  texture(ctx, flask, 0.18, 0.1, 141, 'soft-light');
  // Rising motes.
  ctx.fillStyle = 'rgba(255, 252, 230, 0.85)';
  const r = rng(142);
  for (let i = 0; i < 9; i++) {
    ctx.beginPath();
    ctx.arc(c + (r() - 0.5) * R * 1.3, cy + (r() - 0.2) * R * 0.9, 0.4 + r() * 0.9, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  // The meniscus.
  ctx.save();
  ctx.clip(flask);
  ctx.strokeStyle = 'rgba(255, 246, 200, 0.9)';
  ctx.lineWidth = 0.9;
  ctx.beginPath();
  ctx.ellipse(c, cy - R * 0.45, R * 0.9, 2.2, 0, 0, Math.PI * 2);
  ctx.stroke();
  // The glass: a faint body, a darker edge, sharp reflections.
  ctx.fillStyle = 'rgba(210, 232, 236, 0.16)';
  ctx.fillRect(0, 0, RELIC_BOX, RELIC_BOX);
  ctx.restore();
  innerEdge(ctx, flask, 'rgba(40, 70, 80, 0.55)', 1.2, 1.5, 2.4);
  ctx.save();
  ctx.clip(flask);
  ctx.globalCompositeOperation = 'screen';
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.lineWidth = 2.2;
  ctx.filter = `blur(${0.6 * ctx.getTransform().a}px)`;
  ctx.beginPath();
  ctx.arc(c, cy, R - 4, Math.PI * 1.08, Math.PI * 1.42);
  ctx.stroke();
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(c, cy, R - 3, Math.PI * 0.12, Math.PI * 0.3);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
  ctx.fillRect(c - 3.6, 28, 1.3, 9);
  ctx.restore();
  ctx.strokeStyle = 'rgba(60, 50, 40, 0.75)';
  ctx.lineWidth = 0.9;
  ctx.stroke(flask);
  // The lip, the gold stopper and its wax seal.
  const lip = new Path2D();
  lip.ellipse(c, 26, 7.2, 2.4, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(210, 232, 236, 0.5)';
  ctx.fill(lip);
  ctx.stroke(lip);
  const stopper = shape(
    [
      [c - 5.5, 26],
      [c - 6, 19],
      [c - 3, 14.5],
      [c + 3, 14.5],
      [c + 6, 19],
      [c + 5.5, 26],
    ],
    true,
  );
  const gold = ctx.createLinearGradient(c - 6, 14, c + 6, 26);
  gold.addColorStop(0, '#fff2c0');
  gold.addColorStop(0.45, '#dca848');
  gold.addColorStop(1, '#7a4c14');
  ctx.fillStyle = gold;
  ctx.fill(stopper);
  texture(ctx, stopper, 0.3, 0.05, 143);
  ink(ctx, stopper, 0.7);
  const wax = lumpy(c + 5, 23, 4.2, rng(144), 0.1, 16);
  const drip = new Path2D();
  drip.addPath(wax);
  drip.addPath(ribbon([[c + 6.5, 24], [c + 7.2, 30], [c + 6.8, 33]], 2.2, 1.6));
  ctx.fillStyle = '#a82a1a';
  ctx.fill(drip);
  wash(ctx, drip, c + 3.5, 21.5, 3, 'rgba(255, 190, 170, 0.8)', 'screen');
  ink(ctx, drip, 0.5, 0.8);
  glint(ctx, c - 11, cy - 11, 9, 0.9);
}

function atlasShard(ctx: Ctx): void {
  const r = rng(151);
  // A shard of the sky itself: deep lapis, flecked with gold stars.
  const pts: Pt[] = [
    [44, 10],
    [62, 22],
    [80, 26],
    [74, 48],
    [84, 66],
    [58, 86],
    [40, 78],
    [18, 82],
    [22, 58],
    [12, 40],
    [30, 30],
  ];
  const shard = shape(pts, false);
  wash(ctx, null, 48, 50, 52, 'rgba(120, 170, 255, 0.35)');
  // The broken edge shows the sky's pale lower layer.
  ctx.save();
  ctx.translate(1.6, 2.6);
  ctx.fillStyle = '#7fa6d8';
  ctx.fill(shard);
  ctx.translate(-0.7, -1.2);
  ctx.fillStyle = '#c9dcf2';
  ctx.fill(shard);
  ctx.restore();
  const sky = ctx.createLinearGradient(20, 12, 76, 86);
  sky.addColorStop(0, '#3e5cc0');
  sky.addColorStop(0.4, '#1f2f7a');
  sky.addColorStop(1, '#0a1034');
  ctx.fillStyle = sky;
  ctx.fill(shard);
  // Facets from the break.
  const c: Pt = [48, 50];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    const f = shape([c, a, b], false);
    const out = Math.atan2((a[1] + b[1]) / 2 - c[1], (a[0] + b[0]) / 2 - c[0]);
    const lit = Math.cos(out) * LIGHT.x + Math.sin(out) * LIGHT.y;
    ctx.fillStyle = lit > 0 ? `rgba(160, 200, 255, ${lit * 0.22})` : `rgba(4, 6, 24, ${-lit * 0.35})`;
    ctx.fill(f);
  }
  texture(ctx, shard, 0.25, 0.1, 152, 'soft-light');
  // Nebulous light inside.
  wash(ctx, shard, 38, 40, 22, 'rgba(150, 120, 255, 0.35)', 'screen');
  wash(ctx, shard, 60, 62, 16, 'rgba(90, 200, 255, 0.25)', 'screen');
  speckle(ctx, shard, r, 70, [0.12, 0.35], 'rgba(255, 236, 170, 0.85)', [10, 10, 86, 86]);
  // A constellation, lightly traced.
  const stars: Pt[] = [
    [30, 44],
    [42, 36],
    [52, 44],
    [62, 38],
    [66, 56],
    [50, 64],
  ];
  ctx.save();
  ctx.clip(shard);
  ctx.strokeStyle = 'rgba(255, 226, 150, 0.55)';
  ctx.lineWidth = 0.4;
  ctx.setLineDash([1.2, 1.2]);
  ctx.beginPath();
  ctx.moveTo(stars[0][0], stars[0][1]);
  for (const s of stars.slice(1)) ctx.lineTo(s[0], s[1]);
  ctx.lineTo(stars[2][0], stars[2][1]);
  ctx.stroke();
  ctx.restore();
  for (const [x, y] of stars) glint(ctx, x, y, 3.2 + r() * 2.2, 0.95);
  ctx.strokeStyle = 'rgba(200, 225, 255, 0.5)';
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  ctx.lineTo(c[0], c[1]);
  ctx.lineTo(pts[4][0], pts[4][1]);
  ctx.stroke();
  ink(ctx, shard, 1.1);
  glint(ctx, 40, 18, 9, 0.8);
}

// -------------------------------------------------------------- fragments

/** A piece of a broken target, cut from its painting. */
export interface Fragment {
  tex: Texture;
  /** Its middle, from the target's ground anchor, in world units. */
  x: number;
  y: number;
  w: number;
  h: number;
}

const FRAGMENT_COUNT: Record<string, number> = { coin_amphora: 12, gilded_offering: 7, debris: 10 };
const FRACTURE_EDGE: Record<string, [string, string]> = {
  coin_amphora: ['#e39a66', '#8e3f1c'],
  gilded_offering: ['#fff0b8', '#7a4c14'],
  debris: ['#eadcc0', '#6e5a40'],
};
const fragments = new Map<string, Fragment[]>();

/**
 * Break a target's painting into Voronoi cells: each piece carries its share
 * of the picture, with a fresh fractured edge painted where it came apart.
 */
export function targetFragments(kind: string): Fragment[] {
  const known = FRAGMENT_COUNT[kind] ? kind : 'debris';
  const hit = fragments.get(known);
  if (hit) return hit;
  const src = canvasOf(targetTexture(known === 'debris' ? 'expected' : known));
  const sx = src.width / TARGET_W;
  const sy = src.height / TARGET_H;
  const alpha = src.getContext('2d')!.getImageData(0, 0, src.width, src.height).data;
  const solid = (x: number, y: number) => {
    const px = Math.floor(x * sx);
    const py = Math.floor(y * sy);
    if (px < 0 || py < 0 || px >= src.width || py >= src.height) return false;
    return alpha[(py * src.width + px) * 4 + 3] > 140;
  };
  const r = rng(known.length * 17 + 5);
  const seeds: Pt[] = [];
  for (let tries = 0; seeds.length < FRAGMENT_COUNT[known] && tries < 4000; tries++) {
    const p: Pt = [r() * TARGET_W, r() * TARGET_H];
    if (solid(p[0], p[1]) && seeds.every((s) => Math.hypot(s[0] - p[0], s[1] - p[1]) > 12)) seeds.push(p);
  }
  const out: Fragment[] = [];
  const [edge, core] = FRACTURE_EDGE[known];
  seeds.forEach((s, i) => {
    let cell: Pt[] = [
      [0, 0],
      [TARGET_W, 0],
      [TARGET_W, TARGET_H],
      [0, TARGET_H],
    ];
    for (const o of seeds) {
      if (o === s) continue;
      cell = clipHalf(cell, s, o);
      if (cell.length < 3) break;
    }
    if (cell.length < 3) return;
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (const [x, y] of cell) {
      x0 = Math.min(x0, x);
      y0 = Math.min(y0, y);
      x1 = Math.max(x1, x);
      y1 = Math.max(y1, y);
    }
    // Trim the cell's box to the painting inside it.
    let bx0 = Infinity;
    let by0 = Infinity;
    let bx1 = -Infinity;
    let by1 = -Infinity;
    const path = shape(cell, false);
    const probe = document.createElement('canvas').getContext('2d')!;
    for (let y = y0; y <= y1; y += 1.5) {
      for (let x = x0; x <= x1; x += 1.5) {
        if (solid(x, y) && probe.isPointInPath(path, x, y)) {
          bx0 = Math.min(bx0, x);
          by0 = Math.min(by0, y);
          bx1 = Math.max(bx1, x);
          by1 = Math.max(by1, y);
        }
      }
    }
    if (!(bx1 - bx0 > 3 && by1 - by0 > 3)) return;
    bx0 = Math.max(0, bx0 - 2);
    by0 = Math.max(0, by0 - 2);
    const w = Math.min(TARGET_W, bx1 + 2) - bx0;
    const h = Math.min(TARGET_H, by1 + 2) - by0;
    const tex = bake(`fragment-${known}-${i}`, w, h, (ctx) => {
      ctx.translate(-bx0, -by0);
      ctx.save();
      ctx.clip(path);
      ctx.drawImage(src, 0, 0, TARGET_W, TARGET_H);
      ctx.restore();
      // The soft ground shadow stays behind on the ground: keep only the solid painting.
      const img = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height);
      for (let k = 3; k < img.data.length; k += 4) img.data[k] = Math.max(0, Math.min(255, ((img.data[k] - 140) / 115) * 255));
      ctx.putImageData(img, 0, 0);
      // The fresh break: a pale lip of body clay with a darker core line.
      ctx.save();
      ctx.globalCompositeOperation = 'source-atop';
      ctx.strokeStyle = edge;
      ctx.lineWidth = 2.6;
      ctx.stroke(path);
      ctx.strokeStyle = core;
      ctx.lineWidth = 0.8;
      ctx.stroke(path);
      ctx.restore();
    }, 3);
    out.push({ tex, x: bx0 + w / 2 - TARGET_W / 2, y: by0 + h / 2 - 150, w, h });
  });
  fragments.set(known, out);
  return out;
}

/** Keep the part of `poly` nearer `a` than `b` (Sutherland–Hodgman against the bisector). */
function clipHalf(poly: Pt[], a: Pt, b: Pt): Pt[] {
  const mx = (a[0] + b[0]) / 2;
  const my = (a[1] + b[1]) / 2;
  const nx = b[0] - a[0];
  const ny = b[1] - a[1];
  const side = (p: Pt) => (p[0] - mx) * nx + (p[1] - my) * ny;
  const out: Pt[] = [];
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i];
    const q = poly[(i + 1) % poly.length];
    const sp = side(p);
    const sq = side(q);
    if (sp <= 0) out.push(p);
    if (sp * sq < 0) {
      const t = sp / (sp - sq);
      out.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]);
    }
  }
  return out;
}

// ------------------------------------------------------------ stone light

const STONE_BOX = 128;

/** How each hill's light falls on its stone: the lit side, the shade, and what bounces up from below. */
const STONE_LIGHT: Record<string, { hi: string; shade: string; bounce: string; spec: number }> = {
  first_hill: { hi: 'rgba(255, 238, 200, 0.5)', shade: 'rgba(38, 20, 10, 0.55)', bounce: 'rgba(236, 180, 120, 0.3)', spec: 0.25 },
  tartarus_rim: { hi: 'rgba(255, 200, 150, 0.3)', shade: 'rgba(20, 6, 4, 0.6)', bounce: 'rgba(255, 110, 40, 0.65)', spec: 0.15 },
  leaking_heights: { hi: 'rgba(230, 244, 255, 0.45)', shade: 'rgba(14, 20, 30, 0.5)', bounce: 'rgba(150, 200, 230, 0.35)', spec: 0.8 },
  bronze_pass: { hi: 'rgba(255, 226, 160, 0.5)', shade: 'rgba(30, 16, 6, 0.55)', bounce: 'rgba(230, 150, 70, 0.35)', spec: 0.9 },
  skyward_escarpment: { hi: 'rgba(200, 220, 255, 0.45)', shade: 'rgba(8, 10, 24, 0.6)', bounce: 'rgba(110, 130, 220, 0.3)', spec: 0.35 },
  olympian_approach: { hi: 'rgba(255, 240, 190, 0.6)', shade: 'rgba(40, 26, 10, 0.45)', bounce: 'rgba(255, 210, 120, 0.4)', spec: 0.55 },
};

/**
 * The light on a rolling stone, which must not roll with it: the stone art
 * turns underneath while this stays put, lit from the hill's sun and shaded
 * below right, with light bounced up from the ground. Kept inside the rim
 * (the rim filter lights the edge) and feathered so a craggy outline never
 * shows past it. `r` is the stone's drawn radius.
 */
export function stoneLightTexture(siteId: string, r: number): Texture {
  const look = STONE_LIGHT[siteId] ?? STONE_LIGHT.first_hill;
  return bake(`stone-light-${siteId}-${r}`, STONE_BOX, STONE_BOX, (ctx) => {
    const c = STONE_BOX / 2;
    const R = r * 0.93;
    // The ball's shading: dark across the far side, deepest low right.
    const shade = ctx.createRadialGradient(c + LIGHT.x * R * 0.55, c + LIGHT.y * R * 0.55, R * 0.2, c + LIGHT.x * R * 0.2, c + LIGHT.y * R * 0.2, R * 1.35);
    shade.addColorStop(0, look.shade.replace(/[\d.]+\)$/, '0)'));
    shade.addColorStop(0.55, look.shade.replace(/[\d.]+\)$/, '0.08)'));
    shade.addColorStop(1, look.shade);
    ctx.fillStyle = shade;
    ctx.fill(circle(c, c, R));
    // Bounced light along the underside, then the lit shoulder.
    ctx.save();
    ctx.clip(circle(c, c, R));
    ctx.globalCompositeOperation = 'screen';
    const bounce = ctx.createLinearGradient(0, c + R * 0.35, 0, c + R);
    bounce.addColorStop(0, look.bounce.replace(/[\d.]+\)$/, '0)'));
    bounce.addColorStop(1, look.bounce);
    ctx.fillStyle = bounce;
    ctx.fillRect(0, c + R * 0.35, STONE_BOX, R);
    ctx.restore();
    wash(ctx, circle(c, c, R), c + LIGHT.x * R * 0.45, c + LIGHT.y * R * 0.45, R * 0.75, look.hi, 'screen');
    if (look.spec > 0) {
      // A small hot highlight: bright on wet stone and bronze, faint on dry rock.
      ctx.save();
      ctx.filter = `blur(${2.2 * ctx.getTransform().a}px)`;
      ctx.globalCompositeOperation = 'screen';
      ctx.fillStyle = `rgba(255, 252, 240, ${look.spec})`;
      ctx.beginPath();
      ctx.ellipse(c + LIGHT.x * R * 0.52, c + LIGHT.y * R * 0.52, R * 0.16, R * 0.1, -0.65, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    // Feather the edge so it sits inside any outline.
    ctx.save();
    ctx.globalCompositeOperation = 'destination-in';
    const edge = ctx.createRadialGradient(c, c, R * 0.8, c, c, R);
    edge.addColorStop(0, 'rgba(0, 0, 0, 1)');
    edge.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = edge;
    ctx.fillRect(0, 0, STONE_BOX, STONE_BOX);
    ctx.restore();
  }, 3);
}

/** A light texture's size in world units. */
export const STONE_LIGHT_BOX = STONE_BOX;

// ------------------------------------------------------------------ warm-up

/**
 * Paint the pieces ahead of need, a few at a time while the browser is idle,
 * so the first blow or relic never waits on a canvas. `looks` are the
 * materials whose sherds and chips will fly.
 */
export function warmPaintings(siteIds: string[], looks: SherdLook[]): void {
  const jobs: (() => unknown)[] = [
    () => obolTexture('face'),
    () => obolTexture('back'),
    () => dustTextures(),
    () => leafTextures('gold'),
    () => leafTextures('bay'),
    () => starTexture('gold'),
    () => starTexture('silver'),
    () => burstTexture('clay', 20),
    () => burstTexture('bronze', 16),
    () => burstTexture('bronze', 12),
    () => burstTexture('gold', 24),
    () => sealTexture(),
    ...siteIds.map((id) => () => stoneLightTexture(id, 60)),
    ...looks.flatMap((look) => [() => sherdTextures(look), () => pebbleTextures(look)]),
    ...['debris', 'coin_amphora', 'gilded_offering'].map((kind) => () => targetFragments(kind)),
  ];
  const run = () => {
    const start = performance.now();
    while (jobs.length && performance.now() - start < 8) jobs.shift()!();
    if (jobs.length) later();
  };
  const later = () => (typeof requestIdleCallback === 'function' ? requestIdleCallback(run, { timeout: 500 }) : setTimeout(run, 40));
  later();
}
