import {
  listCandidates,
  solutionOf,
  threadOf,
  type Candidate,
  type CandidateList,
} from "./candidate-paths.ts";
import {
  THREAD_COLOURS,
  threadsThrough,
  type Peg,
  type Point,
  type Puzzle,
  type SquareColour,
  type ThreadColour,
} from "./puzzle.ts";
import type { Solution, Thread } from "./thread.ts";

export type Rule = "partner" | "only-path" | "shared" | "only-reach";

/** A third tier waits on playtesting the level pack; see the open questions in DESIGN.md. */
export type Difficulty = "easy" | "medium";

/** Easiest first: the solver always uses the earliest rule that makes progress. */
export const RULES: readonly Rule[] = ["partner", "only-path", "shared", "only-reach"];

export const RULE_DIFFICULTY: Readonly<Record<Rule, Difficulty>> = {
  partner: "easy",
  "only-path": "easy",
  shared: "medium",
  "only-reach": "medium",
};

export interface Step {
  readonly rule: Rule;
  readonly colour: ThreadColour;
  /** The peg or square the rule reasoned about, for the hint's reason. */
  readonly at: Point;
  /** Paths that can't be in the solution, as the threads they would have been. */
  readonly ruledOut: readonly Thread[];
}

export type LogicResult =
  | {
      readonly status: "solved";
      readonly steps: readonly Step[];
      readonly difficulty: Difficulty;
      readonly solution: Solution;
    }
  /** No rule applies, so the puzzle needs guessing. `unsettled` pegs still have more than one path. */
  | {
      readonly status: "stuck";
      readonly steps: readonly Step[];
      readonly unsettled: readonly Point[];
    }
  /** The puzzle has no solution. */
  | { readonly status: "contradiction"; readonly steps: readonly Step[] }
  | { readonly status: "too-open"; readonly pegs: readonly [Peg, Peg] };

/**
 * Squares are numbered `y * width + x`. A slot is one colour's thread at one square, numbered
 * `square * THREAD_COLOURS.length + colour`.
 */
interface Board {
  readonly puzzle: Puzzle;
  readonly candidates: readonly Candidate[];
  /** 1 while a candidate is still possible. */
  readonly alive: Uint8Array;
  readonly byPeg: readonly (readonly number[])[];
  readonly bySlot: readonly (readonly number[])[];
  /** Slots the pattern asks for: each needs exactly one thread. */
  readonly slots: readonly number[];
  readonly steps: Step[];
}

const applyRule: Readonly<Record<Rule, (board: Board) => boolean>> = {
  partner: applyPartner,
  "only-path": applyOnlyPath,
  shared: applyShared,
  "only-reach": applyOnlyReach,
};

/** Solves by deduction alone, recording each step. `rules` limits which rules it may use. */
export function solveLogically(puzzle: Puzzle, rules: readonly Rule[] = RULES): LogicResult {
  const list: CandidateList = listCandidates(puzzle);
  if (!list.ok) return { status: "too-open", pegs: list.pegs };
  const board: Board = createBoard(puzzle, list.candidates);
  const allowed: readonly Rule[] = RULES.filter((rule: Rule): boolean => rules.includes(rule));

  while (!hasContradiction(board) && !isSolved(board)) {
    const progressed: boolean = allowed.some((rule: Rule): boolean => applyRule[rule](board));
    if (!progressed) break;
  }

  if (hasContradiction(board)) return { status: "contradiction", steps: board.steps };
  if (!isSolved(board)) {
    return { status: "stuck", steps: board.steps, unsettled: unsettledPegs(board) };
  }
  return {
    status: "solved",
    steps: board.steps,
    difficulty: board.steps.some((step: Step): boolean => RULE_DIFFICULTY[step.rule] === "medium")
      ? "medium"
      : "easy",
    solution: solutionOf(
      puzzle.width,
      liveIn(board, [...board.candidates.keys()]).map((row: number): Candidate =>
        candidateAt(board, row),
      ),
    ),
  };
}

function createBoard(puzzle: Puzzle, candidates: readonly Candidate[]): Board {
  const squares: readonly SquareColour[] = puzzle.pattern.flat();
  const byPeg: number[][] = puzzle.pegs.map((): number[] => []);
  const bySlot: number[][] = Array.from(
    { length: squares.length * THREAD_COLOURS.length },
    (): number[] => [],
  );
  candidates.forEach((candidate: Candidate, row: number): void => {
    const [first, second]: readonly [number, number] = candidate.pegs;
    byPeg[first]?.push(row);
    if (second !== first) byPeg[second]?.push(row);
    for (const square of candidate.squares) bySlot[slotOf(square, candidate.colour)]?.push(row);
  });
  return {
    puzzle,
    candidates,
    alive: new Uint8Array(candidates.length).fill(1),
    byPeg,
    bySlot,
    slots: squares.flatMap((square: SquareColour, index: number): number[] =>
      threadsThrough(square).map((colour: ThreadColour): number => slotOf(index, colour)),
    ),
    steps: [],
  };
}

/** A peg whose paths all lead to one partner pairs with it, so the partner's other paths go. */
function applyPartner(board: Board): boolean {
  return board.puzzle.pegs.some((peg: Peg, index: number): boolean => {
    if (peg.length === 1) return false;
    const partners: ReadonlySet<number> = new Set<number>(
      liveIn(board, board.byPeg[index]).map((row: number): number => partnerOf(board, row, index)),
    );
    const partner: number | undefined = partners.size === 1 ? [...partners][0] : undefined;
    if (partner === undefined) return false;
    const elsewhere: readonly number[] = liveIn(board, board.byPeg[partner]).filter(
      (row: number): boolean => partnerOf(board, row, partner) !== index,
    );
    return ruleOut(board, "partner", peg.colour, pointOf(peg), elsewhere);
  });
}

