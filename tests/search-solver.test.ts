import { describe, expect, it } from "vitest";
import { decodeLevel, type DecodeResult } from "../src/core/level-decoder.ts";
import type { Point, Puzzle } from "../src/core/puzzle.ts";
import { findSolutions, type SearchResult } from "../src/core/search-solver.ts";
import type { Solution, Thread } from "../src/core/thread.ts";
import { allSolutions } from "./fixtures/all-solutions.ts";
import examplePuzzle from "./fixtures/example-puzzle.json";
import { decoded, hiddenPuzzleOf, puzzleOf } from "./fixtures/puzzle-of.ts";
import { openLevel, pairingLevel, turningCrossingLevel } from "./fixtures/reference-puzzles.ts";

/** Threads as "red (0,0) (1,0)", which reads better in a failing assertion than nested objects. */
function describeSolution(solution: Solution): string[] {
  return solution.map(
    (thread: Thread): string =>
      `${thread.colour} ${thread.squares.map((p: Point): string => `(${String(p.x)},${String(p.y)})`).join(" ")}`,
  );
}

function solutionsOf(puzzle: Puzzle): string[][] {
  return allSolutions(puzzle, 10).map(describeSolution);
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
        [2, 0, 5],
        [0, 2, 5],
        [4, 2, 5],
        [2, 4, 5],
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
    expect(allSolutions(puzzle, 1)).toHaveLength(1);
  });

  it("reports pegs with too many paths to check", (): void => {
    const result: SearchResult = findSolutions(decoded(openLevel), 2);
    expect(result).toMatchObject({
      ok: false,
      pegs: [
        { x: 0, y: 0 },
        { x: 14, y: 14 },
      ],
    });
  });

  describe("rules", (): void => {
    it("pairs pegs by length, not just colour", (): void => {
      const puzzle: Puzzle = puzzleOf(
        ["RRR..", "RRR..", ".....", ".....", "....."],
        [
          [0, 0, 3],
          [2, 0, 3],
          [0, 1, 3],
          [2, 1, 3],
        ],
      );
      expect(solutionsOf(puzzle)).toEqual([["red (0,0) (1,0) (2,0)", "red (0,1) (1,1) (2,1)"]]);
    });

    it("makes a length-1 peg a thread on its own", (): void => {
      const puzzle: Puzzle = puzzleOf(
        ["R.RR.", ".....", ".....", ".....", "....."],
        [
          [0, 0, 1],
          [2, 0, 2],
          [3, 0, 2],
        ],
      );
      expect(solutionsOf(puzzle)).toEqual([["red (0,0)", "red (2,0) (3,0)"]]);
    });

    it("rejects a crossing where a thread turns", (): void => {
      const puzzle: Puzzle = decoded(turningCrossingLevel);
      expect(solutionsOf(puzzle)).toEqual([]);
    });

    it("never puts two threads of one colour on a square", (): void => {
      const puzzle: Puzzle = puzzleOf(
        [".....", "..R..", ".RRR.", "..R..", "....."],
        [
          [2, 1, 3],
          [1, 2, 3],
          [3, 2, 3],
          [2, 3, 3],
        ],
      );
      expect(solutionsOf(puzzle)).toEqual([]);
    });

    it("never runs a thread through a peg", (): void => {
      const puzzle: Puzzle = puzzleOf(
        ["RRRRR", ".....", ".....", ".....", "....."],
        [
          [0, 0, 5],
          [1, 0, 3],
          [3, 0, 3],
          [4, 0, 5],
        ],
      );
      expect(solutionsOf(puzzle)).toEqual([]);
    });

    it("rejects a loop of thread with no pegs", (): void => {
      const puzzle: Puzzle = puzzleOf(
        ["RR...", "RR...", ".....", ".....", "...RR"],
        [
          [3, 4, 2],
          [4, 4, 2],
        ],
      );
      expect(solutionsOf(puzzle)).toEqual([]);
    });
  });

  describe("in a hidden level", (): void => {
    it("lets a thread cover a square of another colour", (): void => {
      const rows: readonly string[] = ["RYR..", "YYY..", ".....", ".....", "....."];
      const pegs: readonly (readonly [number, number, number])[] = [
        [0, 0, 3],
        [2, 0, 3],
        [0, 1, 3],
        [2, 1, 3],
      ];
      expect(solutionsOf(puzzleOf(rows, pegs))).toEqual([]);
      expect(solutionsOf(hiddenPuzzleOf(rows, pegs))).toEqual([
        ["red (0,0) (1,0) (2,0)", "yellow (0,1) (1,1) (2,1)"],
      ]);
    });

    it("leaves no square uncovered", (): void => {
      const puzzle: Puzzle = hiddenPuzzleOf(
        ["RRR..", "YYY..", ".....", ".....", "....."],
        [
          [0, 0, 3],
          [2, 0, 3],
          [0, 1, 1],
          [2, 1, 1],
        ],
      );
      expect(solutionsOf(puzzle)).toEqual([]);
    });

    it("doesn't know which way a crossing's colours run until the threads around it say", (): void => {
      const rows: readonly string[] = ["YYR..", "ROR..", "RYY..", ".....", "....."];
      const pegs: readonly (readonly [number, number, number])[] = [
        [0, 0, 5],
        [2, 0, 5],
        [0, 2, 5],
        [2, 2, 5],
      ];
      expect(solutionsOf(puzzleOf(rows, pegs))).toHaveLength(1);
      expect(solutionsOf(hiddenPuzzleOf(rows, pegs))).toEqual([
        ["yellow (0,0) (1,0) (1,1) (1,2) (2,2)", "red (2,0) (2,1) (1,1) (0,1) (0,2)"],
        ["yellow (0,0) (0,1) (1,1) (2,1) (2,2)", "red (2,0) (1,0) (1,1) (1,2) (0,2)"],
      ]);
    });
  });
});
