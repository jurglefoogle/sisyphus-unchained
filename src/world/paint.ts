import { CanvasSource, Texture } from 'pixi.js';

/**
 * A small painter's kit for art the renderer makes itself. Each piece is
 * painted once onto a canvas at several times its world size (lit, textured,
 * glazed, inked) and cached as a mipmapped texture, so a shard or a coin
 * holds up next to the painted plates instead of reading as a flat vector.
 *
 * Coordinates inside `bake` are world units; the light comes from the upper
 * left, as on most of the hills.
 */

export type Ctx = CanvasRenderingContext2D;

/** Where the light comes from, as a unit vector (upper left). */
export const LIGHT = { x: -0.6, y: -0.8 };

const cache = new Map<string, Texture>();

/** Paint `w` × `h` world units at `res` pixels per unit; cached by `key`. */
export function bake(key: string, w: number, h: number, draw: (ctx: Ctx) => void, res = 3): Texture {
  const hit = cache.get(key);
  if (hit) return hit;
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(w * res);
  canvas.height = Math.ceil(h * res);
  const ctx = canvas.getContext('2d')!;
  ctx.scale(res, res);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  draw(ctx);
  const texture = new Texture({ source: new CanvasSource({ resource: canvas, resolution: res, autoGenerateMipmaps: true, scaleMode: 'linear' }) });
  cache.set(key, texture);
  return texture;
}

/** The canvas behind a baked texture, for painting one piece into another. */
export function canvasOf(texture: Texture): HTMLCanvasElement {
  return texture.source.resource as HTMLCanvasElement;
}

/** Deterministic random numbers, so a piece paints the same every time. */
export function rng(seed: number): () => number {
  let a = (seed * 2654435761) >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function css(color: number, alpha = 1): string {
  return `rgba(${(color >> 16) & 255}, ${(color >> 8) & 255}, ${color & 255}, ${alpha})`;
}

/** Mix two 0xRRGGBB colours. */
export function mix(a: number, b: number, t: number): number {
  const ch = (s: number) => Math.round(((a >> s) & 255) * (1 - t) + ((b >> s) & 255) * t);
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
}

// ------------------------------------------------------------------ noise

let tile: HTMLCanvasElement | null = null;

/** A tileable mottle (value noise over four octaves, plus a fine tooth). */
function noiseTile(): HTMLCanvasElement {
  if (tile) return tile;
  const N = 256;
  const r = rng(7);
  const grids = [4, 8, 16, 32, 64].map((n) => ({ n, v: Array.from({ length: n * n }, r) }));
  const img = new ImageData(N, N);
  const smooth = (t: number) => t * t * (3 - 2 * t);
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      let v = 0;
      let amp = 0.5;
      let total = 0;
      for (const { n, v: g } of grids) {
        const fx = (x / N) * n;
        const fy = (y / N) * n;
        const x0 = Math.floor(fx);
        const y0 = Math.floor(fy);
        const tx = smooth(fx - x0);
        const ty = smooth(fy - y0);
        const at = (i: number, j: number) => g[((j + n) % n) * n + ((i + n) % n)];
        const top = at(x0, y0) * (1 - tx) + at(x0 + 1, y0) * tx;
        const bottom = at(x0, y0 + 1) * (1 - tx) + at(x0 + 1, y0 + 1) * tx;
        v += (top * (1 - ty) + bottom * ty) * amp;
        total += amp;
        amp *= 0.55;
      }
      v = v / total + (r() - 0.5) * 0.22;
      const c = Math.max(0, Math.min(255, Math.round(v * 255)));
      const i = (y * N + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = c;
      img.data[i + 3] = 255;
    }
  }
  tile = document.createElement('canvas');
  tile.width = tile.height = N;
  tile.getContext('2d')!.putImageData(img, 0, 0);
  return tile;
}

