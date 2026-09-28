import { POTTERY } from './palette';

/**
 * Pose model for the black-figure rig: joint angles, the skeleton they solve
 * to, and IK helpers that plant feet and hands. The figure is ≈150 stage px
 * tall, facing +x with the feet on (0, 0). rig.ts draws it.
 */
const INK = POTTERY.ink;
const CLAY = POTTERY.clay;
const INCISE = 0xc0703f;

const THIGH = 38;
const SHIN = 38;
const TORSO = 44;
const UPPER_ARM = 30;
const FOREARM = 28;

interface Leg {
  /** Thigh angle from straight down; positive swings forward. */
  a: number;
  /** Knee bend; positive folds the shin back. */
  b: number;
}
interface Arm {
  /** Upper-arm angle from straight down; positive swings forward. */
  s: number;
  /** Elbow bend; positive folds the forearm forward. */
  e: number;
  /** Wrist bend; positive tips the fingers toward the thumb side (a palm pressed flat). */
  w?: number;
  /** 1 opens the hand flat (pressing, bracing); 0 lets the fingers curl loosely. */
  open?: number;
}

export interface Pose {
  hipX: number;
  hipY: number;
  /** Torso angle from upright; positive leans forward. */
  lean: number;
  /** Head tilt; positive looks down. */
  nod: number;
  far: Leg;
  near: Leg;
  farArm: Arm;
  nearArm: Arm;
  /** Screen angle of the ground under the feet (negative rises ahead); the feet lie along it. */
  ground?: number;
  /** How far the skirt and belt tie trail behind (px), from motion. */
  sway?: number;
}

export const FIGURE_BONES = [
  { id: 'pelvis', parent: null },
  { id: 'torso', parent: 'pelvis' },
  { id: 'head', parent: 'torso' },
  { id: 'far_upper_arm', parent: 'torso' },
  { id: 'far_forearm', parent: 'far_upper_arm' },
  { id: 'near_upper_arm', parent: 'torso' },
  { id: 'near_forearm', parent: 'near_upper_arm' },
  { id: 'far_thigh', parent: 'pelvis' },
  { id: 'far_shin', parent: 'far_thigh' },
  { id: 'near_thigh', parent: 'pelvis' },
  { id: 'near_shin', parent: 'near_thigh' },
] as const;

export type FigureBoneId = (typeof FIGURE_BONES)[number]['id'];
export interface SolvedBone { id: FigureBoneId; parent: FigureBoneId | null; start: P; end: P }

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Blend `from` toward `to` in place. */
export function easePose(from: Pose, to: Pose, t: number): Pose {
  from.hipX = lerp(from.hipX, to.hipX, t);
  from.hipY = lerp(from.hipY, to.hipY, t);
  from.lean = lerp(from.lean, to.lean, t);
  from.nod = lerp(from.nod, to.nod, t);
  for (const k of ['far', 'near'] as const) {
    from[k].a = lerp(from[k].a, to[k].a, t);
    from[k].b = lerp(from[k].b, to[k].b, t);
  }
  for (const k of ['farArm', 'nearArm'] as const) {
    from[k].s = lerp(from[k].s, to[k].s, t);
    from[k].e = lerp(from[k].e, to[k].e, t);
    from[k].w = lerp(from[k].w ?? 0, to[k].w ?? 0, t);
    from[k].open = lerp(from[k].open ?? 0, to[k].open ?? 0, t);
  }
  from.ground = lerp(from.ground ?? 0, to.ground ?? 0, t);
  from.sway = lerp(from.sway ?? 0, to.sway ?? 0, t);
  return from;
}

export function standPose(breath = 0): Pose {
  const b = Math.sin(breath) * 0.018;
  return {
    hipX: 0,
    hipY: -79.5,
    lean: 0.03 - b,
    nod: 0.05,
    far: { a: -0.1, b: 0.06 },
    near: { a: 0.12, b: 0.1 },
    // Relaxed: the near arm a little forward with a soft elbow, the far one back.
    farArm: { s: -0.16 + b, e: 0.34, w: 0.1 },
    nearArm: { s: 0.16 - b, e: 0.42, w: 0.15 },
  };
}

