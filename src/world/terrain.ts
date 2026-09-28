import { GROUND_Y, HILL, STAGE_H, STAGE_W, UP_NORMAL } from './geometry';

export type RGB = [number, number, number];
const INK: RGB = [0x21, 0x1b, 0x17];
const PALE: RGB = [0xd9, 0x9c, 0x6c];
const IVORY: RGB = [0xf6, 0xec, 0xdc];
const BRONZE: RGB = [0xa5, 0x7b, 0x3b];
export const DEFAULT_GROUND: RGB = [0xb6, 0x5d, 0x35];
export const DEFAULT_SKY: RGB = [0xea, 0xcf, 0xa5];

export const mix = (a: RGB, b: RGB, t: number): RGB => [0, 1, 2].map((i) => Math.round(a[i] + (b[i] - a[i]) * t)) as RGB;
export const css = (c: RGB, alpha = 1) => `rgba(${c[0]},${c[1]},${c[2]},${alpha})`;
export const hex = (c: RGB) => (c[0] << 16) | (c[1] << 8) | c[2];

export function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Drawable = CanvasImageSource & { width: number; height: number };
type G = CanvasRenderingContext2D;
type P = { x: number; y: number };

function average(plate: Drawable, sx: number, sy: number, sw: number, sh: number): RGB | null {
  try {
    const c = document.createElement('canvas');
    c.width = c.height = 8;
    const g = c.getContext('2d', { willReadFrequently: true });
    if (!g) return null;
    g.drawImage(plate, sx, sy, sw, sh, 0, 0, 8, 8);
    const d = g.getImageData(0, 0, 8, 8).data;
    const sum: RGB = [0, 0, 0];
    for (let i = 0; i < d.length; i += 4) for (let k = 0; k < 3; k++) sum[k] += d[i + k];
    return sum.map((v) => Math.round(v / 64)) as RGB;
  } catch { return null; }
}

export function sampleGround(plate: Drawable): RGB | null {
  return average(plate, plate.width * 0.04, plate.height * 0.74, plate.width * 0.92, plate.height * 0.16);
}
export function sampleSky(plate: Drawable): RGB | null {
  return average(plate, plate.width * 0.3, 0, plate.width * 0.4, Math.max(2, plate.height * 0.012));
}

const { footLeft: A, summitLeft: B, summitRight: C, footRight: D } = HILL;
const N = UP_NORMAL;
const route = (u: number, offset = 0): P => ({ x: A.x + (B.x - A.x) * u + N.x * offset, y: A.y + (B.y - A.y) * u + N.y * offset });

function path(g: G, points: P[], close = false) {
  g.beginPath();
  points.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)));
  if (close) g.closePath();
}

function cypress(g: G, x: number, y: number, h: number, clay: RGB) {
  g.fillStyle = css(INK);
  g.fillRect(x - 2, y - h * 0.18, 4, h * 0.2);
  g.beginPath();
  g.moveTo(x, y - h);
  g.bezierCurveTo(x - h * 0.11, y - h * 0.72, x - h * 0.09, y - h * 0.26, x, y - h * 0.12);
  g.bezierCurveTo(x + h * 0.09, y - h * 0.26, x + h * 0.11, y - h * 0.72, x, y - h);
  g.fill();
  g.strokeStyle = css(clay, 0.55);
  g.lineWidth = 1.5;
  g.beginPath(); g.moveTo(x, y - h * 0.18); g.lineTo(x, y - h * 0.76); g.stroke();
}

function temple(g: G, x: number, y: number, scale: number, clay: RGB) {
  g.fillStyle = css(INK); g.strokeStyle = css(clay, 0.7); g.lineWidth = 2;
  g.beginPath(); g.moveTo(x - 48 * scale, y - 48 * scale); g.lineTo(x, y - 72 * scale); g.lineTo(x + 48 * scale, y - 48 * scale); g.closePath(); g.fill(); g.stroke();
  g.fillRect(x - 45 * scale, y - 47 * scale, 90 * scale, 9 * scale);
  g.fillRect(x - 50 * scale, y - 8 * scale, 100 * scale, 9 * scale);
  for (const dx of [-34, -12, 12, 34]) g.fillRect(x + dx * scale - 4 * scale, y - 39 * scale, 8 * scale, 32 * scale);
}

