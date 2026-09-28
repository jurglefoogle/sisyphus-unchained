/** Renderer-neutral asset data. No timing here changes the simulation. */
export interface AssetKeyframe {
  time: number;
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
  rotation: number;
  alpha: number;
}

export interface AssetFrame {
  assetId: string;
  url: string;
  dimensions: number[];
  /** Normalized against the complete source canvas, including padding. */
  pivot: number[];
}

export interface AssetLayer {
  id: string;
  frame: AssetFrame;
  /** Rendered full canvas size, in stage pixels before parent scaling. */
  size: number[];
  keyframes: AssetKeyframe[];
}

export interface AssetState {
  status: 'available' | 'blocked-image-limit';
  duration: number;
  loop: boolean;
  reducedMotionTime: number;
  layers: AssetLayer[];
  notes?: string;
  plannedAssets?: string[];
  audioUrl?: string;
}

export interface AssetDelivery {
  states: Record<string, AssetState>;
  notes?: string;
  variants?: Record<string, { status: string; states: Record<string, AssetState>; notes?: string }>;
}

export interface LibraryAsset {
  id: string;
  category: string;
  url: string;
  sourceFile: string;
  status: string;
  provenance: string;
  dimensions?: number[];
  pivot?: number[];
  durationSeconds?: number;
  loop?: boolean;
}
