import type { Point, Puzzle } from "../core/puzzle.ts";
import type { Thread } from "../core/thread.ts";
import { noProgress, type Progress } from "./progress.ts";

// TODO: hint mode, as the messages that change it arrive.
export type Model = Menu | LevelList | Game | Tour;

/** Every screen carries these, so they follow the player between them. */
export interface Shared {
  readonly progress: Progress;
  /** Every shipped level, in play order. */
  readonly levels: readonly Puzzle[];
}

export interface Menu extends Shared {
  readonly screen: "menu";
  /** Milliseconds on the menu, which drives the board weaving itself beside the title. */
  readonly elapsed: number;
}

export interface LevelList extends Shared {
  readonly screen: "levels";
}

/** A level being played. */
export interface Game extends Shared {
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
export interface Tour extends Shared {
  readonly screen: "tour";
  readonly step: number;
  readonly steps: number;
  /** Milliseconds on this step, which drives its looping animation. */
  readonly elapsed: number;
}

export const menu: Menu = { screen: "menu", elapsed: 0, progress: noProgress, levels: [] };

export const levelList: LevelList = { screen: "levels", progress: noProgress, levels: [] };

export function shared(model: Model): Shared {
  return { progress: model.progress, levels: model.levels };
}

/** A puzzle outside the shipped levels, as the tour and tests draw, plays as a lone level. */
export function startLevel(
  puzzle: Puzzle,
  progress: Progress,
  levels: readonly Puzzle[] = [puzzle],
): Game {
  return {
    screen: "game",
    progress,
    levels,
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

/** Counts from 1. By id rather than identity, so a model that's been through JSON keeps its place. */
export function levelNumber(game: Game): number {
  return game.levels.findIndex((level: Puzzle): boolean => level.id === game.puzzle.id) + 1;
}

export function nextLevel(game: Game): Puzzle | undefined {
  return game.levels[levelNumber(game)];
}
