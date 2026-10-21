import fc from "fast-check";
import { THREAD_COLOURS, type Point, type ThreadColour } from "../../src/core/puzzle.ts";
import type { Solution, Thread } from "../../src/core/thread.ts";
import type { LevelJson, PegJson } from "./level-json.ts";

export interface ThreadPlan {
  readonly colour: ThreadColour;
  readonly start: Point;
  /** Indexes into `STEPS`. */
  readonly steps: readonly number[];
}

export interface Weave {
  readonly width: number;
  readonly height: number;
  readonly level: LevelJson;
  /** In the same canonical order as the search solver's solutions. */
  readonly threads: Solution;
}

type Shape = "end" | "across" | "down" | "turn";

interface Occupant {
  readonly colour: ThreadColour;
  readonly shape: Shape;
}

const STEPS: readonly Point[] = [
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
  { x: 0, y: -1 },
];

const patternCodes: ReadonlyMap<string, string> = new Map<string, string>([
  ["", "."],
  ["red", "R"],
  ["blue", "B"],
  ["yellow", "Y"],
  ["blue,red", "P"],
  ["red,yellow", "O"],
  ["blue,yellow", "G"],
]);

/**
 * Lays each planned thread in turn, skipping steps that would break a rule, so any plan gives a
 * board the rules allow. The threads are then a solution to the level derived from them.
 */
export function weave(width: number, height: number, plans: readonly ThreadPlan[]): Weave {
  const threads: Thread[] = [];
  for (const plan of plans) {
    const board: readonly (readonly Occupant[])[] = boardOf(width, height, threads);
    const squares: readonly Point[] | undefined = layThread(board, width, height, plan);
    if (squares) threads.push({ colour: plan.colour, squares });
  }
  return {
    width,
    height,
    level: levelOf(width, height, threads),
    threads: canonical(threads, width),
  };
}

/** Small boards, so the search solver can usually list every solution. */
export const randomWeaves: fc.Arbitrary<Weave> = fc
  .record({
    width: fc.integer({ min: 5, max: 7 }),
    height: fc.integer({ min: 5, max: 7 }),
    plans: fc.array(
      fc.record({
        colour: fc.constantFrom<ThreadColour>(...THREAD_COLOURS),
        start: fc.record({ x: fc.nat(6), y: fc.nat(6) }),
        steps: fc.array(fc.integer({ min: 0, max: 3 }), { maxLength: 16 }),
      }),
      { maxLength: 8 },
    ),
  })
  .map((input: { width: number; height: number; plans: ThreadPlan[] }): Weave =>
    weave(input.width, input.height, input.plans),
  );

/**
 * The level these threads weave. Written independently of the search solver so the two can check
 * each other.
 */
export function levelOf(width: number, height: number, threads: readonly Thread[]): LevelJson {
  const board: readonly (readonly Occupant[])[] = boardOf(width, height, threads);
  const pattern: string[] = [];
  for (let y: number = 0; y < height; y++) {
    const row: string[] = board
      .slice(y * width, (y + 1) * width)
      .map((occupants: readonly Occupant[]): string => patternCode(occupants));
    pattern.push(row.join(""));
  }
  const pegs: PegJson[] = threads.flatMap((thread: Thread): PegJson[] =>
    (thread.squares.length === 1 ? thread.squares : [thread.squares[0], thread.squares.at(-1)])
      .filter((point: Point | undefined): point is Point => point !== undefined)
      .map((point: Point): PegJson => ({ ...point, length: thread.squares.length })),
  );
  pegs.sort((a: PegJson, b: PegJson): number => a.y * width + a.x - (b.y * width + b.x));
  return { version: 2, id: "random", title: "Random", pattern, pegs };
}

