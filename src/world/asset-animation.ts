import type { AssetKeyframe, AssetLayer, AssetState } from './asset-types';

export interface SampledAssetLayer extends AssetLayer {
  transform: AssetKeyframe;
}

/** Pure clip sampling. Call with elapsed clip seconds, not accumulated frame steps. */
export function sampleAssetState(state: AssetState, elapsed: number, reducedMotion = false): SampledAssetLayer[] {
  if (state.status !== 'available') return [];
  const safeElapsed = Number.isFinite(elapsed) ? Math.max(0, elapsed) : 0;
  const time = reducedMotion ? state.reducedMotionTime
    : state.loop ? safeElapsed % state.duration : Math.min(safeElapsed, state.duration);
  return state.layers.map((layer) => {
    const keys = layer.keyframes;
    let first = keys[0];
    let last = first;
    for (const key of keys) {
      if (key.time <= time) first = key;
      last = key;
      if (key.time >= time) break;
    }
    const ratio = last.time > first.time ? Math.max(0, Math.min(1, (time - first.time) / (last.time - first.time))) : 0;
    const mix = (field: keyof AssetKeyframe) => first[field] + (last[field] - first[field]) * ratio;
    return { ...layer, transform: {
      time, x: mix('x'), y: mix('y'), scaleX: mix('scaleX'), scaleY: mix('scaleY'),
      rotation: mix('rotation'), alpha: mix('alpha'),
    } };
  });
}
