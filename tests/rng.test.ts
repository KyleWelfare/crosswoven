import { describe, expect, it } from "vitest";
import { createRng, randomInt, shuffled, type Rng } from "../src/core/rng.ts";

function draws(rng: Rng, count: number): number[] {
  return Array.from({ length: count }, (): number => rng());
}

describe("rng", (): void => {
  it("repeats its sequence for the same seed", (): void => {
    expect(draws(createRng(42), 5)).toEqual(draws(createRng(42), 5));
    expect(draws(createRng(42), 5)).not.toEqual(draws(createRng(43), 5));
  });

  it("stays in [0, 1)", (): void => {
    for (const value of draws(createRng(1), 1000)) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it("draws integers across the whole inclusive range", (): void => {
    const rng: Rng = createRng(3);
    const seen: ReadonlySet<number> = new Set<number>(
      Array.from({ length: 200 }, (): number => randomInt(rng, 2, 5)),
    );
    expect([...seen].sort()).toEqual([2, 3, 4, 5]);
  });

  it("shuffles without losing or adding items", (): void => {
    const items: readonly number[] = [1, 2, 3, 4, 5, 6, 7, 8];
    expect(shuffled(createRng(9), items).sort()).toEqual(items);
  });
});
