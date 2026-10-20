import {
  THREAD_COLOURS,
  squareMask,
  type ColourMask,
  type Point,
  type Puzzle,
  type ThreadColour,
} from "./puzzle.ts";
import { readThreads, type Solution } from "./thread.ts";

export type Rule = "count" | "crossing" | "loop" | "strand" | "parity";

export type Difficulty = "easy" | "medium" | "hard";

/** Easiest first: the solver always uses the earliest rule that makes progress. */
export const RULES: readonly Rule[] = ["count", "crossing", "loop", "strand", "parity"];

export const RULE_DIFFICULTY: Readonly<Record<Rule, Difficulty>> = {
  count: "easy",
  crossing: "easy",
  loop: "medium",
  strand: "medium",
  parity: "hard",
};

const DIFFICULTIES: readonly Difficulty[] = ["easy", "medium", "hard"];

export interface Step {
  readonly rule: Rule;
  readonly colour: ThreadColour;
  readonly from: Point;
  readonly to: Point;
  readonly linked: boolean;
  /** The square the rule reasoned about, for the hint's reason. */
  readonly at: Point;
}

export type LogicResult =
  | {
      readonly status: "solved";
      readonly steps: readonly Step[];
      readonly difficulty: Difficulty;
      readonly solution: Solution;
    }
  /** "stuck": no rule applies, so the puzzle needs guessing. "contradiction": it has no solution. */
  | { readonly status: "stuck" | "contradiction"; readonly steps: readonly Step[] };

const UNKNOWN: number = 0;
const LINKED: number = 1;
const BLOCKED: number = 2;

/**
 * Squares are numbered `y * width + x`. Each colour has two links per square, to its right and
 * lower neighbours, at `linkIndex(board, colour, square, axis)`.
 */
interface Board {
  readonly puzzle: Puzzle;
  readonly width: number;
  readonly height: number;
  readonly size: number;
  readonly masks: Uint8Array;
  /** Every (colour, square) pair where the pattern puts that colour's thread. */
  readonly colourSquares: readonly (readonly [number, number])[];
  readonly pegs: Uint8Array;
  readonly links: Uint8Array;
  readonly steps: Step[];
  contradiction: boolean;
}

type Axis = 0 | 1;

const ACROSS: Axis = 0;
const DOWN: Axis = 1;

/** One of a square's four sides. `link` is undefined off the grid, which counts as blocked. */
interface Side {
  readonly link: number | undefined;
  readonly axis: Axis;
}

interface Regions {
  /** Region per square, or -1 for squares outside the colour or already in a finished thread. */
  readonly regionOf: Int32Array;
  readonly freePegs: readonly number[];
}

const applyRule: Readonly<Record<Rule, (board: Board) => boolean>> = {
  count: applyCount,
  crossing: applyCrossing,
  loop: applyLoop,
  strand: applyStrand,
  parity: applyParity,
};

/** Solves by deduction alone, recording each step. `rules` limits which rules it may use. */
export function solveLogically(puzzle: Puzzle, rules: readonly Rule[] = RULES): LogicResult {
  const board: Board = createBoard(puzzle);
  const allowed: readonly Rule[] = RULES.filter((rule: Rule): boolean => rules.includes(rule));

  while (!board.contradiction && board.links.includes(UNKNOWN)) {
    const progressed: boolean = allowed.some((rule: Rule): boolean => applyRule[rule](board));
    if (!progressed) break;
  }
  if (!board.contradiction && !board.links.includes(UNKNOWN)) checkFinished(board);

  if (board.contradiction) return { status: "contradiction", steps: board.steps };
  if (board.links.includes(UNKNOWN)) return { status: "stuck", steps: board.steps };
  return {
    status: "solved",
    steps: board.steps,
    difficulty: hardestDifficulty(board.steps),
    solution: readThreads(puzzle, (colour: ThreadColour, a: number, b: number): boolean => {
      const first: number = Math.min(a, b);
      const axis: Axis = Math.abs(a - b) === 1 ? ACROSS : DOWN;
      const link: number = linkIndex(board, THREAD_COLOURS.indexOf(colour), first, axis);
      return board.links[link] === LINKED;
    }),
  };
}

