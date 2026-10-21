import fc from "fast-check";
import { describe, expect, it } from "vitest";
import type { Solution } from "../src/core/thread.ts";
import { allSolutions } from "./fixtures/all-solutions.ts";
import { decoded } from "./fixtures/puzzle-of.ts";
import {
  levelOf,
  randomHiddenWeaves,
  randomWeaves,
  ruleBreaks,
  shownWhenHidden,
  type Weave,
} from "./fixtures/random-weave.ts";

/** High enough that small random boards rarely hit it, so most runs check every solution. */
const LIMIT: number = 300;

describe("findSolutions properties", (): void => {
  it.each([
    ["", randomWeaves],
    [" when hidden", randomHiddenWeaves],
  ])(
    "finds the threads a puzzle was woven from%s",
    (_mode: string, weaves: fc.Arbitrary<Weave>): void => {
      fc.assert(
        fc.property(weaves, (weave: Weave): void => {
          const solutions: readonly Solution[] = allSolutions(decoded(weave.level), LIMIT);
          expect(solutions.length).toBeGreaterThan(0);
          if (solutions.length < LIMIT) expect(solutions).toContainEqual(weave.threads);
        }),
      );
    },
  );

  it("only returns solutions that weave the puzzle and follow the rules", (): void => {
    fc.assert(
      fc.property(randomWeaves, (weave: Weave): void => {
        for (const solution of allSolutions(decoded(weave.level), LIMIT)) {
          expect(levelOf(weave.width, weave.height, solution)).toEqual(weave.level);
          expect(ruleBreaks(weave.width, weave.height, solution)).toEqual([]);
        }
      }),
    );
  });

  it("only returns solutions to a hidden puzzle that cover what it shows and follow the rules", (): void => {
    fc.assert(
      fc.property(randomHiddenWeaves, (weave: Weave): void => {
        for (const solution of allSolutions(decoded(weave.level), LIMIT)) {
          const rewoven: Weave["level"] = levelOf(weave.width, weave.height, solution);
          expect(shownWhenHidden({ ...rewoven, hidden: true })).toEqual(
            shownWhenHidden(weave.level),
          );
          expect(ruleBreaks(weave.width, weave.height, solution)).toEqual([]);
        }
      }),
    );
  });
});
