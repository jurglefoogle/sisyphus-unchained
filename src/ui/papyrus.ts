/**
 * Papyrus for the Improve scroll, painted once at start-up: two layers of
 * pith strips laid at right angles and pressed together, the upper layer
 * running across the sheet, the lower showing faintly through. Tiles
 * seamlessly both ways, so the sheet can be any height and scroll freely.
 * Also the ragged left and right edges of the sheet, as masks.
 */

export interface Papyrus {
  /** The sheet, `TILE` CSS pixels square. */
  sheet: string;
  /** The same fibres, lighter and finer: a sillybos (title tag) of thinner stock. */
  tag: string;
  /** Alpha masks for the torn edges, `EDGE` wide and `TILE` tall, tiling vertically. */
  edgeLeft: string;
  edgeRight: string;
}

export const TILE = 360;
export const EDGE = 14;
export const RES = 2;

let cached: Papyrus | null = null;

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

/** Smooth periodic noise along one axis: a sum of a few sines with integer periods. */
export function wave(r: () => number, period: number, terms = 4): (x: number) => number {
  const parts = Array.from({ length: terms }, (_, i) => ({ k: 1 + Math.floor(r() * (3 + i * 3)), a: 1 / (1 + i), p: r() * Math.PI * 2 }));
  const norm = parts.reduce((s, p) => s + p.a, 0);
  return (x) => parts.reduce((s, p) => s + p.a * Math.sin((x / period) * Math.PI * 2 * p.k + p.p), 0) / norm;
}

export function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = Math.round(w * RES);
  c.height = Math.round(h * RES);
  const ctx = c.getContext('2d')!;
  ctx.scale(RES, RES);
  return [c, ctx];
}

/** Draw at (x, y) and at its wrapped copies, so the tile has no seams. */
export function wrapped(size: number, draw: (dx: number, dy: number) => void): void {
  for (const dx of [-size, 0, size]) for (const dy of [-size, 0, size]) draw(dx, dy);
}

