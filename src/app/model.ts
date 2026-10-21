import type { Puzzle } from "../core/puzzle.ts";
import type { Thread } from "../core/thread.ts";

// TODO: hint mode and progress, as the messages that change them arrive.
export type Model = Menu | LevelList | Game;

export interface Menu {
  readonly screen: "menu";
  readonly rulesOpen: boolean;
}

export interface LevelList {
  readonly screen: "levels";
}

/** A level being played. */
export interface Game {
  readonly screen: "game";
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

export const menu: Menu = { screen: "menu", rulesOpen: false };

export const levelList: LevelList = { screen: "levels" };

export function startLevel(puzzle: Puzzle): Game {
  return {
    screen: "game",
    puzzle,
    threads: [],
    drag: undefined,
    history: [],
    solvedFor: undefined,
  };
}
