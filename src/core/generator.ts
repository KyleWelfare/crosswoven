import { solveLogically, type Difficulty, type LogicResult } from "./logic-solver.ts";
import type { Picture, ThreadLengths } from "./picture.ts";
import {
  THREAD_COLOURS,
  formatPoint,
  neighbourSquares,
  threadsThrough,
  type Peg,
  type Point,
  type Puzzle,
  type SquareColour,
  type ThreadColour,
} from "./puzzle.ts";
import { createRng, randomInt, shuffled, type Rng } from "./rng.ts";
import { findSolutions, type SearchResult } from "./search-solver.ts";
import { toSolution, type Solution, type Thread } from "./thread.ts";
import { validatePuzzle, type Verdict } from "./validator.ts";

export type Laying =
  | { readonly ok: true; readonly puzzle: Puzzle; readonly threads: Solution }
  /** The picture can't be woven, and these squares are why. */
  | { readonly ok: false; readonly badSquares: readonly Point[] };

/** Squares are numbered in reading order, `y * width + x`. */
interface Grid {
  readonly width: number;
  readonly height: number;
  readonly squares: readonly SquareColour[];
  readonly lengths: ThreadLengths;
}

interface ColourPath {
  readonly colour: ThreadColour;
  readonly squares: readonly number[];
}

/** For each two-colour square, the colour whose thread runs across it; the other runs down. */
type Orientation = ReadonlyMap<number, ThreadColour>;

type Found<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly bad: readonly number[] };

/**
 * Covers each colour of a picture with short threads and puts numbered pegs at their ends. The
 * same picture and seed always give the same laying. Whether it makes a good puzzle is the
 * validator's job.
 */
export function layThreads(picture: Picture, seed: number): Laying {
  const grid: Grid = gridOf(picture);
  const orientation: Found<Orientation> = orientCrossings(grid);
  if (!orientation.ok) return badLaying(grid, orientation.bad);

  const rng: Rng = createRng(seed);
  const paths: ColourPath[] = [];
  for (const colour of THREAD_COLOURS) {
    const forced: Found<readonly (readonly number[])[]> = forcedPaths(
      grid,
      orientation.value,
      colour,
    );
    if (!forced.ok) return badLaying(grid, forced.bad);

    for (const squares of layColour(grid, colour, forced.value, rng)) {
      paths.push({ colour, squares });
    }
  }
  const threads: Solution = toSolution(
    paths.map((path: ColourPath): Thread => threadOf(grid, path)),
    grid.width,
  );
  return { ok: true, puzzle: puzzleOf(picture, threads), threads };
}

/** Rounds of splitting per seed, and seeds, before the generator gives up on a picture. */
export const ROUNDS_PER_SEED: number = 50;
export const SEEDS: number = 10;

export type Outcome = "accepted" | "too-open" | "not-unique" | "needs-guessing";

/** One laying the generator tried. Kept for How It Works, which replays them. */
export interface Attempt {
  readonly seed: number;
  readonly threads: Solution;
  readonly outcome: Outcome;
  /** The squares that got it rejected. */
  readonly trouble: readonly Point[];
}

export type Generation =
  | {
      readonly ok: true;
      readonly puzzle: Puzzle;
      readonly difficulty: Difficulty;
      readonly attempts: readonly Attempt[];
    }
  /** The picture can't be woven, or never settled: these squares are why. */
  | {
      readonly ok: false;
      readonly badSquares: readonly Point[];
      readonly attempts: readonly Attempt[];
    };

interface Check {
  readonly outcome: Outcome;
  readonly trouble: readonly Point[];
}

/**
 * Lays threads, then splits a thread where the puzzle goes wrong until the validator accepts it.
 * Each split adds two pegs, which can only narrow the solutions. Seeds are tried from 1 up, so a
 * picture always gives the same level.
 */
