import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { findSolutions } from "../src/core/search-solver.ts";
import type { Solution } from "../src/core/thread.ts";
import { decoded } from "./fixtures/puzzle-of.ts";
import { levelOf, randomWeaves, ruleBreaks, type Weave } from "./fixtures/random-weave.ts";

/** High enough that small random boards rarely hit it, so most runs check every solution. */
const LIMIT: number = 300;

describe("findSolutions properties", (): void => {
  it("finds the threads a puzzle was woven from", (): void => {
    fc.assert(
      fc.property(randomWeaves, (weave: Weave): void => {
        const solutions: readonly Solution[] = findSolutions(decoded(weave.level), LIMIT);
        expect(solutions.length).toBeGreaterThan(0);
        if (solutions.length < LIMIT) expect(solutions).toContainEqual(weave.threads);
      }),
    );
  });

  it("only returns solutions that weave the puzzle and follow the rules", (): void => {
    fc.assert(
      fc.property(randomWeaves, (weave: Weave): void => {
        for (const solution of findSolutions(decoded(weave.level), LIMIT)) {
          expect(levelOf(weave.width, weave.height, solution)).toEqual(weave.level);
          expect(ruleBreaks(weave.width, weave.height, solution)).toEqual([]);
        }
      }),
    );
  });
});
