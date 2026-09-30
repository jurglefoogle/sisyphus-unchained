import { Money } from './money';

const SUFFIXES = ['', 'K', 'M', 'B', 'T'];

/** Display decimal mark from the player's locale; saves always stay canonical. */
let decimalMark = '.';

export function setNumberLocale(locale: string | undefined): void {
  try {
    const part = new Intl.NumberFormat(locale).formatToParts(1.5).find((p) => p.type === 'decimal');
    decimalMark = part?.value ?? '.';
  } catch {
    decimalMark = '.';
  }
}

const localize = (text: string): string => (decimalMark === '.' ? text : text.replace('.', decimalMark));

/** Display-only formatting: K, M, B, T, then scientific notation. */
export function formatMoney(value: Money): string {
  return localize(formatCanonical(value));
}

function formatCanonical(value: Money): string {
  if (value.isNegative()) return '-' + formatCanonical(Money.ZERO.sub(value));
  if (value.lt(1000)) {
    const n = value.toNumber();
    return Number.isInteger(n) ? String(n) : n < 10 ? n.toFixed(1) : String(Math.floor(n));
  }
  const exp = Math.floor(value.log10());
  const tier = Math.floor(exp / 3);
  if (tier < SUFFIXES.length) {
    const scaled = value.toNumber() / 10 ** (tier * 3);
    return trimFixed(scaled) + SUFFIXES[tier];
  }
  const mantissa = value.toNumber() / 10 ** exp;
  if (Number.isFinite(mantissa)) return `${mantissa.toFixed(2)}e${exp}`;
  // Beyond double range: derive the mantissa from the logarithm.
  const m = 10 ** (value.log10() - exp);
  return `${m.toFixed(2)}e${exp}`;
}

function trimFixed(n: number): string {
  const digits = n >= 100 ? 1 : 2;
  const truncated = Math.floor(n * 10 ** digits) / 10 ** digits;
  return truncated.toFixed(digits).replace(/\.?0+$/, '');
}

export function formatRate(value: Money): string {
  return `${formatMoney(value)}/s`;
}

export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds)) return '—';
  if (seconds < 60) return `${Math.ceil(seconds)}s`;
  if (seconds < 3600) {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return s ? `${m}m ${s}s` : `${m}m`;
  }
  if (seconds < 86400) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return m ? `${h}h ${m}m` : `${h}h`;
  }
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  return h ? `${d}d ${h}h` : `${d}d`;
}

/** A multiplier that may grow absurd: ×2.5, ×40, then ×1.00M and up. */
export function formatTimes(x: number): string {
  return x < 1e4 ? formatMultiplier(x) : `×${formatMoney(Money.of(x))}`;
}

export function formatMultiplier(x: number): string {
  return `×${localize(x.toFixed(x < 10 ? 2 : 1).replace(/\.?0+$/, ''))}`;
}