export function generateLevel(picture: Picture): Generation {
  const grid: Grid = gridOf(picture);
  const attempts: Attempt[] = [];
  const unsettled: Point[] = [];
  for (let seed: number = 1; seed <= SEEDS; seed++) {
    const laying: Laying = layThreads(picture, seed);
    if (!laying.ok) return { ok: false, badSquares: laying.badSquares, attempts };
    let threads: Solution | undefined = laying.threads;
    let trouble: readonly Point[] = [];
    for (let round: number = 0; threads && round < ROUNDS_PER_SEED; round++) {
      const puzzle: Puzzle = puzzleOf(picture, threads);
      const check: Check = checkLaying(puzzle);
      attempts.push({ seed, threads, ...check });
      if (check.outcome === "accepted") return accepted(puzzle, attempts);
      trouble = check.trouble;
      threads = splitTrouble(grid, threads, trouble);
    }
    unsettled.push(...trouble);
  }
  return { ok: false, badSquares: uniquePoints(unsettled), attempts };
}

/** The validator's checks, but saying where the trouble is so the generator knows what to split. */
function checkLaying(puzzle: Puzzle): Check {
  const search: SearchResult = findSolutions(puzzle, 2);
  if (!search.ok) return { outcome: "too-open", trouble: search.pegs.map(pointOf) };
  const [first, second]: readonly (Solution | undefined)[] = search.solutions;
  if (!first) throw new Error(`the generator's own threads don't solve "${puzzle.id}"`);
  if (second) return { outcome: "not-unique", trouble: differingSquares(first, second) };
  const logic: LogicResult = solveLogically(puzzle);
  if (logic.status === "stuck") return { outcome: "needs-guessing", trouble: logic.unsettled };
  return { outcome: "accepted", trouble: [] };
}

function accepted(puzzle: Puzzle, attempts: readonly Attempt[]): Generation {
  const verdict: Verdict = validatePuzzle(puzzle);
  if (!verdict.ok) {
    throw new Error(`the validator rejected "${puzzle.id}" after the generator's checks passed`);
  }
  return { ok: true, puzzle, difficulty: verdict.difficulty, attempts };
}

/** Squares whose thread, of any colour, differs between the two solutions. */
function differingSquares(first: Solution, second: Solution): readonly Point[] {
  const threadAt = (solution: Solution): ReadonlyMap<string, string> =>
    new Map<string, string>(
      solution.flatMap((thread: Thread): [string, string][] =>
        thread.squares.map((square: Point): [string, string] => [
          `${thread.colour} ${formatPoint(square)}`,
          JSON.stringify(thread.squares),
        ]),
      ),
    );
  const firstAt: ReadonlyMap<string, string> = threadAt(first);
  const secondAt: ReadonlyMap<string, string> = threadAt(second);
  return uniquePoints(
    first.flatMap((thread: Thread): Point[] =>
      thread.squares.filter(
        (square: Point): boolean =>
          firstAt.get(`${thread.colour} ${formatPoint(square)}`) !==
          secondAt.get(`${thread.colour} ${formatPoint(square)}`),
      ),
    ),
  );
}

/**
 * Splits the longest thread through the trouble squares, as near its middle as a cut can go.
 * Undefined if none of them can be split.
 */
function splitTrouble(
  grid: Grid,
  threads: Solution,
  trouble: readonly Point[],
): Solution | undefined {
  const troubleKeys: ReadonlySet<string> = new Set<string>(trouble.map(formatPoint));
  const target: Thread | undefined = threads
    .filter(
      (thread: Thread): boolean =>
        cutsOf(grid, thread).length > 0 &&
        thread.squares.some((square: Point): boolean => troubleKeys.has(formatPoint(square))),
    )
    .reduce<Thread | undefined>(
      (longest: Thread | undefined, thread: Thread): Thread =>
        longest && longest.squares.length >= thread.squares.length ? longest : thread,
      undefined,
    );
  if (!target) return undefined;
  const middle: number = (target.squares.length - 1) / 2;
  const cut: number = cutsOf(grid, target).reduce((best: number, index: number): number =>
    Math.abs(index + 0.5 - middle) < Math.abs(best + 0.5 - middle) ? index : best,
  );
  const pieces: readonly Thread[] = [
    { colour: target.colour, squares: target.squares.slice(0, cut + 1) },
    { colour: target.colour, squares: target.squares.slice(cut + 1) },
  ];
  return toSolution(
    [...threads.filter((thread: Thread): boolean => thread !== target), ...pieces],
    grid.width,
  );
}

