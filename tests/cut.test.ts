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

  it("cuts a thread crossed by one turning on a two-colour square", (): void => {
    const redTurning: Thread = threadOf("red", [2, 0], [2, 1], [2, 2], [3, 2]);
    expect(cutThreads(onPurple, [blueTied], redTurning)).toEqual([
      threadOf("blue", [0, 2], [1, 2]),
    ]);
  });

  it("cuts a thread running the same way through a two-colour square", (): void => {
    const redTied: Thread = threadOf("red", [2, 0], [2, 1], [2, 2], [2, 3], [2, 4]);
    const blueUp: Thread = threadOf("blue", [2, 3], [2, 2]);
    expect(cutThreads(onPurple, [redTied], blueUp)).toEqual([threadOf("red", [2, 0], [2, 1])]);
  });

  it("cuts the thread running a third colour's way out of a full crossing", (): void => {
    const yellowIn: Thread = threadOf("yellow", [1, 3], [1, 2], [2, 2]);
    const redTied: Thread = threadOf("red", [2, 0], [2, 1], [2, 2], [2, 3], [2, 4]);
    expect(cutThreads(threeColours, [blueIn, redTied], yellowIn)).toEqual([
      threadOf("blue", [4, 2], [3, 2]),
      redTied,
    ]);
  });
});
