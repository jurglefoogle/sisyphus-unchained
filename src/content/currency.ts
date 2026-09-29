import { siteDef } from './catalog';
import { formatMoney } from '../core/format';
import type { Money } from '../core/money';

/** Each hill's own money (docs/hill-workshops-plan.md §1). */
export interface CurrencyDef {
  id: string;
  name: string;
  one: string;
  /** Stamped on the coin where no painted icon exists. */
  glyph: string;
  /** What it is, for tooltips and the Archive. */
  note: string;
}

export const CURRENCIES: Record<string, CurrencyDef> = {
  obols: { id: 'obols', name: 'Obols', one: 'Obol', glyph: '◎', note: 'The ferryman\'s coin. Earned on the First Hill.' },
  cinders: { id: 'cinders', name: 'Cinders', one: 'Cinder', glyph: '▲', note: 'Still warm. Earned on the Tartarus Rim.' },
  drams: { id: 'drams', name: 'Drams', one: 'Dram', glyph: '◆', note: 'Measures of Styx water. Earned on the Leaking Heights.' },
  ingots: { id: 'ingots', name: 'Ingots', one: 'Ingot', glyph: '▬', note: 'Cast bronze. Earned on the Bronze Pass.' },
  starlight: { id: 'starlight', name: 'Starlight', one: 'Starlight', glyph: '✦', note: 'Swept off the route at dawn. Earned on the Skyward Escarpment.' },
  ambrosia: { id: 'ambrosia', name: 'Ambrosia', one: 'Ambrosia', glyph: '❖', note: 'Food of the gods, in expense-account portions. Earned on the Olympian Approach.' },
};

export function currencyOf(siteId: string): CurrencyDef {
  return CURRENCIES[siteDef(siteId).currency];
}

/** "1.2K Cinders". */
export function priced(amount: Money, siteId: string): string {
  const c = currencyOf(siteId);
  return `${formatMoney(amount)} ${amount.eq(1) ? c.one : c.name}`;
}