/** Indexes `i` where cutting between squares `i` and `i + 1` leaves both new ends off crossings. */
function cutsOf(grid: Grid, thread: Thread): readonly number[] {
  return thread.squares.slice(0, -1).flatMap((square: Point, index: number): number[] => {
    const next: Point | undefined = thread.squares[index + 1];
    return next &&
      !isCrossing(grid, squareOf(grid, square)) &&
      !isCrossing(grid, squareOf(grid, next))
      ? [index]
      : [];
  });
}

function puzzleOf(picture: Picture, threads: Solution): Puzzle {
  return { ...picture, pegs: pegsOf(threads) };
}

function gridOf(picture: Picture): Grid {
  return {
    width: picture.width,
    height: picture.height,
    squares: picture.pattern.flat(),
    lengths: picture.lengths,
  };
}

function uniquePoints(points: readonly Point[]): readonly Point[] {
  const byKey: Map<string, Point> = new Map<string, Point>(
    points.map((point: Point): [string, Point] => [formatPoint(point), point]),
  );
  return [...byKey.values()].sort((a: Point, b: Point): number => a.y - b.y || a.x - b.x);
}

function squareOf(grid: Grid, point: Point): number {
  return point.y * grid.width + point.x;
}

function pointOf(point: Point): Point {
  return { x: point.x, y: point.y };
}

/**
 * Two-colour squares that touch share a colour, and a shared colour runs the same way through
 * both, so choosing one square's direction settles its whole group. Each group has two choices.
 */
function orientCrossings(grid: Grid): Found<Orientation> {
  const orientation: Map<number, ThreadColour> = new Map<number, ThreadColour>();
  const bad: number[] = [];
  for (const start of grid.squares.keys()) {
    if (!isCrossing(grid, start) || orientation.has(start) || bad.includes(start)) continue;
    const group: readonly number[] = crossingGroup(grid, start);
    const fit: Orientation | undefined = coloursAt(grid, start)
      .map((across: ThreadColour): Orientation | undefined =>
        orientGroup(grid, group, start, across),
      )
      .find((choice: Orientation | undefined): boolean => choice !== undefined);
    if (fit) for (const [square, across] of fit) orientation.set(square, across);
    else bad.push(...group);
  }
  return bad.length > 0 ? { ok: false, bad } : { ok: true, value: orientation };
}

function crossingGroup(grid: Grid, start: number): readonly number[] {
  const group: number[] = [start];
  for (let i: number = 0; i < group.length; i++) {
    for (const next of neighbours(grid, group[i] ?? start)) {
      if (isCrossing(grid, next) && !group.includes(next)) group.push(next);
    }
  }
  return group;
}

/**
 * Undefined if `startAcross` running across `start` leaves some colour with nowhere to go. The
 * group is in breadth-first order from `start`, so each square is oriented before it's checked.
 */
