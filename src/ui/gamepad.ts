/**
 * Controller support (spec §04): polls the standard gamepad mapping and
 * reports button edges. Stick directions are folded into the d-pad with a
 * dead zone and a repeat delay so menus can be walked comfortably.
 */

export const PAD = {
  A: 0,
  B: 1,
  X: 2,
  Y: 3,
  LB: 4,
  RB: 5,
  BACK: 8,
  START: 9,
  UP: 12,
  DOWN: 13,
  LEFT: 14,
  RIGHT: 15,
} as const;

const DEAD_ZONE = 0.55;
const REPEAT_FIRST_MS = 380;
const REPEAT_MS = 140;
const DIRECTIONS = [PAD.UP, PAD.DOWN, PAD.LEFT, PAD.RIGHT];

export class GamepadInput {
  private raf = 0;
  private prev = new Map<number, boolean>();
  private repeatAt = new Map<number, number>();

  constructor(private onButton: (button: number, pressed: boolean) => void) {}

  start(): void {
    const loop = (now: number) => {
      this.poll(now);
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop(): void {
    cancelAnimationFrame(this.raf);
  }

  private poll(now: number): void {
    const pads = navigator.getGamepads?.() ?? [];
    const pressed = new Map<number, boolean>();
    for (const pad of pads) {
      if (!pad || !pad.connected) continue;
      pad.buttons.forEach((b, i) => {
        if (b.pressed) pressed.set(i, true);
      });
      const [x = 0, y = 0] = pad.axes;
      if (y < -DEAD_ZONE) pressed.set(PAD.UP, true);
      if (y > DEAD_ZONE) pressed.set(PAD.DOWN, true);
      if (x < -DEAD_ZONE) pressed.set(PAD.LEFT, true);
      if (x > DEAD_ZONE) pressed.set(PAD.RIGHT, true);
    }
    const all = new Set([...pressed.keys(), ...this.prev.keys()]);
    for (const i of all) {
      const now_ = pressed.get(i) ?? false;
      const was = this.prev.get(i) ?? false;
      if (now_ !== was) {
        this.onButton(i, now_);
        if (now_ && DIRECTIONS.includes(i as (typeof DIRECTIONS)[number])) this.repeatAt.set(i, now + REPEAT_FIRST_MS);
      } else if (now_ && DIRECTIONS.includes(i as (typeof DIRECTIONS)[number]) && now >= (this.repeatAt.get(i) ?? Infinity)) {
        this.onButton(i, true);
        this.repeatAt.set(i, now + REPEAT_MS);
      }
    }
    this.prev = pressed;
  }
}

/** Move focus to the next or previous focusable control inside `root`. */
export function stepFocus(root: ParentNode, dir: 1 | -1): void {
  const items = [
    ...root.querySelectorAll<HTMLElement>('button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex="0"]'),
  ].filter((el) => el.offsetParent !== null && !el.closest('[inert]'));
  if (!items.length) return;
  const i = items.indexOf(document.activeElement as HTMLElement);
  const next = items[i < 0 ? (dir > 0 ? 0 : items.length - 1) : Math.min(items.length - 1, Math.max(0, i + dir))];
  next.focus();
  next.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
}
