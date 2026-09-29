import { Container, Graphics } from 'pixi.js';
import { BONE_LENGTH, SISYPHUS_LOOK, solveSkeleton, type FigureBoneId, type Look, type Pose } from './figure';

/**
 * The black-figure cutout rig. Every bone carries a piece drawn once in its
 * own frame, as the painter would cut it from sisyphus_rest.png: an ink
 * silhouette with clay incisions for muscle, curls and the eye. Each frame
 * only moves and turns the pieces; the skirt, which stretches between the
 * thighs, is the one shape redrawn, and only when it changes.
 *
 * Piece frames: +x runs along the bone from its root, and -y is the front
 * (shin, quadriceps, biceps, thumb, toes).
 */

type P = { x: number; y: number };
/** Width profile along a bone: [t (in bone lengths), front, back]. */
type Profile = readonly (readonly [number, number, number])[];

const { THIGH, SHIN, UPPER_ARM, FOREARM } = BONE_LENGTH;
const WRAP = 0xd3b58b;

const THIGH_PROFILE: Profile = [
  [-0.08, 7, 8.6],
  [0.18, 8.8, 8.4],
  [0.45, 8.6, 7.2],
  [0.75, 6.4, 5.4],
  [1, 4.4, 4.3],
];
const SHIN_PROFILE: Profile = [
  [0, 4.4, 4.7],
  [0.16, 4.6, 7.8],
  [0.34, 4.2, 8.2],
  [0.58, 3.2, 4.6],
  [0.86, 2.5, 2.7],
  [1, 2.9, 3],
];
const UPPER_ARM_PROFILE: Profile = [
  [-0.06, 7.8, 7.8],
  [0.18, 7.6, 7],
  [0.5, 5.8, 6.2],
  [0.8, 4.2, 4.6],
  [1, 3.8, 3.8],
];
const FOREARM_PROFILE: Profile = [
  [0, 3.8, 4],
  [0.22, 5, 4.6],
  [0.56, 3.6, 3.3],
  [1, 2.5, 2.5],
];

/** A closed curve through the midpoints of `pts`, each point a control. */
function smooth(g: Graphics, pts: P[]): Graphics {
  const n = pts.length;
  const mid = (a: P, b: P) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
  const start = mid(pts[n - 1], pts[0]);
  g.moveTo(start.x, start.y);
  for (let i = 0; i < n; i++) {
    const m = mid(pts[i], pts[(i + 1) % n]);
    g.quadraticCurveTo(pts[i].x, pts[i].y, m.x, m.y);
  }
  return g.closePath();
}

/** An open incised stroke through `pts`, smoothed the same way. */
function incise(g: Graphics, pts: P[], color: number, width = 1.1, alpha = 0.85): void {
  g.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length - 1; i++) {
    const m = { x: (pts[i].x + pts[i + 1].x) / 2, y: (pts[i].y + pts[i + 1].y) / 2 };
    g.quadraticCurveTo(pts[i].x, pts[i].y, i === pts.length - 2 ? pts[i + 1].x : m.x, i === pts.length - 2 ? pts[i + 1].y : m.y);
  }
  if (pts.length === 2) g.lineTo(pts[1].x, pts[1].y);
  g.stroke({ width, color, alpha, cap: 'round', join: 'round' });
}

/**
 * An open arc stroke. Pixi joins an arc to the previous path's end point, so
 * each starts from its own moveTo.
 */
function arcStroke(g: Graphics, x: number, y: number, r: number, a0: number, a1: number, style: { width: number; color: number; alpha: number }): void {
  g.moveTo(x + Math.cos(a0) * r, y + Math.sin(a0) * r).arc(x, y, r, a0, a1).stroke({ ...style, cap: 'round' });
}

const pts = (xs: readonly (readonly [number, number])[]): P[] => xs.map(([x, y]) => ({ x, y }));

/** A limb silhouette from its width profile, with rounded ends. */
/**
 * The incised contour round a silhouette, so a limb still reads where it
 * crosses the trunk, the other limbs or the black stone.
 */
const contour = (look: Look) => ({ width: 0.7, color: look.incise, alpha: 0.5, join: 'round' as const });

