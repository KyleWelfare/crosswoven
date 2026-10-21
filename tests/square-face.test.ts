import { describe, expect, it } from "vitest";
import { faceOf } from "../src/app/square-face.ts";
import type { Puzzle, SquareColour } from "../src/core/puzzle.ts";
import { hiddenPuzzleOf, puzzleOf } from "./fixtures/puzzle-of.ts";

const rows: readonly string[] = [".....", "..B..", "RRPRR", "..B..", "..B.."];
const pegs: readonly (readonly [number, number, number])[] = [
  [2, 1, 4],
  [2, 4, 4],
  [0, 2, 5],
  [4, 2, 5],
];
const squares: readonly SquareColour[] = ["blank", "red", "blue", "purple"];

describe("faceOf", (): void => {
  it("shows every square's colour in a level that shows its picture", (): void => {
    const puzzle: Puzzle = puzzleOf(rows, pegs);
    expect(squares.map((square: SquareColour): string => faceOf(puzzle, square))).toEqual(squares);
  });

  it("shows walls, open field and crossings' colours in a hidden level", (): void => {
    const puzzle: Puzzle = hiddenPuzzleOf(rows, pegs);
    expect(squares.map((square: SquareColour): string => faceOf(puzzle, square))).toEqual([
      "wall",
      "field",
      "field",
      "purple",
    ]);
  });
});
