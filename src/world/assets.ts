/**
 * Asset contract between the art pipeline and the world renderer. IDs match
 * economy.json (stoneAssetId, sceneId) and the animation inventory in spec §04.
 * Until an asset is delivered, the renderer draws a greybox stand-in.
 *
 * Delivery rules (spec §04 "Asset acceptance"): transparent background, edge
 * padding, consistent scale, and a documented pivot for every export.
 */
export interface AssetSpec {
  id: string;
  /** Clips or states the renderer will request. */
  states: string[];
  /** Where the pivot must sit, in words, so placement code stays stable. */
  pivot: string;
  notes?: string;
}

export const ASSET_MANIFEST: AssetSpec[] = [
  {
    id: 'sisyphus',
    states: [
      'rest',
      'push_loop',
      'strain_accent',
      'summit_reaction',
      'step_aside',
      'manual_assist',
      'walk',
      // Prelude: grip gives out, he is knocked flat, gets up and trudges down.
      'slip_knockdown',
      'get_up',
    ],
    pivot: 'between the feet, on the ground line',
    notes: 'Needs a feet_wrapped variant (rag wraps) from the Wrap Your Feet upgrade onward.',
  },
  { id: 'shade_attendant', states: ['pull_loop', 'idle', 'purchase_reaction', 'walk'], pivot: 'between the feet, on the ground line' },
  ...['stone_limestone', 'stone_basalt', 'stone_marble', 'stone_bronze', 'stone_star', 'stone_decree'].map((id) => ({
    id,
    states: ['texture'],
    pivot: 'centre of the stone',
    notes: 'Rotated by the renderer; rolling, hesitation and rebound are transforms.',
  })),
  {
    id: 'stone_limestone_prelude',
    states: ['rough', 'chipped'],
    pivot: 'centre of the stone',
    notes: 'First Hill stone before Grind It Round: jagged, then chipped. Afterwards stone_limestone.',
  },
  {
    id: 'route_footholds',
    states: ['idle'],
    pivot: 'route foot',
    notes: 'Steps cut into the upper half of the First Hill route (Cut Footholds).',
  },
  { id: 'best_height_marker', states: ['idle', 'moved'], pivot: 'bottom of the pole, on the route surface' },
  { id: 'fx_fall', states: ['dust', 'obol_toss'], pivot: 'centre', notes: 'Slip dust and the shades tossing obols at the foot.' },
  { id: 'fx_first_summit', states: ['burst'], pivot: 'centre', notes: 'One-time celebration at the end of the prelude.' },
  { id: 'flywheel', states: ['uninstalled', 'charging', 'turning', 'upgraded'], pivot: 'wheel hub', notes: 'Rotated by the renderer.' },
  { id: 'rope_drum', states: ['idle', 'turning'], pivot: 'drum axle' },
  { id: 'target_debris', states: ['idle', 'shatter'], pivot: 'bottom centre' },
  { id: 'target_coin_amphora', states: ['idle', 'shatter'], pivot: 'bottom centre' },
  { id: 'target_gilded_offering', states: ['idle', 'shatter'], pivot: 'bottom centre' },
  ...['hermes', 'daedalus', 'ixion', 'danaids', 'talos', 'atlas', 'charter'].map((id) => ({
    id: `work_${id}`,
    states: ['entrance', 'idle'],
    pivot: 'bottom centre, anchored at the summit post',
  })),
  { id: 'install_level_10', states: ['idle'], pivot: 'route foot', notes: 'Extra scaffold' },
  { id: 'install_level_25', states: ['idle'], pivot: 'route foot', notes: 'Bronze support' },
  { id: 'install_level_50', states: ['idle', 'running'], pivot: 'route foot', notes: 'Belt, capstan or chapter prop' },
  { id: 'fx_coin', states: ['small_grant', 'milestone_grant'], pivot: 'centre' },
  { id: 'fx_relic', states: ['rare_discovery'], pivot: 'centre' },
  { id: 'decree_stamp', states: ['stamp'], pivot: 'centre' },
  ...[
    'scene_first_hill',
    'scene_tartarus_rim',
    'scene_leaking_heights',
    'scene_bronze_pass',
    'scene_skyward_escarpment',
    'scene_olympian_approach',
  ].map((id) => ({
    id,
    states: ['background', 'hill', 'foreground'],
    pivot: 'top-left of the 1600×900 stage',
    notes: 'Layers must keep the route geometry in src/world/geometry.ts clear.',
  })),
];
