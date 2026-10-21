import { pegAt, type Peg, type Point, type Puzzle } from "../core/puzzle.ts";
import type { Thread } from "../core/thread.ts";

/**
 * A thread is tied once it joins two pegs of its colour and number at exactly that length. A peg
 * marked 1 is a whole thread on its own, so one square on it is tied.
 */
export function isTied(puzzle: Puzzle, thread: Thread): boolean {
  const first: Point | undefined = thread.squares[0];
  const last: Point | undefined = thread.squares.at(-1);
  const start: Peg | undefined = first && pegAt(puzzle, first);
  const end: Peg | undefined = last && pegAt(puzzle, last);
  return (
    start !== undefined &&
    end !== undefined &&
    start.colour === thread.colour &&
    end.colour === thread.colour &&
    start.length === end.length &&
    thread.squares.length === end.length
  );
}

export function isPegTied(puzzle: Puzzle, threads: readonly Thread[], peg: Peg): boolean {
  return threads.some(
    (thread: Thread): boolean =>
      thread.colour === peg.colour && endsAt(thread, peg) && isTied(puzzle, thread),
  );
}

export function endsAt(thread: Thread, square: Point): boolean {
  return [thread.squares[0], thread.squares.at(-1)].some(
    (end: Point | undefined): boolean => end?.x === square.x && end.y === square.y,
  );
}