/** Rules a set of threads breaks that `levelOf` can't show: bad steps and bent crossings. */
export function ruleBreaks(width: number, height: number, threads: readonly Thread[]): string[] {
  const breaks: string[] = [];
  for (const thread of threads) {
    thread.squares.forEach((square: Point, index: number): void => {
      const next: Point | undefined = thread.squares[index + 1];
      if (next && Math.abs(next.x - square.x) + Math.abs(next.y - square.y) !== 1) {
        breaks.push(`${thread.colour} jumps from (${String(square.x)}, ${String(square.y)})`);
      }
    });
  }
  boardOf(width, height, threads).forEach((occupants: readonly Occupant[], index: number): void => {
    const shapes: string = occupants
      .map((occupant: Occupant): string => occupant.shape)
      .sort()
      .join(",");
    const colours: ReadonlySet<ThreadColour> = new Set<ThreadColour>(
      occupants.map((occupant: Occupant): ThreadColour => occupant.colour),
    );
    if (occupants.length > 2 || colours.size < occupants.length) {
      breaks.push(`square ${String(index)} has ${shapes}`);
    } else if (occupants.length === 2 && shapes !== "across,down") {
      breaks.push(`square ${String(index)} has a bent crossing: ${shapes}`);
    }
  });
  return breaks;
}

function boardOf(width: number, height: number, threads: readonly Thread[]): Occupant[][] {
  const board: Occupant[][] = Array.from({ length: width * height }, (): Occupant[] => []);
  for (const thread of threads) {
    thread.squares.forEach((square: Point, index: number): void => {
      board[square.y * width + square.x]?.push({
        colour: thread.colour,
        shape: shapeAt(thread.squares, index),
      });
    });
  }
  return board;
}

function shapeAt(squares: readonly Point[], index: number): Shape {
  const before: Point | undefined = squares[index - 1];
  const after: Point | undefined = squares[index + 1];
  if (!before || !after) return "end";
  if (before.y === after.y) return "across";
  if (before.x === after.x) return "down";
  return "turn";
}

function layThread(
  board: readonly (readonly Occupant[])[],
  width: number,
  height: number,
  plan: ThreadPlan,
): readonly Point[] | undefined {
  const occupantsAt = (point: Point): readonly Occupant[] => board[point.y * width + point.x] ?? [];
  const start: Point = { x: plan.start.x % width, y: plan.start.y % height };
  if (occupantsAt(start).length > 0) return undefined;

  const path: Point[] = [start];
  const canEnter = (point: Point, step: Point): boolean => {
    if (point.x < 0 || point.y < 0 || point.x >= width || point.y >= height) return false;
    if (path.some((visited: Point): boolean => visited.x === point.x && visited.y === point.y)) {
      return false;
    }
    const occupants: readonly Occupant[] = occupantsAt(point);
    const crossable: Shape = step.y === 0 ? "down" : "across";
    return (
      occupants.length === 0 ||
      (occupants.length === 1 &&
        occupants[0]?.colour !== plan.colour &&
        occupants[0]?.shape === crossable)
    );
  };

  for (const stepIndex of plan.steps) {
    const last: Point = path.at(-1) ?? start;
    const previous: Point | undefined = path.at(-2);
    const crossing: boolean = previous !== undefined && occupantsAt(last).length > 0;
    const step: Point =
      crossing && previous
        ? { x: last.x - previous.x, y: last.y - previous.y }
        : (STEPS[stepIndex] ?? { x: 1, y: 0 });
    const next: Point = { x: last.x + step.x, y: last.y + step.y };
    if (canEnter(next, step)) path.push(next);
    else if (crossing) break;
  }
  // A thread can't end on a crossing: pegs sit on single-colour squares.
  while (path.length > 0 && occupantsAt(path.at(-1) ?? start).length > 0) path.pop();
  return path.length >= 2 ? path : undefined;
}

function patternCode(occupants: readonly Occupant[]): string {
  const key: string = occupants
    .map((occupant: Occupant): string => occupant.colour)
    .sort()
    .join(",");
  return patternCodes.get(key) ?? "?";
}

/** Orders threads the way `Solution` documents, so they compare equal to the solver's. */
export function canonical(threads: readonly Thread[], width: number): Solution {
  const order = (point: Point | undefined): number =>
    point ? point.y * width + point.x : Number.MAX_SAFE_INTEGER;
  return threads
    .map((thread: Thread): Thread =>
      order(thread.squares[0]) <= order(thread.squares.at(-1))
        ? thread
        : { colour: thread.colour, squares: [...thread.squares].reverse() },
    )
    .sort((a: Thread, b: Thread): number => order(a.squares[0]) - order(b.squares[0]));
}
