import { Sprite, type Container, type Graphics } from 'pixi.js';
import { TARGET_ANCHOR, targetTexture } from './painted';
import { POTTERY } from './palette';

/**
 * Renderer-drawn props in the black-figure style: the waiting targets (the
 * delivered idle icons are fine line art that disappears at game scale, so
 * these are painted) and the stand-in figure for Sisyphus's blocked poses. Everything is anchored at
 * its ground point (0, 0).
 */
const INK = POTTERY.ink;

/** The waiting target, painted (see painted.ts): a figured amphora of obols, a gilded tripod or a heap of debris. */
export function drawTarget(c: Container, kind: string): void {
  for (const child of c.removeChildren()) child.destroy();
  const art = new Sprite(targetTexture(kind));
  art.anchor.set(TARGET_ANCHOR.x, TARGET_ANCHOR.y);
  c.addChild(art);
}

/**
 * Greybox stand-in for Sisyphus's blocked poses (rest, walk, slip): a
 * black-figure silhouette in a clay chiton, about as tall as the push art.
 */
export function drawFigure(g: Graphics, stride: number, moving: boolean, wrapped: boolean): void {
  g.clear();
  const sw = moving ? Math.sin(stride) : 0;
  const leg = { width: 11, color: INK, cap: 'round' as const, join: 'round' as const };
  const arm = { width: 8, color: INK, cap: 'round' as const, join: 'round' as const };
  const feet = [-sw * 16, sw * 16];
  // Far leg and arm first.
  g.moveTo(0, -66).lineTo(4 + feet[0] * 0.4, -34).lineTo(feet[0], -3).stroke(leg);
  g.moveTo(feet[0], -3).lineTo(feet[0] + 10, -2).stroke({ ...leg, width: 7 });
  g.moveTo(-2, -110).lineTo(-6 + sw * 7, -86).lineTo(-3 + sw * 14, -64).stroke(arm);
  g.moveTo(0, -66).lineTo(4 + feet[1] * 0.4, -34).lineTo(feet[1], -3).stroke(leg);
  g.moveTo(feet[1], -3).lineTo(feet[1] + 10, -2).stroke({ ...leg, width: 7 });
  // Chiton with a pale hem and ink belt.
  g.poly([-17, -116, 17, -116, 25, -60, 8, -55, -6, -58, -25, -60]).fill(POTTERY.clay).stroke({ width: 2, color: INK, join: 'round' });
  g.moveTo(-24, -64).lineTo(24, -64).stroke({ width: 4, color: POTTERY.paleClay });
  g.moveTo(-19, -89).lineTo(19, -89).stroke({ width: 3.5, color: INK });
  g.moveTo(-6, -114).lineTo(-12, -92).stroke({ width: 1.5, color: INK, alpha: 0.6 });
  g.moveTo(6, -114).lineTo(4, -92).stroke({ width: 1.5, color: INK, alpha: 0.6 });
  // Near arm over the chiton.
  g.moveTo(4, -110).lineTo(8 - sw * 7, -86).lineTo(6 - sw * 14, -64).stroke(arm);
  // Head: curls, headband, beard, eye.
  g.rect(-3, -124, 8, 10).fill(INK);
  g.circle(3, -128, 12).fill(INK);
  g.circle(-5, -133, 9).fill(INK);
  g.moveTo(-10, -135).lineTo(13, -133).stroke({ width: 2.5, color: POTTERY.clay });
  g.poly([5, -124, 17, -121, 9, -110]).fill(INK);
  g.circle(10, -129, 1.7).fill(POTTERY.ivory);
  if (wrapped) {
    for (const x of feet) g.roundRect(x - 6, -9, 18, 8, 3).fill(POTTERY.parchment).stroke({ width: 1.5, color: INK });
  }
}