/** A peg with one path left is fixed, so every path sharing a peg or a slot with it goes. */
function applyOnlyPath(board: Board): boolean {
  return board.puzzle.pegs.some((peg: Peg, index: number): boolean => {
    const rows: readonly number[] = liveIn(board, board.byPeg[index]);
    const only: number | undefined = rows[0];
    if (rows.length !== 1 || only === undefined) return false;
    const candidate: Candidate = candidateAt(board, only);
    const clashes: readonly number[] = liveIn(board, [
      ...candidate.pegs.flatMap(
        (pegIndex: number): readonly number[] => board.byPeg[pegIndex] ?? [],
      ),
      ...candidate.squares.flatMap(
        (square: number): readonly number[] => board.bySlot[slotOf(square, candidate.colour)] ?? [],
      ),
    ]).filter((row: number): boolean => row !== only);
    return ruleOut(board, "only-path", peg.colour, pointOf(peg), clashes);
  });
}

/** Squares on every remaining path of a peg are its own, so other threads of its colour lose them. */
function applyShared(board: Board): boolean {
  return board.puzzle.pegs.some((peg: Peg, index: number): boolean => {
    const paths: readonly (readonly number[])[] = liveIn(board, board.byPeg[index]).map(
      (row: number): readonly number[] => candidateAt(board, row).squares,
    );
    const [first, ...rest]: readonly (readonly number[])[] = paths;
    if (!first) return false;
    const shared: readonly number[] = first.filter((square: number): boolean =>
      rest.every((squares: readonly number[]): boolean => squares.includes(square)),
    );
    const others: readonly number[] = liveIn(
      board,
      shared.flatMap(
        (square: number): readonly number[] => board.bySlot[slotOf(square, peg.colour)] ?? [],
      ),
    ).filter((row: number): boolean => !candidateAt(board, row).pegs.includes(index));
    return ruleOut(board, "shared", peg.colour, pointOf(peg), others);
  });
}

/** If every path through a slot belongs to one peg, that peg's paths that miss the slot go. */
function applyOnlyReach(board: Board): boolean {
  return board.slots.some((slot: number): boolean => {
    const through: readonly number[] = liveIn(board, board.bySlot[slot]);
    const [first, ...rest]: readonly number[] = through;
    if (first === undefined) return false;
    const owners: readonly number[] = candidateAt(board, first).pegs.filter(
      (peg: number): boolean =>
        rest.every((row: number): boolean => candidateAt(board, row).pegs.includes(peg)),
    );
    return owners.some((owner: number): boolean => {
      const misses: readonly number[] = liveIn(board, board.byPeg[owner]).filter(
        (row: number): boolean => !through.includes(row),
      );
      const square: number = Math.floor(slot / THREAD_COLOURS.length);
      return ruleOut(
        board,
        "only-reach",
        candidateAt(board, first).colour,
        pointAt(board, square),
        misses,
      );
    });
  });
}

/** Rules out `rows` as one step. False if there's nothing to rule out. */
function ruleOut(
  board: Board,
  rule: Rule,
  colour: ThreadColour,
  at: Point,
  rows: readonly number[],
): boolean {
  const unique: readonly number[] = [...new Set<number>(rows)].sort(
    (a: number, b: number): number => a - b,
  );
  if (unique.length === 0) return false;
  for (const row of unique) board.alive[row] = 0;
  board.steps.push({
    rule,
    colour,
    at,
    ruledOut: unique.map((row: number): Thread =>
      threadOf(board.puzzle.width, candidateAt(board, row)),
    ),
  });
  return true;
}

function hasContradiction(board: Board): boolean {
  return (
    board.byPeg.some((rows: readonly number[]): boolean => liveIn(board, rows).length === 0) ||
    board.slots.some((slot: number): boolean => liveIn(board, board.bySlot[slot]).length === 0)
  );
}

/** Each peg and slot down to one path; that each slot has exactly one rules out leftover clashes. */
function isSolved(board: Board): boolean {
  return (
    board.byPeg.every((rows: readonly number[]): boolean => liveIn(board, rows).length === 1) &&
    board.slots.every((slot: number): boolean => liveIn(board, board.bySlot[slot]).length === 1)
  );
}

function liveIn(board: Board, rows: readonly number[] | undefined): number[] {
  return (rows ?? []).filter((row: number): boolean => board.alive[row] === 1);
}

function candidateAt(board: Board, row: number): Candidate {
  const candidate: Candidate | undefined = board.candidates[row];
  if (!candidate) throw new RangeError(`no candidate ${String(row)}`);
  return candidate;
}

function partnerOf(board: Board, row: number, peg: number): number {
  const [first, second]: readonly [number, number] = candidateAt(board, row).pegs;
  return first === peg ? second : first;
}

function slotOf(square: number, colour: ThreadColour): number {
  return square * THREAD_COLOURS.length + THREAD_COLOURS.indexOf(colour);
}

function pointAt(board: Board, square: number): Point {
  return { x: square % board.puzzle.width, y: Math.floor(square / board.puzzle.width) };
}

function pointOf(point: Point): Point {
  return { x: point.x, y: point.y };
}

function unsettledPegs(board: Board): readonly Point[] {
  return board.puzzle.pegs.flatMap((peg: Peg, index: number): Point[] =>
    liveIn(board, board.byPeg[index]).length > 1 ? [pointOf(peg)] : [],
  );
}
