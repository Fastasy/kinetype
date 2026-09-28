// Deterministic PRNG. Required: the game must produce identical sequences from
// identical seeds, and must never call Math.random() during render (that was the
// source of a hydration mismatch in the previous build of this site).

export interface Rng {
  next(): number;
  int(maxExclusive: number): number;
  pick<T>(items: readonly T[]): T;
  chance(p: number): boolean;
}

/** mulberry32 — small, fast, good enough for word selection and particle scatter. */
export function createRng(seed: number): Rng {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int(maxExclusive: number) {
      return Math.floor(next() * maxExclusive);
    },
    pick<T>(items: readonly T[]): T {
      return items[Math.floor(next() * items.length)];
    },
    chance(p: number) {
      return next() < p;
    },
  };
}

/** A fresh seed from the clock. Only call this from effects or event handlers. */
export function freshSeed(): number {
  return (Date.now() ^ (Math.random() * 0xffffffff)) >>> 0;
}