function limb(g: Graphics, len: number, profile: Profile, look: Look): void {
  const front = profile.map(([t, f]) => ({ x: t * len, y: -f }));
  const back = profile.map(([t, , b]) => ({ x: t * len, y: b })).reverse();
  const [t0, f0, b0] = profile[0];
  const [t1, f1, b1] = profile[profile.length - 1];
  const capStart = { x: t0 * len - (f0 + b0) * 0.45, y: (b0 - f0) / 2 };
  const capEnd = { x: t1 * len + (f1 + b1) * 0.45, y: (b1 - f1) / 2 };
  smooth(g, [capStart, ...front, capEnd, ...back]).fill(look.ink).stroke(contour(look));
}

function thighPiece(look: Look): Graphics {
  const g = new Graphics();
  limb(g, THIGH, THIGH_PROFILE, look);
  const L = THIGH;
  // Vastus and rectus, then the kneecap.
  incise(g, pts([[L * 0.5, -6.4], [L * 0.7, -3.6], [L * 0.86, -3.4]]), look.incise, 1, 0.75);
  incise(g, pts([[L * 0.92, -4.2], [L * 1.02, -5.4], [L * 1.1, -3.4]]), look.incise, 1, 0.85);
  return g;
}

function shinPiece(look: Look): Graphics {
  const g = new Graphics();
  limb(g, SHIN, SHIN_PROFILE, look);
  const L = SHIN;
  // Calf head, and the shinbone's edge.
  incise(g, pts([[L * 0.1, 4.4], [L * 0.3, 2.2], [L * 0.52, 3]]), look.incise, 1, 0.75);
  incise(g, pts([[L * 0.8, -1.6], [L * 0.9, 0.2], [L * 0.86, 1.8]]), look.incise, 0.8, 0.6);
  return g;
}

function upperArmPiece(look: Look): Graphics {
  const g = new Graphics();
  limb(g, UPPER_ARM, UPPER_ARM_PROFILE, look);
  const L = UPPER_ARM;
  // The deltoid's hem, then the biceps.
  incise(g, pts([[L * -0.02, -4.6], [L * 0.3, -3.2], [L * 0.42, 0.4], [L * 0.2, 4.6]]), look.incise, 1.1);
  return g;
}

function forearmPiece(look: Look): Graphics {
  const g = new Graphics();
  limb(g, FOREARM, FOREARM_PROFILE, look);
  incise(g, pts([[FOREARM * 0.1, 1.8], [FOREARM * 0.3, 0.4], [FOREARM * 0.5, 0.6]]), look.incise, 0.8, 0.6);
  return g;
}

/** A relaxed hand: fingers loosely curled toward the thumb, thumb laid along the front. */
function relaxedHandPiece(look: Look): Graphics {
  const g = new Graphics();
  smooth(g, pts([[-1.2, -2.1], [3.2, -2.5], [6, -2.5], [8.4, -2], [9.4, -0.4], [8.8, 1.6], [6.8, 2.6], [4, 2.4], [1.4, 2.1], [-1.2, 1.9]])).fill(look.ink).stroke(contour(look));
  smooth(g, pts([[2, -2], [4.2, -3.5], [6.4, -3.7], [7.2, -2.9], [5.2, -1.7]])).fill(look.ink).stroke(contour(look));
  // The curled fingers' folds.
  incise(g, pts([[5.2, 1.4], [7.4, 1], [8.2, -0.6]]), look.incise, 0.7, 0.65);
  incise(g, pts([[4.6, -0.3], [6.6, -0.6], [7.4, -1.4]]), look.incise, 0.6, 0.5);
  g.scale.set(0.9);
  return g;
}

function handPiece(look: Look): Graphics {
  const g = new Graphics();
  // Palm narrowing from the wrist to tapered fingers.
  smooth(g, pts([[-1.2, -2.1], [3.4, -2.5], [7.4, -2.2], [10.2, -1.2], [11, 0.2], [9.6, 1.4], [5.4, 1.9], [2, 2], [-1.2, 1.9]])).fill(look.ink).stroke(contour(look));
  // Thumb, set out from the palm on the front.
  smooth(g, pts([[2.2, -2], [4.8, -4], [6.8, -4.4], [6.8, -3.2], [4.8, -1.6]])).fill(look.ink).stroke(contour(look));
  incise(g, pts([[5.6, -1.1], [9.6, -0.5]]), look.incise, 0.7, 0.65);
  incise(g, pts([[5.6, 0.6], [9, 0.9]]), look.incise, 0.7, 0.65);
  g.scale.set(0.9);
  return g;
}