function orientGroup(
  grid: Grid,
  group: readonly number[],
  start: number,
  startAcross: ThreadColour,
): Orientation | undefined {
  const orientation: Map<number, ThreadColour> = new Map<number, ThreadColour>([
    [start, startAcross],
  ]);
  for (const square of group) {
    const across: ThreadColour | undefined = orientation.get(square);
    if (across === undefined) return undefined;
    const colours: readonly ThreadColour[] = coloursAt(grid, square);
    const down: ThreadColour | undefined = colours.find(
      (colour: ThreadColour): boolean => colour !== across,
    );
    if (down === undefined || !continuesBothWays(grid, square, across, true)) return undefined;
    if (!continuesBothWays(grid, square, down, false)) return undefined;
    for (const next of neighbours(grid, square)) {
      if (!group.includes(next)) continue;
      const nextColours: readonly ThreadColour[] = coloursAt(grid, next);
      const shared: ThreadColour | undefined = nextColours.find((colour: ThreadColour): boolean =>
        colours.includes(colour),
      );
      const nextAcross: ThreadColour | undefined =
        shared === across
          ? shared
          : nextColours.find((colour: ThreadColour): boolean => colour !== shared);
      const known: ThreadColour | undefined = orientation.get(next);
      if (nextAcross === undefined || (known !== undefined && known !== nextAcross))
        return undefined;
      orientation.set(next, nextAcross);
    }
  }
  return orientation;
}

function continuesBothWays(
  grid: Grid,
  square: number,
  colour: ThreadColour,
  across: boolean,
): boolean {
  const ends: readonly number[] = axisNeighbours(grid, square, across);
  return (
    ends.length === 2 &&
    ends.every((next: number): boolean => coloursAt(grid, next).includes(colour))
  );
}

/** Both neighbours along an axis, or none on the edge of the grid. */
function axisNeighbours(grid: Grid, square: number, across: boolean): readonly number[] {
  const x: number = square % grid.width;
  const y: number = Math.floor(square / grid.width);
  if (across) return x > 0 && x < grid.width - 1 ? [square - 1, square + 1] : [];
  return y > 0 && y < grid.height - 1 ? [square - grid.width, square + grid.width] : [];
}

/** The threads crossings force: straight through each band and out to the squares either side. */
function forcedPaths(
  grid: Grid,
  orientation: Orientation,
  colour: ThreadColour,
): Found<readonly (readonly number[])[]> {
  const links: Map<number, number[]> = new Map<number, number[]>();
  const link = (a: number, b: number): void => {
    const fromA: number[] = links.get(a) ?? [];
    if (!fromA.includes(b)) fromA.push(b);
    links.set(a, fromA);
  };
  for (const [square, across] of orientation) {
    if (!coloursAt(grid, square).includes(colour)) continue;
    for (const end of axisNeighbours(grid, square, across === colour)) {
      link(square, end);
      link(end, square);
    }
  }

  const bad: number[] = [...links].flatMap(([square, linked]: [number, number[]]): number[] =>
    linked.length > 2 ? [square] : [],
  );
  if (bad.length > 0) return { ok: false, bad };

  const paths: number[][] = [];
  const traced: Set<number> = new Set<number>();
  for (const [start, linked] of links) {
    if (linked.length !== 1 || traced.has(start)) continue;
    const path: number[] = [start];
    let previous: number | undefined;
    let current: number = start;
    for (;;) {
      traced.add(current);
      const next: number | undefined = (links.get(current) ?? []).find(
        (square: number): boolean => square !== previous,
      );
      if (next === undefined) break;
      path.push(next);
      previous = current;
      current = next;
    }
    paths.push(path);
  }
  // A ring of bands has no ends to trace from, and so nowhere for its pegs.
  const ring: number[] = [...links.keys()].filter((square: number): boolean => !traced.has(square));
  return ring.length > 0 ? { ok: false, bad: ring } : { ok: true, value: paths };
}

/**
 * Grows the forced threads, then covers the colour's remaining squares. Each new thread starts
 * from the square with the fewest free neighbours and steps to the neighbour with the fewest, so
 * few squares get cut off. One that still ends up alone joins a neighbouring thread's end if it
 * can, or becomes a length-1 thread.
 */
