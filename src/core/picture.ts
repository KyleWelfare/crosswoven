import type { Puzzle } from "./puzzle.ts";

/** How many squares the generator aims for in each thread it lays. */
export interface ThreadLengths {
  readonly min: number;
  readonly max: number;
}

/** Short threads keep deductions local; longer ones make fewer pegs and harder puzzles. */
export const DEFAULT_LENGTHS: ThreadLengths = { min: 2, max: 5 };

/** What Claude draws: a level before the generator lays its threads and pegs. */
export type Picture = Omit<Puzzle, "pegs"> & {
  readonly lengths: ThreadLengths;
  /**
   * From 0 to 1, the chance a new thread aims for the length of a nearby thread of its colour
   * instead of a random one. Same numbers close together give a peg rival partners to rule out.
   */
  readonly sameNumbers?: number;
  /**
   * Rounds of deduction the level should take (see SolveProfile). The generator keeps the seed
   * closest to it; without one, it keeps the first seed the validator accepts.
   */
  readonly targetRounds?: number;
};