function createBoard(puzzle: Puzzle): Board {
  const width: number = puzzle.width;
  const size: number = width * puzzle.height;
  const masks: Uint8Array = Uint8Array.from(puzzle.pattern.flat(), squareMask);
  const board: Board = {
    puzzle,
    width,
    height: puzzle.height,
    size,
    masks,
    colourSquares: [...masks.keys()].flatMap((square: number): [number, number][] =>
      coloursIn(masks[square] ?? 0).map((colour: number): [number, number] => [colour, square]),
    ),
    pegs: new Uint8Array(size),
    links: new Uint8Array(size * 2 * THREAD_COLOURS.length).fill(BLOCKED),
    steps: [],
    contradiction: false,
  };
  for (const peg of puzzle.pegs) board.pegs[peg.y * width + peg.x] = 1;
  for (const [colour, square] of board.colourSquares) {
    for (const side of sidesOf(board, colour, square)) {
      const other: number | undefined =
        side.link === undefined ? undefined : otherEnd(board, side.link, square);
      if (side.link !== undefined && other !== undefined && hasColour(board, other, colour)) {
        board.links[side.link] = UNKNOWN;
      }
    }
  }
  return board;
}

function applyCount(board: Board): boolean {
  let progressed: boolean = false;
  for (const [colour, square] of board.colourSquares) {
    const sides: readonly Side[] = sidesOf(board, colour, square);
    const linked: number = countState(board, sides, LINKED);
    const unknown: number = countState(board, sides, UNKNOWN);
    const needed: number = board.pegs[square] === 1 ? 1 : 2;
    if (linked > needed || linked + unknown < needed) {
      board.contradiction = true;
      return false;
    }
    if (unknown === 0 || (linked < needed && linked + unknown > needed)) continue;
    for (const side of sides) {
      if (side.link === undefined || board.links[side.link] !== UNKNOWN) continue;
      progressed = decide(board, side.link, linked < needed, "count", square) || progressed;
    }
  }
  return progressed;
}

function applyCrossing(board: Board): boolean {
  let progressed: boolean = false;
  for (let square: number = 0; square < board.size; square++) {
    const colours: readonly number[] = coloursIn(board.masks[square] ?? 0);
    const first: number | undefined = colours[0];
    const second: number | undefined = colours[1];
    if (first === undefined || second === undefined) continue;

    const firstAcross: boolean | undefined = runsAcross(board, square, first, second);
    if (board.contradiction) return false;
    if (firstAcross === undefined) continue;
    const across: number = firstAcross ? first : second;
    const down: number = firstAcross ? second : first;
    for (const side of sidesOf(board, across, square)) {
      progressed = fix(board, side, side.axis === ACROSS, square) || progressed;
    }
    for (const side of sidesOf(board, down, square)) {
      progressed = fix(board, side, side.axis === DOWN, square) || progressed;
    }
  }
  return progressed;
}

/** Whether the first colour must run across, down (false), or it isn't known yet (undefined). */
function runsAcross(
  board: Board,
  square: number,
  first: number,
  second: number,
): boolean | undefined {
  const shows = (colour: number, axis: Axis, state: number): boolean =>
    sidesOf(board, colour, square).some(
      (side: Side): boolean => side.axis === axis && stateOf(board, side) === state,
    );
  const across: boolean =
    shows(first, ACROSS, LINKED) ||
    shows(first, DOWN, BLOCKED) ||
    shows(second, DOWN, LINKED) ||
    shows(second, ACROSS, BLOCKED);
  const down: boolean =
    shows(first, DOWN, LINKED) ||
    shows(first, ACROSS, BLOCKED) ||
    shows(second, ACROSS, LINKED) ||
    shows(second, DOWN, BLOCKED);
  if (across && down) board.contradiction = true;
  return across === down ? undefined : across;
}