function layColour(
  grid: Grid,
  colour: ThreadColour,
  forced: readonly (readonly number[])[],
  rng: Rng,
): readonly (readonly number[])[] {
  const taken: ReadonlySet<number> = new Set<number>(forced.flat());
  const free: Set<number> = new Set<number>(
    [...grid.squares.keys()].filter(
      (square: number): boolean => grid.squares[square] === colour && !taken.has(square),
    ),
  );
  const freeNeighbours = (square: number): number =>
    neighbours(grid, square).filter((next: number): boolean => free.has(next)).length;
  const mostCutOff = (squares: readonly number[]): number | undefined =>
    squares.reduce<number | undefined>(
      (best: number | undefined, square: number): number =>
        best === undefined || freeNeighbours(square) < freeNeighbours(best) ? square : best,
      undefined,
    );
  const grow = (path: number[]): void => {
    const target: number = randomInt(rng, grid.lengths.min, grid.lengths.max);
    for (const atEnd of [true, false]) {
      while (path.length < target) {
        const end: number | undefined = atEnd ? path.at(-1) : path[0];
        const options: readonly number[] = neighbours(grid, end ?? -1).filter(
          (next: number): boolean => free.has(next),
        );
        const next: number | undefined = mostCutOff(shuffled(rng, options));
        if (next === undefined) break;
        free.delete(next);
        if (atEnd) path.push(next);
        else path.unshift(next);
      }
    }
  };

  const paths: number[][] = forced.map((path: readonly number[]): number[] => [...path]);
  for (const path of paths) grow(path);
  const order: readonly number[] = shuffled(rng, [...free]);
  for (;;) {
    const start: number | undefined = mostCutOff(
      order.filter((square: number): boolean => free.has(square)),
    );
    if (start === undefined) break;
    free.delete(start);
    const path: number[] = [start];
    grow(path);
    if (path.length > 1 || !joinNeighbour(grid, paths, start)) paths.push(path);
  }
  return paths;
}

/** Adds a lone square to the end of a neighbouring thread with room for it. */
function joinNeighbour(grid: Grid, paths: number[][], square: number): boolean {
  const nearby: ReadonlySet<number> = new Set<number>(neighbours(grid, square));
  for (const path of paths) {
    if (path.length >= grid.lengths.max) continue;
    if (nearby.has(path.at(-1) ?? -1)) {
      path.push(square);
      return true;
    }
    if (nearby.has(path[0] ?? -1)) {
      path.unshift(square);
      return true;
    }
  }
  return false;
}

function pegsOf(threads: Solution): readonly Peg[] {
  const pegs: Peg[] = threads.flatMap((thread: Thread): Peg[] => {
    const length: number = thread.squares.length;
    const ends: readonly (Point | undefined)[] =
      length === 1 ? [thread.squares[0]] : [thread.squares[0], thread.squares.at(-1)];
    return ends.flatMap((end: Point | undefined): Peg[] =>
      end ? [{ x: end.x, y: end.y, colour: thread.colour, length }] : [],
    );
  });
  return pegs.sort((a: Peg, b: Peg): number => a.y - b.y || a.x - b.x);
}

function threadOf(grid: Grid, path: ColourPath): Thread {
  return {
    colour: path.colour,
    squares: path.squares.map((square: number): Point => pointAt(grid, square)),
  };
}

function badLaying(grid: Grid, squares: readonly number[]): Laying {
  const unique: readonly number[] = [...new Set<number>(squares)].sort(
    (a: number, b: number): number => a - b,
  );
  return { ok: false, badSquares: unique.map((square: number): Point => pointAt(grid, square)) };
}

function neighbours(grid: Grid, square: number): number[] {
  return neighbourSquares(grid.width, grid.height, square);
}

function coloursAt(grid: Grid, square: number): readonly ThreadColour[] {
  return threadsThrough(grid.squares[square] ?? "blank");
}

function isCrossing(grid: Grid, square: number): boolean {
  return coloursAt(grid, square).length === 2;
}

function pointAt(grid: Grid, square: number): Point {
  return { x: square % grid.width, y: Math.floor(square / grid.width) };
}