/** A bare foot on its sole; origin at the ankle, +x toward the toes, y down. */
function footPiece(look: Look): { foot: Container; wrap: Graphics } {
  const foot = new Container();
  const shape = new Graphics();
  smooth(
    shape,
    pts([[-3, -3.8], [2.6, -3.1], [8, -0.2], [14, 2.4], [19.2, 3.5], [20.8, 4.6], [19.6, 5.6], [13, 5.5], [7, 4.9], [0, 5.6], [-3.8, 5.6], [-5.8, 4.3], [-5.6, 0.2]]),
  )
    .fill(look.ink)
    .stroke(contour(look));
  incise(shape, pts([[0.6, -1.2], [1.8, 0.6], [0.2, 1.6]]), look.incise, 0.9, 0.75);
  incise(shape, pts([[16.4, 2.8], [16.2, 5.2]]), look.incise, 0.8, 0.7);
  incise(shape, pts([[18.6, 3.4], [18.5, 5.3]]), look.incise, 0.8, 0.7);
  // Rag wrappings, bought with the first grip upgrade.
  const wrap = new Graphics();
  smooth(wrap, pts([[-4, -6], [3, -5], [4, -1], [13, 2.5], [14, 5], [1, 5.5], [-5, 4], [-5, 0]]))
    .fill(WRAP).stroke({ width: 0.7, color: look.ink });
  // Two turns round the ankle and one across the instep.
  for (const [x0, y0, x1, y1] of [
    [-5.4, -2.6, 3.6, -1.6],
    [-6, 0.8, 5, 1.4],
    [7.4, 0, 10, 5.4],
  ] as const) {
    wrap.moveTo(x0, y0).lineTo(x1, y1).stroke({ width: 0.8, color: look.ink, alpha: 0.8, cap: 'round' });
  }
  foot.addChild(shape, wrap);
  // The painted feet are short and high-arched; the outline above is drawn long.
  foot.scale.set(0.8, 1);
  return { foot, wrap };
}

/**
 * Broadens the chest and back above the waist, to the heroic V of the painted
 * figure: nothing changes at the belt, the full swell is reached at the pecs.
 */
function chest(xs: readonly (readonly [number, number])[]): P[] {
  return xs.map(([x, y]) => {
    const k = Math.min(1, Math.max(0, (-y - 20) / 14));
    return { x: x * (1 + k * (x > 0 ? 0.24 : 0.14)), y };
  });
}

/**
 * Trunk, neck and the bare near chest, in the torso frame: origin at the hip,
 * +x forward, -y up the spine (TORSO long), as solveSkeleton's `at(along, side)`
 * = (side, -along).
 */
function torsoPiece(look: Look): Graphics {
  const g = new Graphics();
  // Neck: a thick column under the beard.
  smooth(g, pts([[-5.5, -42], [-4, -53], [2.5, -55], [6.5, -44]])).fill(look.ink);
  smooth(
    g,
    chest([
      // Back: buttock, the small of the back, shoulder blade.
      [-7, 5.5], [-11.4, 1], [-10.6, -6], [-8.2, -15], [-10, -26], [-13.6, -36], [-10.8, -44], [-4, -47.5],
      // Front: collarbone, chest, belly, groin.
      [4.5, -47], [11, -42.5], [14.8, -34], [12.4, -27], [9.2, -19], [9.4, -8], [7, 1], [1, 5.5],
    ]),
  ).fill(look.ink);
  // Near pectoral, left bare where the chiton crosses from the far shoulder.
  incise(g, chest([[3, -41], [10, -37.5], [14, -31.5], [10.8, -28.2]]), look.incise, 1.1);
  incise(g, chest([[-1, -46], [4, -44.5], [8, -43]]), look.incise, 0.9, 0.6);
  return g;
}

