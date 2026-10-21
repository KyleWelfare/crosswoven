import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { solveLogically, type LogicResult, type Step } from "../src/core/logic-solver.ts";
import type { Point, Puzzle } from "../src/core/puzzle.ts";
import type { Solution, Thread } from "../src/core/thread.ts";
import { allSolutions } from "./fixtures/all-solutions.ts";
import { decoded } from "./fixtures/puzzle-of.ts";
import { randomWeaves, type Weave } from "./fixtures/random-weave.ts";

const LIMIT: number = 300;

function samePoint(a: Point | undefined, b: Point): boolean {
  return a !== undefined && a.x === b.x && a.y === b.y;
}

function hasLink(solution: Solution, step: Step): boolean {
  return solution.some(
    (thread: Thread): boolean =>
      thread.colour === step.colour &&
      thread.squares.some(
        (square: Point, index: number): boolean =>
          (samePoint(square, step.from) && samePoint(thread.squares[index + 1], step.to)) ||
          (samePoint(square, step.to) && samePoint(thread.squares[index + 1], step.from)),
      ),
  );
}

describe("solveLogically properties", (): void => {
  it("agrees with the search solver whenever it finishes", (): void => {
    fc.assert(
      fc.property(randomWeaves, (weave: Weave): void => {
        const puzzle: Puzzle = decoded(weave.level);
        const result: LogicResult = solveLogically(puzzle);
        if (result.status !== "solved") return;
        expect(allSolutions(puzzle, 2)).toEqual([result.solution]);
      }),
    );
  });

  it("only makes deductions that hold in every solution", (): void => {
    fc.assert(
      fc.property(randomWeaves, (weave: Weave): void => {
        const puzzle: Puzzle = decoded(weave.level);
        const solutions: readonly Solution[] = allSolutions(puzzle, LIMIT);
        if (solutions.length === LIMIT) return;
        for (const step of solveLogically(puzzle).steps) {
          for (const solution of solutions) expect(hasLink(solution, step)).toBe(step.linked);
        }
      }),
    );
  });

  it("never reports a contradiction on a puzzle that has a solution", (): void => {
    fc.assert(
      fc.property(randomWeaves, (weave: Weave): void => {
        expect(solveLogically(decoded(weave.level)).status).not.toBe("contradiction");
      }),
    );
  });
});
