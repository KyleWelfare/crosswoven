import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { decodeLevel, type DecodeResult } from "../src/core/level-decoder.ts";
import { THREAD_COLOURS, type ThreadColour } from "../src/core/puzzle.ts";
import { findSolutions } from "../src/core/search-solver.ts";
import type { Solution } from "../src/core/thread.ts";
import {
  levelOf,
  ruleBreaks,
  weave,
  type ThreadPlan,
  type Weave,
} from "./fixtures/random-weave.ts";

/** High enough that small random boards rarely hit it, so most runs check every solution. */
const LIMIT: number = 300;

const weaves: fc.Arbitrary<{ width: number; height: number; weave: Weave }> = fc
  .record({
    width: fc.integer({ min: 5, max: 7 }),
    height: fc.integer({ min: 5, max: 7 }),
    plans: fc.array(
      fc.record({
        colour: fc.constantFrom<ThreadColour>(...THREAD_COLOURS),
        start: fc.record({ x: fc.nat(6), y: fc.nat(6) }),
        steps: fc.array(fc.integer({ min: 0, max: 3 }), { maxLength: 16 }),
      }),
      { maxLength: 8 },
    ),
  })
  .map(
    (input: {
      width: number;
      height: number;
      plans: ThreadPlan[];
    }): { width: number; height: number; weave: Weave } => ({
      width: input.width,
      height: input.height,
      weave: weave(input.width, input.height, input.plans),
    }),
  );

describe("findSolutions properties", (): void => {
  it("finds the threads a puzzle was woven from", (): void => {
    fc.assert(
      fc.property(weaves, (input: { width: number; height: number; weave: Weave }): void => {
        const result: DecodeResult = decodeLevel(input.weave.level);
        if (!result.ok) throw new Error(result.errors.join("; "));
        const solutions: readonly Solution[] = findSolutions(result.puzzle, LIMIT);
        expect(solutions.length).toBeGreaterThan(0);
        if (solutions.length < LIMIT) expect(solutions).toContainEqual(input.weave.threads);
      }),
    );
  });

  it("only returns solutions that weave the puzzle and follow the rules", (): void => {
    fc.assert(
      fc.property(weaves, (input: { width: number; height: number; weave: Weave }): void => {
        const result: DecodeResult = decodeLevel(input.weave.level);
        if (!result.ok) throw new Error(result.errors.join("; "));
        for (const solution of findSolutions(result.puzzle, LIMIT)) {
          expect(levelOf(input.width, input.height, solution)).toEqual(input.weave.level);
          expect(ruleBreaks(input.width, input.height, solution)).toEqual([]);
        }
      }),
    );
  });
});
