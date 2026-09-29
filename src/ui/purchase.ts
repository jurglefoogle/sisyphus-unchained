import type { Game } from '../app/game';
import type { GameView, PurchaseRow } from '../app/view';

/** Prices are Obols unless they name Insight. */
export function price(cost: string): { icon: string; amount: string } {
  return cost.endsWith(' Insight') ? { icon: 'ui_insight', amount: cost.slice(0, -' Insight'.length) } : { icon: 'ui_obols', amount: cost };
}

export const still = () => document.documentElement.classList.contains('reduced-motion') || matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Carry out a purchase row. Begin Again opens its review instead and returns null. */
export function act(game: Game, view: GameView, row: PurchaseRow, count: number, onprestige: () => void) {
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
    case 'prestige':
      onprestige();
      return null;
  }
}

/** The offers worth hanging on the rolled scroll: the pinned goal first, then the list's own order. */
export function readyOffers(view: GameView, max: number): { row: PurchaseRow; count: number; cost: string }[] {
  const ready = view.rows.filter((r) => r.affordable && !r.disabled && r.action.kind !== 'prestige');
  ready.sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned));
  return ready.slice(0, max).map((row) => {
    const opt = row.options?.find((o) => o.affordable);
    return { row, count: opt?.count ?? 1, cost: opt?.cost ?? row.cost ?? '' };
  });
}
