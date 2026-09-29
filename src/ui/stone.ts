/**
 * Stone for the frame round the world, painted once at start-up like the
 * papyrus: limestone for the beam across the top, dark basalt for the goal
 * tablet beneath. Soft mottling from the quarry bed, patches of claw-chisel
 * tooth, pits and a vein or two. Tiles seamlessly both ways.
 */
import { canvas, rng, wave, wrapped } from './papyrus';

export interface Stone {
  limestone: string;
  basalt: string;
  /** A terracotta band with a running key in black glaze, `KEY_W` by `KEY_H`. */
  key: string;
}

export const STONE_TILE = 300;
export const KEY_W = 22;
export const KEY_H = 12;

type RGB = [number, number, number];
interface Palette {
  base: RGB;
  dark: RGB;
  light: RGB;
  /** How strongly marks show against the base. */
  depth: number;
}

const LIMESTONE: Palette = { base: [224, 210, 184], dark: [96, 72, 44], light: [255, 250, 236], depth: 1 };
const BASALT: Palette = { base: [44, 38, 34], dark: [8, 6, 5], light: [214, 190, 160], depth: 0.75 };

let cached: Stone | null = null;

const rgba = (c: RGB, a: number) => `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${a})`;

function paintStone(seed: number, pal: Palette): string {
  const S = STONE_TILE;
  const [c, ctx] = canvas(S, S);
  const r = rng(seed);
  const k = pal.depth;
  ctx.fillStyle = rgba(pal.base, 1);
  ctx.fillRect(0, 0, S, S);

  // Mottling from the quarry bed: broad soft clouds, lighter and darker.
  for (let i = 0; i < 70; i++) {
    const x = r() * S;
    const y = r() * S;
    const rad = 24 + r() * 80;
    const col = r() < 0.5 ? pal.dark : pal.light;
    const a = (0.025 + r() * 0.05) * k;
    wrapped(S, (dx, dy) => {
      const g = ctx.createRadialGradient(x + dx, y + dy, 0, x + dx, y + dy, rad);
      g.addColorStop(0, rgba(col, a));
      g.addColorStop(1, rgba(col, 0));
      ctx.fillStyle = g;
      ctx.fillRect(x + dx - rad, y + dy - rad, rad * 2, rad * 2);
    });
  }

  // Bedding: faint bands running along the block.
  const bed = wave(r, S, 4);
  for (let y = 0; y < S; y += 2) {
    const v = bed(y);
    ctx.fillStyle = rgba(v > 0 ? pal.light : pal.dark, Math.abs(v) * 0.05 * k);
    ctx.fillRect(0, y, S, 2);
  }

  // Claw-chisel tooth: patches of short parallel cuts, each with a lit lip.
  ctx.lineCap = 'round';
  for (let i = 0; i < 110; i++) {
    const x = r() * S;
    const y = r() * S;
    const turn = -0.5 + (r() - 0.5) * 0.5 + (r() < 0.35 ? Math.PI / 2 : 0);
    const teeth = 4 + Math.floor(r() * 4);
    const len = 7 + r() * 12;
    const a = (0.05 + r() * 0.07) * k;
    const cos = Math.cos(turn);
    const sin = Math.sin(turn);
    for (let t = 0; t < teeth; t++) {
      const off = (t - teeth / 2) * 2.3;
      const ox = x - sin * off;
      const oy = y + cos * off;
      const l = len * (0.7 + r() * 0.3);
      wrapped(S, (dx, dy) => {
        ctx.lineWidth = 0.7;
        ctx.strokeStyle = rgba(pal.dark, a);
        ctx.beginPath();
        ctx.moveTo(ox + dx, oy + dy);
        ctx.lineTo(ox + dx + cos * l, oy + dy + sin * l);
        ctx.stroke();
        ctx.strokeStyle = rgba(pal.light, a * 0.9);
        ctx.beginPath();
        ctx.moveTo(ox + dx + 0.6, oy + dy + 0.8);
        ctx.lineTo(ox + dx + cos * l + 0.6, oy + dy + sin * l + 0.8);
        ctx.stroke();
      });
    }
  }

  // A vein or two, wandering across.
  for (let i = 0; i < 3; i++) {
    const y0 = r() * S;
    const w = wave(r, S, 4);
    const amp = 8 + r() * 20;
    ctx.strokeStyle = rgba(r() < 0.6 ? pal.dark : pal.light, (0.05 + r() * 0.06) * k);
    ctx.lineWidth = 0.5 + r() * 0.9;
    wrapped(S, (dx, dy) => {
      ctx.beginPath();
      for (let x = 0; x <= S; x += 6) ctx.lineTo(x + dx, y0 + dy + w(x) * amp);
      ctx.stroke();
    });
  }

  // Pits, each shaded above and lit on its lower rim.
  for (let i = 0; i < 180; i++) {
    const x = r() * S;
    const y = r() * S;
    const rad = 0.4 + r() * (r() < 0.1 ? 2.2 : 0.9);
    const a = (0.2 + r() * 0.35) * k;
    wrapped(S, (dx, dy) => {
      ctx.fillStyle = rgba(pal.light, a * 0.7);
      ctx.beginPath();
      ctx.arc(x + dx + 0.4, y + dy + 0.5, rad, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = rgba(pal.dark, a);
      ctx.beginPath();
      ctx.arc(x + dx, y + dy, rad, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  // A fine tooth over everything.
  const img = ctx.getImageData(0, 0, c.width, c.height);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (r() - 0.5) * 12 * k;
    d[i] += n;
    d[i + 1] += n;
    d[i + 2] += n * 0.9;
  }
  ctx.putImageData(img, 0, 0);
  return c.toDataURL('image/png');
}

/** A running key in black glaze on fired clay, the band potters put under a scene. */
function paintKey(): string {
  const [c, ctx] = canvas(KEY_W, KEY_H);
  const g = ctx.createLinearGradient(0, 0, 0, KEY_H);
  g.addColorStop(0, '#b8643a');
  g.addColorStop(0.5, '#a6532c');
  g.addColorStop(1, '#8a4121');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, KEY_W, KEY_H);
  ctx.strokeStyle = '#1d130c';
  ctx.lineWidth = 1.5;
  ctx.lineCap = 'butt';
  ctx.lineJoin = 'miter';
  ctx.beginPath();
  ctx.moveTo(-1, 9.5);
  ctx.lineTo(KEY_W + 1, 9.5);
  ctx.moveTo(17.5, 9.5);
  ctx.lineTo(17.5, 2.5);
  ctx.lineTo(6.5, 2.5);
  ctx.lineTo(6.5, 7);
  ctx.lineTo(13, 7);
  ctx.lineTo(13, 5);
  ctx.stroke();
  return c.toDataURL('image/png');
}

export function stone(): Stone {
  if (cached) return cached;
  cached = { limestone: paintStone(23, LIMESTONE), basalt: paintStone(41, BASALT), key: paintKey() };
  return cached;
}
