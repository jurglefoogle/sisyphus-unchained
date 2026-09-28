import type { Graphics } from 'pixi.js';
import { POTTERY } from './palette';

/**
 * Renderer-drawn props in the black-figure style: the waiting targets (the
 * delivered idle icons are fine line art that disappears at game scale) and
 * the stand-in figure for Sisyphus's blocked poses. Everything is anchored at
 * its ground point (0, 0).
 */
const INK = POTTERY.ink;
const STONE = 0x5a4636;
const STONE_LIT = 0x93705a;
const GOLD = 0xd8b25a;

function contactShadow(g: Graphics, rx: number) {
  g.ellipse(0, 2, rx, rx * 0.16).fill({ color: INK, alpha: 0.28 });
}

function lump(g: Graphics, x: number, y: number, rx: number, ry: number, body = STONE, lit = STONE_LIT) {
  g.ellipse(x, y, rx, ry).fill(body);
  g.ellipse(x - rx * 0.3, y - ry * 0.4, rx * 0.55, ry * 0.4).fill({ color: lit, alpha: 0.75 });
  g.ellipse(x, y, rx, ry).stroke({ width: 2.5, color: INK });
}

/** A black-figure amphora of Obols with a clay panel, handles and coins at the lip. */
function amphora(g: Graphics) {
  contactShadow(g, 42);
  // Handles behind the body.
  g.moveTo(-12, -100).bezierCurveTo(-44, -108, -46, -84, -34, -76).stroke({ width: 6, color: INK, cap: 'round' });
  g.moveTo(12, -100).bezierCurveTo(44, -108, 46, -84, 34, -76).stroke({ width: 6, color: INK, cap: 'round' });
  // Coins spilling from the mouth.
  for (const [x, y] of [[-8, -118], [6, -121], [0, -114], [13, -115]] as const) {
    g.circle(x, y, 6).fill(GOLD).stroke({ width: 1.8, color: INK });
  }
  g.moveTo(-16, -112)
    .lineTo(16, -112)
    .lineTo(12, -100)
    .bezierCurveTo(46, -90, 52, -56, 36, -30)
    .bezierCurveTo(28, -16, 18, -10, 13, -6)
    .lineTo(20, 0)
    .lineTo(-20, 0)
    .lineTo(-13, -6)
    .bezierCurveTo(-18, -10, -28, -16, -36, -30)
    .bezierCurveTo(-52, -56, -46, -90, -12, -100)
    .closePath()
    .fill(INK);
  // Lip, shoulder and foot bands in clay; a figured panel on the belly.
  g.rect(-17, -115, 34, 5).fill(POTTERY.paleClay).stroke({ width: 1.5, color: INK });
  g.moveTo(-30, -84).quadraticCurveTo(0, -78, 30, -84).stroke({ width: 3, color: POTTERY.clay });
  g.roundRect(-23, -70, 46, 32, 6).fill(POTTERY.clay);
  g.circle(0, -54, 9).fill(INK);
  g.circle(0, -54, 5).stroke({ width: 1.5, color: POTTERY.clay });
  g.moveTo(-27, -22).quadraticCurveTo(0, -17, 27, -22).stroke({ width: 3, color: POTTERY.clay });
  // Sheen on the lit side.
  g.moveTo(-34, -70).quadraticCurveTo(-40, -52, -30, -36).stroke({ width: 3, color: POTTERY.ivory, alpha: 0.35, cap: 'round' });
}

/** A heap of broken stone and pot shards. */
function debris(g: Graphics) {
  contactShadow(g, 52);
  lump(g, -26, -12, 22, 14);
  lump(g, 30, -8, 16, 10);
  lump(g, 8, -13, 26, 16);
  lump(g, -8, -31, 18, 12);
  // A broken sherd, clay with an ink band.
  g.poly([-50, -2, -44, -26, -28, -30, -30, -4]).fill(POTTERY.clay).stroke({ width: 2.2, color: INK, join: 'round' });
  g.moveTo(-47, -14).lineTo(-29, -18).stroke({ width: 4, color: INK });
  g.poly([36, -18, 50, -30, 56, -12]).fill(POTTERY.paleClay).stroke({ width: 2, color: INK, join: 'round' });
}

/** A bronze tripod cauldron heaped with gold. */
function offering(g: Graphics) {
  contactShadow(g, 46);
  for (const [x0, x1] of [[-26, -40], [26, 40], [0, 0]] as const) {
    g.moveTo(x0, -40).lineTo(x1, 0).stroke({ width: 6, color: INK, cap: 'round' });
  }
  // Ring handles.
  g.circle(-26, -86, 10).stroke({ width: 5, color: INK });
  g.circle(26, -86, 10).stroke({ width: 5, color: INK });
  g.circle(-26, -86, 10).stroke({ width: 2.5, color: POTTERY.bronze });
  g.circle(26, -86, 10).stroke({ width: 2.5, color: POTTERY.bronze });
  // Gold heaped above the rim.
  for (const [x, y] of [[-20, -80], [-8, -86], [6, -84], [18, -80], [-2, -92], [12, -91]] as const) {
    g.circle(x, y, 6.5).fill(GOLD).stroke({ width: 1.6, color: INK });
  }
  g.moveTo(-44, -76)
    .lineTo(44, -76)
    .bezierCurveTo(44, -48, 26, -34, 0, -34)
    .bezierCurveTo(-26, -34, -44, -48, -44, -76)
    .closePath()
    .fill(POTTERY.bronze)
    .stroke({ width: 3, color: INK });
  g.moveTo(-40, -66).lineTo(40, -66).stroke({ width: 2, color: INK, alpha: 0.7 });
  g.moveTo(-30, -60).quadraticCurveTo(-30, -44, -14, -40).stroke({ width: 3, color: POTTERY.ivory, alpha: 0.5, cap: 'round' });
  g.rect(-47, -80, 94, 6).fill(INK);
}

export function drawTarget(g: Graphics, kind: string): void {
  g.clear();
  if (kind === 'coin_amphora') amphora(g);
  else if (kind === 'gilded_offering') offering(g);
  else debris(g);
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
