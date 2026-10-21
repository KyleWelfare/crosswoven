import {
  neighbourSquares,
  type Peg,
  type Point,
  type Puzzle,
  type ThreadColour,
} from "./puzzle.ts";
import { canEnter, isCrossing, slotsOf, type Slots } from "./slot.ts";
import { toSolution, type Solution, type Thread } from "./thread.ts";

/** Squares are numbered in reading order, `y * width + x`. */
export interface Candidate {
  readonly colour: ThreadColour;
  /** Indexes into `puzzle.pegs`, lower first. Both the same for a length-1 peg. */
  readonly pegs: readonly [number, number];
  /** From the first peg's square to the second's, both included. */
  readonly squares: readonly number[];
}

/** A pair of pegs with more possible paths than the solvers can check in reasonable time. */
export interface TooOpen {
  readonly ok: false;
  readonly pegs: readonly [Peg, Peg];
}

export type CandidateList =
  { readonly ok: true; readonly candidates: readonly Candidate[] } | TooOpen;

/** Short threads stay far below this; a pair above it is a long thread through an open area. */
export const MAX_PATHS_PER_PAIR: number = 100_000;

interface PegPair {
  readonly indexes: readonly [number, number];
  readonly from: Peg;
  readonly to: Peg;
}

interface Grid {
  readonly width: number;
  readonly height: number;
  readonly slots: Slots;
  readonly isPeg: Uint8Array;
}

/**
 * Every path each pair of pegs could be joined by: the right length, through squares its colour
 * may enter, never through another peg, and straight through two-colour squares.
 */
export function listCandidates(
  puzzle: Puzzle,
  maxPathsPerPair: number = MAX_PATHS_PER_PAIR,
): CandidateList {
  const grid: Grid = createGrid(puzzle);
  const candidates: Candidate[] = [];
  for (const pair of pegPairs(puzzle.pegs)) {
    const paths: readonly (readonly number[])[] | undefined = pathsBetween(
      grid,
      pair,
      maxPathsPerPair,
    );
    if (!paths) return { ok: false, pegs: [pair.from, pair.to] };
    for (const squares of paths) {
      candidates.push({ colour: pair.from.colour, pegs: pair.indexes, squares });
    }
  }
  return { ok: true, candidates };
}

function createGrid(puzzle: Puzzle): Grid {
  const width: number = puzzle.width;
  const isPeg: Uint8Array = new Uint8Array(width * puzzle.height);
  for (const peg of puzzle.pegs) isPeg[peg.y * width + peg.x] = 1;
  return {
    width,
    height: puzzle.height,
    slots: slotsOf(puzzle),
    isPeg,
  };
}

function pegPairs(pegs: readonly Peg[]): readonly PegPair[] {
  return pegs.flatMap((from: Peg, i: number): PegPair[] =>
    from.length === 1
      ? [{ indexes: [i, i], from, to: from }]
      : pegs.flatMap((to: Peg, j: number): PegPair[] =>
          j > i && to.colour === from.colour && to.length === from.length
            ? [{ indexes: [i, j], from, to }]
            : [],
        ),
  );
}

/** Undefined once there are more than `max` paths. */
function pathsBetween(
  grid: Grid,
  pair: PegPair,
  max: number,
): readonly (readonly number[])[] | undefined {
  const start: number = pair.from.y * grid.width + pair.from.x;
  const target: number = pair.to.y * grid.width + pair.to.x;
  const length: number = pair.from.length;
  if (length === 1) return [[start]];
  const steps: number = length - 1;
  const gap: number = distance(grid, start, target);
  // Each step changes the checkerboard colour, so the spare steps must come in pairs.
  if (gap > steps || (steps - gap) % 2 === 1) return [];

  const colour: ThreadColour = pair.from.colour;
  const path: number[] = [start];
  const onPath: Uint8Array = new Uint8Array(grid.width * grid.height);
  onPath[start] = 1;
  const paths: (readonly number[])[] = [];

  /** False once over `max`. */
  function extend(): boolean {
    const current: number = path.at(-1) ?? start;
    if (path.length === length) {
      if (current === target) paths.push([...path]);
      return paths.length <= max;
    }
    for (const next of neighbourSquares(grid.width, grid.height, current)) {
      if (!mayStep(path.at(-2), current, next)) continue;
      path.push(next);
      onPath[next] = 1;
      const withinMax: boolean = extend();
      onPath[next] = 0;
      path.pop();
      if (!withinMax) return false;
    }
    return true;
  }

  function mayStep(previous: number | undefined, current: number, next: number): boolean {
    if (onPath[next] === 1 || !canEnter(grid.slots, next, colour)) return false;
    if (grid.isPeg[next] === 1 && (next !== target || path.length + 1 < length)) return false;
    if (distance(grid, next, target) > length - path.length - 1) return false;
    return (
      previous === undefined ||
      !isCrossing(grid.slots, current) ||
      next - current === current - previous
    );
  }

  return extend() ? paths : undefined;
}

function distance(grid: Grid, a: number, b: number): number {
  return (
    Math.abs((a % grid.width) - (b % grid.width)) +
    Math.abs(Math.floor(a / grid.width) - Math.floor(b / grid.width))
  );
}

export function solutionOf(width: number, chosen: readonly Candidate[]): Solution {
  return toSolution(
    chosen.map((candidate: Candidate): Thread => threadOf(width, candidate)),
    width,
  );
}

/** Starts from whichever peg comes first in reading order, as threads in a `Solution` do. */
export function threadOf(width: number, candidate: Candidate): Thread {
  const squares: readonly number[] = candidate.squares;
  const forwards: boolean = (squares[0] ?? 0) <= (squares.at(-1) ?? 0);
  return {
    colour: candidate.colour,
    squares: (forwards ? squares : [...squares].reverse()).map((square: number): Point => ({
      x: square % width,
      y: Math.floor(square / width),
    })),
  };
}