function rock(g: G, x: number, y: number, w: number, h: number, clay: RGB) {
  g.fillStyle = css(INK); g.beginPath(); g.moveTo(x - w * 0.52, y); g.quadraticCurveTo(x - w * 0.48, y - h * 0.72, x - w * 0.08, y - h); g.quadraticCurveTo(x + w * 0.38, y - h * 0.86, x + w * 0.52, y); g.closePath(); g.fill();
  g.strokeStyle = css(clay, 0.5); g.lineWidth = 1.5; g.beginPath(); g.moveTo(x - w * 0.1, y - h * 0.84); g.lineTo(x + w * 0.02, y - h * 0.48); g.lineTo(x - w * 0.16, y - h * 0.24); g.stroke();
}

function shrub(g: G, x: number, y: number, r: number, clay: RGB) {
  g.strokeStyle = css(INK); g.lineWidth = Math.max(1.5, r * 0.1); g.lineCap = 'round';
  for (const a of [-1.2, -0.9, -0.6, -0.3]) {
    const tx = x + Math.cos(a) * r, ty = y + Math.sin(a) * r;
    g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo((x + tx) / 2, ty + r * 0.18, tx, ty); g.stroke();
    g.fillStyle = css(INK); g.beginPath(); g.ellipse(tx, ty, r * 0.22, r * 0.1, a, 0, Math.PI * 2); g.fill();
  }
  g.strokeStyle = css(clay, 0.55); g.lineWidth = 1; g.beginPath(); g.moveTo(x - r * 0.6, y - r * 0.6); g.lineTo(x + r * 0.45, y - r * 0.25); g.stroke();
}

export interface TerrainOptions { footholds: boolean }

/** A restrained black-figure mountain built around the authoritative route. */
export function paintTerrain(ground: RGB, seed: number, res: number, opts: TerrainOptions): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(STAGE_W * res); canvas.height = Math.round(STAGE_H * res);
  const g = canvas.getContext('2d')!; g.scale(res, res);
  const random = rng(seed);
  const clay = mix(ground, PALE, 0.14), clayDark = mix(ground, INK, 0.18), clayLight = mix(ground, IVORY, 0.28);

  path(g, [{ x: 70, y: GROUND_Y + 6 }, A, B, C, { x: 1170, y: 430 }, { x: 1290, y: 610 }, D, { x: 1510, y: GROUND_Y + 6 }], true);
  g.fillStyle = css(clay); g.fill(); g.strokeStyle = css(INK); g.lineWidth = 7; g.lineJoin = 'round'; g.stroke();

  path(g, [A, B, { x: 1012, y: GROUND_Y + 6 }, { x: 70, y: GROUND_Y + 6 }], true);
  g.fillStyle = css(clayDark, 0.18); g.fill();

  path(g, [{ x: 946, y: 340 }, C, { x: 1170, y: 430 }, { x: 1290, y: 610 }, D, { x: 1320, y: GROUND_Y + 6 }, { x: 1090, y: GROUND_Y + 6 }, { x: 1030, y: 575 }], true);
  g.fillStyle = css(INK); g.fill();

  // Broad clay facets keep the cliff dimensional without turning it noisy.
  g.fillStyle = css(clayDark, 0.44);
  for (const facet of [
    [{ x: 960, y: 362 }, { x: 1025, y: 406 }, { x: 1000, y: 520 }, { x: 1040, y: 576 }, { x: 1082, y: 704 }, { x: 1048, y: 748 }],
    [{ x: 1080, y: 350 }, { x: 1150, y: 438 }, { x: 1120, y: 526 }, { x: 1185, y: 650 }, { x: 1160, y: 744 }, { x: 1100, y: 620 }],
    [{ x: 1200, y: 505 }, { x: 1268, y: 620 }, { x: 1325, y: 738 }, { x: 1240, y: 748 }, { x: 1218, y: 650 }],
  ]) { path(g, facet, true); g.fill(); }

  g.strokeStyle = css(clay, 0.62); g.lineWidth = 2.3; g.lineCap = 'round';
  for (const pts of [
    [{ x: 1005, y: 390 }, { x: 1060, y: 465 }, { x: 1038, y: 548 }, { x: 1102, y: 635 }],
    [{ x: 1100, y: 420 }, { x: 1142, y: 510 }, { x: 1120, y: 596 }],
    [{ x: 1190, y: 530 }, { x: 1225, y: 620 }, { x: 1202, y: 704 }],
  ]) { path(g, pts); g.stroke(); }

  path(g, [{ x: C.x + 22, y: C.y + 18 }, { x: C.x + 78, y: C.y + 25 }, { x: D.x + 8, y: D.y - 18 }, { x: D.x - 72, y: D.y - 12 }], true);
  g.fillStyle = css(clayLight); g.fill(); g.strokeStyle = css(INK); g.lineWidth = 4; g.stroke();
  g.strokeStyle = css(BRONZE, 0.75); g.lineWidth = 2;
  for (let i = 1; i < 8; i++) {
    const t = i / 8, x = C.x + 48 + (D.x - C.x - 88) * t, y = C.y + 34 + (D.y - C.y - 52) * t;
    g.beginPath(); g.moveTo(x - 28, y - 14); g.lineTo(x + 23, y + 13); g.stroke();
  }

  g.strokeStyle = css(clayLight, 0.5); g.lineWidth = 5;
  g.beginPath(); g.moveTo(315, 716); g.bezierCurveTo(520, 650, 650, 570, 710, 500); g.bezierCurveTo(790, 410, 860, 382, 968, 348); g.stroke();

  if (opts.footholds) {
    g.strokeStyle = css(IVORY, 0.85); g.lineWidth = 5;
    for (let i = 5; i < 10; i++) { const p = route(i / 11, -5); g.beginPath(); g.moveTo(p.x - 12, p.y + 5); g.lineTo(p.x + 15, p.y + 5); g.stroke(); }
  }

  temple(g, 1045, 310, 0.7, clay); cypress(g, 970, 319, 76, clay); cypress(g, 1124, 350, 70, clay); cypress(g, 945, 350, 46, clay);
  shrub(g, 610, 620, 26, clay); shrub(g, 785, 500, 22, clay); shrub(g, 1282, 718, 28, clay);
  rock(g, 930, GROUND_Y + 6, 150, 64, clay); rock(g, 1378, GROUND_Y + 6, 110, 50, clay);

  g.fillStyle = css(INK, 0.07);
  for (let i = 0; i < 260; i++) { const x = 90 + random() * 1400, y = 335 + random() * 410; g.fillRect(x, y, 1 + random() * 2.2, 1 + random() * 1.4); }
  return canvas;
}

