import {
  threadsThrough,
  type Peg,
  type Point,
  type Puzzle,
  type SquareColour,
} from "../core/puzzle.ts";
import type { Thread } from "../core/thread.ts";
import type { Model } from "./model.ts";
import { isPegTied } from "./tie.ts";
import { wovenSquares } from "./weave.ts";

/** How long the threads take to fade back once the picture is woven, in milliseconds. */
export const WIN_FADE: number = 900;

/**
 * Every peg is tied, every square has exactly the threads its colour asks for, and threads run
 * straight through two-colour squares as the weave needs. Without that last check a board that
 * turns at its crossings would match every colour but not be a weave. With every peg tied, no
 * loose thread is left either.
 */
export function isSolved(puzzle: Puzzle, threads: readonly Thread[]): boolean {
  if (!puzzle.pegs.every((peg: Peg): boolean => isPegTied(puzzle, threads, peg))) return false;
  const woven: readonly boolean[] = wovenSquares(puzzle, threads);
  const matches: boolean = puzzle.pattern.every(
    (row: readonly SquareColour[], y: number): boolean =>
      row.every(
        (square: SquareColour, x: number): boolean =>
          square === "blank" || woven[y * puzzle.width + x] === true,
      ),
  );
  return (
    matches &&
    threads.every((thread: Thread): boolean => runsStraightThroughCrossings(puzzle, thread))
  );
}

/** From 0 as the puzzle is solved to 1 once the threads have faded; 0 before it's solved. */
export function winProgress(model: Model): number {
  return model.solvedFor === undefined ? 0 : Math.min(model.solvedFor / WIN_FADE, 1);
}

export function isFading(model: Model): boolean {
  return model.solvedFor !== undefined && model.solvedFor < WIN_FADE;
}

function runsStraightThroughCrossings(puzzle: Puzzle, thread: Thread): boolean {
  return thread.squares.every((square: Point, i: number): boolean => {
    const colour: SquareColour | undefined = puzzle.pattern[square.y]?.[square.x];
    if (!colour || threadsThrough(colour).length < 2) return true;
    const previous: Point | undefined = thread.squares[i - 1];
    const next: Point | undefined = thread.squares[i + 1];
    return (
      previous !== undefined &&
      next !== undefined &&
      (previous.x === next.x || previous.y === next.y)
    );
  });
}
