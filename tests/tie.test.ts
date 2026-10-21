import { describe, expect, it } from "vitest";
import { isPegTied, isTied } from "../src/app/tie.ts";
import { pegAt, type Peg, type Puzzle } from "../src/core/puzzle.ts";
import type { Thread } from "../src/core/thread.ts";
import { decoded, puzzleOf } from "./fixtures/puzzle-of.ts";
import { threadOf } from "./fixtures/thread-of.ts";
import examplePuzzle from "./fixtures/example-puzzle.json";

const lattice: Puzzle = decoded(examplePuzzle);
const single: Puzzle = puzzleOf(["R....", ".....", ".....", ".....", "....."], [[0, 0, 1]]);

function pegOf(puzzle: Puzzle, x: number, y: number): Peg {
  const peg: Peg | undefined = pegAt(puzzle, { x, y });
  if (!peg) throw new Error(`no peg at (${String(x)}, ${String(y)})`);
  return peg;
}

describe("isTied", (): void => {
  it("is false for a thread that stops short of a second peg", (): void => {
    expect(isTied(lattice, threadOf("red", [2, 0], [2, 1]))).toBe(false);
  });

  it("is true once a thread joins two pegs of its colour and number at that length", (): void => {
    expect(isTied(lattice, threadOf("red", [2, 0], [1, 0], [1, 1], [1, 2], [1, 3], [1, 4]))).toBe(
      true,
    );
  });

  it("is false between pegs with different numbers", (): void => {
    expect(isTied(lattice, threadOf("red", [2, 0], [3, 0]))).toBe(false);
  });

  it("is false between matching pegs at the wrong length", (): void => {
    expect(isTied(lattice, threadOf("blue", [4, 1], [4, 2]))).toBe(false);
  });

  it("is true for one square on a peg marked 1", (): void => {
    expect(isTied(single, threadOf("red", [0, 0]))).toBe(true);
  });

  it("is false for one square on a peg with a longer thread", (): void => {
    expect(isTied(lattice, threadOf("red", [2, 0]))).toBe(false);
  });
});

describe("isPegTied", (): void => {
  it("leaves the peg a thread starts from hollow until the thread is tied", (): void => {
    const threads: Thread[] = [threadOf("red", [2, 0], [1, 0])];
    expect(isPegTied(lattice, threads, pegOf(lattice, 2, 0))).toBe(false);
  });

  it("ties both ends of a tied thread", (): void => {
    const threads: Thread[] = [threadOf("red", [2, 0], [1, 0], [1, 1], [1, 2], [1, 3], [1, 4])];
    expect(isPegTied(lattice, threads, pegOf(lattice, 2, 0))).toBe(true);
    expect(isPegTied(lattice, threads, pegOf(lattice, 1, 4))).toBe(true);
    expect(isPegTied(lattice, threads, pegOf(lattice, 3, 0))).toBe(false);
  });
});
