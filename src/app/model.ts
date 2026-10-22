import type { Point, Puzzle } from "../core/puzzle.ts";
import type { Thread } from "../core/thread.ts";
import { noProgress, type Progress } from "./progress.ts";

// TODO: hint mode, as the messages that change it arrive.
export type Model = Menu | LevelList | Game | Tour;

/** Every screen carries the progress, so it follows the player between them. */
interface Saved {
  readonly progress: Progress;
}

export interface Menu extends Saved {
  readonly screen: "menu";
  /** Milliseconds on the menu, which drives the board weaving itself beside the title. */
  readonly elapsed: number;
}

export interface LevelList extends Saved {
  readonly screen: "levels";
}

/** A level being played. */
export interface Game extends Saved {
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
  readonly rulesOpen: boolean;
  /** The square keyboard play acts on. While a thread is laid from the keyboard, its loose end. */
  readonly cursor: Point;
  /** Only while the board has keyboard focus, so pointer players never see it. */
  readonly cursorShown: boolean;
}

/** How the Puzzles Are Made, on one of its steps. */
export interface Tour extends Saved {
  readonly screen: "tour";
  readonly step: number;
  readonly steps: number;
  /** Milliseconds on this step, which drives its looping animation. */
  readonly elapsed: number;
}

export const menu: Menu = { screen: "menu", elapsed: 0, progress: noProgress };

export const levelList: LevelList = { screen: "levels", progress: noProgress };

export function startLevel(puzzle: Puzzle, progress: Progress): Game {
  return {
    screen: "game",
    progress,
    puzzle,
    threads: [],
    drag: undefined,
    history: [],
    solvedFor: undefined,
    rulesOpen: false,
    cursor: { x: 0, y: 0 },
    cursorShown: false,
  };
}