/** A walking stride; `phase` advances one step per π. `weary` slumps the gait. */
export function walkPose(phase: number, weary = 0): Pose {
  const s = Math.sin(phase);
  const c = Math.cos(phase);
  const leg = (sn: number, cs: number): Leg => ({ a: 0.42 * sn - 0.02, b: 0.1 + 0.62 * Math.max(0, cs) });
  return {
    hipX: 0,
    hipY: -78 + 2.6 * Math.abs(c) - 2 - weary * 3,
    lean: 0.08 + weary * 0.2,
    nod: 0.04 + weary * 0.35,
    near: leg(s, c),
    far: leg(-s, -c),
    nearArm: { s: -0.36 * s * (1 - weary * 0.5), e: 0.3 + 0.25 * Math.max(0, -s) },
    farArm: { s: 0.36 * s * (1 - weary * 0.5), e: 0.3 + 0.25 * Math.max(0, s) },
  };
}

/** Two-beat uphill effort cycle, with planted feet and hands. */
export function pushPose(phase: number, strain = 0): Pose {
  const drive = (Math.sin(phase * Math.PI * 2) + 1) * 0.5;
  const effort = 0.08 * drive + strain * 0.08;
  return {
    hipX: -2 + drive * 2,
    hipY: -75 + drive * 2,
    lean: 0.42 + effort,
    nod: 0.1 + effort * 0.5,
    far: { a: -0.34 + drive * 0.08, b: 0.16 + drive * 0.16 },
    near: { a: 0.42 - drive * 0.06, b: 0.22 + drive * 0.18 },
    farArm: { s: 1.02 - effort, e: 0.08 + drive * 0.12 },
    nearArm: { s: 1.12 - effort, e: 0.06 + drive * 0.1 },
  };
}

/** Capstan-hauling cycle for the shade attendant. */
export function pullPose(phase: number): Pose {
  const pull = (Math.sin(phase * Math.PI * 2) + 1) * 0.5;
  return {
    hipX: -pull * 3,
    hipY: -77 + pull,
    lean: 0.16 - pull * 0.18,
    nod: 0.16,
    far: { a: -0.18, b: 0.12 + pull * 0.12 },
    near: { a: 0.22, b: 0.16 + pull * 0.1 },
    farArm: { s: 0.84 - pull * 0.34, e: 0.18 + pull * 0.72 },
    nearArm: { s: 0.94 - pull * 0.38, e: 0.16 + pull * 0.76 },
  };
}

/** Stepped aside with hands on hips, as the concept's third panel. */
export function asidePose(breath = 0): Pose {
  const b = Math.sin(breath) * 0.02;
  const pose: Pose = {
    hipX: 0,
    hipY: -80,
    lean: -0.05 - b,
    nod: -0.06,
    far: { a: -0.16, b: 0.04 },
    near: { a: 0.2, b: 0.16 },
    farArm: { s: 0, e: 0 },
    nearArm: { s: 0, e: 0 },
  };
  // Knuckles on the hips, both elbows jutting back: the near arm frames the
  // waist, the far elbow shows behind the back.
  reachArm(pose, 'nearArm', { x: 7, y: pose.hipY - 14 + b * 30 });
  reachArm(pose, 'farArm', { x: -7, y: pose.hipY - 15 });
  return pose;
}

/** Knocked down by the slip: sprawled back on one elbow, one knee up. */
export function fallenPose(t = 0): Pose {
  const w = Math.sin(t * 2.2) * 0.04;
  const pose: Pose = {
    hipX: -6,
    hipY: -15,
    lean: -1.12 + w,
    nod: -0.25,
    far: { a: 0.95, b: 1.55 },
    near: { a: 1.45, b: 0.22 },
    farArm: { s: 0, e: 0 },
    nearArm: { s: 0, e: 0 },
  };
  // One leg flung out along the ground, the other knee drawn up.
  plantLeg(pose, 'near', { x: 64, y: -ANKLE_H });
  plantLeg(pose, 'far', { x: 36 + w * 30, y: -ANKLE_H });
  // Propped on the near palm behind him; the far hand clutches the raised knee.
  reachArm(pose, 'nearArm', { x: -50, y: -4 }, true);
  reachArm(pose, 'farArm', { x: 14 + w * 40, y: -36 });
  pose.nearArm.open = 1;
  pose.farArm.open = 1;
  return pose;
}

type P = { x: number; y: number };

const leg = (hip: P, l: Leg) => {
  const knee = { x: hip.x + Math.sin(l.a) * THIGH, y: hip.y + Math.cos(l.a) * THIGH };
  const sa = l.a - l.b;
  const ankle = { x: knee.x + Math.sin(sa) * SHIN, y: knee.y + Math.cos(sa) * SHIN };
  return { knee, ankle, sa };
};

