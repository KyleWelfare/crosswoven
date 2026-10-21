import { describe, expect, it } from "vitest";
import { cutThreads } from "../src/app/cut.ts";
import type { Puzzle } from "../src/core/puzzle.ts";
import type { Thread } from "../src/core/thread.ts";
import { puzzleOf } from "./fixtures/puzzle-of.ts";
import { threadOf } from "./fixtures/thread-of.ts";

// A red thread down the middle column meets a blue one along the middle row.
const onBlue: Puzzle = puzzleOf(
  ["..R..", "..R..", "BBBBB", "..R..", "..R.."],
  [
    [2, 0, 5],
    [2, 4, 5],
    [0, 2, 5],
    [4, 2, 5],
  ],
);
const onPurple: Puzzle = puzzleOf(
  ["..R..", "..R..", "BBPBB", "..R..", "..R.."],
  [
    [2, 0, 5],
    [2, 4, 5],
    [0, 2, 5],
    [4, 2, 5],
  ],
);
// A purple square at the centre, with yellow pegs beside it to bring a third colour in.
const threeColours: Puzzle = puzzleOf(
  ["..R..", ".YR..", "BBPBB", ".YR..", "..R.."],
  [
    [2, 0, 5],
    [2, 4, 5],
    [0, 2, 5],
    [4, 2, 5],
    [1, 1, 3],
    [1, 3, 3],
  ],
);
const blueIn: Thread = threadOf("blue", [4, 2], [3, 2], [2, 2]);
const blueTied: Thread = threadOf("blue", [0, 2], [1, 2], [2, 2], [3, 2], [4, 2]);
const redDown: Thread = threadOf("red", [2, 0], [2, 1], [2, 2]);

describe("cutThreads", (): void => {
  it("cuts a tied thread out of a one-colour square, leaving a half at each peg", (): void => {
    expect(cutThreads(onBlue, [blueTied], redDown)).toEqual([
      threadOf("blue", [0, 2], [1, 2]),
      threadOf("blue", [4, 2], [3, 2]),
    ]);
  });

  it("drops the half of a loose thread that has no peg", (): void => {
    const loose: Thread = threadOf("blue", [0, 2], [1, 2], [2, 2], [3, 2]);
    expect(cutThreads(onBlue, [loose], redDown)).toEqual([threadOf("blue", [0, 2], [1, 2])]);
  });

  it("leaves a thread crossing on a two-colour square", (): void => {
    expect(cutThreads(onPurple, [blueTied], redDown)).toEqual([blueTied]);
  });

  it("cuts a thread the square doesn't show before one it does, however early it was laid", (): void => {
    const yellowIn: Thread = threadOf("yellow", [1, 1], [1, 2], [2, 2]);
    expect(cutThreads(threeColours, [yellowIn, blueIn], redDown)).toEqual([
      threadOf("yellow", [1, 1], [1, 2]),
      blueIn,
    ]);
  });

  it("cuts the later laid of two threads the square shows", (): void => {
    const yellowIn: Thread = threadOf("yellow", [1, 3], [1, 2], [2, 2]);
    const redTied: Thread = threadOf("red", [2, 0], [2, 1], [2, 2], [2, 3], [2, 4]);
    expect(cutThreads(threeColours, [blueIn, redTied], yellowIn)).toEqual([
      blueIn,
      threadOf("red", [2, 0], [2, 1]),
      threadOf("red", [2, 4], [2, 3]),
    ]);
    expect(cutThreads(threeColours, [redTied, blueIn], yellowIn)).toEqual([
      redTied,
      threadOf("blue", [4, 2], [3, 2]),
    ]);
  });

  describe("in a hidden level", (): void => {
    it("holds one thread of any colour in a one-colour square", (): void => {
      const hidden: Puzzle = { ...onBlue, hidden: true };
      expect(cutThreads(hidden, [blueTied], redDown)).toEqual([
        threadOf("blue", [0, 2], [1, 2]),
        threadOf("blue", [4, 2], [3, 2]),
      ]);
    });

    it("holds the two colours a crossing is marked with", (): void => {
      const hidden: Puzzle = { ...onPurple, hidden: true };
      expect(cutThreads(hidden, [blueTied], redDown)).toEqual([blueTied]);
    });
  });
});
