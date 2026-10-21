import { describe, expect, it } from "vitest";
import { wovenSquares } from "../src/app/weave.ts";
import type { Point, Puzzle, ThreadColour } from "../src/core/puzzle.ts";
import type { Thread } from "../src/core/thread.ts";
import { puzzleOf } from "./fixtures/puzzle-of.ts";

const cross: Puzzle = puzzleOf(
  ["..B..", "..B..", "RRPRR", "..B..", "..B.."],
  [
    [2, 0, 5],
    [2, 4, 5],
    [0, 2, 5],
    [4, 2, 5],
  ],
);
const across: Thread = threadOf("red", [0, 2], [1, 2], [2, 2], [3, 2], [4, 2]);
const down: Thread = threadOf("blue", [2, 0], [2, 1], [2, 2], [2, 3], [2, 4]);

function threadOf(
  colour: ThreadColour,
  ...squares: readonly (readonly [number, number])[]
): Thread {
  return {
    colour,
    squares: squares.map(([x, y]: readonly [number, number]): Point => ({ x, y })),
  };
}

/** The woven squares as "x,y", which reads better in a failing assertion than 25 booleans. */
function wovenAt(puzzle: Puzzle, threads: readonly Thread[]): string[] {
  return wovenSquares(puzzle, threads).flatMap((woven: boolean, i: number): string[] =>
    woven ? [`${String(i % puzzle.width)},${String(Math.floor(i / puzzle.width))}`] : [],
  );
}

describe("wovenSquares", (): void => {
  it("marks nothing before any thread is laid", (): void => {
    expect(wovenAt(cross, [])).toEqual([]);
  });

  it("marks single-colour squares that their thread passes through", (): void => {
    expect(wovenAt(cross, [across])).toEqual(["0,2", "1,2", "3,2", "4,2"]);
  });

  it("marks a two-colour square only once both of its threads cross it", (): void => {
    expect(wovenAt(cross, [across, down])).toContain("2,2");
    expect(wovenAt(cross, [down])).not.toContain("2,2");
  });

  it("leaves a square unmarked when a thread of a colour it doesn't show passes through", (): void => {
    const stray: Thread = threadOf("blue", [0, 1], [0, 2], [0, 3]);
    expect(wovenAt(cross, [across, stray])).not.toContain("0,2");
  });

  it("leaves a square unmarked when two threads of its colour pass through", (): void => {
    const second: Thread = threadOf("red", [1, 1], [1, 2], [1, 3]);
    expect(wovenAt(cross, [across, second])).not.toContain("1,2");
  });

  it("never marks a blank square, even with a thread through it", (): void => {
    const overBlank: Thread = threadOf("red", [0, 1], [1, 1]);
    expect(wovenAt(cross, [overBlank])).toEqual([]);
  });
});
