import type { Point, ThreadColour } from "./puzzle.ts";

export interface Thread {
  readonly colour: ThreadColour;
  /** From one peg to the other, both included. */
  readonly squares: readonly Point[];
}

/**
 * Threads ordered by their first square in reading order (left to right, top to bottom), each
 * starting from whichever of its pegs comes first. Two equal solutions are deeply equal.
 */
export type Solution = readonly Thread[];
