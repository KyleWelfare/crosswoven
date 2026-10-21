import { describe, expect, it } from "vitest";
import {
  solveLogically,
  type LogicResult,
  type Rule,
  type Step,
} from "../src/core/logic-solver.ts";
import type { Puzzle } from "../src/core/puzzle.ts";
import { allSolutions } from "./fixtures/all-solutions.ts";
import examplePuzzle from "./fixtures/example-puzzle.json";
import { decoded } from "./fixtures/puzzle-of.ts";
import {
  guessingLevel,
  onlyPathLevel,
  onlyReachLevel,
  openLevel,
  partnerLevel,
  sharedLevel,
  turningCrossingLevel,
} from "./fixtures/reference-puzzles.ts";

/** Stuck without `rule` (and anything harder), solved once it's allowed. */
function expectNeeds(puzzle: Puzzle, easier: readonly Rule[], rule: Rule): readonly Step[] {
  expect(solveLogically(puzzle, easier).status).toBe("stuck");
  const result: LogicResult = solveLogically(puzzle, [...easier, rule]);
  if (result.status !== "solved") throw new Error(`expected solved, got ${result.status}`);
  return result.steps;
}

const partnerPuzzle: Puzzle = decoded(partnerLevel);
const onlyPathPuzzle: Puzzle = decoded(onlyPathLevel);
const sharedPuzzle: Puzzle = decoded(sharedLevel);
const onlyReachPuzzle: Puzzle = decoded(onlyReachLevel);

describe("solveLogically", (): void => {
  it("solves the example puzzle to the search solver's answer", (): void => {
    const puzzle: Puzzle = decoded(examplePuzzle);
    const result: LogicResult = solveLogically(puzzle);
    if (result.status !== "solved") throw new Error(`expected solved, got ${result.status}`);
    expect(result.solution).toEqual(allSolutions(puzzle, 2)[0]);
  });

  describe("rules", (): void => {
    it("partner: a peg that can reach only one partner pairs with it", (): void => {
      const steps: readonly Step[] = expectNeeds(partnerPuzzle, [], "partner");
      expect(steps[0]).toEqual({
        rule: "partner",
        colour: "blue",
        at: { x: 2, y: 0 },
        ruledOut: [
          {
            colour: "blue",
            squares: [
              { x: 1, y: 0 },
              { x: 1, y: 1 },
            ],
          },
        ],
      });
    });

    it("only path: a peg's last path is its thread, so clashing paths go", (): void => {
      const steps: readonly Step[] = expectNeeds(onlyPathPuzzle, ["partner"], "only-path");
      expect(steps[0]).toMatchObject({ rule: "only-path", at: { x: 3, y: 0 } });
    });

    it("shared: squares on every path of a peg are closed to other threads", (): void => {
      const steps: readonly Step[] = expectNeeds(sharedPuzzle, ["partner", "only-path"], "shared");
      expect(steps[0]).toMatchObject({ rule: "shared", at: { x: 1, y: 0 } });
    });

    it("only reach: the one peg that can reach a square must", (): void => {
      const steps: readonly Step[] = expectNeeds(
        onlyReachPuzzle,
        ["partner", "only-path", "shared"],
        "only-reach",
      );
      expect(steps).toContainEqual(
        expect.objectContaining({ rule: "only-reach", at: { x: 1, y: 6 } }),
      );
    });
  });

  it("gets stuck on a puzzle that needs guessing", (): void => {
    const puzzle: Puzzle = decoded(guessingLevel);
    expect(allSolutions(puzzle, 2)).toHaveLength(1);
    expect(solveLogically(puzzle).status).toBe("stuck");
  });

  it("reports a contradiction on a puzzle with no solution", (): void => {
    expect(solveLogically(decoded(turningCrossingLevel)).status).toBe("contradiction");
  });

  it("reports pegs with too many paths to check", (): void => {
    expect(solveLogically(decoded(openLevel))).toMatchObject({ status: "too-open" });
  });

  it("rates a puzzle by the hardest rule it needed", (): void => {
    expect(solveLogically(partnerPuzzle)).toMatchObject({ difficulty: "easy" });
    expect(solveLogically(onlyPathPuzzle)).toMatchObject({ difficulty: "easy" });
    expect(solveLogically(sharedPuzzle)).toMatchObject({ difficulty: "medium" });
    expect(solveLogically(onlyReachPuzzle)).toMatchObject({ difficulty: "medium" });
  });
});
