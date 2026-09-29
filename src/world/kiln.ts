import type { Container, Renderer } from 'pixi.js';
import { GROUND_Y, STAGE_W } from './geometry';
import { DistortFilter, KilnFilter, RimFilter } from './post';

/**
 * Each hill's light, as the post pipeline sees it. Positions on the painted
 * plate are fractions of it (so the light comes from the sun that is painted
 * there); positions in the scene are world units.
 */
interface Look {
  /** Where the light comes from, on the plate. */
  sun: [number, number];
  /** Colour of the scattered light. */
  light: [number, number, number];
  /** Strength of the shafts, their reach in world units, and the brightness that counts as sky. */
  rays: number;
  reach: number;
  sky: number;
  /** Below this line on the plate nothing emits light. */
  horizon: number;
  /** Bloom: the brightness it starts at and how strongly it is laid over. */
  threshold: number;
  bloom: number;
  /** Grade: kiln tint, shadow and highlight multipliers. */
  tint: [number, number, number];
  shadow: [number, number, number];
  high: [number, number, number];
  vignette: number;
  /** How strongly figures are rim-lit from the light. */
  rim: number;
  /** Heat haze: strength in pixels and the world band it rises through. */
  haze?: [number, number, number];
  /** Water on the plate: its top and bottom as plate fractions. */
  sea?: [number, number];
}

const LOOKS: Record<string, Look> = {
  first_hill: {
    sun: [0.254, 0.114],
    light: [1.0, 0.84, 0.6],
    rays: 2.1,
    reach: 1400,
    sky: 0.6,
    horizon: 0.27,
    threshold: 0.9,
    bloom: 1.0,
    tint: [1.0, 0.97, 0.92],
    shadow: [0.9, 0.9, 0.98],
    high: [1.05, 1.0, 0.94],
    vignette: 0.32,
    rim: 0.75,
    sea: [0.25, 0.42],
  },
  tartarus_rim: {
    sun: [0.5, 0.33],
    light: [1.0, 0.5, 0.25],
    rays: 2.2,
    reach: 1100,
    sky: 0.42,
    horizon: 0.38,
    threshold: 0.78,
    bloom: 1.2,
    tint: [1.06, 0.9, 0.8],
    shadow: [0.86, 0.82, 0.9],
    high: [1.1, 0.96, 0.84],
    vignette: 0.45,
    rim: 0.95,
    haze: [3.2, 420, 820],
  },
  leaking_heights: {
    sun: [0.82, -0.25],
    light: [1.0, 0.86, 0.7],
    rays: 1.1,
    reach: 1100,
    sky: 0.4,
    horizon: 0.3,
    threshold: 0.9,
    bloom: 0.9,
    tint: [0.96, 0.99, 1.03],
    shadow: [0.88, 0.92, 1.0],
    high: [1.04, 1.0, 0.96],
    vignette: 0.32,
    rim: 0.5,
    sea: [0.3, 0.62],
  },
  bronze_pass: {
    sun: [0.742, 0.132],
    light: [1.0, 0.9, 0.68],
    rays: 2.1,
    reach: 1400,
    sky: 0.6,
    horizon: 0.36,
    threshold: 0.88,
    bloom: 1.0,
    tint: [1.04, 0.97, 0.86],
    shadow: [0.9, 0.88, 0.94],
    high: [1.06, 1.0, 0.9],
    vignette: 0.34,
    rim: 0.8,
  },
  skyward_escarpment: {
    sun: [0.5, -0.4],
    light: [0.8, 0.85, 1.0],
    rays: 0,
    reach: 600,
    sky: 0.9,
    horizon: 0.2,
    threshold: 0.84,
    bloom: 1.3,
    tint: [0.94, 0.96, 1.05],
    shadow: [0.84, 0.88, 1.02],
    high: [1.02, 1.0, 1.0],
    vignette: 0.42,
    rim: 0.45,
  },
  olympian_approach: {
    sun: [0.191, 0.14],
    light: [1.0, 0.84, 0.5],
    rays: 2.3,
    reach: 1400,
    sky: 0.44,
    horizon: 0.46,
    threshold: 0.86,
    bloom: 1.25,
    tint: [1.05, 1.0, 0.88],
    shadow: [0.88, 0.86, 0.94],
    high: [1.08, 1.02, 0.9],
    vignette: 0.4,
    rim: 0.9,
  },
};

const PLATE_W = 1600;
const PLATE_H = 900;

interface Wave {
  x: number;
  y: number;
  age: number;
  speed: number;
  strength: number;
  life: number;
}

/** Runs the post pipeline: per-hill look, shockwaves and the hit flash. */
export class Kiln {
  private distort = new DistortFilter();
  private finish = new KilnFilter();
  private waves: Wave[] = [];
  private flashAmount = 0;
  private flashColor: [number, number, number] = [1, 0.95, 0.85];
  private time = 0;
  /** Eased copy of the current look, so hills blend into each other. */
  private cur: Look = structuredClone(LOOKS.first_hill);

  readonly filters = [this.distort, this.finish];
  /** For the figures and machines: their edges catch the hill's light. */
  readonly rim = new RimFilter();

  static supported(renderer: Renderer): boolean {
    return renderer.name === 'webgl';
  }

