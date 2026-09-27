import { catalog } from '../src/content/catalog';
import { newGame } from '../src/core/commands';
import { Money } from '../src/core/money';
import { stepSites, type StepContext } from '../src/core/sim';
import type { GameEvent, GameState } from '../src/core/state';

/** A brand-new save: the prelude (slipping stone) is still ahead. */
export function freshState(): GameState {
  return newGame(0, { coin: 12345, relic: 67890, saveId: 'test' });
}

/** A save past the prelude: the ordinary summit economy. */
export function makeState(): GameState {
  const s = freshState();
  s.prelude = { complete: true, upgradeIds: catalog.prelude.upgrades.map((u) => u.id), bestHeight: 1, attempts: 0 };
  return s;
}

/** Flywheel and foreman were discovered in an earlier run, so no level gates apply. */
export function knowsAutomation(s: GameState): GameState {
  s.discoveries.tutorialIds.push('first_wheel', 'foreman');
  return s;
}

export function ctx(opts: Partial<StepContext> = {}): StepContext {
  return { manualHeld: false, offline: false, events: [], ...opts };
}

/** Run the foreground simulation at a fixed frame rate. */
export function runFrames(state: GameState, seconds: number, fps: number, manualHeld = false): GameEvent[] {
  const events: GameEvent[] = [];
  const frames = Math.round(seconds * fps);
  const c = ctx({ manualHeld, events });
  for (let i = 0; i < frames; i++) stepSites(state, 1 / fps, c);
  return events;
}

export function give(state: GameState, amount: number | string): void {
  state.wallet.obols = state.wallet.obols.add(Money.of(amount));
}

export function expectClose(a: Money | number, b: Money | number, rel = 1e-9): void {
  const x = typeof a === 'number' ? a : a.toNumber();
  const y = typeof b === 'number' ? b : b.toNumber();
  const scale = Math.max(1, Math.abs(x), Math.abs(y));
  if (Math.abs(x - y) > rel * scale) throw new Error(`expected ${x} ≈ ${y} (rel ${rel})`);
}