/**
 * Lay the mottle over what is already painted inside `path` (overlay keeps
 * the colour and adds the tooth of fired clay or cast metal). `grain` is the
 * size of the mottle in world units per noise pixel.
 */
export function texture(ctx: Ctx, path: Path2D, amount: number, grain = 0.12, seed = 0, mode: GlobalCompositeOperation = 'overlay'): void {
  const pattern = ctx.createPattern(noiseTile(), 'repeat')!;
  const r = rng(seed + 11);
  pattern.setTransform(new DOMMatrix([grain, 0, 0, grain, r() * 200, r() * 200]));
  ctx.save();
  ctx.clip(path);
  ctx.globalCompositeOperation = mode;
  ctx.globalAlpha = amount;
  ctx.fillStyle = pattern;
  ctx.fillRect(-1000, -1000, 2000, 2000);
  ctx.restore();
}

// ---------------------------------------------------------------- shading

function resOf(ctx: Ctx): number {
  return ctx.getTransform().a;
}

/**
 * A shadow or light cast inward from the edge of `path`, softened by `blur`
 * world units. It gathers on the side opposite the offset: (1, 1) darkens
 * the upper-left rim, as in a recess lit from the upper left.
 */
export function innerEdge(ctx: Ctx, path: Path2D, color: string, dx: number, dy: number, blur: number): void {
  const res = resOf(ctx);
  const ring = new Path2D();
  ring.rect(-1000, -1000, 2000, 2000);
  ring.addPath(path);
  ctx.save();
  ctx.clip(path);
  ctx.shadowColor = color;
  ctx.shadowBlur = blur * res;
  ctx.shadowOffsetX = dx * res;
  ctx.shadowOffsetY = dy * res;
  ctx.fillStyle = '#000';
  ctx.fill(ring, 'evenodd');
  ctx.restore();
}

/** Standard modelling for a solid: light gathers upper left, shade lower right. */
export function model(ctx: Ctx, path: Path2D, size: number, light = 0.45, shade = 0.55): void {
  innerEdge(ctx, path, `rgba(33, 22, 14, ${shade})`, LIGHT.x * size * 0.18, LIGHT.y * size * 0.18, size * 0.22);
  innerEdge(ctx, path, `rgba(255, 244, 222, ${light})`, -LIGHT.x * size * 0.08, -LIGHT.y * size * 0.08, size * 0.08);
}

/** A soft radial wash within `path`: highlight, hot spot or occlusion. */
export function wash(ctx: Ctx, path: Path2D | null, x: number, y: number, r: number, color: string, mode: GlobalCompositeOperation = 'source-over'): void {
  ctx.save();
  if (path) ctx.clip(path);
  ctx.globalCompositeOperation = mode;
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color);
  g.addColorStop(1, color.replace(/[\d.]+\)$/, '0)'));
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
  ctx.restore();
}

/** Raised relief: a shadow below right, a lit lip above left, then the face. */
export function emboss(ctx: Ctx, path: Path2D, face: string | CanvasGradient, depth: number, dark = 'rgba(70, 42, 14, 0.8)', lit = 'rgba(255, 246, 214, 0.85)'): void {
  ctx.save();
  ctx.translate(depth, depth * 1.2);
  ctx.fillStyle = dark;
  ctx.fill(path);
  ctx.restore();
  ctx.save();
  ctx.translate(-depth * 0.7, -depth * 0.8);
  ctx.fillStyle = lit;
  ctx.fill(path);
  ctx.restore();
  ctx.fillStyle = face;
  ctx.fill(path);
}

/** Cut into the surface: a dark line with a lit lower lip. */
export function engrave(ctx: Ctx, path: Path2D, width: number, dark = 'rgba(40, 24, 10, 0.75)', lit = 'rgba(255, 240, 200, 0.45)'): void {
  ctx.save();
  ctx.translate(width * 0.45, width * 0.55);
  ctx.strokeStyle = lit;
  ctx.lineWidth = width * 0.8;
  ctx.stroke(path);
  ctx.restore();
  ctx.strokeStyle = dark;
  ctx.lineWidth = width;
  ctx.stroke(path);
}