/** Upper chiton in the torso frame: pinned on the far shoulder, bloused over the belt. */
function chitonPiece(look: Look): Graphics {
  const g = new Graphics();
  smooth(
    g,
    chest([
      [-14.4, -35], [-12.4, -41.5], [-7.6, -46], [-3.5, -47], [1, -41.5], [6.6, -33], [12.6, -27], [11.6, -21.5], [10.4, -17],
      [1, -16.6], [-9.4, -17.4], [-10.6, -25],
    ]),
  )
    .fill(look.cloth)
    .stroke({ width: 1.6, color: look.ink, join: 'round' });
  // Drape folds falling from the pin.
  for (const [x0, y0, x1, y1] of [
    [-6.5, -44, -8.6, -19],
    [-2, -42.5, -3, -18.5],
    [3, -37, 3.4, -18],
    [8, -29, 9, -18.4],
  ] as const) {
    const [a, b] = chest([[x0, y0], [x1, y1]]);
    g.moveTo(a.x, a.y)
      .quadraticCurveTo((a.x + b.x) / 2 - 1.5, (a.y + b.y) / 2, b.x, b.y)
      .stroke({ width: 1, color: look.ink, alpha: 0.6, cap: 'round' });
  }
  // The pin.
  g.circle(-7 * 1.14, -44.4, 1.6).fill(look.ink);
  return g;
}

/**
 * The chiton from his other side: pinned on the near shoulder, so it covers
 * the chest and the drape falls from the pin in front of us.
 */
function reverseChitonPiece(look: Look): Graphics {
  const g = new Graphics();
  smooth(
    g,
    chest([
      [-14.4, -35], [-12.4, -41.5], [-7.6, -46], [-3, -48], [2, -48.6], [6.4, -46.6], [11, -42.5], [14.6, -34.5], [12.8, -27.5],
      [11.6, -21.5], [10.4, -17], [1, -16.6], [-9.4, -17.4], [-10.6, -25],
    ]),
  )
    .fill(look.cloth)
    .stroke({ width: 1.6, color: look.ink, join: 'round' });
  // Folds swinging down and across from the near pin, and one under the chest.
  for (const [x0, y0, cx, cy, x1, y1] of [
    [-1, -45, -6, -32, -8.6, -18.6],
    [1.5, -44, -1, -30, -2.6, -18.2],
    [4, -43.5, 4.6, -30, 3.6, -18],
    [7, -41.5, 11, -32, 9, -18.4],
    [-6, -24, 2, -21.6, 11, -25.5],
  ] as const) {
    const [a, c, b] = chest([[x0, y0], [cx, cy], [x1, y1]]);
    g.moveTo(a.x, a.y).quadraticCurveTo(c.x, c.y, b.x, b.y).stroke({ width: 1, color: look.ink, alpha: 0.6, cap: 'round' });
  }
  return g;
}

/** The near shoulder's cloth and pin, laid over the top of the arm when the chiton is pinned there. */
function shoulderCapPiece(look: Look): Graphics {
  const g = new Graphics();
  smooth(g, chest([[-5.6, -45.4], [-1.4, -48.8], [4.6, -48.4], [8, -44.6], [6.6, -40.2], [1.6, -41.8], [-3.4, -41.6]]))
    .fill(look.cloth)
    .stroke({ width: 1.4, color: look.ink, join: 'round' });
  const [pin] = chest([[1.2, -46.2]]);
  g.circle(pin.x, pin.y, 1.6).fill(look.ink);
  return g;
}

/** Belt, knot and hanging tie, in the torso frame, laid over the skirt's waist. */
function beltPiece(look: Look): Graphics {
  const g = new Graphics();
  g.moveTo(-9.8, -18.6).lineTo(11.2, -18.2).stroke({ width: 3.4, color: look.ink, cap: 'round' });
  return g;
}

/** Where the belt is knotted, in the torso frame: on the near hip, or round on the far one. */
const KNOT = { x: 6.6, y: -18.4 };
const KNOT_FAR = { x: 10.2, y: -18.4 };

