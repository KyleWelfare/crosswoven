import { THREAD_COLOURS, neighbourSquares, type Peg, type Puzzle } from "./puzzle.ts";
import {
  SLOTS_PER_SQUARE,
  canEnter,
  isCrossing,
  slotOf,
  slotsOf,
  squareOfSlot,
  type Slots,
} from "./slot.ts";

/**
 * What a player knows of each thread: the squares it's known to run through, from its peg out.
 * Squares are numbered `y * width + x`, and every prefix starts at its peg's square.
 */
export type Prefixes = readonly (readonly number[])[];

/** A move a player sees is forced: peg `peg`'s thread runs on into `square`. */
export interface Seen {
  readonly peg: number;
  readonly square: number;
}

/**
 * Squares a player looks ahead before calling a move a trap. One step catches a pocket with no way
 * out; two catches a pocket one square deeper.
 */
const LOOKAHEAD: number = 2;

interface View {
  readonly puzzle: Puzzle;
  readonly slots: Slots;
  readonly prefixes: Prefixes;
  readonly done: readonly boolean[];
  /** For each slot, the peg whose known prefix holds it, or -1. */
  readonly owners: Int32Array;
}

interface Neighbour {
  readonly square: number;
  /** The peg whose thread ends here and can still grow, or -1 for a free square. */
  readonly end: number;
}

/**
 * Moves a player makes without deducing anything, against what's known so far. A thread's next
 * square is seen when every other way on is a trap within a short look ahead, leaves no matching
 * peg in reach of the length left, or turns inside a crossing. A square that must be covered and
 * has only two usable neighbours is seen to belong to the thread ending at one of them.
 */
export function seenMoves(puzzle: Puzzle, prefixes: Prefixes, done: readonly boolean[]): Seen[] {
  const slots: Slots = slotsOf(puzzle);
  const view: View = { puzzle, slots, prefixes, done, owners: ownersOf(puzzle, slots, prefixes) };
  const seen: Map<number, number> = new Map<number, number>();
  for (let index: number = 0; index < puzzle.pegs.length; index++) {
    const forced: number | undefined = forcedStep(view, index);
    if (forced !== undefined) seen.set(index, forced);
  }
  for (const { peg, square } of filledPockets(view)) if (!seen.has(peg)) seen.set(peg, square);
  return [...seen].map(([peg, square]: [number, number]): Seen => ({ peg, square }));
}

/** The peg whose known thread `path` meets end to end with exactly the right length, if any. */
export function joinedPeg(
  puzzle: Puzzle,
  prefixes: Prefixes,
  done: readonly boolean[],
  index: number,
  path: readonly number[],
): number | undefined {
  const peg: Peg = pegOf(puzzle, index);
  const head: number | undefined = path.at(-1);
  const joined: number = puzzle.pegs.findIndex(
    (other: Peg, j: number): boolean =>
      isPartner(peg, other, index, j, done) &&
      prefixes[j]?.at(-1) === head &&
      path.length + (prefixes[j]?.length ?? 0) - 1 === peg.length,
  );
  return joined === -1 ? undefined : joined;
}

function forcedStep(view: View, index: number): number | undefined {
  const peg: Peg = pegOf(view.puzzle, index);
  const prefix: readonly number[] = view.prefixes[index] ?? [];
  if (view.done[index] || peg.length === 1 || prefix.length >= peg.length) return undefined;
  const open: readonly number[] = nextSquares(view, index, prefix).filter(
    (square: number): boolean => staysAlive(view, index, [...prefix, square], LOOKAHEAD),
  );
  return open.length === 1 ? open[0] : undefined;
}

function staysAlive(view: View, index: number, path: readonly number[], depth: number): boolean {
  const peg: Peg = pegOf(view.puzzle, index);
  const last: number | undefined = path.at(-1);
  if (last === undefined) return false;
  if (joinedPeg(view.puzzle, view.prefixes, view.done, index, path) !== undefined) return true;
  if (ownerAt(view, peg, last) !== -1 || path.length >= peg.length) return false;
  if (!canStillReach(view, index, path)) return false;
  if (depth === 0) return true;
  return nextSquares(view, index, path).some((square: number): boolean =>
    staysAlive(view, index, [...path, square], depth - 1),
  );
}

/** Some matching peg's known end is within the steps left, with the right parity. */
function canStillReach(view: View, index: number, path: readonly number[]): boolean {
  const peg: Peg = pegOf(view.puzzle, index);
  const last: number | undefined = path.at(-1);
  if (last === undefined) return false;
  return view.puzzle.pegs.some((other: Peg, j: number): boolean => {
    const end: number | undefined = view.prefixes[j]?.at(-1);
    if (!isPartner(peg, other, index, j, view.done) || end === undefined) return false;
    const steps: number = peg.length - path.length - (view.prefixes[j]?.length ?? 1) + 1;
    const distance: number = manhattan(view.puzzle.width, last, end);
    return steps >= distance && (steps - distance) % 2 === 0;
  });
}