function fix(board: Board, side: Side, linked: boolean, square: number): boolean {
  if (side.link === undefined) {
    if (linked) board.contradiction = true;
    return false;
  }
  return decide(board, side.link, linked, "crossing", square);
}

/**
 * A square picks the links it still needs, but no pick may join two squares of one piece: that
 * would close a loop. Links in every remaining pick are linked; links in none are blocked.
 */
function applyLoop(board: Board): boolean {
  for (const colour of THREAD_COLOURS.keys()) {
    const pieces: Int32Array = piecesOf(board, colour);
    for (const [squareColour, square] of board.colourSquares) {
      if (squareColour !== colour) continue;
      const sides: readonly Side[] = sidesOf(board, colour, square);
      const open: number[] = sides
        .filter((side: Side): boolean => stateOf(board, side) === UNKNOWN)
        .map((side: Side): number => side.link ?? -1);
      const needed: number = (board.pegs[square] === 1 ? 1 : 2) - countState(board, sides, LINKED);
      if (open.length === 0 || needed <= 0) continue;

      const picks: number[][] = combinations(open, needed).filter(
        (pick: readonly number[]): boolean => !closesLoop(board, pieces, square, pick),
      );
      if (picks.length === 0) {
        board.contradiction = true;
        return false;
      }
      for (const link of open) {
        const inAll: boolean = picks.every((pick: readonly number[]): boolean =>
          pick.includes(link),
        );
        const inNone: boolean = picks.every(
          (pick: readonly number[]): boolean => !pick.includes(link),
        );
        if (inAll || inNone) return decide(board, link, inAll, "loop", square);
      }
    }
  }
  return false;
}

function closesLoop(
  board: Board,
  pieces: Int32Array,
  square: number,
  pick: readonly number[],
): boolean {
  const joined: number[] = [
    root(pieces, square),
    ...pick.map((link: number): number => root(pieces, otherEnd(board, link, square))),
  ];
  return new Set(joined).size < joined.length;
}

function combinations(items: readonly number[], size: number): number[][] {
  if (size === 0) return [[]];
  return items.flatMap((item: number, index: number): number[][] =>
    combinations(items.slice(index + 1), size - 1).map((rest: number[]): number[] => [
      item,
      ...rest,
    ]),
  );
}

/**
 * Only the "finishing a thread strands squares" half. Its mirror, "blocking a link strands
 * squares", never fires on a solvable puzzle: a part joined to the rest by one link, with no pegs
 * of its own, can't be woven at all, since a thread passing through needs two ways in and out.
 */
function applyStrand(board: Board): boolean {
  for (const colour of THREAD_COLOURS.keys()) {
    const pieces: Int32Array = piecesOf(board, colour);
    const finished: ReadonlySet<number> = finishedSquares(board, colour, pieces);
    if (strandsAny(regionsOf(board, colour, finished))) {
      board.contradiction = true;
      return false;
    }
    for (const [link, a, b] of unknownLinks(board, colour)) {
      const closed: ReadonlySet<number> | undefined = closedBy(board, colour, pieces, a, b);
      if (closed && strandsAny(regionsOf(board, colour, new Set([...finished, ...closed])))) {
        return decide(board, link, false, "strand", a);
      }
    }
  }
  return false;
}

function applyParity(board: Board): boolean {
  for (const colour of THREAD_COLOURS.keys()) {
    const finished: ReadonlySet<number> = finishedSquares(board, colour, piecesOf(board, colour));
    const regions: Regions = regionsOf(board, colour, finished);
    if (regions.freePegs.some((pegs: number): boolean => pegs % 2 === 1)) {
      board.contradiction = true;
      return false;
    }
    for (const [link, a, b] of unknownLinks(board, colour)) {
      const without: Regions = regionsOf(board, colour, finished, link);
      const regionA: number = without.regionOf[a] ?? -1;
      const regionB: number = without.regionOf[b] ?? -1;
      if (
        regionA !== regionB &&
        (without.freePegs[regionA] ?? 0) % 2 === 1 &&
        (without.freePegs[regionB] ?? 0) % 2 === 1
      ) {
        return decide(board, link, true, "parity", a);
      }
    }
  }
  return false;
}