/** The belt's knot and hanging tie, origin at the knot, hanging down +y; it swings with the sway. */
function tiePiece(look: Look): Graphics {
  const g = new Graphics();
  g.moveTo(0, 1.2).quadraticCurveTo(1.6, 7.4, 0.4, 12.4).stroke({ width: 2.6, color: look.ink, cap: 'round' });
  g.moveTo(-0.6, 1.4).quadraticCurveTo(-2.2, 5.6, -2.8, 8.6).stroke({ width: 2.2, color: look.ink, cap: 'round' });
  g.circle(0, 0, 2.3).fill(look.ink).stroke({ width: 0.8, color: look.cloth, alpha: 0.9 });
  return g;
}

/**
 * The head in profile, origin at the skull's centre, +x toward the face, y
 * down. Landmarks are measured off sisyphus_rest.png (0.16 px per art px):
 * a sloping forehead and long straight nose, the eye set well back from the
 * brow, a full curly beard and a mass of curls reaching back past the ear.
 */
function headPiece(look: Look): Graphics {
  const g = new Graphics();
  const { ink } = look;
  const outline = pts([
    [-2.4, -12.4], [4.4, -12], [9.6, -9.8], [12.2, -7.4], [12.8, -4.8], [12.5, -1.8],
    // Nose, lips, moustache.
    [14.6, 4.2], [14.3, 4.9], [12.5, 5.6], [12.9, 6.4], [12.2, 7.1], [12.8, 7.8],
    // Beard, full and rounded, drawn to the chin.
    [13.5, 9.4], [12.4, 13.4], [8.6, 15.4], [3.8, 15], [0.6, 13.6],
    // Nape and the back of the curls.
    [-6, 10.2], [-10.4, 6.6], [-12.4, -0.8], [-10.4, -8.4],
  ]);
  smooth(g, outline).fill(ink);
  // Contour down the face, from the brow to the beard, so it reads against the stone.
  incise(g, outline.slice(2, 13), look.incise, 0.7, 0.5);
  // Curls bump the outline of the hair and beard.
  for (const [x, y, r] of [
    [-1, -12.2, 2], [3.4, -12, 2], [7.4, -10.8, 1.9], [-5.2, -11.2, 2], [-8.8, -8.4, 2], [-11.2, -4.6, 2],
    [-12, -0.4, 2], [-11.2, 3.8, 2], [-8.6, 7.6, 1.9], [-5, 10, 1.8], [12.8, 11.8, 1.6], [10.8, 14.2, 1.7],
    [7, 15.3, 1.7], [3.4, 14.7, 1.6],
  ] as const) {
    g.circle(x, y, r).fill(ink);
  }
  // Curl marks: the hair behind the temple, and the beard below the cheek.
  const face = (x: number, y: number) => x > 3.4 && y < 6.6 + Math.max(0, x - 11) * 2;
  const ear = { x: -0.8, y: 2.8 };
  const curl = (x: number, y: number) => {
    const a = (x * 1.7 + y * 2.3) % (Math.PI * 2);
    arcStroke(g, x, y, 0.95, a, a + Math.PI * 1.35, { width: 0.65, color: look.incise, alpha: 0.72 });
  };
  for (let y = -10.6; y <= 8.5; y += 3.1) {
    for (let x = -11.6; x <= 10.5; x += 3.1) {
      const cx = x + ((Math.round((y + 10.6) / 3.1) % 2) * 1.55);
      const inHair = ((cx + 1.2) / 10.6) ** 2 + ((y + 1.2) / 10.2) ** 2 < 1;
      if (!inHair || face(cx, y) || Math.hypot(cx - ear.x, y - ear.y) < 2.6 || (y > 5 && cx > -1)) continue;
      curl(cx, y);
    }
  }
  for (const [x, y] of pts([[2.4, 8.4], [5.4, 8.8], [8.4, 9], [11.4, 10.2], [3.8, 11.6], [6.8, 12], [9.8, 12.4], [5.8, 14.2], [8.8, 14.4], [0.8, 10.8]]).map((p) => [p.x, p.y])) {
    curl(x, y);
  }
  // Ear, set in the curls.
  arcStroke(g, ear.x, ear.y, 1.9, -Math.PI * 0.45, Math.PI * 0.9, { width: 0.9, color: look.incise, alpha: 0.9 });
  g.circle(ear.x + 0.2, ear.y + 0.2, 0.5).fill({ color: look.incise, alpha: 0.8 });
  // Band across the curls, from the hairline back.
  g.moveTo(11.2, -8).quadraticCurveTo(-1.2, -13.6, -10.4, -1.6).stroke({ width: 1.4, color: look.cloth, cap: 'round' });
  // Brow, nostril, and the line of the lips under the moustache.
  incise(g, pts([[7.2, -2.4], [9.8, -3.1], [12, -2.2]]), look.incise, 0.9, 0.9);
  arcStroke(g, 13.4, 4.2, 0.75, -Math.PI * 0.6, Math.PI * 0.5, { width: 0.7, color: look.incise, alpha: 0.75 });
  incise(g, pts([[10.8, 7.1], [12.2, 7.1]]), look.incise, 0.7, 0.8);
  return g;
}

