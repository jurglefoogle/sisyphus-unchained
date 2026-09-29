import type { Game } from '../app/game';
import type { GameView, PurchaseRow } from '../app/view';
import { CURRENCIES } from '../content/currency';

export interface Price {
  /** Painted coin art, when the currency has one. */
  icon: string | null;
  /** Stamped on a plain coin otherwise. */
  glyph: string;
  amount: string;
  name: string;
}

/** A price in a hill's currency, or Insight. Obols unless told otherwise. */
export function price(cost: string, currency = 'obols'): Price {
  if (cost.endsWith(' Insight') || currency === 'insight') {
    return { icon: 'ui_insight', glyph: '', amount: cost.replace(/ Insight$/, ''), name: 'Insight' };
  }
  const c = CURRENCIES[currency] ?? CURRENCIES.obols;
  return { icon: c.id === 'obols' ? 'ui_obols' : null, glyph: c.glyph, amount: cost, name: c.name };
}

export const still = () => document.documentElement.classList.contains('reduced-motion') || matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Carry out a purchase row. Begin Again opens its review instead and returns null. */
export function act(game: Game, view: GameView, row: PurchaseRow, count: number, onprestige: (kind?: 'appeal') => void) {
  const a = row.action;
  // One request per offer as displayed: a double click on the same offer buys once.
  const id = `${view.revision}:${view.site.id}:${row.key}:${count}`;
  switch (a.kind) {
    case 'levels':
      return game.buyLevels(a.track, count, id);
    case 'flywheel':
      return game.buyFlywheel(id);
    case 'foreman':
      return game.hireForeman(id);
    case 'work':
      return game.buyWork(a.workId, id);
    case 'site':
      return game.openSite(a.siteId, id);
    case 'upgrade':
      return game.buyUpgrade(a.upgradeId, id);
    case 'prelude':
      return game.buyPreludeUpgrade(a.upgradeId, id);
    case 'steward':
      return game.hireSteward(a.paidWith, id);
    case 'stewardOrder':
      return game.setStewardOrder(id);
    case 'counterweight':
      return game.installCounterweight(id);
    case 'trim':
      return game.trimCounterweight(count, id);
    case 'seal':
      return count === 0 ? game.unseal(a.index, id) : game.breakSeal(a.index, id);
    case 'summon':
      return game.summonVisitor(id);
    case 'appeal':
      // A new run: reviewed first, as Begin Again is.
      onprestige('appeal');
      return null;
    case 'bargain':
      return game.takeBargain(count, id);
    case 'vent':
      return game.vent(id);
    case 'ventAt':
      return game.nudgeVentAt(count, id);
    case 'jar':
      return game.tendJar(count, id);
    case 'jarTarget':
      return game.nudgeJarTarget(count, id);
    case 'split':
      return game.nudgeSplit(count, id);
    case 'pourNext':
      return game.pourNext(a.index, id);
    case 'turn':
      return game.turnSky(id);
    case 'mount':
      return game.moveConstellation(a.index, count, id);
    case 'duty':
      return game.nudgeOnDuty(count, id);
    case 'clerk':
      return game.hireClerk(id);
    case 'prestige':
      onprestige();
      return null;
  }
}

/** The offers worth hanging on the rolled scroll: the pinned goal first, then the list's own order. */
export function readyOffers(view: GameView, max: number): { row: PurchaseRow; count: number; cost: string; currency: string }[] {
  const choices = new Set(['prestige', 'stewardOrder', 'trim', 'bargain', 'vent', 'ventAt', 'jar', 'jarTarget', 'split', 'pourNext', 'turn', 'mount', 'duty', 'summon', 'appeal']);
  const ready = view.rows.filter((r) => r.affordable && !r.disabled && !choices.has(r.action.kind));
  ready.sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned));
  return ready.slice(0, max).map((row) => {
    const opt = row.options?.find((o) => o.affordable);
    return { row, count: opt?.count ?? 1, cost: opt?.cost ?? row.cost ?? '', currency: row.currency ?? 'obols' };
  });
}
