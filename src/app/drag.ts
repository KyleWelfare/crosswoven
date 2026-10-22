import { onBoard, pegAt, type Peg, type Point, type Puzzle } from "../core/puzzle.ts";
import type { Thread } from "../core/thread.ts";
import { cutThreads } from "./cut.ts";
import { endsAt, isTied } from "./tie.ts";

/**
 * A press on a peg starts its thread afresh. A press on a laid thread picks it up at that square,
 * keeping the part back to the peg it was laid from. Anywhere else starts nothing.
 */
export function startDrag(
  puzzle: Puzzle,
  threads: readonly Thread[],
  square: Point,
): Thread | undefined {
  const peg: Peg | undefined = pegAt(puzzle, square);
  if (peg) return { colour: peg.colour, squares: [{ x: peg.x, y: peg.y }] };
  // A crossing square holds two threads. The one laid last is the likelier to be adjusted.
  const thread: Thread | undefined = threads.findLast(
    (laid: Thread): boolean => indexOf(laid, square) >= 0,
  );
  if (!thread) return undefined;
  return { colour: thread.colour, squares: thread.squares.slice(0, indexOf(thread, square) + 1) };
}

/**
 * Moves the end of the drag to `square`. Moving onto its own path takes it back to there.
 * Otherwise it walks one square at a time, so a fast pointer that skips squares still lays a
 * connected thread, and stops where the thread can't go further.
 */
export function dragTo(
  puzzle: Puzzle,
  threads: readonly Thread[],
  drag: Thread,
  square: Point,
): Thread {
  if (!onBoard(puzzle, square)) return drag;
  const back: number = indexOf(drag, square);
  if (back >= 0) return truncate(drag, back);
  let current: Thread = drag;
  for (;;) {
    const head: Point | undefined = current.squares.at(-1);
    if (!head || samePoint(head, square)) return current;
    const next: Thread = step(puzzle, threads, current, stepToward(head, square));
    if (next === current) return current;
    current = next;
  }
}

/**
 * The thread the drag makes: the drag itself, or once it reaches the loose end of a thread laid
 * from a peg of its colour and number with exactly the length left between them, the two joined
 * into one tied thread. The join is worked out afresh from the drag rather than stored, so
 * dragging back off the join square undoes it.
 */
export function draggedThread(puzzle: Puzzle, threads: readonly Thread[], drag: Thread): Thread {
  const head: Point | undefined = drag.squares.at(-1);
  if (!head || drag.squares.length < 2) return drag;
  const partner: Thread | undefined = notReplaced(threads, drag).find((laid: Thread): boolean => {
    const end: Point | undefined = laid.squares.at(-1);
    return (
      laid.colour === drag.colour &&
      laid.squares.length > 1 &&
      end !== undefined &&
      samePoint(end, head) &&
      !isTied(puzzle, laid)
    );
  });
  if (!partner) return drag;
  const joined: Thread = {
    colour: drag.colour,
    squares: [...drag.squares, ...partner.squares.slice(0, -1).reverse()],
  };
  return isTied(puzzle, joined) ? joined : drag;
}

/**
 * The laid threads with the dragged thread in place of any it replaces, those at the pegs it
 * starts and ends on, and cutting any it crowds out of a square. Nothing is dropped or cut until
 * the pointer lets go, so dragging back brings those threads back.
 */
export function shownThreads(
  puzzle: Puzzle,
  threads: readonly Thread[],
  drag: Thread | undefined,
): Thread[] {
  if (!drag) return [...threads];
  const dragged: Thread = draggedThread(puzzle, threads, drag);
  const pegs: readonly (Point | undefined)[] = [dragged.squares[0], dragged.squares.at(-1)];
  const kept: Thread[] = threads.filter(
    (thread: Thread): boolean =>
      !pegs.some((peg: Point | undefined): boolean => peg !== undefined && endsAt(thread, peg)),
  );
  return [...cutThreads(puzzle, kept, dragged), dragged];
}

/**
 * The threads once the pointer lets go. A press that never left its peg lays nothing, unless the
 * peg is marked 1 and so is a whole thread on its own; it still clears the thread that was there.
 */
export function releasedThreads(
  puzzle: Puzzle,
  threads: readonly Thread[],
  drag: Thread,
): Thread[] {
  const shown: Thread[] = shownThreads(puzzle, threads, drag);
  if (drag.squares.length > 1 || isTied(puzzle, drag)) return shown;
  return shown.filter((thread: Thread): boolean => thread !== drag);
}

/**
 * A thread is a string cut to its peg's number, so it can't grow past that, and a peg it can't tie
 * to blocks it. Blank squares never hold a thread, so they block it too, and so does another
 * thread of its colour unless the two join. Squares and threads of other colours don't block it:
 * keeping threads to their colour would steer the player towards the solution.
 */
function step(puzzle: Puzzle, threads: readonly Thread[], drag: Thread, next: Point): Thread {
  const back: number = indexOf(drag, next);
  if (back >= 0) return truncate(drag, back);
  const first: Point | undefined = drag.squares[0];
  const start: Peg | undefined = first && pegAt(puzzle, first);
  if (!start || drag.squares.length >= start.length) return drag;
  if (isTied(puzzle, draggedThread(puzzle, threads, drag))) return drag;
  if (puzzle.pattern[next.y]?.[next.x] === "blank") return drag;
  const grown: Thread = { colour: drag.colour, squares: [...drag.squares, next] };
  if (pegAt(puzzle, next)) return isTied(puzzle, grown) ? grown : drag;
  const occupied: boolean = notReplaced(threads, drag).some(
    (laid: Thread): boolean => laid.colour === drag.colour && indexOf(laid, next) >= 0,
  );
  if (occupied && draggedThread(puzzle, threads, grown) === grown) return drag;
  return grown;
}

/** The thread at the drag's own peg is being replaced, so it doesn't get in the drag's way. */
function notReplaced(threads: readonly Thread[], drag: Thread): Thread[] {
  const first: Point | undefined = drag.squares[0];
  return threads.filter((laid: Thread): boolean => !first || !endsAt(laid, first));
}

/** One square along whichever axis is further from `to`. */
function stepToward(from: Point, to: Point): Point {
  const dx: number = to.x - from.x;
  const dy: number = to.y - from.y;
  if (Math.abs(dx) >= Math.abs(dy)) return { x: from.x + Math.sign(dx), y: from.y };
  return { x: from.x, y: from.y + Math.sign(dy) };
}

function truncate(drag: Thread, last: number): Thread {
  if (last === drag.squares.length - 1) return drag;
  return { colour: drag.colour, squares: drag.squares.slice(0, last + 1) };
}

function indexOf(thread: Thread, square: Point): number {
  return thread.squares.findIndex((point: Point): boolean => samePoint(point, square));
}

function samePoint(a: Point, b: Point): boolean {
  return a.x === b.x && a.y === b.y;
}
