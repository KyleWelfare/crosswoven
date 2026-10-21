import {
  pegAt,
  threadsThrough,
  type Point,
  type Puzzle,
  type SquareColour,
} from "../core/puzzle.ts";
import type { Thread } from "../core/thread.ts";

/**
 * A square holds as many threads as it shows colours: one, or two crossing. Laying `through`
 * into a full square cuts a thread already there, as in Flow, so a mistake can be laid over
 * rather than cleared first. Threads whose colour the square doesn't show are cut first, then
 * the latest laid. Each half stays at its peg and can be joined up again; a half with no peg of
 * its own is dropped.
 */
export function cutThreads(puzzle: Puzzle, threads: readonly Thread[], through: Thread): Thread[] {
  let laid: Thread[] = [...threads];
  for (const square of through.squares) {
    const colour: SquareColour = puzzle.pattern[square.y]?.[square.x] ?? "blank";
    const room: number = threadsThrough(colour).length - 1;
    const there: Thread[] = laid.filter((thread: Thread): boolean => indexOf(thread, square) >= 0);
    const shown = (thread: Thread): boolean => threadsThrough(colour).includes(thread.colour);
    const keptFirst: Thread[] = [
      ...there.filter(shown),
      ...there.filter((thread: Thread): boolean => !shown(thread)),
    ];
    const cut: Thread[] = keptFirst.slice(Math.max(room, 0));
    laid = laid.flatMap((thread: Thread): Thread[] =>
      cut.includes(thread) ? halves(puzzle, thread, square) : [thread],
    );
  }
  return laid;
}

/** Each half reads from its own peg, as every laid thread does. */
function halves(puzzle: Puzzle, thread: Thread, square: Point): Thread[] {
  const at: number = indexOf(thread, square);
  const before: readonly Point[] = thread.squares.slice(0, at);
  const after: readonly Point[] = thread.squares.slice(at + 1).reverse();
  const end: Point | undefined = after[0];
  return [before, end && pegAt(puzzle, end) ? after : []]
    .filter((squares: readonly Point[]): boolean => squares.length > 1)
    .map((squares: readonly Point[]): Thread => ({ colour: thread.colour, squares }));
}

function indexOf(thread: Thread, square: Point): number {
  return thread.squares.findIndex(
    (point: Point): boolean => point.x === square.x && point.y === square.y,
  );
}