/** Almond eye, frontal as the vase painters drew it, gazing ahead; and its closed lid. */
function eyePieces(look: Look): { open: Graphics; shut: Graphics } {
  const open = new Graphics();
  open
    .moveTo(7, 0.2)
    .quadraticCurveTo(9.2, -1.5, 11.2, -0.1)
    .quadraticCurveTo(9.2, 1.4, 7, 0.2)
    .fill(look.eye);
  open.circle(10, -0.1, 0.9).fill(look.ink);
  const shut = new Graphics();
  shut.moveTo(7, 0.2).quadraticCurveTo(9.2, 0.9, 11.2, -0.1).stroke({ width: 0.8, color: look.incise, alpha: 0.9, cap: 'round' });
  return { open, shut };
}

/** Whether the eyes are shut at `time`: a quick blink every few seconds, never quite regular. */
function blinking(time: number): boolean {
  const period = 4.1;
  const k = Math.floor(time / period);
  const jitter = (Math.sin(k * 12.9898) * 43758.5453) % 1;
  const t = time - k * period - 0.8 - Math.abs(jitter) * 2.6;
  // Now and then a double blink.
  return (t >= 0 && t < 0.12) || (Math.abs(jitter) > 0.8 && t >= 0.24 && t < 0.34);
}

/** Where the head's neck joint sits: in head frame, and on the torso. */
const HEAD_JOINT = { x: 1.2, y: 13 };
/** The head is drawn at the reference's measure; the painted figure carries it a little smaller. */
const HEAD_K = 0.87;
const NECK_TOP = { x: 2, y: -48.5 };

/** Resting ankle angle limits between shin and foot (radians). */
const ANKLE_MIN = 1.02;
const ANKLE_MAX = 2.2;

export class FigureRig extends Container {
  private readonly farArm: Container[];
  private readonly nearArm: Container[];
  private readonly farLeg: Container[];
  private readonly nearLeg: Container[];
  private readonly wraps: Graphics[] = [];
  private readonly hands: { open: Graphics; relaxed: Graphics }[] = [];
  private readonly torso = new Container();
  private readonly belt: Graphics;
  private readonly tie: Graphics;
  private readonly chiton: Graphics;
  private readonly reverseChiton: Graphics;
  private readonly shoulderCap: Graphics;
  private reversed = false;
  private readonly eye: { open: Graphics; shut: Graphics };
  private readonly skirt = new Graphics();
  private readonly head = new Container();
  private readonly look: Look;
  private skirtKey = '';

  constructor(look: Look = SISYPHUS_LOOK) {
    super();
    this.look = look;
    const arm = () => {
      const open = handPiece(look);
      const relaxed = relaxedHandPiece(look);
      const hand = new Container();
      hand.addChild(open, relaxed);
      this.hands.push({ open, relaxed });
      return [upperArmPiece(look), forearmPiece(look), hand];
    };
    const leg = () => {
      const { foot, wrap } = footPiece(look);
      this.wraps.push(wrap);
      return [thighPiece(look), shinPiece(look), foot];
    };
    this.farArm = arm();
    this.nearArm = arm();
    this.farLeg = leg();
    this.nearLeg = leg();
    this.chiton = chitonPiece(look);
    this.reverseChiton = reverseChitonPiece(look);
    this.shoulderCap = shoulderCapPiece(look);
    this.reverseChiton.visible = false;
    this.shoulderCap.visible = false;
    this.torso.addChild(torsoPiece(look), this.chiton, this.reverseChiton);
    this.belt = beltPiece(look);
    this.tie = tiePiece(look);
    this.eye = eyePieces(look);
    this.head.addChild(headPiece(look), this.eye.open, this.eye.shut);
    this.head.scale.set(HEAD_K);
    // Back to front: far arm, far leg, near leg, trunk, skirt, belt, near arm, head.
    // Within a limb the root overlaps its child: foot < shin < thigh, hand < forearm < upper arm.
    const limbOrder = (parts: Container[]) => [parts[2], parts[1], parts[0]];
    this.addChild(...limbOrder(this.farArm), ...limbOrder(this.farLeg), ...limbOrder(this.nearLeg));
    this.addChild(this.torso, this.skirt, this.belt, this.tie, ...limbOrder(this.nearArm), this.shoulderCap, this.head);
    for (const g of [...this.farArm, ...this.farLeg]) g.tint = 0xd8d8d8;
  }