const arm = (shoulder: P, a: Arm, lean: number) => {
  const s = a.s + lean;
  const elbow = { x: shoulder.x + Math.sin(s) * UPPER_ARM, y: shoulder.y + Math.cos(s) * UPPER_ARM };
  const fa = s + a.e;
  const hand = { x: elbow.x + Math.sin(fa) * FOREARM, y: elbow.y + Math.cos(fa) * FOREARM };
  return { elbow, hand };
};

/** Resolve the authored pose into the named bone segments used by the renderer. */
export function solveSkeleton(pose: Pose): SolvedBone[] {
  const hip = { x: pose.hipX, y: pose.hipY };
  const up = { x: Math.sin(pose.lean), y: -Math.cos(pose.lean) };
  const fwd = { x: -up.y, y: up.x };
  const at = (along: number, side: number): P => ({ x: hip.x + up.x * along + fwd.x * side, y: hip.y + up.y * along + fwd.y * side });
  const torsoEnd = at(TORSO - 2, 1);
  const farShoulder = at(TORSO - 3, -3);
  const nearShoulder = torsoEnd;
  const farArm = arm(farShoulder, pose.farArm, pose.lean);
  const nearArm = arm(nearShoulder, pose.nearArm, pose.lean);
  const farHip = at(0, -3);
  const nearHip = at(0, 3);
  const farLeg = leg(farHip, pose.far);
  const nearLeg = leg(nearHip, pose.near);
  const neck = at(TORSO + 5, 3);
  const head = {
    x: neck.x + Math.sin(pose.lean + pose.nod) * 12.5,
    y: neck.y - Math.cos(pose.lean + pose.nod) * 12.5,
  };
  const parent = new Map(FIGURE_BONES.map((bone) => [bone.id, bone.parent]));
  const bone = (id: FigureBoneId, start: P, end: P): SolvedBone => ({ id, parent: parent.get(id) ?? null, start, end });
  return [
    bone('pelvis', hip, at(8, 0)),
    bone('torso', at(8, 0), torsoEnd),
    bone('head', neck, head),
    bone('far_upper_arm', farShoulder, farArm.elbow),
    bone('far_forearm', farArm.elbow, farArm.hand),
    bone('near_upper_arm', nearShoulder, nearArm.elbow),
    bone('near_forearm', nearArm.elbow, nearArm.hand),
    bone('far_thigh', farHip, farLeg.knee),
    bone('far_shin', farLeg.knee, farLeg.ankle),
    bone('near_thigh', nearHip, nearLeg.knee),
    bone('near_shin', nearLeg.knee, nearLeg.ankle),
  ];
}

/** Colours for a rigged figure: Sisyphus in black-figure, the shade in ashen grey. */
export interface Look {
  ink: number;
  cloth: number;
  incise: number;
  eye: number;
}
export const SISYPHUS_LOOK: Look = { ink: INK, cloth: CLAY, incise: INCISE, eye: POTTERY.ivory };
export const SHADE_LOOK: Look = { ink: 0x4a5a63, cloth: 0x9fb0b8, incise: 0xc9d6dc, eye: 0xe8f0f2 };

/** Bone lengths, for drawing each segment at its size. */
export const BONE_LENGTH = { THIGH, SHIN, TORSO, UPPER_ARM, FOREARM } as const;

// ------------------------------------------------------------------------ IK
//
// Poses are authored as joint angles; these solve the two-bone limbs so feet
// land on the real ground and hands meet what they hold. Targets are in the
// figure's local space (feet at the origin, facing +x, y down).

/** Hip and shoulder positions for a pose, as solveSkeleton places them. */
function joints(pose: Pose) {
  const up = { x: Math.sin(pose.lean), y: -Math.cos(pose.lean) };
  const fwd = { x: -up.y, y: up.x };
  const at = (along: number, side: number): P => ({
    x: pose.hipX + up.x * along + fwd.x * side,
    y: pose.hipY + up.y * along + fwd.y * side,
  });
  return { farHip: at(0, -3), nearHip: at(0, 3), farShoulder: at(TORSO - 3, -3), nearShoulder: at(TORSO - 2, 1) };
}

/** Angle from straight down toward +x, and the two interior angles of the limb triangle. */
function triangle(root: P, target: P, l1: number, l2: number) {
  const dx = target.x - root.x;
  const dy = target.y - root.y;
  const d = Math.min(l1 + l2 - 0.01, Math.max(Math.abs(l1 - l2) + 0.01, Math.hypot(dx, dy)));
  const theta = Math.atan2(dx, dy);
  const alpha = Math.acos((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d));
  const beta = Math.acos((l2 * l2 + d * d - l1 * l1) / (2 * l2 * d));
  return { theta, alpha, beta };
}