export const FRIEZE_W = 60;
export const FRIEZE_H = 56;
export function paintFriezeTile(ground: RGB, res: number): HTMLCanvasElement {
  const c = document.createElement('canvas'); c.width = FRIEZE_W * res; c.height = FRIEZE_H * res;
  const g = c.getContext('2d')!; g.scale(res, res); g.fillStyle = css(INK); g.fillRect(0, 0, FRIEZE_W, FRIEZE_H);
  g.fillStyle = css(mix(ground, PALE, 0.18)); g.fillRect(0, 7, FRIEZE_W, 42); g.strokeStyle = css(INK); g.lineWidth = 4; g.strokeRect(-2, 10, FRIEZE_W + 4, 36);
  g.lineWidth = 3; g.beginPath(); g.moveTo(-2, 28); g.lineTo(10, 28); g.lineTo(10, 18); g.lineTo(28, 18); g.lineTo(28, 38); g.lineTo(46, 38); g.lineTo(46, 28); g.lineTo(FRIEZE_W + 2, 28); g.stroke();
  return c;
}

export function paintVignette(): HTMLCanvasElement {
  const c = document.createElement('canvas'); c.width = STAGE_W; c.height = STAGE_H;
  const g = c.getContext('2d')!, gradient = g.createRadialGradient(STAGE_W / 2, STAGE_H * 0.47, STAGE_H * 0.2, STAGE_W / 2, STAGE_H * 0.47, STAGE_W * 0.68);
  gradient.addColorStop(0, 'rgba(33,27,23,0)'); gradient.addColorStop(0.72, 'rgba(33,27,23,0.015)'); gradient.addColorStop(1, 'rgba(33,27,23,0.18)');
  g.fillStyle = gradient; g.fillRect(0, 0, STAGE_W, STAGE_H); return c;
}
