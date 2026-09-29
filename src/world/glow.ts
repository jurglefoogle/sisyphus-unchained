import { Container, Sprite, Texture } from 'pixi.js';

/**
 * Pooled sprites for per-frame effects: each frame calls `begin`, a run of
 * `add`s, then `end`, and unused sprites are hidden rather than destroyed.
 * The glow layer is the same with a soft light texture and additive blending
 * so sparks, gold and embers really shine (and feed the kiln's bloom).
 */

let texture: Texture | null = null;

/** A soft disc of light: a bright core and a long falloff. */
export function glowTexture(): Texture {
  if (texture) return texture;
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const r = Math.min(1, Math.hypot(x - size / 2 + 0.5, y - size / 2 + 0.5) / (size / 2));
      const falloff = (1 - r) ** 2.4;
      const core = Math.exp(-r * r * 60);
      const a = Math.min(1, falloff * 0.55 + core * 0.9);
      const i = (y * size + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = 255;
      img.data[i + 3] = Math.round(a * 255);
    }
  }
  ctx.putImageData(img, 0, 0);
  texture = Texture.from(canvas);
  return texture;
}

export class SpriteLayer extends Container {
  private pool: Sprite[] = [];
  private used = 0;

  constructor(
    private max = 200,
    private blend: 'normal' | 'add' = 'normal',
  ) {
    super();
  }

  begin(): void {
    this.used = 0;
  }

  /** Place `tex` at (x, y), `w` × `h` world units, turned by `angle`. */
  put(tex: Texture, x: number, y: number, w: number, h: number, angle = 0, alpha = 1, tint = 0xffffff): Sprite | null {
    if (this.used >= this.max || alpha <= 0.01) return null;
    let s = this.pool[this.used];
    if (!s) {
      s = new Sprite(tex);
      s.anchor.set(0.5);
      s.blendMode = this.blend;
      this.pool.push(s);
      this.addChild(s);
    }
    this.used++;
    s.texture = tex;
    s.visible = true;
    s.position.set(x, y);
    s.tint = tint;
    s.alpha = Math.min(1, alpha);
    s.rotation = angle;
    s.width = w;
    s.height = h;
    return s;
  }

  end(): void {
    for (let i = this.used; i < this.pool.length; i++) this.pool[i].visible = false;
  }
}

export class GlowLayer extends SpriteLayer {
  constructor(max = 160) {
    super(max, 'add');
  }

  /** A glow of `radius` world units; `stretch` lengthens it along `angle`. */
  add(x: number, y: number, radius: number, color: number, alpha: number, stretch = 1, angle = 0): void {
    if (radius <= 0) return;
    this.put(glowTexture(), x, y, radius * 2 * stretch, radius * 2, angle, alpha, color);
  }
}