/** Specks within `path`: chips, pits, patina, flecks of mica. */
export function speckle(ctx: Ctx, path: Path2D, r: () => number, count: number, size: [number, number], color: string, box: [number, number, number, number]): void {
  ctx.save();
  ctx.clip(path);
  ctx.fillStyle = color;
  const [x0, y0, x1, y1] = box;
  for (let i = 0; i < count; i++) {
    const x = x0 + r() * (x1 - x0);
    const y = y0 + r() * (y1 - y0);
    const s = size[0] + r() * (size[1] - size[0]);
    ctx.beginPath();
    ctx.ellipse(x, y, s, s * (0.6 + r() * 0.5), r() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** The painter's ink line, a little heavier on the shadow side. */
export function ink(ctx: Ctx, path: Path2D, width: number, alpha = 0.92): void {
  ctx.save();
  ctx.strokeStyle = `rgba(33, 27, 23, ${alpha})`;
  ctx.lineWidth = width;
  ctx.stroke(path);
  ctx.translate(-LIGHT.x * width * 0.35, -LIGHT.y * width * 0.35);
  ctx.globalAlpha = 0.5;
  ctx.lineWidth = width * 0.8;
  ctx.stroke(path);
  ctx.restore();
}

/** A soft contact shadow on the ground at (x, y). */
export function groundShadow(ctx: Ctx, x: number, y: number, rx: number, ry: number, alpha = 0.45): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1, ry / rx);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
  g.addColorStop(0, `rgba(33, 22, 14, ${alpha})`);
  g.addColorStop(0.6, `rgba(33, 22, 14, ${alpha * 0.45})`);
  g.addColorStop(1, 'rgba(33, 22, 14, 0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, rx, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** A closed shape through `pts`, smoothed (Catmull-Rom) or faceted. */
export function shape(pts: [number, number][], smooth = true): Path2D {
  const p = new Path2D();
  const n = pts.length;
  if (!smooth) {
    p.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < n; i++) p.lineTo(pts[i][0], pts[i][1]);
    p.closePath();
    return p;
  }
  p.moveTo(pts[0][0], pts[0][1]);
  for (let i = 0; i < n; i++) {
    const a = pts[(i - 1 + n) % n];
    const b = pts[i];
    const c = pts[(i + 1) % n];
    const d = pts[(i + 2) % n];
    p.bezierCurveTo(b[0] + (c[0] - a[0]) / 6, b[1] + (c[1] - a[1]) / 6, c[0] - (d[0] - b[0]) / 6, c[1] - (d[1] - b[1]) / 6, c[0], c[1]);
  }
  p.closePath();
  return p;
}

/** A four-pointed glint: thin tapered flares round a hot core. */
export function glint(ctx: Ctx, x: number, y: number, r: number, alpha = 1): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.globalCompositeOperation = 'lighter';
  for (const [len, rot] of [
    [r, 0],
    [r, Math.PI / 2],
    [r * 0.55, Math.PI / 4],
    [r * 0.55, -Math.PI / 4],
  ] as const) {
    ctx.save();
    ctx.rotate(rot);
    const g = ctx.createLinearGradient(-len, 0, len, 0);
    g.addColorStop(0, 'rgba(255, 244, 214, 0)');
    g.addColorStop(0.5, `rgba(255, 250, 235, ${alpha})`);
    g.addColorStop(1, 'rgba(255, 244, 214, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(-len, 0);
    ctx.quadraticCurveTo(0, -len * 0.06, len, 0);
    ctx.quadraticCurveTo(0, len * 0.06, -len, 0);
    ctx.fill();
    ctx.restore();
  }
  wash(ctx, null, 0, 0, r * 0.3, `rgba(255, 252, 240, ${alpha})`, 'lighter');
  ctx.restore();
}
