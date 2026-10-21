import type { Puzzle } from "./puzzle.ts";

/** How many squares the generator aims for in each thread it lays. */
export interface ThreadLengths {
  readonly min: number;
  readonly max: number;
}

/** Short threads keep deductions local; longer ones make fewer pegs and harder puzzles. */
export const DEFAULT_LENGTHS: ThreadLengths = { min: 2, max: 5 };

/** What Claude draws: a level before the generator lays its threads and pegs. */
export type Picture = Omit<Puzzle, "pegs"> & { readonly lengths: ThreadLengths };
