import { describe, expect, it } from 'vitest';
import { ASSET_MANIFEST, REQUIRED_ASSETS, getAssetState, getAssetVariantState } from '../src/world/assets';
import { sampleAssetState } from '../src/world/asset-animation';
import deliveries from '../public/assets/pottery-v1/delivery.json';
import library from '../public/assets/pottery-v1/manifest.json';
import { GROUND_Y, STAGE_H, STAGE_W, surfaceY } from '../src/world/geometry';

describe('asset contract', () => {
  it('includes every source asset exactly once and preserves every requested state', () => {
    const ids = ASSET_MANIFEST.map((asset) => asset.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const asset of library.assets) expect(ids).toContain(asset.id);
    for (const spec of REQUIRED_ASSETS) {
      for (const state of spec.states) expect(getAssetState(spec.id, state), `${spec.id}/${state}`).toBeDefined();
    }
  });

  it('resolves available layers to real files with valid dimensions and clip timing', () => {
    for (const spec of ASSET_MANIFEST) {
      for (const [name, state] of Object.entries(spec.delivery?.states ?? {})) {
        expect(state.duration, `${spec.id}/${name}`).toBeGreaterThan(0);
        if (state.status !== 'available') {
          expect(state.layers).toEqual([]);
          expect(state.plannedAssets?.length).toBeGreaterThan(0);
          continue;
        }
        if (state.audioUrl) expect(state.audioUrl).toMatch(/^\/assets\/pottery-v1\/audio\/.*\.wav$/);
        for (const layer of state.layers) {
          expect(library.assets.some((asset) => asset.url === layer.frame.url), layer.frame.url).toBe(true);
          if (layer.frame.rect) {
            const [x, y, w, h] = layer.frame.rect;
            expect(x).toBeGreaterThanOrEqual(0);
            expect(y).toBeGreaterThanOrEqual(0);
            expect(w).toBeGreaterThan(0);
            expect(h).toBeGreaterThan(0);
            expect(x + w).toBeLessThanOrEqual(layer.frame.dimensions[0]);
            expect(y + h).toBeLessThanOrEqual(layer.frame.dimensions[1]);
          }
          expect(layer.frame.dimensions).toHaveLength(2);
          expect(layer.frame.pivot).toHaveLength(2);
          expect(layer.frame.pivot.every((n) => n >= 0 && n <= 1)).toBe(true);
          expect(layer.size.every((n) => n > 0)).toBe(true);
          expect(layer.keyframes.length).toBeGreaterThan(0);
          expect(layer.keyframes[0].time).toBe(0);
          for (let i = 0; i < layer.keyframes.length; i++) {
            expect(Object.values(layer.keyframes[i]).every(Number.isFinite)).toBe(true);
            expect(layer.keyframes[i].time).toBeLessThanOrEqual(state.duration);
            if (i) expect(layer.keyframes[i].time).toBeGreaterThan(layer.keyframes[i - 1].time);
          }
        }
      }
    }
  });

  it('keeps one painted Sisyphus walk frame visible throughout each quarter stride', () => {
    const walk = getAssetState('sisyphus', 'walk')!;
    expect(walk.status).toBe('available');
    expect(walk.layers).toHaveLength(4);
    for (let frame = 0; frame < 4; frame++) {
      const layers = sampleAssetState(walk, (frame + 0.5) / 4);
      expect(layers.filter((layer) => layer.transform.alpha > 0.99).map((layer) => layer.id)).toEqual([`walk_${frame}`]);
      expect(layers.every((layer) => layer.frame.assetId === 'sisyphus_walk_strip')).toBe(true);
    }
    const fall = getAssetState('sisyphus', 'slip_knockdown')!;
    expect(fall.status).toBe('available');
    expect(fall.loop).toBe(false);
    expect(sampleAssetState(fall, 5).filter((layer) => layer.transform.alpha > 0.99).map((layer) => layer.id)).toEqual(['walk_3']);
    expect(sampleAssetState(fall, 0.1, true).filter((layer) => layer.transform.alpha > 0.99).map((layer) => layer.id)).toEqual(['walk_3']);
  });

  it('keeps generated terrain aligned with authoritative route surfaces', () => {
    expect(deliveries.geometry.stage).toEqual([STAGE_W, STAGE_H]);
    expect(deliveries.geometry.ground).toBe(GROUND_Y);
    for (const [x, y] of deliveries.geometry.ascent) expect(surfaceY(x)).toBeCloseTo(y, 5);
    const firstHill = getAssetState('scene_first_hill', 'hill')!.layers[0];
    expect(firstHill.size).toEqual([STAGE_W, STAGE_H]);
    expect(firstHill.frame.pivot).toEqual([0, 0]);
  });

  it('rotates a machine rotor without rotating its support and holds reduced motion', () => {
    const state = getAssetState('flywheel', 'turning')!;
    const half = sampleAssetState(state, state.duration / 2);
    expect(half.find((layer) => layer.id === 'stand')?.transform.rotation).toBe(0);
    expect(half.find((layer) => layer.id === 'rotor')?.transform.rotation).toBeCloseTo(Math.PI);
    expect(sampleAssetState(state, .75)).toEqual(sampleAssetState(state, .75 + state.duration));
    expect(sampleAssetState(state, .4, true)).toEqual(sampleAssetState(state, 400, true));
  });

  it('finishes one-shot effects without granting rewards or reviving particles', () => {
    const state = getAssetState('target_coin_amphora', 'shatter')!;
    const end = sampleAssetState(state, 10);
    expect(end.every((layer) => layer.transform.alpha === 0)).toBe(true);
    expect(sampleAssetState(state, -1)).toEqual(sampleAssetState(state, 0));
    expect(sampleAssetState(getAssetState('sisyphus', 'walk')!, 2)).toEqual(sampleAssetState(getAssetState('sisyphus', 'walk')!, 0));
    expect(sampleAssetState(getAssetState('flywheel', 'uninstalled')!, 2)).toEqual([]);
  });

  it('reports blocked poses and variants without disguising them as delivered', () => {
    const rows = REQUIRED_ASSETS.flatMap((spec) => spec.states.map((state) => ({
      id: spec.id, state, status: getAssetState(spec.id, state)?.status ?? 'missing',
    })));
    const variants = REQUIRED_ASSETS.flatMap((spec) => Object.entries(ASSET_MANIFEST.find((asset) => asset.id === spec.id)?.delivery?.variants ?? {}).map(([name, variant]) => ({ id: spec.id, variant: name, status: variant.status })));
    const blocked = rows.filter((row) => row.status !== 'available');
    const report = {
      requiredAssets: REQUIRED_ASSETS.length,
      registeredAssets: ASSET_MANIFEST.length,
      requiredStates: rows.length,
      availableStates: rows.length - blocked.length,
      blockedStates: blocked,
      variants,
      complete: blocked.length === 0 && variants.every((variant) => variant.status === 'available'),
      rows,
    };
    expect(rows.some((row) => row.status === 'missing')).toBe(false);
    expect(report.complete).toBe(false);
    expect(variants).toContainEqual({ id: 'sisyphus', variant: 'feet_wrapped', status: 'partial' });
    expect(getAssetVariantState('sisyphus', 'feet_wrapped', 'walk')?.status).toBe('available');
    expect(getAssetVariantState('sisyphus', 'feet_wrapped', 'rest')?.status).toBe('available');
  });
});
