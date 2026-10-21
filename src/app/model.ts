import type { Puzzle } from "../core/puzzle.ts";
import type { Thread } from "../core/thread.ts";

// TODO: hint mode and progress, as the messages that change them arrive.
export interface Model {
  readonly puzzle: Puzzle;
  /** Each starts at a peg. One that hasn't reached a second peg yet stops short. */
  readonly threads: readonly Thread[];
  /** The thread under the pointer, from its peg to the square the pointer is on. */
  readonly drag: Thread | undefined;
  /** The boards before each change, latest last, for Undo. */
  readonly history: readonly (readonly Thread[])[];
  /** Milliseconds since the puzzle was solved, which drives the win animation. */
  readonly solvedFor: number | undefined;
}

export function startLevel(puzzle: Puzzle): Model {
  return { puzzle, threads: [], drag: undefined, history: [], solvedFor: undefined };
}
