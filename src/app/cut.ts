import {
  pegAt,
  threadsThrough,
  type Point,
  type Puzzle,
  type SquareColour,
} from "../core/puzzle.ts";
import type { Thread } from "../core/thread.ts";

/**
 * A square holds one thread, or two crossing straight at right angles where it shows two colours.
 * Laying `through` into a square cuts every thread there that it doesn't cross that way, as in
 * Flow, so a mistake can be laid over rather than cleared first. Since a crossing square already
 * holding two threads covers both ways, a third always cuts the one running its way, whatever its
 * colour. Each half stays at its peg and can be joined up again; a half with no peg of its own is
 * dropped.
 */
export function cutThreads(puzzle: Puzzle, threads: readonly Thread[], through: Thread): Thread[] {
  let laid: Thread[] = [...threads];
  for (const square of through.squares) {
    const colour: SquareColour = puzzle.pattern[square.y]?.[square.x] ?? "blank";
    const crossable: boolean = threadsThrough(colour).length === 2;
    const cut: Thread[] = laid.filter(
      (thread: Thread): boolean =>
        indexOf(thread, square) >= 0 &&
        !(crossable && (axesAt(thread, square) & axesAt(through, square)) === 0),
    );
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

const ACROSS: number = 1;
const DOWN: number = 2;

/** The ways a thread runs through `square`, as ACROSS and DOWN bits: both where it turns. */
function axesAt(thread: Thread, square: Point): number {
  const at: number = indexOf(thread, square);
  return [thread.squares[at - 1], thread.squares[at + 1]].reduce(
    (axes: number, neighbour: Point | undefined): number => {
      if (!neighbour) return axes;
      return axes | (neighbour.x === square.x ? DOWN : ACROSS);
    },
    0,
  );
}

function indexOf(thread: Thread, square: Point): number {
  return thread.squares.findIndex(
    (point: Point): boolean => point.x === square.x && point.y === square.y,
  );
}
