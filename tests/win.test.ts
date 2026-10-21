import { describe, expect, it } from "vitest";
import { isSolved } from "../src/app/win.ts";
import type { Puzzle } from "../src/core/puzzle.ts";
import type { Thread } from "../src/core/thread.ts";
import { onlySolution } from "./fixtures/all-solutions.ts";
import { decoded, hiddenPuzzleOf, puzzleOf } from "./fixtures/puzzle-of.ts";
import { turningCrossingLevel } from "./fixtures/reference-puzzles.ts";
import { threadOf } from "./fixtures/thread-of.ts";
import examplePuzzle from "./fixtures/example-puzzle.json";

const lattice: Puzzle = decoded(examplePuzzle);

describe("isSolved", (): void => {
  it("is true for the solution", (): void => {
    expect(isSolved(lattice, onlySolution(lattice))).toBe(true);
  });

  it("is false with a thread missing", (): void => {
    expect(isSolved(lattice, onlySolution(lattice).slice(1))).toBe(false);
  });

  it("is false with nothing laid", (): void => {
    expect(isSolved(lattice, [])).toBe(false);
  });

  it("is false when threads turn at a crossing, though every peg is tied and every colour matches", (): void => {
    const turning: Puzzle = decoded(turningCrossingLevel);
    expect(
      isSolved(turning, [
        threadOf("blue", [2, 1], [2, 2], [3, 2]),
        threadOf("red", [1, 2], [2, 2], [2, 3]),
      ]),
    ).toBe(false);
  });

  describe("in a hidden level", (): void => {
    it("is true when a thread covers a square of another colour, as the one solution does", (): void => {
      const rows: readonly string[] = ["RYR..", "YYY..", ".....", ".....", "....."];
      const pegs: readonly (readonly [number, number, number])[] = [
        [0, 0, 3],
        [2, 0, 3],
        [0, 1, 3],
        [2, 1, 3],
      ];
      const threads: readonly Thread[] = [
        threadOf("red", [0, 0], [1, 0], [2, 0]),
        threadOf("yellow", [0, 1], [1, 1], [2, 1]),
      ];
      expect(isSolved(puzzleOf(rows, pegs), threads)).toBe(false);
      expect(isSolved(hiddenPuzzleOf(rows, pegs), threads)).toBe(true);
    });

    it("is false with every peg tied but a square left uncovered", (): void => {
      const puzzle: Puzzle = hiddenPuzzleOf(
        ["RRR..", "YYY..", ".....", ".....", "....."],
        [
          [0, 0, 3],
          [2, 0, 3],
          [0, 1, 1],
          [2, 1, 1],
        ],
      );
      expect(
        isSolved(puzzle, [
          threadOf("red", [0, 0], [1, 0], [2, 0]),
          threadOf("yellow", [0, 1]),
          threadOf("yellow", [2, 1]),
        ]),
      ).toBe(false);
    });
  });
});
