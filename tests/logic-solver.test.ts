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
import { decoded, puzzleOf } from "./fixtures/puzzle-of.ts";
import {
  crossingLevel,
  guessingLevel,
  loopLevel,
  strandLevel,
  turningCrossingLevel,
} from "./fixtures/reference-puzzles.ts";

function rulesUsed(result: LogicResult): ReadonlySet<Rule> {
  return new Set(result.steps.map((step: Step): Rule => step.rule));
}

/** Stuck without `rule` (and anything harder), solved once it's allowed. */
function expectNeeds(puzzle: Puzzle, easier: readonly Rule[], rule: Rule): LogicResult {
  expect(solveLogically(puzzle, easier).status).toBe("stuck");
  const result: LogicResult = solveLogically(puzzle, [...easier, rule]);
  expect(result.status).toBe("solved");
  return result;
}

const crossingPuzzle: Puzzle = decoded(crossingLevel);
const loopPuzzle: Puzzle = decoded(loopLevel);
const strandPuzzle: Puzzle = decoded(strandLevel);
const guessingPuzzle: Puzzle = decoded(guessingLevel);

describe("solveLogically", (): void => {
  it("solves the example puzzle to the search solver's answer", (): void => {
    const puzzle: Puzzle = decoded(examplePuzzle);
    const result: LogicResult = solveLogically(puzzle);
    if (result.status !== "solved") throw new Error(`expected solved, got ${result.status}`);
    expect(result.solution).toEqual(allSolutions(puzzle, 2)[0]);
  });

  describe("rules", (): void => {
    it("count: a straight crossing needs nothing else", (): void => {
      const puzzle: Puzzle = puzzleOf(
        ["..B..", "..B..", "RRPRR", "..B..", "..B.."],
        [
          [2, 0, 5],
          [0, 2, 5],
          [4, 2, 5],
          [2, 4, 5],
        ],
      );
      const result: LogicResult = solveLogically(puzzle, ["count"]);
      expect(result).toMatchObject({ status: "solved", difficulty: "easy" });
      expect(rulesUsed(result)).toEqual(new Set(["count"]));
    });

    it("crossing: fixes both threads once one direction is known", (): void => {
      const result: LogicResult = expectNeeds(crossingPuzzle, ["count"], "crossing");
      expect(result).toMatchObject({ difficulty: "easy" });
    });

    it("loop: a square can't link to both ends of one piece", (): void => {
      const result: LogicResult = expectNeeds(loopPuzzle, ["count", "crossing"], "loop");
      expect(result).toMatchObject({ difficulty: "medium" });
      expect(result.steps).toContainEqual(
        expect.objectContaining({
          rule: "loop",
          from: { x: 2, y: 2 },
          to: { x: 3, y: 2 },
          linked: true,
        }),
      );
    });

    it("strand: won't finish a thread that strands other squares", (): void => {
      const result: LogicResult = expectNeeds(
        strandPuzzle,
        ["count", "crossing", "loop"],
        "strand",
      );
      expect(result).toMatchObject({ difficulty: "medium" });
      expect(result.steps).toContainEqual(
        expect.objectContaining({
          rule: "strand",
          from: { x: 2, y: 3 },
          to: { x: 3, y: 3 },
          linked: false,
        }),
      );
    });

    it("parity: links what a region needs to pair its pegs", (): void => {
      const puzzle: Puzzle = puzzleOf(
        ["RRRR.", ".....", ".....", ".....", "....."],
        [
          [0, 0, 4],
          [3, 0, 4],
        ],
      );
      const result: LogicResult = solveLogically(puzzle, ["parity"]);
      expect(result).toMatchObject({ status: "solved", difficulty: "hard" });
      expect(rulesUsed(result)).toEqual(new Set(["parity"]));
    });
  });

  it("gets stuck on a puzzle that needs guessing", (): void => {
    expect(allSolutions(guessingPuzzle, 2)).toHaveLength(1);
    expect(solveLogically(guessingPuzzle).status).toBe("stuck");
  });

  it("reports a contradiction on a puzzle with no solution", (): void => {
    const puzzle: Puzzle = decoded(turningCrossingLevel);
    expect(solveLogically(puzzle).status).toBe("contradiction");
  });

  it("rates a puzzle by the hardest rule it needed", (): void => {
    expect(solveLogically(crossingPuzzle)).toMatchObject({ difficulty: "easy" });
    expect(solveLogically(loopPuzzle)).toMatchObject({ difficulty: "medium" });
    expect(solveLogically(strandPuzzle)).toMatchObject({ difficulty: "medium" });
  });

  it("uses easier rules before harder ones", (): void => {
    const steps: readonly Step[] = solveLogically(strandPuzzle).steps;
    expect(steps[0]?.rule).toBe("count");
  });
});