  /**
   * Move the pieces to `pose` (`time` in seconds drives the blink). `reverse`
   * shows his other side, for when the figure is mirrored to face left: the
   * chiton's pin and the belt knot are on one shoulder and hip, not on
   * whichever side faces us. Only the skirt is redrawn, and only when it changes.
   */
  update(pose: Pose, wrapped: boolean, time = 0, reverse = false): void {
    if (reverse !== this.reversed) this.turn(reverse);
    const bones = new Map<FigureBoneId, { start: P; end: P }>();
    for (const b of solveSkeleton(pose)) bones.set(b.id, b);
    const bone = (id: FigureBoneId) => bones.get(id)!;
    const place = (g: Container, id: FigureBoneId) => {
      const { start, end } = bone(id);
      g.position.set(start.x, start.y);
      g.rotation = Math.atan2(end.y - start.y, end.x - start.x);
    };

    const ground = pose.ground ?? 0;
    for (const [parts, side] of [
      [this.farLeg, 'far'],
      [this.nearLeg, 'near'],
    ] as const) {
      place(parts[0], `${side}_thigh`);
      place(parts[1], `${side}_shin`);
      // The foot lies along the ground unless the ankle can't bend that far:
      // then the heel lifts (a trailing leg) or the toes drop (a lifted one).
      const { end: ankle } = bone(`${side}_shin`);
      const shin = parts[1].rotation;
      const joint = Math.min(ANKLE_MAX, Math.max(ANKLE_MIN, shin - ground));
      parts[2].position.set(ankle.x, ankle.y);
      parts[2].rotation = shin - joint;
    }
    for (const w of this.wraps) w.visible = wrapped;

    for (const [parts, side, arm] of [
      [this.farArm, 'far', pose.farArm],
      [this.nearArm, 'near', pose.nearArm],
    ] as const) {
      place(parts[0], `${side}_upper_arm`);
      place(parts[1], `${side}_forearm`);
      const { end: wrist } = bone(`${side}_forearm`);
      parts[2].position.set(wrist.x, wrist.y);
      parts[2].rotation = parts[1].rotation - (arm.w ?? 0);
      const hand = this.hands[side === 'far' ? 0 : 1];
      hand.open.visible = (arm.open ?? 0) >= 0.5;
      hand.relaxed.visible = !hand.open.visible;
    }

    // Trunk and belt turn about the hip with the lean.
    const hip = { x: pose.hipX, y: pose.hipY };
    for (const g of [this.torso, this.belt, this.shoulderCap]) {
      g.position.set(hip.x, hip.y);
      g.rotation = pose.lean;
    }
    const T = (x: number, y: number): P => ({
      x: hip.x + x * Math.cos(pose.lean) - y * Math.sin(pose.lean),
      y: hip.y + x * Math.sin(pose.lean) + y * Math.cos(pose.lean),
    });
    // The tie hangs from the knot and trails with the sway.
    const sway = pose.sway ?? 0;
    const at = reverse ? KNOT_FAR : KNOT;
    const knot = T(at.x, at.y);
    this.tie.position.set(knot.x, knot.y);
    this.tie.rotation = sway * 0.09 - 0.05;

    const shut = blinking(time);
    this.eye.open.visible = !shut;
    this.eye.shut.visible = shut;

    // Head: the neck joint stays on top of the neck; the skull turns with the nod.
    const turn = pose.lean + pose.nod;
    const neck = T(NECK_TOP.x, NECK_TOP.y);
    this.head.rotation = turn;
    this.head.position.set(
      neck.x - HEAD_K * (HEAD_JOINT.x * Math.cos(turn) - HEAD_JOINT.y * Math.sin(turn)),
      neck.y - HEAD_K * (HEAD_JOINT.x * Math.sin(turn) + HEAD_JOINT.y * Math.cos(turn)),
    );

    this.drawSkirt(pose, T, bone('near_thigh'), bone('far_thigh'));
  }