function paintSheet(seed: number, light: number): string {
  const S = TILE;
  const [c, ctx] = canvas(S, S);
  const r = rng(seed);
  const base = [226 + light, 205 + light, 160 + light * 0.8];
  ctx.fillStyle = `rgb(${base.join(',')})`;
  ctx.fillRect(0, 0, S, S);

  // The lower layer, running down the sheet: broad strips seen through the upper.
  for (let x = 0; x < S; ) {
    const w = 9 + r() * 16;
    const tone = r() - 0.5;
    ctx.fillStyle = tone > 0 ? `rgba(255, 246, 222, ${tone * 0.035})` : `rgba(120, 82, 36, ${-tone * 0.03})`;
    wrapped(S, (dx) => ctx.fillRect(x + dx, 0, w, S));
    x += w;
  }

  // The upper layer, running across: strips of pith, each a little different.
  for (let y = 0; y < S; ) {
    const h = 7 + r() * 13;
    const tone = r() - 0.5;
    const bend = wave(r, S, 3);
    const lift = 1.2 + r() * 1.6;
    const strip = (dx: number, dy: number) => {
      ctx.beginPath();
      for (let x = 0; x <= S; x += 12) ctx.lineTo(x + dx, y + dy + bend(x) * lift);
      for (let x = S; x >= 0; x -= 12) ctx.lineTo(x + dx, y + h + dy + bend(x + 40) * lift);
      ctx.closePath();
      ctx.fill();
    };
    ctx.fillStyle = tone > 0 ? `rgba(255, 244, 214, ${tone * 0.4})` : `rgba(128, 86, 38, ${-tone * 0.3})`;
    wrapped(S, strip);
    // The seam where two strips overlap reads as a faint darker line.
    ctx.fillStyle = 'rgba(110, 72, 30, 0.1)';
    wrapped(S, (dx, dy) => ctx.fillRect(dx, y + dy, S, 0.8));
    y += h;
  }

  // Fibres: long fine threads, mostly across, some down.
  ctx.lineCap = 'round';
  for (let i = 0; i < 520; i++) {
    const across = r() < 0.9;
    const x = r() * S;
    const y = r() * S;
    const len = 30 + r() * (across ? 180 : 70);
    const dark = r() < 0.55;
    ctx.strokeStyle = dark ? `rgba(104, 66, 26, ${0.05 + r() * 0.12})` : `rgba(255, 248, 228, ${0.08 + r() * 0.2})`;
    ctx.lineWidth = 0.35 + r() * 0.8;
    const wob = (r() - 0.5) * 3;
    wrapped(S, (dx, dy) => {
      ctx.beginPath();
      if (across) {
        ctx.moveTo(x + dx, y + dy);
        ctx.quadraticCurveTo(x + len / 2 + dx, y + wob + dy, x + len + dx, y + dy + wob * 0.3);
      } else {
        ctx.moveTo(x + dx, y + dy);
        ctx.quadraticCurveTo(x + wob + dx, y + len / 2 + dy, x + wob * 0.3 + dx, y + len + dy);
      }
      ctx.stroke();
    });
  }

  // Knots in the pith and flecks of bark.
  for (let i = 0; i < 70; i++) {
    const x = r() * S;
    const y = r() * S;
    const rx = 0.6 + r() * (r() < 0.15 ? 5 : 1.6);
    const ry = rx * (0.25 + r() * 0.35);
    const turn = (r() - 0.5) * 0.3;
    ctx.fillStyle = `rgba(${r() < 0.3 ? '70, 42, 18' : '132, 90, 44'}, ${0.12 + r() * 0.3})`;
    wrapped(S, (dx, dy) => {
      ctx.beginPath();
      ctx.ellipse(x + dx, y + dy, rx, ry, turn, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  // A fine tooth over everything.
  const img = ctx.getImageData(0, 0, c.width, c.height);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (r() - 0.5) * 14;
    d[i] += n;
    d[i + 1] += n;
    d[i + 2] += n * 0.8;
  }
  ctx.putImageData(img, 0, 0);
  return c.toDataURL('image/png');
}

/** A torn edge: opaque inside, fraying out through loose fibres. */
function paintEdge(seed: number, side: 'left' | 'right'): string {
  const [c, ctx] = canvas(EDGE, TILE);
  const r = rng(seed);
  const coarse = wave(r, TILE, 5);
  const fine = wave(r, TILE / 6, 3);
  const at = (y: number) => EDGE * 0.45 + coarse(y) * EDGE * 0.28 + fine(y) * 1.2;
  const x = (v: number) => (side === 'left' ? v : EDGE - v);
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.moveTo(x(EDGE), -2);
  for (let y = -2; y <= TILE + 2; y += 3) ctx.lineTo(x(at(y)), y);
  ctx.lineTo(x(EDGE), TILE + 2);
  ctx.closePath();
  ctx.fill();
  // Loose fibres standing proud of the edge.
  ctx.strokeStyle = '#000';
  ctx.lineCap = 'round';
  for (let i = 0; i < 26; i++) {
    const y = r() * TILE;
    const from = at(y);
    const len = 2 + r() * 5;
    ctx.globalAlpha = 0.35 + r() * 0.5;
    ctx.lineWidth = 0.4 + r() * 0.6;
    for (const dy of [-TILE, 0, TILE]) {
      ctx.beginPath();
      ctx.moveTo(x(from + 1), y + dy);
      ctx.lineTo(x(Math.max(0.5, from - len)), y + dy + (r() - 0.5) * 2);
      ctx.stroke();
    }
  }
  return c.toDataURL('image/png');
}

export function papyrus(): Papyrus {
  if (cached) return cached;
  cached = {
    sheet: paintSheet(7, 0),
    tag: paintSheet(19, 12),
    edgeLeft: paintEdge(3, 'left'),
    edgeRight: paintEdge(11, 'right'),
  };
  return cached;
}