/** The squares of the thread that linking a and b would finish, if both pieces end at a peg. */
function closedBy(
  board: Board,
  colour: number,
  pieces: Int32Array,
  a: number,
  b: number,
): ReadonlySet<number> | undefined {
  const pieceA: number = root(pieces, a);
  const pieceB: number = root(pieces, b);
  const squares: number[] = [];
  let pegCount: number = 0;
  for (const [squareColour, square] of board.colourSquares) {
    if (squareColour !== colour) continue;
    const piece: number = root(pieces, square);
    if (piece !== pieceA && piece !== pieceB) continue;
    squares.push(square);
    if (board.pegs[square] === 1) pegCount++;
  }
  return pegCount === 2 ? new Set(squares) : undefined;
}

function strandsAny(regions: Regions): boolean {
  return regions.freePegs.includes(0);
}

/** Squares in pieces that already join two pegs. */
function finishedSquares(board: Board, colour: number, pieces: Int32Array): ReadonlySet<number> {
  const pegCount: Map<number, number> = new Map<number, number>();
  for (const [squareColour, square] of board.colourSquares) {
    if (squareColour !== colour || board.pegs[square] !== 1) continue;
    const piece: number = root(pieces, square);
    pegCount.set(piece, (pegCount.get(piece) ?? 0) + 1);
  }
  const finished: Set<number> = new Set<number>();
  for (const [squareColour, square] of board.colourSquares) {
    if (squareColour === colour && pegCount.get(root(pieces, square)) === 2) finished.add(square);
  }
  return finished;
}

/** Where a colour's unfinished squares can still reach, if `skipped` were blocked too. */
function regionsOf(
  board: Board,
  colour: number,
  finished: ReadonlySet<number>,
  skipped: number = -1,
): Regions {
  const regionOf: Int32Array = new Int32Array(board.size).fill(-1);
  const freePegs: number[] = [];
  for (const [squareColour, start] of board.colourSquares) {
    if (squareColour !== colour || finished.has(start) || regionOf[start] !== -1) continue;
    const region: number = freePegs.length;
    let pegs: number = 0;
    const queue: number[] = [start];
    regionOf[start] = region;
    for (let next: number | undefined = queue.pop(); next !== undefined; next = queue.pop()) {
      if (board.pegs[next] === 1) pegs++;
      for (const side of sidesOf(board, colour, next)) {
        if (side.link === undefined || side.link === skipped) continue;
        if (board.links[side.link] === BLOCKED) continue;
        const other: number = otherEnd(board, side.link, next);
        if (finished.has(other) || regionOf[other] !== -1) continue;
        regionOf[other] = region;
        queue.push(other);
      }
    }
    freePegs.push(pegs);
  }
  return { regionOf, freePegs };
}

/** Union-find roots over a colour's linked links. */
function piecesOf(board: Board, colour: number): Int32Array {
  const parent: Int32Array = Int32Array.from(new Int32Array(board.size).keys());
  for (let square: number = 0; square < board.size; square++) {
    for (const axis of [ACROSS, DOWN]) {
      const link: number = linkIndex(board, colour, square, axis);
      if (board.links[link] !== LINKED) continue;
      parent[root(parent, square)] = root(parent, otherEnd(board, link, square));
    }
  }
  return parent;
}

function root(parent: Int32Array, square: number): number {
  let current: number = square;
  while (parent[current] !== current) current = parent[current] ?? current;
  return current;
}