/**
 * Squares a thread can step to from the end of `path`: ones its colour may enter, not its own
 * already, and free unless it's the known end of a thread it could join. Out of a crossing it goes
 * straight on.
 */
function nextSquares(view: View, index: number, path: readonly number[]): number[] {
  const { puzzle }: View = view;
  const peg: Peg = pegOf(puzzle, index);
  const last: number | undefined = path.at(-1);
  if (last === undefined) return [];
  return neighbourSquares(puzzle.width, puzzle.height, last).filter((square: number): boolean => {
    if (!goesStraight(view.slots, path, square)) return false;
    if (path.includes(square) || !canEnter(view.slots, square, peg.colour)) return false;
    const owner: number = ownerAt(view, peg, square);
    return (
      owner === -1 ||
      (isPartner(peg, pegOf(puzzle, owner), index, owner, view.done) &&
        view.prefixes[owner]?.at(-1) === square)
    );
  });
}

/**
 * A square with one slot, which nobody is known to fill yet, must be passed through, so with just
 * two usable neighbours the thread ending at either one runs through it.
 */
function filledPockets(view: View): Seen[] {
  const { puzzle, slots }: View = view;
  const slotCount: Uint8Array = new Uint8Array(puzzle.width * puzzle.height);
  for (const slot of slots.required) {
    const square: number = squareOfSlot(slot);
    slotCount[square] = (slotCount[square] ?? 0) + 1;
  }
  const seen: Seen[] = [];
  for (const slot of slots.required) {
    const square: number = squareOfSlot(slot);
    if (slotCount[square] !== 1 || view.owners[slot] !== -1) continue;
    const usable: readonly Neighbour[] = neighbourSquares(
      puzzle.width,
      puzzle.height,
      square,
    ).flatMap((next: number): Neighbour[] => usableNeighbour(view, square, next));
    const end: Neighbour | undefined = usable.find(({ end }: Neighbour): boolean => end !== -1);
    if (usable.length === 2 && end) seen.push({ peg: end.end, square });
  }
  return seen;
}

/**
 * A way into `pocket` from `square`: a free slot of a colour that may enter both, or the growing
 * end of a known thread that can step on into it. The inside of a known thread is no way in. A
 * square offering more than one thread a way in belongs to none of them.
 */
function usableNeighbour(view: View, pocket: number, square: number): Neighbour[] {
  const ends: Set<number> = new Set<number>();
  let free: boolean = false;
  for (const colour of THREAD_COLOURS) {
    if (!canEnter(view.slots, pocket, colour) || !canEnter(view.slots, square, colour)) continue;
    const owner: number = view.owners[slotOf(view.slots, square, colour)] ?? -1;
    if (owner === -1) free = true;
    else if (growsInto(view, owner, square, pocket)) ends.add(owner);
  }
  const [end]: readonly number[] = [...ends];
  if (free || ends.size > 1) return [{ square, end: -1 }];
  return end === undefined ? [] : [{ square, end }];
}

function growsInto(view: View, owner: number, square: number, pocket: number): boolean {
  const peg: Peg = pegOf(view.puzzle, owner);
  const prefix: readonly number[] = view.prefixes[owner] ?? [];
  const grows: boolean = !view.done[owner] && peg.length > 1 && prefix.length < peg.length;
  return grows && prefix.at(-1) === square && goesStraight(view.slots, prefix, pocket);
}

/** Out of a crossing a thread goes straight on. */
function goesStraight(slots: Slots, path: readonly number[], next: number): boolean {
  const last: number | undefined = path.at(-1);
  const previous: number | undefined = path.at(-2);
  return (
    last === undefined ||
    previous === undefined ||
    !isCrossing(slots, last) ||
    next - last === last - previous
  );
}

function ownersOf(puzzle: Puzzle, slots: Slots, prefixes: Prefixes): Int32Array {
  const owners: Int32Array = new Int32Array(puzzle.width * puzzle.height * SLOTS_PER_SQUARE).fill(
    -1,
  );
  puzzle.pegs.forEach((peg: Peg, index: number): void => {
    for (const square of prefixes[index] ?? []) owners[slotOf(slots, square, peg.colour)] = index;
  });
  return owners;
}

function ownerAt(view: View, peg: Peg, square: number): number {
  return view.owners[slotOf(view.slots, square, peg.colour)] ?? -1;
}

function isPartner(
  peg: Peg,
  other: Peg,
  index: number,
  j: number,
  done: readonly boolean[],
): boolean {
  return j !== index && !done[j] && other.colour === peg.colour && other.length === peg.length;
}

function manhattan(width: number, a: number, b: number): number {
  return (
    Math.abs((a % width) - (b % width)) + Math.abs(Math.floor(a / width) - Math.floor(b / width))
  );
}

function pegOf(puzzle: Puzzle, index: number): Peg {
  const peg: Peg | undefined = puzzle.pegs[index];
  if (!peg) throw new RangeError(`no peg ${String(index)}`);
  return peg;
}
