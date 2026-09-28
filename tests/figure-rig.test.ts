import { describe, expect, it } from 'vitest';
import { FIGURE_BONES, pullPose, pushPose, solveSkeleton, walkPose } from '../src/world/figure';
import deliveries from '../public/assets/pottery-v1/delivery.json';

describe('character skeletons', () => {
  it('defines a unique, finite hierarchy and solves every authored bone', () => {
    const ids = FIGURE_BONES.map((bone) => bone.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const bone of FIGURE_BONES) {
      if (bone.parent) expect(ids).toContain(bone.parent);
    }

    const solved = solveSkeleton(pushPose(0));
    expect(solved.map((bone) => bone.id)).toEqual(ids);
    for (const bone of solved) {
      expect([bone.start.x, bone.start.y, bone.end.x, bone.end.y].every(Number.isFinite)).toBe(true);
      expect(Math.hypot(bone.end.x - bone.start.x, bone.end.y - bone.start.y)).toBeGreaterThan(5);
    }
  });

  it('attaches the shared skeleton to both delivered character assets', () => {
    for (const id of ['sisyphus', 'shade_attendant'] as const) {
      const skeleton = deliveries.assets[id].skeleton;
      expect(skeleton.renderer).toBe('procedural-vector');
      expect(skeleton.bones).toEqual(FIGURE_BONES);
      expect(skeleton.animations.length).toBeGreaterThan(0);
    }
  });

  it('moves limbs across push, pull, and walk clips while keeping bone lengths stable', () => {
    for (const clip of [pushPose, pullPose, walkPose]) {
      const a = solveSkeleton(clip(0));
      const b = solveSkeleton(clip(0.25));
      expect(b.some((bone, i) => Math.hypot(bone.end.x - a[i].end.x, bone.end.y - a[i].end.y) > 0.5)).toBe(true);
      for (let i = 0; i < a.length; i++) {
        const length = (bone: typeof a[number]) => Math.hypot(bone.end.x - bone.start.x, bone.end.y - bone.start.y);
        expect(length(b[i])).toBeCloseTo(length(a[i]), 5);
      }
    }
  });
});