function checkFinished(board: Board): void {
  applyCount(board);
  applyCrossing(board);
  for (const colour of THREAD_COLOURS.keys()) {
    const pieces: Int32Array = piecesOf(board, colour);
    const pegged: Set<number> = new Set<number>();
    for (const [squareColour, square] of board.colourSquares) {
      if (squareColour === colour && board.pegs[square] === 1) pegged.add(root(pieces, square));
    }
    for (const [squareColour, square] of board.colourSquares) {
      if (squareColour === colour && !pegged.has(root(pieces, square))) board.contradiction = true;
    }
  }
}

function decide(board: Board, link: number, linked: boolean, rule: Rule, at: number): boolean {
  const state: number = linked ? LINKED : BLOCKED;
  const current: number | undefined = board.links[link];
  if (current === state) return false;
  if (current !== UNKNOWN) {
    board.contradiction = true;
    return false;
  }
  board.links[link] = state;
  const colour: number = Math.floor(link / (2 * board.size));
  const from: number = Math.floor((link % (2 * board.size)) / 2);
  board.steps.push({
    rule,
    colour: colourName(colour),
    from: pointOf(board, from),
    to: pointOf(board, otherEnd(board, link, from)),
    linked,
    at: pointOf(board, at),
  });
  return true;
}

function hardestDifficulty(steps: readonly Step[]): Difficulty {
  const hardest: number = Math.max(
    0,
    ...steps.map((step: Step): number => DIFFICULTIES.indexOf(RULE_DIFFICULTY[step.rule])),
  );
  return DIFFICULTIES[hardest] ?? "hard";
}

function linkIndex(board: Board, colour: number, square: number, axis: Axis): number {
  return (colour * board.size + square) * 2 + axis;
}

/** The square at the other end of a link from `square`, which must be one of its ends. */
function otherEnd(board: Board, link: number, square: number): number {
  const owner: number = Math.floor((link % (2 * board.size)) / 2);
  const step: number = link % 2 === ACROSS ? 1 : board.width;
  return square === owner ? owner + step : owner;
}

function sidesOf(board: Board, colour: number, square: number): readonly Side[] {
  const x: number = square % board.width;
  const y: number = Math.floor(square / board.width);
  return [
    {
      link: x + 1 < board.width ? linkIndex(board, colour, square, ACROSS) : undefined,
      axis: ACROSS,
    },
    { link: x > 0 ? linkIndex(board, colour, square - 1, ACROSS) : undefined, axis: ACROSS },
    { link: y + 1 < board.height ? linkIndex(board, colour, square, DOWN) : undefined, axis: DOWN },
    {
      link: y > 0 ? linkIndex(board, colour, square - board.width, DOWN) : undefined,
      axis: DOWN,
    },
  ];
}

function stateOf(board: Board, side: Side): number {
  return side.link === undefined ? BLOCKED : (board.links[side.link] ?? BLOCKED);
}

function countState(board: Board, sides: readonly Side[], state: number): number {
  return sides.filter((side: Side): boolean => stateOf(board, side) === state).length;
}

function unknownLinks(board: Board, colour: number): [number, number, number][] {
  const found: [number, number, number][] = [];
  for (let square: number = 0; square < board.size; square++) {
    for (const axis of [ACROSS, DOWN]) {
      const link: number = linkIndex(board, colour, square, axis);
      if (board.links[link] === UNKNOWN) found.push([link, square, otherEnd(board, link, square)]);
    }
  }
  return found;
}

function coloursIn(mask: ColourMask): readonly number[] {
  return [...THREAD_COLOURS.keys()].filter(
    (colour: number): boolean => (mask & (1 << colour)) !== 0,
  );
}

function hasColour(board: Board, square: number, colour: number): boolean {
  return ((board.masks[square] ?? 0) & (1 << colour)) !== 0;
}

function colourName(colour: number): ThreadColour {
  const name: ThreadColour | undefined = THREAD_COLOURS[colour];
  if (name === undefined) throw new RangeError(`no thread colour ${String(colour)}`);
  return name;
}

function pointOf(board: Board, square: number): Point {
  return { x: square % board.width, y: Math.floor(square / board.width) };
}
