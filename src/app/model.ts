import type { Puzzle } from "../core/puzzle.ts";
import type { Thread } from "../core/thread.ts";

// TODO: drag state, hint mode and progress, as the messages that change them arrive.
export interface Model {
  readonly puzzle: Puzzle;
  readonly threads: readonly Thread[];
}