  /** Swap the costume to the side now facing us. */
  private turn(reverse: boolean): void {
    this.reversed = reverse;
    this.chiton.visible = !reverse;
    this.reverseChiton.visible = reverse;
    this.shoulderCap.visible = reverse;
    // Round on the far hip the knot shows at the belly's edge, the tie hanging behind the skirt.
    this.removeChild(this.tie);
    this.addChildAt(this.tie, this.getChildIndex(reverse ? this.torso : this.belt) + 1);
  }

  /** Skirt: from the belt to a meander hem flared halfway down the thighs. */
  private drawSkirt(pose: Pose, T: (x: number, y: number) => P, nearThigh: { start: P; end: P }, farThigh: { start: P; end: P }): void {
    const along = (b: { start: P; end: P }) => ({
      x: b.start.x + (b.end.x - b.start.x) * 0.52,
      y: b.start.y + (b.end.y - b.start.y) * 0.52,
    });
    const onThighs = [along(nearThigh), along(farThigh)];
    const lead = onThighs[0].x >= onThighs[1].x ? onThighs[0] : onThighs[1];
    const trail = lead === onThighs[0] ? onThighs[1] : onThighs[0];
    // The hem trails the motion: pressed back along the front, flared out behind.
    const sway = pose.sway ?? 0;
    const hemFront = { x: lead.x + 13 - sway * 0.8, y: lead.y + 3 + Math.abs(sway) * 0.2 };
    const hemBack = { x: Math.min(trail.x - 12, hemFront.x - 40) - sway * 1.2, y: trail.y + 3 - Math.max(0, sway) * 0.4 };
    const key = [hemFront.x, hemFront.y, hemBack.x, hemBack.y, pose.hipX, pose.hipY, pose.lean * 50].map(Math.round).join();
    if (key === this.skirtKey) return;
    this.skirtKey = key;

    const { ink, cloth } = this.look;
    const g = this.skirt.clear();
    const waistBack = T(-9.6, -18);
    const waistFront = T(11, -18);
    const hipFront = T(14.6, -6);
    const seat = T(-14, -3);
    g.moveTo(waistBack.x, waistBack.y)
      .lineTo(waistFront.x, waistFront.y)
      .quadraticCurveTo(hipFront.x, hipFront.y, hemFront.x, hemFront.y)
      .lineTo(hemBack.x, hemBack.y)
      .quadraticCurveTo(seat.x, seat.y, waistBack.x, waistBack.y)
      .fill(cloth)
      .stroke({ width: 1.6, color: ink, join: 'round' });
    // Pleats fanning from the belt to the hem.
    for (const t of [0.2, 0.42, 0.64, 0.84]) {
      const top = T(-9 + t * 20, -16.5);
      const bx = hemBack.x + (hemFront.x - hemBack.x) * t;
      const by = hemBack.y + (hemFront.y - hemBack.y) * t;
      g.moveTo(top.x, top.y)
        .quadraticCurveTo((top.x + bx) / 2 - 2, (top.y + by) / 2, bx, by - 3)
        .stroke({ width: 1, color: ink, alpha: 0.6, cap: 'round' });
    }
    // Meander hem: an ink band with clay keys.
    g.moveTo(hemBack.x, hemBack.y).lineTo(hemFront.x, hemFront.y).stroke({ width: 5.5, color: ink, cap: 'butt' });
    const n = Math.max(2, Math.floor((hemFront.x - hemBack.x) / 6));
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n;
      const x = hemBack.x + (hemFront.x - hemBack.x) * t;
      const y = hemBack.y + (hemFront.y - hemBack.y) * t;
      g.rect(x - 1.1, y - 1.5, 2.2, 2.2).fill(cloth);
    }
  }
}
