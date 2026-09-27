/**
 * Fixed route geometry in a virtual 1600×900 stage. One uphill route, a
 * summit, a descent down the steep back face into the impact area, and a
 * foreground return chute (spec §04 "the entire useful loop").
 */
export const STAGE_W = 1600;
export const STAGE_H = 900;
export const GROUND_Y = 760;
export const STONE_R = 46;

export interface Vec {
  x: number;
  y: number;
}

export const HILL = {
  footLeft: { x: 200, y: GROUND_Y },
  summitLeft: { x: 1000, y: 312 },
  summitRight: { x: 1090, y: 312 },
  footRight: { x: 1420, y: GROUND_Y },
};

const up = { x: HILL.summitLeft.x - HILL.footLeft.x, y: HILL.summitLeft.y - HILL.footLeft.y };
const upLen = Math.hypot(up.x, up.y);
export const UP_DIR = { x: up.x / upLen, y: up.y / upLen };
export const UP_NORMAL = { x: UP_DIR.y, y: -UP_DIR.x };
export const SLOPE_ANGLE = Math.atan2(up.y, up.x);
export const ROUTE_LENGTH = upLen;

export const PULLEY = { x: 1045, y: 236 };
export const FLYWHEEL = { x: 1470, y: GROUND_Y - 6, r: 64 };
export const TARGET = { x: 1565, y: GROUND_Y };
export const IMPACT = { x: 1515, y: GROUND_Y - STONE_R };
export const REST_SPOT = { x: 96, y: GROUND_Y };

/** Ground surface height at x. */
export function surfaceY(x: number): number {
  const { footLeft: a, summitLeft: b, summitRight: c, footRight: d } = HILL;
  if (x <= a.x || x >= d.x) return GROUND_Y;
  if (x < b.x) return a.y + ((x - a.x) / (b.x - a.x)) * (b.y - a.y);
  if (x <= c.x) return b.y;
  return c.y + ((x - c.x) / (d.x - c.x)) * (d.y - c.y);
}

/** Stone centre on the uphill route at normalised progress u. */
export function routePoint(u: number): Vec {
  const a = HILL.footLeft;
  return {
    x: a.x + up.x * u + UP_NORMAL.x * STONE_R,
    y: a.y + up.y * u + UP_NORMAL.y * STONE_R,
  };
}

function lerp(a: Vec, b: Vec, t: number): Vec {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

function polyline(points: Vec[], t: number): Vec {
  const lengths: number[] = [];
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    const l = Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
    lengths.push(l);
    total += l;
  }
  let d = Math.min(1, Math.max(0, t)) * total;
  for (let i = 0; i < lengths.length; i++) {
    if (d <= lengths[i]) return lerp(points[i], points[i + 1], lengths[i] ? d / lengths[i] : 0);
    d -= lengths[i];
  }
  return points[points.length - 1];
}

const DESCENT_PATH: Vec[] = [
  routePoint(1),
  { x: HILL.summitRight.x - 4, y: HILL.summitRight.y - STONE_R },
  { x: HILL.summitRight.x + 30, y: HILL.summitRight.y - STONE_R + 22 },
  { x: HILL.footRight.x + 10, y: GROUND_Y - STONE_R - 8 },
  IMPACT,
];

export const RETURN_PATH: Vec[] = [
  IMPACT,
  { x: IMPACT.x - 40, y: GROUND_Y + 34 },
  { x: 120, y: GROUND_Y + 34 },
  routePoint(0),
];

/** Summit hesitation before the fall, as a fraction of the 4 s descent. */
export const HESITATE = 0.1;

/** Stone position during descent, t in 0..1: pause, then accelerate. */
export function descentPoint(t: number): Vec {
  if (t < HESITATE) {
    const wobble = Math.sin((t / HESITATE) * Math.PI * 3) * 3 * (1 - t / HESITATE);
    const p = routePoint(1);
    return { x: p.x + wobble, y: p.y };
  }
  const s = (t - HESITATE) / (1 - HESITATE);
  return polyline(DESCENT_PATH, s * s);
}

export function returnPoint(t: number): Vec {
  const eased = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
  return polyline(RETURN_PATH, eased);
}

export function pathLength(points: Vec[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) total += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  return total;
}
