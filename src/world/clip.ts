import { Container, Rectangle, Sprite, Texture } from 'pixi.js';
import { sampleAssetState } from './asset-animation';
import type { AssetFrame, AssetState } from './asset-types';

/** Returns the texture for a delivered frame, or null while it loads. */
export type FrameTextures = (frame: AssetFrame) => Texture | null;

/**
 * Plays one delivered asset state (delivery.json): one sprite per layer,
 * anchored at the layer pivot, sized to the layer's stage size and moved by
 * the sampled keyframe. The parent places and scales the whole clip.
 */
export class Clip extends Container {
  private sprites = new Map<string, Sprite>();
  private order = '';
  private crops = new Map<string, Texture>();

  constructor(private textures: FrameTextures) {
    super();
  }

  /**
   * Draw `state` at `elapsed` clip seconds. Returns true once every layer is
   * drawn; false while textures load, or (hiding the clip) when the state is
   * missing or blocked, so the caller keeps its stand-in.
   */
  show(state: AssetState | undefined, elapsed: number, reducedMotion = false): boolean {
    if (!state || state.status !== 'available') {
      this.visible = false;
      return false;
    }
    this.visible = true;
    const layers = sampleAssetState(state, elapsed, reducedMotion);
    const order = layers.map((l) => l.id).join('|');
    if (order !== this.order) {
      this.order = order;
      this.removeChildren();
      for (const l of layers) {
        let sp = this.sprites.get(l.id);
        if (!sp) {
          sp = new Sprite();
          this.sprites.set(l.id, sp);
        }
        this.addChild(sp);
      }
    }
    let ready = true;
    for (const l of layers) {
      const sp = this.sprites.get(l.id)!;
      const source = this.textures(l.frame);
      let tex = source;
      if (source && l.frame.rect) {
        const rect = l.frame.rect;
        const id = `${l.frame.url}:${rect.join(',')}`;
        tex = this.crops.get(id) ?? null;
        if (!tex) {
          tex = new Texture({ source: source.source, frame: new Rectangle(rect[0], rect[1], rect[2], rect[3]) });
          this.crops.set(id, tex);
        }
      }
      sp.visible = !!tex;
      if (!tex) {
        ready = false;
        continue;
      }
      if (sp.texture !== tex) sp.texture = tex;
      const k = l.transform;
      sp.anchor.set(l.frame.pivot[0], l.frame.pivot[1]);
      sp.scale.set((l.size[0] / tex.width) * k.scaleX, (l.size[1] / tex.height) * k.scaleY);
      sp.position.set(k.x, k.y);
      sp.rotation = k.rotation;
      sp.alpha = k.alpha;
    }
    return ready;
  }
}
