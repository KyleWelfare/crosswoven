import {
  neighbourSquares,
  threadsThrough,
  type Peg,
  type Puzzle,
  type SquareColour,
  type ThreadColour,
} from "./puzzle.ts";

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
  readonly prefixes: Prefixes;
  readonly done: readonly boolean[];
  /** For each colour and square, the peg whose known prefix holds it, or -1. */
  readonly owners: ReadonlyMap<ThreadColour, Int32Array>;
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
  const view: View = { puzzle, prefixes, done, owners: ownersOf(puzzle, prefixes) };
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
 * Squares a thread can step to from the end of `path`: of its colour, not its own already, and free
 * unless it's the known end of a thread it could join. Out of a crossing it goes straight on.
 */
function nextSquares(view: View, index: number, path: readonly number[]): number[] {
  const { puzzle }: View = view;
  const peg: Peg = pegOf(puzzle, index);
  const last: number | undefined = path.at(-1);
  const previous: number | undefined = path.at(-2);
  if (last === undefined) return [];
  const straightOn: number | undefined =
    previous !== undefined && isCrossing(puzzle, last) ? 2 * last - previous : undefined;
  return neighbourSquares(puzzle.width, puzzle.height, last).filter((square: number): boolean => {
    if (straightOn !== undefined && square !== straightOn) return false;
    if (path.includes(square) || !coloursAt(puzzle, square).includes(peg.colour)) return false;
    const owner: number = ownerAt(view, peg, square);
    return (
      owner === -1 ||
      (isPartner(peg, pegOf(puzzle, owner), index, owner, view.done) &&
        view.prefixes[owner]?.at(-1) === square)
    );
  });
}

/**
 * A single-colour square nobody is known to cover yet must be passed through, so with just two
 * usable neighbours the thread ending at either one runs through it.
 */
function filledPockets(view: View): Seen[] {
  const { puzzle }: View = view;
  const seen: Seen[] = [];
  for (let square: number = 0; square < puzzle.width * puzzle.height; square++) {
    const colours: readonly ThreadColour[] = coloursAt(puzzle, square);
    const colour: ThreadColour | undefined = colours.length === 1 ? colours[0] : undefined;
    const owners: Int32Array | undefined = colour && view.owners.get(colour);
    if (!colour || !owners || owners[square] !== -1) continue;
    const usable: readonly Neighbour[] = neighbourSquares(puzzle.width, puzzle.height, square)
      .filter((next: number): boolean => coloursAt(puzzle, next).includes(colour))
      .flatMap((next: number): Neighbour[] => usableNeighbour(view, owners, next));
    const end: Neighbour | undefined = usable.find(({ end }: Neighbour): boolean => end !== -1);
    if (usable.length === 2 && end) seen.push({ peg: end.end, square });
  }
  return seen;
}

/** Free, or the growing end of a known thread; the inside of a known thread is no way in. */
function usableNeighbour(view: View, owners: Int32Array, square: number): Neighbour[] {
  const owner: number = owners[square] ?? -1;
  if (owner === -1) return [{ square, end: -1 }];
  const peg: Peg = pegOf(view.puzzle, owner);
  const prefix: readonly number[] = view.prefixes[owner] ?? [];
  const grows: boolean = !view.done[owner] && peg.length > 1 && prefix.length < peg.length;
  return grows && prefix.at(-1) === square ? [{ square, end: owner }] : [];
}

function ownersOf(puzzle: Puzzle, prefixes: Prefixes): Map<ThreadColour, Int32Array> {
  const owners: Map<ThreadColour, Int32Array> = new Map<ThreadColour, Int32Array>();
  puzzle.pegs.forEach((peg: Peg, index: number): void => {
    const squares: Int32Array =
      owners.get(peg.colour) ?? new Int32Array(puzzle.width * puzzle.height).fill(-1);
    owners.set(peg.colour, squares);
    for (const square of prefixes[index] ?? []) squares[square] = index;
  });
  return owners;
}

function ownerAt(view: View, peg: Peg, square: number): number {
  return view.owners.get(peg.colour)?.[square] ?? -1;
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

function coloursAt(puzzle: Puzzle, square: number): readonly ThreadColour[] {
  const colour: SquareColour =
    puzzle.pattern[Math.floor(square / puzzle.width)]?.[square % puzzle.width] ?? "blank";
  return threadsThrough(colour);
}

function isCrossing(puzzle: Puzzle, square: number): boolean {
  return coloursAt(puzzle, square).length === 2;
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
