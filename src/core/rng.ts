/**
 * Small seeded PRNG (mulberry32). Authoritative random streams keep their own
 * saved state so cosmetic randomness can never shift a drop.
 */
export function nextRandom(state: number): { value: number; state: number } {
  let t = (state + 0x6d2b79f5) >>> 0;
  let r = Math.imul(t ^ (t >>> 15), t | 1);
  r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
  const value = ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  return { value, state: t };
}

export function randomSeed(): number {
  return (Math.random() * 4294967296) >>> 0;
}

/**
 * Number of trials until the first success with probability p, capped at
 * `cap`. Used for the bounded relic countdown (spec §02).
 */
export function sampleCappedGeometric(
  state: number,
  p: number,
  cap: number,
): { count: number; state: number } {
  let s = state;
  for (let k = 1; k < cap; k++) {
    const roll = nextRandom(s);
    s = roll.state;
    if (roll.value < p) return { count: k, state: s };
  }
  return { count: cap, state: s };
}
