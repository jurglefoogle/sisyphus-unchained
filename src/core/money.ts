import Decimal from 'break_infinity.js';

export type MoneySource = Money | number | string;

/**
 * Immutable large-number wrapper. Gameplay code talks only to Money so the
 * numeric library can be swapped without touching rules. break_infinity.js
 * favours speed and magnitude over exact precision (spec §05).
 */
export class Money {
  private constructor(private readonly d: Decimal) {}

  static readonly ZERO = new Money(new Decimal(0));

  static of(v: MoneySource): Money {
    if (v instanceof Money) return v;
    const d = new Decimal(v);
    if (!Number.isFinite(d.mantissa) || !Number.isFinite(d.exponent)) {
      throw new Error(`Invalid money value: ${String(v)}`);
    }
    return new Money(d);
  }

  static sum(values: Iterable<Money>): Money {
    let acc = Money.ZERO;
    for (const v of values) acc = acc.add(v);
    return acc;
  }

  static max(a: Money, b: Money): Money {
    return a.gte(b) ? a : b;
  }

  static min(a: Money, b: Money): Money {
    return a.lte(b) ? a : b;
  }

  add(o: MoneySource): Money {
    return new Money(this.d.add(Money.of(o).d));
  }

  sub(o: MoneySource): Money {
    return new Money(this.d.sub(Money.of(o).d));
  }

  mul(o: MoneySource): Money {
    return new Money(this.d.mul(Money.of(o).d));
  }

  div(o: MoneySource): Money {
    return new Money(this.d.div(Money.of(o).d));
  }

  pow(exp: number): Money {
    return new Money(this.d.pow(exp));
  }

  ceil(): Money {
    return new Money(this.d.ceil());
  }

  floor(): Money {
    return new Money(this.d.floor());
  }

  cmp(o: MoneySource): -1 | 0 | 1 {
    return this.d.cmp(Money.of(o).d);
  }

  eq(o: MoneySource): boolean {
    return this.cmp(o) === 0;
  }

  gt(o: MoneySource): boolean {
    return this.cmp(o) > 0;
  }

  gte(o: MoneySource): boolean {
    return this.cmp(o) >= 0;
  }

  lt(o: MoneySource): boolean {
    return this.cmp(o) < 0;
  }

  lte(o: MoneySource): boolean {
    return this.cmp(o) <= 0;
  }

  isZero(): boolean {
    return this.d.eq(0);
  }

  isNegative(): boolean {
    return this.d.lt(0);
  }

  /** Base-10 logarithm; only meaningful for positive values. */
  log10(): number {
    return this.d.log10();
  }

  /** Lossy conversion for ratios, progress bars and animation only. */
  toNumber(): number {
    return this.d.toNumber();
  }

  /** Canonical serialisation. Never parse formatted display text. */
  serialize(): string {
    return this.d.toString();
  }

  toString(): string {
    return this.serialize();
  }
}
