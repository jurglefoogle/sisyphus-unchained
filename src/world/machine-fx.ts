import { Container, Graphics, Texture } from 'pixi.js';
import type { SiteState } from '../core/state';
import { glowTexture, SpriteLayer } from './glow';

/** What the machine shows: the same reading as its gauge in the HUD. */
export interface MachineReading {
  value: number;
  mark: number | null;
  hot: boolean;
}

/** The Orrery's twelve medallions, clockwise from the top, as fractions of the painting. */
const HOUSES: [number, number][] = [
  [0.593, 0.113], [0.743, 0.147], [0.829, 0.227], [0.836, 0.34], [0.74, 0.461], [0.593, 0.529],
  [0.45, 0.541], [0.307, 0.529], [0.207, 0.446], [0.2, 0.34], [0.276, 0.234], [0.407, 0.151],
];

const FIRE = 0xff8a3a;
const EMBER = 0xffc070;
const WATER = 0x78bccb;
const BRONZE = 0xc8913a;
const GOLD = 0xf2c66d;
const IVORY = 0xefe6d2;
const SEAL = 0xa8322a;
const INK = 0x2a1d14;

let soft: Texture | null = null;

/** A broad, even disc with a soft rim: for washes over the painting, where a glow's hot core would read as a dot. */
function softTexture(): Texture {
  if (soft) return soft;
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.5, 'rgba(255,255,255,0.85)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  soft = Texture.from(canvas);
  return soft;
}

/**
 * Light and matter laid over a hill's machine painting so it reads the
 * machine's state: the furnace glows with heat, the jar's gauge holds the
 * water, the foundry's mould fills, the Orrery lights the house overhead and
 * the Bureau's tray stacks its backlog. It sits beside the machine clip, is
 * placed and scaled like it, and works in the painting's local units: a
 * `size` box anchored at `pivot`.
 */
export class MachineFx extends Container {
  private g = new Graphics();
  private shade = new SpriteLayer(8);
  private glow = new SpriteLayer(40, 'add');

  constructor() {
    super();
    this.addChild(this.shade, this.g, this.glow);
  }

