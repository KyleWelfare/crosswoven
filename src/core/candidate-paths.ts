import {
  colourBit,
  squareMask,
  type ColourMask,
  type Peg,
  type Puzzle,
  type ThreadColour,
} from "./puzzle.ts";

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
  readonly masks: Uint8Array;
  readonly isPeg: Uint8Array;
}

/**
 * Every path each pair of pegs could be joined by: the right length, through squares of the
 * thread's colour, never through another peg, and straight through two-colour squares.
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
    masks: Uint8Array.from(puzzle.pattern.flat(), squareMask),
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

  const bit: ColourMask = colourBit(pair.from.colour);
  const path: number[] = [start];
  const onPath: Uint8Array = new Uint8Array(grid.masks.length);
  onPath[start] = 1;
  const paths: (readonly number[])[] = [];

  /** False once over `max`. */
  function extend(): boolean {
    const current: number = path.at(-1) ?? start;
    if (path.length === length) {
      if (current === target) paths.push([...path]);
      return paths.length <= max;
    }
    for (const next of neighbours(grid, current)) {
      if (!canEnter(next)) continue;
      path.push(next);
      onPath[next] = 1;
      const withinMax: boolean = extend();
      onPath[next] = 0;
      path.pop();
      if (!withinMax) return false;
    }
    return true;
  }

  function canEnter(next: number): boolean {
    if (onPath[next] === 1 || ((grid.masks[next] ?? 0) & bit) === 0) return false;
    if (grid.isPeg[next] === 1 && (next !== target || path.length + 1 < length)) return false;
    if (distance(grid, next, target) > length - path.length - 1) return false;
    const current: number = path.at(-1) ?? start;
    const previous: number | undefined = path.at(-2);
    return (
      previous === undefined || !isCrossing(grid, current) || next - current === current - previous
    );
  }

  return extend() ? paths : undefined;
}

function neighbours(grid: Grid, square: number): number[] {
  const x: number = square % grid.width;
  const y: number = Math.floor(square / grid.width);
  const found: number[] = [];
  if (x + 1 < grid.width) found.push(square + 1);
  if (y + 1 < grid.height) found.push(square + grid.width);
  if (x > 0) found.push(square - 1);
  if (y > 0) found.push(square - grid.width);
  return found;
}

function distance(grid: Grid, a: number, b: number): number {
  return (
    Math.abs((a % grid.width) - (b % grid.width)) +
    Math.abs(Math.floor(a / grid.width) - Math.floor(b / grid.width))
  );
}

function isCrossing(grid: Grid, square: number): boolean {
  const mask: ColourMask = grid.masks[square] ?? 0;
  return (mask & (mask - 1)) !== 0;
}
