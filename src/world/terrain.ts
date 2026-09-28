import { GROUND_Y, HILL, STAGE_H, STAGE_W, UP_DIR, UP_NORMAL } from './geometry';

/**
 * Renderer-side hill treatment. The delivered hill layer is a flat trapezoid
 * that vanishes into the painted ground, so the renderer paints its own hill
 * on the same route geometry: a sunlit route face, a shaded back face, strata,
 * screenprint grain and a cast shadow, all tinted from the scene's own ground.
 */
export type RGB = [number, number, number];

const INK: RGB = [0x21, 0x1b, 0x17];
const PALE: RGB = [0xd9, 0x9c, 0x6c];
const IVORY: RGB = [0xf6, 0xec, 0xdc];
/** Pottery clay, used until the scene plate has loaded and been sampled. */
export const DEFAULT_GROUND: RGB = [0xb6, 0x5d, 0x35];

const mix = (a: RGB, b: RGB, t: number): RGB => [0, 1, 2].map((i) => Math.round(a[i] + (b[i] - a[i]) * t)) as RGB;
const css = (c: RGB, alpha = 1) => `rgba(${c[0]},${c[1]},${c[2]},${alpha})`;

/** Small deterministic PRNG so every site paints the same hill each time. */
function rng(seed: number): () => number {
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

/** Average colour of the open ground in front of the hill on a scene plate. */
export function sampleGround(plate: Drawable): RGB | null {
  try {
    const c = document.createElement('canvas');
    c.width = c.height = 8;
    const g = c.getContext('2d', { willReadFrequently: true });
    if (!g) return null;
    const { width: w, height: h } = plate;
    g.drawImage(plate, w * 0.04, h * 0.74, w * 0.92, h * 0.16, 0, 0, 8, 8);
    const d = g.getImageData(0, 0, 8, 8).data;
    const sum: RGB = [0, 0, 0];
    for (let i = 0; i < d.length; i += 4) for (let k = 0; k < 3; k++) sum[k] += d[i + k];
    return sum.map((v) => Math.round(v / 64)) as RGB;
  } catch {
    return null;
  }
}

/** Soft-edged drawing where the canvas supports filters; plain otherwise. */
function soft(g: CanvasRenderingContext2D, blur: number, draw: () => void) {
  g.save();
  if ('filter' in g) g.filter = `blur(${blur}px)`;
  draw();
  g.restore();
}

const { footLeft: A, summitLeft: B, summitRight: C, footRight: D } = HILL;
const BASE = GROUND_Y + 6;
const TOE_L = A.x - 44;
const TOE_R = D.x + 50;
/** The back face bows inward slightly, clear of the descent path. */
const BACK_CTRL = { x: (C.x + D.x) / 2 - 48, y: (C.y + D.y) / 2 + 36 };

function hillPath(g: CanvasRenderingContext2D) {
  g.beginPath();
  g.moveTo(TOE_L, BASE);
  g.quadraticCurveTo(A.x - 14, GROUND_Y + 1, A.x, GROUND_Y);
  // The route face stays exactly on the rolling line.
  g.lineTo(B.x, B.y);
  g.lineTo(C.x, C.y);
  g.quadraticCurveTo(BACK_CTRL.x, BACK_CTRL.y, D.x, D.y);
  g.quadraticCurveTo(D.x + 16, GROUND_Y + 1, TOE_R, BASE);
  g.closePath();
}

function silhouette(g: CanvasRenderingContext2D) {
  g.beginPath();
  g.moveTo(TOE_L, BASE);
  g.quadraticCurveTo(A.x - 14, GROUND_Y + 1, A.x, GROUND_Y);
  g.lineTo(B.x, B.y);
  g.lineTo(C.x, C.y);
  g.quadraticCurveTo(BACK_CTRL.x, BACK_CTRL.y, D.x, D.y);
  g.quadraticCurveTo(D.x + 16, GROUND_Y + 1, TOE_R, BASE);
}

/** A point `depth` px inside the route face at progress u. */
function onFace(u: number, depth: number) {
  return { x: A.x + (B.x - A.x) * u - UP_NORMAL.x * depth, y: A.y + (B.y - A.y) * u - UP_NORMAL.y * depth };
}

function rock(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, body: RGB, lit: RGB, rand: () => number) {
  const pts: [number, number][] = [];
  const n = 7;
  for (let i = 0; i < n; i++) {
    const a = Math.PI + (i / (n - 1)) * Math.PI;
    const r = 0.8 + rand() * 0.25;
    pts.push([x + Math.cos(a) * w * r, y + Math.sin(a) * h * r]);
  }
  g.beginPath();
  g.moveTo(pts[0][0], y);
  for (const [px, py] of pts) g.lineTo(px, py);
  g.lineTo(x + w, y);
  g.closePath();
  g.fillStyle = css(body);
  g.fill();
  // Sun from the upper left catches the top-left of each stone.
  g.save();
  g.clip();
  g.fillStyle = css(lit, 0.8);
  g.beginPath();
  g.ellipse(x - w * 0.35, y - h * 0.85, w * 0.7, h * 0.45, -0.2, 0, Math.PI * 2);
  g.fill();
  g.restore();
  g.strokeStyle = css(INK, 0.85);
  g.lineWidth = 1.6;
  g.stroke();
  g.fillStyle = css(INK, 0.25);
  g.beginPath();
  g.ellipse(x + w * 0.25, y + 1.5, w * 1.05, 2.5, 0, 0, Math.PI * 2);
  g.fill();
}

function tuft(g: CanvasRenderingContext2D, x: number, y: number, size: number, rand: () => number) {
  g.strokeStyle = css(INK, 0.75);
  g.lineCap = 'round';
  g.lineWidth = 1.6;
  const blades = 4 + Math.floor(rand() * 4);
  for (let i = 0; i < blades; i++) {
    const lean = (i / (blades - 1) - 0.5) * 1.3 + (rand() - 0.5) * 0.3;
    const len = size * (0.6 + rand() * 0.5);
    g.beginPath();
    g.moveTo(x + (i - blades / 2) * 1.6, y);
    g.quadraticCurveTo(x + lean * len * 0.3, y - len * 0.6, x + lean * len * 0.8, y - len);
    g.stroke();
  }
}

/** Paint the hill and nearby ground details into a stage-sized canvas. */
export function paintTerrain(ground: RGB, seed: number, res = 1.5): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(STAGE_W * res);
  canvas.height = Math.round(STAGE_H * res);
  const g = canvas.getContext('2d')!;
  g.scale(res, res);
  const rand = rng(seed);

  const lit = mix(ground, PALE, 0.42);
  const mid = mix(ground, PALE, 0.12);
  const low = mix(ground, INK, 0.12);
  const shadow = mix(ground, INK, 0.52);
  const rim = mix(ground, IVORY, 0.62);
  const stone = mix(ground, INK, 0.38);

  // Cast shadow: the sun sits high behind the left of the hill.
  soft(g, 14, () => {
    g.fillStyle = css(INK, 0.3);
    g.beginPath();
    g.moveTo(A.x + 260, GROUND_Y);
    g.lineTo(D.x + 20, GROUND_Y);
    g.lineTo(D.x + 170, GROUND_Y + 40);
    g.lineTo(A.x + 520, GROUND_Y + 56);
    g.closePath();
    g.fill();
  });
  // Contact darkening where the hill meets the plain.
  soft(g, 6, () => {
    g.fillStyle = css(INK, 0.22);
    g.beginPath();
    g.ellipse((TOE_L + TOE_R) / 2, BASE, (TOE_R - TOE_L) / 2 + 20, 12, 0, 0, Math.PI * 2);
    g.fill();
  });

  // Body: lit from the upper left.
  hillPath(g);
  const body = g.createLinearGradient(A.x + 200, B.y, C.x + 200, GROUND_Y);
  body.addColorStop(0, css(lit));
  body.addColorStop(0.45, css(mid));
  body.addColorStop(1, css(low));
  g.fillStyle = body;
  g.fill();

  g.save();
  hillPath(g);
  g.clip();

  // Strata: slightly wavy bedding lines across the whole mass.
  for (let y = B.y + 26; y < GROUND_Y - 8; y += 30 + rand() * 16) {
    const phase = rand() * 10;
    const amp = 2 + rand() * 3;
    g.beginPath();
    for (let x = A.x - 60; x <= D.x + 60; x += 16) {
      const yy = y + Math.sin(x * 0.011 + phase) * amp + (x - 800) * 0.018;
      if (x === A.x - 60) g.moveTo(x, yy);
      else g.lineTo(x, yy);
    }
    g.strokeStyle = css(IVORY, 0.13 + rand() * 0.08);
    g.lineWidth = 1.4 + rand();
    g.stroke();
  }

  // Back face in shadow, divided from the lit face by a soft ridge.
  const ridge = { top: { x: (B.x + C.x) / 2 + 8, y: B.y }, ctrl: { x: C.x + 10, y: 560 }, foot: { x: C.x + 70, y: BASE } };
  const shadowPath = () => {
    g.beginPath();
    g.moveTo(ridge.top.x, ridge.top.y - 4);
    g.quadraticCurveTo(ridge.ctrl.x, ridge.ctrl.y, ridge.foot.x, ridge.foot.y + 4);
    g.lineTo(TOE_R + 40, BASE + 4);
    g.lineTo(TOE_R + 40, C.y - 10);
    g.closePath();
  };
  soft(g, 2.5, () => {
    shadowPath();
    const sh = g.createLinearGradient(0, C.y, 0, GROUND_Y);
    sh.addColorStop(0, css(shadow, 0.9));
    sh.addColorStop(1, css(mix(shadow, ground, 0.35), 0.9));
    g.fillStyle = sh;
    g.fill();
  });
  // Screenprint hatching in the shadow.
  g.save();
  shadowPath();
  g.clip();
  g.strokeStyle = css(INK, 0.16);
  g.lineWidth = 1.2;
  for (let k = -600; k < 900; k += 8) {
    g.beginPath();
    g.moveTo(C.x - 200 + k, C.y - 20);
    g.lineTo(C.x - 200 + k + 460, C.y + 460);
    g.stroke();
  }
  g.restore();

  // Occlusion toward the foot.
  const occ = g.createLinearGradient(0, GROUND_Y - 90, 0, BASE);
  occ.addColorStop(0, css(INK, 0));
  occ.addColorStop(1, css(INK, 0.26));
  g.fillStyle = occ;
  g.fillRect(TOE_L - 10, GROUND_Y - 90, TOE_R - TOE_L + 20, 100);

  // Grain.
  for (let i = 0; i < 2600; i++) {
    const x = TOE_L + rand() * (TOE_R - TOE_L);
    const y = B.y + rand() * (BASE - B.y);
    const light = rand() < 0.6;
    g.fillStyle = light ? css(IVORY, 0.08 + rand() * 0.16) : css(INK, 0.06 + rand() * 0.1);
    g.beginPath();
    g.arc(x, y, 0.5 + rand() * 1.3, 0, Math.PI * 2);
    g.fill();
  }

  // Embedded stones on both faces, kept clear of the rolling line.
  for (let i = 0; i < 6; i++) {
    const u = 0.1 + rand() * 0.8;
    const p = onFace(u, 50 + rand() * 150);
    if (p.y > GROUND_Y - 20) continue;
    const w = 8 + rand() * 9;
    rock(g, p.x, p.y, w, w * (0.7 + rand() * 0.3), stone, lit, rand);
  }
  for (let i = 0; i < 3; i++) {
    const x = C.x + 30 + rand() * 200;
    const y = C.y + 120 + rand() * 280;
    if (y > GROUND_Y - 20) continue;
    const w = 7 + rand() * 7;
    rock(g, x, y, w, w * 0.8, mix(stone, INK, 0.3), shadow, rand);
  }

  // The worn track: packed paler earth just under the rolling line.
  g.lineCap = 'round';
  const trackA = onFace(0.02, 9);
  const trackB = onFace(0.995, 9);
  g.strokeStyle = css(rim, 0.34);
  g.lineWidth = 10;
  g.beginPath();
  g.moveTo(trackA.x, trackA.y);
  g.lineTo(trackB.x, trackB.y);
  g.stroke();
  g.setLineDash([3, 22]);
  g.strokeStyle = css(INK, 0.28);
  g.lineWidth = 4;
  const scuffA = onFace(0.03, 16);
  const scuffB = onFace(0.98, 16);
  g.beginPath();
  g.moveTo(scuffA.x, scuffA.y);
  g.lineTo(scuffB.x, scuffB.y);
  g.stroke();
  g.setLineDash([]);
  g.restore();

  // Sunlit rim along the route face and plateau, then a fine ink edge.
  g.save();
  hillPath(g);
  g.clip();
  g.strokeStyle = css(rim, 0.75);
  g.lineWidth = 5;
  g.beginPath();
  g.moveTo(A.x + 20 * UP_DIR.x, A.y + 20 * UP_DIR.y + 2);
  g.lineTo(B.x, B.y + 2);
  g.lineTo(C.x - 6, C.y + 2);
  g.stroke();
  g.restore();
  silhouette(g);
  g.strokeStyle = css(INK, 0.92);
  g.lineWidth = 2.6;
  g.lineJoin = 'round';
  g.stroke();

  // Summit cairn: a few stacked stones at the top of the route.
  rock(g, C.x - 20, C.y, 12, 9, stone, lit, rand);
  rock(g, C.x - 8, C.y - 8, 8, 6, stone, lit, rand);

  // Ground details: pebbles on the plain, dry tufts at the hill's feet.
  for (let i = 0; i < 70; i++) {
    const x = rand() * STAGE_W;
    const y = GROUND_Y + 8 + rand() * 70;
    const s = 1.5 + rand() * 4.5;
    g.fillStyle = css(rand() < 0.5 ? stone : mix(ground, IVORY, 0.4), 0.55 + rand() * 0.4);
    g.beginPath();
    g.ellipse(x, y, s, s * 0.6, 0, 0, Math.PI * 2);
    g.fill();
  }
  for (const [x, y, size] of [
    [TOE_L - 20, BASE + 4, 16],
    [A.x + 60, BASE + 10, 12],
    [TOE_R + 12, BASE + 2, 18],
    [TOE_R + 150, BASE + 22, 13],
    [40, GROUND_Y + 22, 15],
    [760, BASE + 30, 11],
  ] as const) {
    tuft(g, x, y, size, rand);
  }
  return canvas;
}

/** A screen-space vignette canvas: warm light in the centre, ink at the edges. */
export function paintVignette(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d')!;
  const v = g.createRadialGradient(128, 110, 40, 128, 128, 190);
  v.addColorStop(0, css(INK, 0));
  v.addColorStop(0.65, css(INK, 0.05));
  v.addColorStop(1, css(INK, 0.38));
  g.fillStyle = v;
  g.fillRect(0, 0, 256, 256);
  return c;
}
