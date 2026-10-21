import type { Puzzle } from "./puzzle.ts";

/** What Claude draws: a level before the generator lays its threads and pegs. */
export type Picture = Omit<Puzzle, "pegs">;
