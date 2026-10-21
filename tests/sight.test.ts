import { describe, expect, it } from "vitest";
import type { Peg, Point, Puzzle } from "../src/core/puzzle.ts";
import { seenMoves, type Prefixes, type Seen } from "../src/core/sight.ts";
import { puzzleOf } from "./fixtures/puzzle-of.ts";

function square(puzzle: Puzzle, point: Point): number {
  return point.y * puzzle.width + point.x;
}

function pegIndex(puzzle: Puzzle, point: Point): number {
  return puzzle.pegs.findIndex((peg: Peg): boolean => peg.x === point.x && peg.y === point.y);
}

/** What a player sees on a fresh board, where each thread is known only at its peg. */
function seenAtStart(puzzle: Puzzle): readonly Seen[] {
  const prefixes: Prefixes = puzzle.pegs.map((peg: Peg): number[] => [square(puzzle, peg)]);
  return seenMoves(
    puzzle,
    prefixes,
    puzzle.pegs.map((): boolean => false),
  );
}

describe("seenMoves", (): void => {
  it("sees past a pocket the thread would be trapped in", (): void => {
    const puzzle: Puzzle = puzzleOf(
      ["..Y..", "..Y..", "..YYY", "..YYY", "....."],
      [
        [2, 1, 4],
        [4, 2, 4],
      ],
    );
    expect(seenAtStart(puzzle)).toContainEqual({
      peg: pegIndex(puzzle, { x: 2, y: 1 }),
      square: square(puzzle, { x: 2, y: 2 }),
    });
  });

  it("sees past a move that leaves no matching peg in reach", (): void => {
    const puzzle: Puzzle = puzzleOf(
      [".....", "YY...", "YYY..", ".....", "....."],
      [
        [0, 2, 3],
        [2, 2, 3],
      ],
    );
    expect(seenAtStart(puzzle)).toContainEqual({
      peg: pegIndex(puzzle, { x: 0, y: 2 }),
      square: square(puzzle, { x: 1, y: 2 }),
    });
  });

  it("sees that a square with two ways in belongs to the thread ending at one", (): void => {
    // (1,1) could go right or down, but (2,1) can only be covered from (1,1) and (3,1).
    const puzzle: Puzzle = puzzleOf(
      [".....", ".YYY.", "YY.Y.", ".YYY.", "....."],
      [
        [1, 1, 5],
        [3, 3, 5],
      ],
    );
    expect(seenAtStart(puzzle)).toContainEqual({
      peg: pegIndex(puzzle, { x: 1, y: 1 }),
      square: square(puzzle, { x: 2, y: 1 }),
    });
  });

  it("sees nothing where a thread has two real ways on", (): void => {
    const puzzle: Puzzle = puzzleOf(
      [".....", ".YYY.", ".YYY.", ".YYY.", "....."],
      [
        [1, 1, 5],
        [3, 3, 5],
      ],
    );
    expect(seenAtStart(puzzle)).toEqual([]);
  });
});
