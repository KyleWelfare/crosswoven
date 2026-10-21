import {
  THREAD_COLOURS,
  threadsThrough,
  type Puzzle,
  type SquareColour,
  type ThreadColour,
} from "../core/puzzle.ts";
import type { Thread } from "../core/thread.ts";

/** Threads of one colour through each square, numbered `y * width + x`. */
type Counts = Readonly<Record<ThreadColour, Uint8Array>>;

/**
 * Which squares, numbered `y * width + x`, have exactly the threads their colour asks for: one of
 * each colour the square shows and none of any other. Blank squares never count, so only the
 * picture fills in as the player weaves.
 */
export function wovenSquares(puzzle: Puzzle, threads: readonly Thread[]): readonly boolean[] {
  const size: number = puzzle.width * puzzle.height;
  // Runs every frame, so flat typed arrays rather than an object per square.
  const counts: Counts = {
    red: new Uint8Array(size),
    blue: new Uint8Array(size),
    yellow: new Uint8Array(size),
  };
  for (const thread of threads) {
    const ofColour: Uint8Array = counts[thread.colour];
    for (const square of thread.squares) {
      const index: number = square.y * puzzle.width + square.x;
      ofColour[index] = (ofColour[index] ?? 0) + 1;
    }
  }
  return puzzle.pattern.flatMap((row: readonly SquareColour[], y: number): boolean[] =>
    row.map((square: SquareColour, x: number): boolean =>
      isWoven(square, counts, y * puzzle.width + x),
    ),
  );
}

function isWoven(square: SquareColour, counts: Counts, index: number): boolean {
  const wanted: readonly ThreadColour[] = threadsThrough(square);
  return (
    wanted.length > 0 &&
    THREAD_COLOURS.every(
      (colour: ThreadColour): boolean =>
        counts[colour][index] === (wanted.includes(colour) ? 1 : 0),
    )
  );
}