/** Bend the leg so its ankle reaches `ankle`, knee forward. */
export function plantLeg(pose: Pose, which: 'far' | 'near', ankle: P): void {
  const j = joints(pose);
  const { theta, alpha, beta } = triangle(which === 'far' ? j.farHip : j.nearHip, ankle, THIGH, SHIN);
  const a = theta + alpha;
  pose[which] = { a, b: a - (theta - beta) };
}

/** Bend the arm so its hand reaches `hand`, elbow down (or forward). */
export function reachArm(pose: Pose, which: 'farArm' | 'nearArm', hand: P, elbowForward = false): void {
  const j = joints(pose);
  const { theta, alpha, beta } = triangle(which === 'farArm' ? j.farShoulder : j.nearShoulder, hand, UPPER_ARM, FOREARM);
  const s = elbowForward ? theta + alpha : theta - alpha;
  pose[which] = { s: s - pose.lean, e: elbowForward ? theta - beta - s : theta + beta - s };
}

/** Local shoulder position, for aiming a reach. */
export function shoulderOf(pose: Pose, which: 'farArm' | 'nearArm'): P {
  const j = joints(pose);
  return which === 'farArm' ? j.farShoulder : j.nearShoulder;
}

/**
 * Where each foot is in a stepping gait, as a fraction of the stride: planted
 * and sliding back through `stance` of the cycle, then lifted and swung
 * forward. Returns [far, near] with x in -1..1 and lift in 0..1.
 */
export function gait(phase: number, stance = 0.62): { x: number; lift: number }[] {
  return [phase + 0.5, phase].map((p) => {
    const t = ((p % 1) + 1) % 1;
    if (t < stance) return { x: 1 - (2 * t) / stance, lift: 0 };
    const k = (t - stance) / (1 - stance);
    const eased = k * k * (3 - 2 * k);
    return { x: -1 + 2 * eased, lift: Math.sin(Math.PI * k) };
  });
}

/** Ankle height above the sole: the foot is drawn below the ankle. */
export const ANKLE_H = 5;

/**
 * A full walking pose at gait `phase` (one stride per 1), feet planted on
 * `groundAt(localX)` and swung `step` either side of centre. The hip rides as
 * high as the legs allow, so it rises over each planted leg and dips as the
 * next heel strikes; the arms swing against the legs. `weary` shortens the
 * lift and the swing and bows the head.
 */
export function walkCycle(phase: number, step: number, weary: number, groundAt: (lx: number) => number, stance = 0.6): Pose {
  const feet = gait(phase, stance);
  const lift = 9 - weary * 4;
  const ankles = feet.map((f, i) => {
    const x = 2 + step * f.x + (i === 0 ? -3 : 3);
    return { x, y: groundAt(x) - ANKLE_H - lift * f.lift };
  });
  const pose = walkPose(0, weary);
  const reach = (THIGH + SHIN) * (0.975 - weary * 0.025);
  let hipY = -Infinity;
  ankles.forEach((a, i) => {
    const dx = a.x - (pose.hipX + (i === 0 ? -3 : 3));
    hipY = Math.max(hipY, a.y - Math.sqrt(Math.max(0, reach * reach - dx * dx)));
  });
  pose.hipY = hipY;
  // The chest leads a little more as each foot pushes off.
  const push = Math.max(feet[0].lift, feet[1].lift);
  pose.lean += 0.03 * push;
  pose.nod -= 0.03 * push;
  plantLeg(pose, 'far', ankles[0]);
  plantLeg(pose, 'near', ankles[1]);
  const swing = 0.3 * (1 - weary * 0.55);
  pose.farArm = { s: -swing * feet[0].x, e: 0.24 + 0.3 * Math.max(0, -feet[0].x), w: 0.08 };
  pose.nearArm = { s: -swing * feet[1].x, e: 0.24 + 0.3 * Math.max(0, -feet[1].x), w: 0.08 };
  return pose;
}
/** Reach from shoulder to fingertips with the arm straight. */
export const ARM_REACH = UPPER_ARM + FOREARM;

/** Screen angle of a forearm (elbow to wrist) in figure space. */
export function forearmAngle(pose: Pose, which: 'farArm' | 'nearArm'): number {
  const a = pose[which];
  const fa = a.s + pose.lean + a.e;
  return Math.atan2(Math.cos(fa), Math.sin(fa));
}
