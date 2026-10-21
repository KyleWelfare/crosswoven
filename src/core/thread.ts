import type { Point, ThreadColour } from "./puzzle.ts";

export interface Thread {
  readonly colour: ThreadColour;
  /** From one peg to the other, both included. */
  readonly squares: readonly Point[];
}

/**
 * Threads ordered by their first square in reading order (left to right, top to bottom), each
 * starting from whichever of its pegs comes first. Two equal solutions are deeply equal.
 */
export type Solution = readonly Thread[];

export function sameSolution(a: Solution, b: Solution): boolean {
  return (
    a.length === b.length &&
    a.every((thread: Thread, i: number): boolean => {
      const other: Thread | undefined = b[i];
      return (
        other !== undefined &&
        thread.colour === other.colour &&
        thread.squares.length === other.squares.length &&
        thread.squares.every((square: Point, j: number): boolean => {
          const match: Point | undefined = other.squares[j];
          return match !== undefined && match.x === square.x && match.y === square.y;
        })
      );
    })
  );
}

/** Puts threads in the order `Solution` documents. */
export function toSolution(threads: readonly Thread[], width: number): Solution {
  const order = (point: Point | undefined): number => (point ? point.y * width + point.x : 0);
  return threads
    .map((thread: Thread): Thread =>
      order(thread.squares[0]) <= order(thread.squares.at(-1))
        ? thread
        : { colour: thread.colour, squares: [...thread.squares].reverse() },
    )
    .sort((a: Thread, b: Thread): number => order(a.squares[0]) - order(b.squares[0]));
}
