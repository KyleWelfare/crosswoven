import { describe, expect, it } from "vitest";
import { decodeLevel, type DecodeResult } from "../src/core/level-decoder.ts";
import type { Point, Puzzle } from "../src/core/puzzle.ts";
import { findSolutions } from "../src/core/search-solver.ts";
import type { Solution, Thread } from "../src/core/thread.ts";
import examplePuzzle from "./fixtures/example-puzzle.json";
import { decoded, puzzleOf } from "./fixtures/puzzle-of.ts";
import { pairingLevel, turningCrossingLevel } from "./fixtures/reference-puzzles.ts";

/** Threads as "red (0,0) (1,0)", which reads better in a failing assertion than nested objects. */
function describeSolution(solution: Solution): string[] {
  return solution.map(
    (thread: Thread): string =>
      `${thread.colour} ${thread.squares.map((p: Point): string => `(${String(p.x)},${String(p.y)})`).join(" ")}`,
  );
}

function solutionsOf(puzzle: Puzzle): string[][] {
  return findSolutions(puzzle, 10).map(describeSolution);
}

describe("findSolutions", (): void => {
  it("solves the example puzzle, and only one way", (): void => {
    const result: DecodeResult = decodeLevel(examplePuzzle);
    if (!result.ok) throw new Error(result.errors.join("; "));
    expect(solutionsOf(result.puzzle)).toEqual([
      [
        "red (2,0) (1,0) (1,1) (1,2) (1,3) (1,4)",
        "red (3,0) (3,1) (3,2) (3,3) (4,3) (4,4) (3,4)",
        "blue (4,1) (3,1) (2,1) (1,1) (0,1) (0,2) (1,2) (2,2) (3,2) (4,2)",
        "blue (2,3) (1,3) (0,3) (0,4)",
      ],
    ]);
  });

  it("lets threads of different colours cross straight over each other", (): void => {
    const puzzle: Puzzle = puzzleOf(
      ["..B..", "..B..", "RRPRR", "..B..", "..B.."],
      [
        [2, 0],
        [0, 2],
        [4, 2],
        [2, 4],
      ],
    );
    expect(solutionsOf(puzzle)).toEqual([
      ["blue (2,0) (2,1) (2,2) (2,3) (2,4)", "red (0,2) (1,2) (2,2) (3,2) (4,2)"],
    ]);
  });

  it("finds every way to pair pegs", (): void => {
    const puzzle: Puzzle = decoded(pairingLevel);
    expect(solutionsOf(puzzle)).toEqual([
      ["red (0,0) (1,0)", "red (0,1) (1,1)"],
      ["red (0,0) (0,1)", "red (1,0) (1,1)"],
    ]);
  });

  it("stops at the limit", (): void => {
    const puzzle: Puzzle = decoded(pairingLevel);
    expect(findSolutions(puzzle, 1)).toHaveLength(1);
  });

  describe("rules", (): void => {
    it("rejects a crossing where a thread turns", (): void => {
      const puzzle: Puzzle = decoded(turningCrossingLevel);
      expect(solutionsOf(puzzle)).toEqual([]);
    });

    it("never puts two threads of one colour on a square", (): void => {
      const puzzle: Puzzle = puzzleOf(
        [".....", "..R..", ".RRR.", "..R..", "....."],
        [
          [2, 1],
          [1, 2],
          [3, 2],
          [2, 3],
        ],
      );
      expect(solutionsOf(puzzle)).toEqual([]);
    });

    it("never runs a thread through a peg", (): void => {
      const puzzle: Puzzle = puzzleOf(
        ["RRRRR", ".....", ".....", ".....", "....."],
        [
          [0, 0],
          [1, 0],
          [3, 0],
          [4, 0],
        ],
      );
      expect(solutionsOf(puzzle)).toEqual([]);
    });

    it("rejects a loop of thread with no pegs", (): void => {
      const puzzle: Puzzle = puzzleOf(
        ["RR...", "RR...", ".....", ".....", "...RR"],
        [
          [3, 4],
          [4, 4],
        ],
      );
      expect(solutionsOf(puzzle)).toEqual([]);
    });
  });
});