  update(site: SiteState, reading: MachineReading | null, time: number, reduced: boolean, pivot: number[], size: number[]): void {
    const g = this.g;
    g.clear();
    this.glow.begin();
    this.shade.begin();
    const w = size[0];
    const h = size[1];
    const x = (u: number) => (u - pivot[0]) * w;
    const y = (v: number) => (v - pivot[1]) * h;
    const glow = (u: number, v: number, rx: number, ry: number, alpha: number, tint: number) =>
      this.glow.put(glowTexture(), x(u), y(v), rx * 2 * w, ry * 2 * h, 0, alpha, tint);
    const wash = (u: number, v: number, rx: number, ry: number, alpha: number, tint: number) =>
      this.glow.put(softTexture(), x(u), y(v), rx * 2 * w, ry * 2 * h, 0, alpha, tint);
    // Soot over the painted fire: a cold machine looks banked, not blazing.
    const cool = (u: number, v: number, rx: number, ry: number, alpha: number) =>
      this.shade.put(softTexture(), x(u), y(v), rx * 2 * w, ry * 2 * h, 0, alpha, INK);
    // A slow breath for steady lights; still under reduced motion.
    const breathe = (rate: number) => (reduced ? 0.5 : 0.5 + 0.5 * Math.sin(time * rate));

    if (site.furnace && reading) {
      const heat = reading.value;
      const erupting = reading.hot;
      const flicker = reduced ? 1 : 0.85 + 0.15 * Math.sin(time * 13) * Math.sin(time * 7.3);
      const banked = erupting ? 0 : 1 - heat;
      cool(0.6, 0.71, 0.2, 0.09, 0.8 * banked);
      cool(0.62, 0.43, 0.22, 0.24, 0.8 * banked);
      wash(0.6, 0.71, 0.2, 0.09, (0.35 * heat * heat + (erupting ? 0.35 : 0)) * flicker, FIRE);
      wash(0.62, 0.43, 0.2, 0.22, (0.2 * heat * heat + (erupting ? 0.3 : 0)) * flicker, EMBER);
      glow(0.6, 0.71, 0.26, 0.14, (0.4 * heat + (erupting ? 0.5 : 0)) * flicker, FIRE);
      if (erupting && !reduced) {
        for (let i = 0; i < 12; i++) {
          const p = (time * 0.55 + i / 12) % 1;
          const u = 0.45 + ((i * 0.37) % 1) * 0.3 + Math.sin(time * 2 + i) * 0.02;
          glow(u, 0.62 - p * 0.45, 0.03, 0.03, 1 - p, EMBER);
        }
      }
    } else if (site.jar && reading) {
      // The painted gauge tube, glassed over: the water as it stands, a line at
      // the fullest it has been (what pays) and a bronze tick at the steward's target.
      const cx = x(0.745);
      const half = 0.016 * w;
      const top = y(0.27);
      const bottom = y(0.655);
      const len = bottom - top;
      g.roundRect(cx - half, top, half * 2, len, half).fill({ color: INK, alpha: 0.55 });
      const level = Math.max(0, Math.min(1, site.jar.level)) * len;
      if (level > 0.5) g.roundRect(cx - half + 1, bottom - level, half * 2 - 2, level, half - 1).fill({ color: WATER, alpha: 0.9 });
      const peak = bottom - reading.value * len;
      g.rect(cx - half, peak - 0.6, half * 2, 1.2).fill({ color: 0xffffff, alpha: 0.85 });
      if (reading.mark !== null) {
        const my = bottom - reading.mark * len;
        g.rect(cx - half - 3, my - 1, half * 2 + 6, 2).fill({ color: BRONZE });
      }
      if (reading.hot) glow(0.745, 0.27, 0.05, 0.03, 0.35 + 0.4 * breathe(3), 0xffffff);
    } else if (site.foundry && reading) {
      const f = site.foundry;
      if (f.queue.length > 0) {
        const pouring = !f.paused && f.split > 0;
        const flicker = reduced ? 1 : 0.85 + 0.15 * Math.sin(time * 9);
        glow(0.43, 0.17, 0.11, 0.1, pouring ? 0.6 * flicker : 0.12, FIRE);
        // Bronze runs along the blueprint's mould (the open one on the right) as it fills.
        const cells = 6;
        for (let i = 0; i < cells; i++) {
          const part = Math.max(0, Math.min(1, reading.value * cells - i));
          if (part <= 0) break;
          wash(0.6 + (0.26 * (i + 0.5)) / cells, 0.555 + 0.01 * i, 0.045, 0.04, 0.75 * part, FIRE);
        }
        // Cast and waiting: the mould pulses until the next blueprint is chosen.
        if (f.paused) glow(0.73, 0.56, 0.2, 0.1, 0.25 + 0.5 * breathe(2.5), GOLD);
      }
    } else if (site.sky) {
      const sky = site.sky;
      const n = sky.houses.length;
      const at = (i: number) => HOUSES[Math.floor((i * HOUSES.length) / Math.max(1, n)) % HOUSES.length];
      for (let i = 0; i < n; i++) {
        if (sky.houses[i] === null) continue;
        const [u, v] = at(i);
        g.circle(x(u), y(v), 2.6).fill({ color: GOLD });
      }
      const [u, v] = at(sky.position % Math.max(1, n));
      const lit = sky.houses[sky.position % Math.max(1, n)] !== null;
      g.circle(x(u), y(v), 0.045 * w).stroke({ width: 2.4, color: GOLD, alpha: 0.7 + 0.3 * breathe(2) });
      glow(u, v, 0.08, 0.08, lit ? 0.6 + 0.3 * breathe(2) : 0.35, GOLD);
    } else if (site.bureau && reading) {
      // The backlog, sheet by sheet on the slab below the out-tray; the statute seals it.
      const sheets = Math.round(reading.value * 10);
      const left = x(0.765);
      const tw = x(0.875) - left;
      const base = y(0.56);
      const step = (base - y(0.47)) / 10;
      for (let i = 0; i < sheets; i++) {
        const jitter = (((i * 7919) % 13) / 13 - 0.5) * 3;
        g.rect(left + 2 + jitter, base - (i + 1) * step, tw - 4, step * 0.8).fill({ color: IVORY }).stroke({ width: 0.5, color: INK, alpha: 0.5 });
      }
      if (reading.hot) {
        const sy = base - sheets * step - 2;
        g.circle(left + tw / 2, sy, 4.2).fill({ color: SEAL });
        glow(0.82, sy / h + pivot[1], 0.04, 0.04, 0.25 + 0.2 * breathe(2), SEAL);
      }
    }
    this.glow.end();
    this.shade.end();
  }
}