  /** A ring of force from a point in the world: px of push, world units per second. */
  shockwave(x: number, y: number, strength: number, speed = 900, life = 0.7): void {
    this.waves.push({ x, y, age: 0, speed, strength, life });
    if (this.waves.length > 4) this.waves.shift();
  }

  /** Set from the flash-free option: no bright full-screen flashes. */
  flashFree = false;

  flash(amount: number, color: [number, number, number] = [1, 0.95, 0.85]): void {
    if (this.flashFree) return;
    this.flashAmount = Math.max(this.flashAmount, amount);
    this.flashColor = color;
  }

  /**
   * Per frame. `stage` is the world (for world positions), `plate` the
   * painted background (for the sun and the sea), in CSS pixels.
   */
  update(dt: number, width: number, height: number, stage: Container, plate: Container, siteId: string, still: boolean): void {
    this.time += still ? 0 : dt;
    const want = LOOKS[siteId] ?? LOOKS.first_hill;
    blend(this.cur, want, Math.min(1, dt * 2.5));
    const look = this.cur;
    const zoom = stage.scale.x;
    const plateAt = (fx: number, fy: number) => plate.toGlobal({ x: fx * PLATE_W, y: fy * PLATE_H });
    const worldAt = (x: number, y: number) => stage.toGlobal({ x, y });

    // Distort.
    const d = this.distort.u;
    d.uScreen[0] = width;
    d.uScreen[1] = height;
    d.uOrigin[0] = stage.x;
    d.uOrigin[1] = stage.y;
    d.uZoom = zoom;
    d.uTime = this.time;
    this.waves = this.waves.filter((w) => (w.age += dt) < w.life);
    for (let i = 0; i < 4; i++) {
      const w = this.waves[i];
      const o = i * 4;
      if (!w || still) {
        d.uWaves[o + 3] = 0;
        continue;
      }
      const at = worldAt(w.x, w.y);
      const k = w.age / w.life;
      d.uWaves[o] = at.x;
      d.uWaves[o + 1] = at.y;
      d.uWaves[o + 2] = w.speed * w.age * (1 - 0.35 * k);
      d.uWaves[o + 3] = w.strength * (1 - k) ** 1.5;
    }
    const haze = want.haze;
    d.uHaze[0] = haze && !still ? haze[0] : 0;
    if (haze) {
      d.uHaze[1] = worldAt(0, haze[1]).y;
      d.uHaze[2] = worldAt(0, haze[2]).y;
    }
    const sea = want.sea;
    d.uSea[0] = sea ? 1 : 0;
    if (sea) {
      d.uSea[1] = plateAt(0, sea[0]).y;
      d.uSea[2] = plateAt(0, sea[1]).y;
    }

    // Light.
    const l = this.finish.lightU;
    l.uScreen[0] = width;
    l.uScreen[1] = height;
    const sun = plateAt(look.sun[0], look.sun[1]);
    l.uSun[0] = sun.x;
    l.uSun[1] = sun.y;
    l.uThreshold = look.threshold;
    l.uRay[0] = look.rays;
    l.uRay[1] = look.reach * zoom;
    l.uRay[2] = look.sky;
    l.uRay[3] = plateAt(0, look.horizon).y;
    l.uLight.set(look.light);

    // Finish.
    const f = this.finish.u;
    f.uScreen[0] = width;
    f.uScreen[1] = height;
    f.uOrigin[0] = stage.x;
    f.uOrigin[1] = stage.y;
    f.uZoom = zoom;
    f.uBloom = look.bloom;
    f.uTint.set(look.tint);
    f.uShadow.set(look.shadow);
    f.uHigh.set(look.high);
    f.uVignette = look.vignette;
    this.flashAmount = still ? 0 : Math.max(0, this.flashAmount - dt * 5);
    f.uFlash[0] = this.flashColor[0];
    f.uFlash[1] = this.flashColor[1];
    f.uFlash[2] = this.flashColor[2];
    f.uFlash[3] = this.flashAmount;

    // Rim light, from the middle of the ground toward the light.
    const r = this.rim.u;
    const mid = worldAt(STAGE_W / 2, GROUND_Y - 120);
    const dx = sun.x - mid.x;
    const dy = sun.y - mid.y;
    const len = Math.hypot(dx, dy) || 1;
    r.uDir[0] = dx / len;
    r.uDir[1] = dy / len;
    r.uWidth = 3.2 * zoom * this.resolution;
    r.uColor.set(look.light);
    r.uStrength = look.rim;
  }

  /** Device pixels per CSS pixel, for widths measured in texels. */
  resolution = 1;

  /** Balanced quality: no distortion pass and a lighter bloom. */
  set lite(on: boolean) {
    this.distort.enabled = !on;
    this.finish.lite = on;
  }
}

/** Ease every number in `cur` toward `want`. */
function blend(cur: Look, want: Look, k: number): void {
  const c = cur as unknown as Record<string, unknown>;
  const w = want as unknown as Record<string, unknown>;
  for (const key of Object.keys(w)) {
    const a = c[key];
    const b = w[key];
    if (typeof b === 'number') c[key] = typeof a === 'number' ? a + (b - a) * k : b;
    else if (Array.isArray(b)) {
      const arr = Array.isArray(a) && a.length === b.length ? (a as number[]) : [...(b as number[])];
      for (let i = 0; i < b.length; i++) arr[i] += ((b as number[])[i] - arr[i]) * k;
      c[key] = arr;
    }
  }
}
