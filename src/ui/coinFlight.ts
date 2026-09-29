/**
 * Obols fly from where they were earned to the purse in the corner: a short
 * arc, a turn of the coin in flight, and a knock on the purse as each lands.
 * Purely cosmetic; the counter has already changed. Capped so a fast
 * operation reads as a steady trickle rather than a swarm.
 */

import { canvasOf } from '../world/paint';
import { obolTexture } from '../world/painted';

const MAX_IN_FLIGHT = 16;
const STEPS = 10;
/** Glints trailing each coin: delay (ms) and strength. */
const TRAIL: [number, number][] = [
  [30, 0.55],
  [65, 0.3],
];

let painted: string | null | undefined;

/** The world's struck obol, so the coin in flight matches the ones on the ground. */
function paintedObol(): string | null {
  if (painted === undefined) {
    try {
      painted = canvasOf(obolTexture('face')).toDataURL();
    } catch {
      painted = null;
    }
  }
  return painted;
}

export class CoinFlight {
  private layer: HTMLDivElement;
  private flying = 0;
  private lastBump = 0;

  constructor(
    private src: string,
    /** The purse's coin, the flight's target. */
    private target: () => HTMLElement | null,
    /** Text to brighten as coins land. */
    private counter: () => HTMLElement | null,
    /** Called as a coin lands, for its sound. */
    private onLand: () => void = () => {},
  ) {
    this.layer = document.createElement('div');
    this.layer.className = 'coin-flight';
    this.layer.setAttribute('aria-hidden', 'true');
    Object.assign(this.layer.style, { position: 'fixed', inset: '0', pointerEvents: 'none', zIndex: '40', overflow: 'hidden' });
    document.body.appendChild(this.layer);
  }

  launch(x: number, y: number, grand: boolean): void {
    const to = this.target()?.getBoundingClientRect();
    if (!to) return;
    const count = Math.min(grand ? 6 : 3, MAX_IN_FLIGHT - this.flying);
    const tx = to.left + to.width / 2;
    const ty = to.top + to.height / 2;
    for (let i = 0; i < count; i++) this.fly(x + (Math.random() - 0.5) * 50, y + (Math.random() - 0.5) * 24, tx, ty, i * 70);
  }

  private fly(x0: number, y0: number, x1: number, y1: number, delay: number): void {
    this.flying++;
    const size = 26;
    const img = document.createElement('img');
    img.src = paintedObol() ?? this.src;
    img.alt = '';
    Object.assign(img.style, {
      position: 'absolute',
      left: `${-size / 2}px`,
      top: `${-size / 2}px`,
      width: `${size}px`,
      height: `${size}px`,
      filter: 'drop-shadow(0 2px 1px rgba(33, 27, 23, 0.35))',
      willChange: 'transform',
      opacity: '0',
    });
    this.layer.appendChild(img);
    // A quadratic arc that lifts first, then drops into the purse.
    const cx = x0 + (x1 - x0) * 0.25 + (Math.random() - 0.5) * 80;
    const cy = Math.min(y0, y1) - 120 - Math.random() * 60;
    const spin = 2 + Math.floor(Math.random() * 2);
    const frames: Keyframe[] = [];
    for (let s = 0; s <= STEPS; s++) {
      const k = s / STEPS;
      const t = k * k * (3 - 2 * k) * 0.35 + k * k * 0.65;
      const u = 1 - t;
      const x = u * u * x0 + 2 * u * t * cx + t * t * x1;
      const y = u * u * y0 + 2 * u * t * cy + t * t * y1;
      // Pop out, hold, then shrink into the purse; turn about the vertical axis.
      const scale = k < 0.15 ? 0.5 + (k / 0.15) * 0.7 : 1.2 - 0.55 * ((k - 0.15) / 0.85);
      const turn = Math.cos(k * Math.PI * spin);
      frames.push({
        offset: k,
        transform: `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) scale(${(scale * Math.max(0.15, Math.abs(turn))).toFixed(3)}, ${scale.toFixed(3)})`,
        opacity: k < 0.08 ? k / 0.08 : 1,
      });
    }
    const duration = 760 + Math.random() * 180;
    // A thin streak of gold light follows it in.
    for (const [lag, strength] of TRAIL) {
      const glow = document.createElement('div');
      Object.assign(glow.style, {
        position: 'absolute',
        left: `${-size / 2}px`,
        top: `${-size / 2}px`,
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(255, 236, 170, 0.95) 0%, rgba(232, 180, 80, 0.5) 40%, rgba(232, 180, 80, 0) 70%)',
        mixBlendMode: 'screen',
        willChange: 'transform',
        opacity: '0',
      });
      this.layer.appendChild(glow);
      const trail = glow.animate(
        frames.map((f) => ({ ...f, transform: String(f.transform).replace(/scale\([^)]*\)/, `scale(${(0.8 - lag / 200).toFixed(2)})`), opacity: Number(f.opacity) * strength })),
        { duration, delay: delay + lag, easing: 'linear', fill: 'both' },
      );
      trail.onfinish = trail.oncancel = () => glow.remove();
    }
    const anim = img.animate(frames, { duration, delay, easing: 'linear', fill: 'both' });
    anim.onfinish = () => {
      img.remove();
      this.flying--;
      this.bump();
    };
    anim.oncancel = () => {
      img.remove();
      this.flying--;
    };
  }

  /** The purse takes the coin: a small knock, at most every few frames. */
  private bump(): void {
    const now = performance.now();
    if (now - this.lastBump < 90) return;
    this.lastBump = now;
    this.onLand();
    this.target()?.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.16) rotate(-8deg)' }, { transform: 'scale(1)' }], { duration: 220, easing: 'ease-out' });
    this.counter()?.animate([{ offset: 0, color: '#954421', textShadow: '0 0 0.6em rgba(216, 178, 90, 0.8)' }], {
      duration: 420,
      easing: 'ease-out',
    });
  }

  destroy(): void {
    this.layer.remove();
  }
}
