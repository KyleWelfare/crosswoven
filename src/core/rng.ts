/** Returns a number in [0, 1). Each call advances the generator. */
export type Rng = () => number;

/** mulberry32: tiny and fast, and the same seed always gives the same sequence. */
export function createRng(seed: number): Rng {
  let state: number = seed >>> 0;
  return (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let mixed: number = Math.imul(state ^ (state >>> 15), state | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

/** Inclusive of both ends. */
export function randomInt(rng: Rng, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

export function shuffled<T>(rng: Rng, items: readonly T[]): T[] {
  const result: T[] = [...items];
  for (let i: number = result.length - 1; i > 0; i--) {
    const j: number = randomInt(rng, 0, i);
    const item: T | undefined = result[i];
    const other: T | undefined = result[j];
    if (item === undefined || other === undefined) continue;
    result[i] = other;
    result[j] = item;
  }
  return result;
}
