import {
  listCandidates,
  solutionOf,
  threadOf,
  type Candidate,
  type CandidateList,
} from "./candidate-paths.ts";
import { positionOf, type Peg, type Point, type Puzzle, type ThreadColour } from "./puzzle.ts";
import { joinedPeg, seenMoves, type Seen } from "./sight.ts";
import { SLOTS_PER_SQUARE, slotOf, slotsOf, squareOfSlot, type Slots } from "./slot.ts";
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

export interface RoundsResult {
  readonly result: LogicResult;
  /** `result`'s steps, grouped by the round that took them. */
  readonly rounds: readonly (readonly Step[])[];
}

/** Squares are numbered `y * width + x`, and slots as in Slots. */
interface Board {
  readonly puzzle: Puzzle;
  readonly slots: Slots;
  readonly candidates: readonly Candidate[];
  /** 1 while a candidate is still possible. */
  readonly alive: Uint8Array;
  readonly byPeg: readonly (readonly number[])[];
  readonly bySlot: readonly (readonly number[])[];
}

/** What a rule can rule out, worked out without changing the board. */
interface Finding {
  readonly rule: Rule;
  readonly colour: ThreadColour;
  readonly at: Point;
  /** Candidate rows, sorted and never empty. */
  readonly rows: readonly number[];
}

/** The findings to apply next, or none once nothing applies. */
type Advance = (board: Board, allowed: readonly Rule[]) => readonly Finding[];

/** Each rule looks at one peg, or for only-reach one slot, by its index. */
const findAt: Readonly<Record<Rule, (board: Board, item: number) => Finding | undefined>> = {
  partner: findPartner,
  "only-path": findOnlyPath,
  shared: findShared,
  "only-reach": findOnlyReach,
};

/** `rules` limits which rules it may use. */
export function solveLogically(puzzle: Puzzle, rules: readonly Rule[] = RULES): LogicResult {
  return solve(puzzle, rules, firstFinding).result;
}

/**
 * Solves the way a player scans the whole board before moving on: each round takes every
 * deduction open at its start, from the easiest tier that has any. Ruling paths out never stops
 * a rule from applying, so this ends where solveLogically does, with the same verdict.
 */
export function solveInRounds(puzzle: Puzzle, rules: readonly Rule[] = RULES): RoundsResult {
  return solve(puzzle, rules, roundOfFindings);
}

export interface Look {
  readonly seen: number;
  /** Pegs whose thread isn't finished, so `seen / open` is how much of the board can move. */
  readonly open: number;
}

export interface PlayerResult {
  readonly result: LogicResult;
  /**
   * The rounds of deduction a player needs: each comes once they've run out of moves they can see
   * (sight.ts), and takes every deduction open at that point, easy before medium.
   */
  readonly thinking: readonly (readonly Step[])[];
  /** Each time the player looks the board over, how many pegs they can see a move for. */
  readonly looks: readonly Look[];
}

/**
 * Solves the way a player plays: moves they can see cost nothing, and only running out of them
 * calls for a round of deduction. A long chain of forced moves is one glance to a player, but as
 * many rounds to solveInRounds.
 */
export function solveAsPlayer(puzzle: Puzzle): PlayerResult {
  const list: CandidateList = listCandidates(puzzle);
  if (!list.ok) return { result: { status: "too-open", pegs: list.pegs }, thinking: [], looks: [] };
  const board: Board = createBoard(puzzle, list.candidates);
  const prefixes: number[][] = puzzle.pegs.map((peg: Peg): number[] => [squareOf(puzzle, peg)]);
  const done: boolean[] = puzzle.pegs.map((peg: Peg): boolean => peg.length === 1);
  const thinking: (readonly Step[])[] = [];
  const looks: Look[] = [];
  for (;;) {
    followSight(board, prefixes, done, looks);
    if (hasContradiction(board) || isSolved(board)) break;
    const found: readonly Finding[] = roundOfFindings(board, RULES);
    if (found.length === 0) break;
    thinking.push(found.map((finding: Finding): Step => ruleOut(board, finding)));
    const touched: ReadonlySet<number> = new Set<number>(
      found.flatMap((finding: Finding): number[] =>
        finding.rows.flatMap((row: number): number[] => [...candidateAt(board, row).pegs]),
      ),
    );
    for (const peg of touched) learnPrefix(board, prefixes, done, peg);
  }
  return { result: resultOf(board, thinking.flat()), thinking, looks };
}

function followSight(board: Board, prefixes: number[][], done: boolean[], looks: Look[]): void {
  for (;;) {
    const seen: readonly Seen[] = seenMoves(board.puzzle, prefixes, done);
    if (seen.length === 0) return;
    looks.push({
      seen: seen.length,
      open: done.filter((finished: boolean): boolean => !finished).length,
    });
    for (const { peg, square } of seen) {
      // Two ends that see each other in one look join on the first; the second has nothing left.
      if (done[peg]) continue;
      prefixes[peg]?.push(square);
      const path: readonly number[] = prefixes[peg] ?? [];
      const joined: number | undefined = joinedPeg(board.puzzle, prefixes, done, peg, path);
      if (joined !== undefined) {
        const whole: readonly number[] = [
          ...path,
          ...[...(prefixes[joined] ?? [])].reverse().slice(1),
        ];
        prefixes[peg] = [...whole];
        prefixes[joined] = [...whole].reverse();
        done[peg] = true;
        done[joined] = true;
        keepTo(board, joined, prefixes[joined] ?? []);
      }
      keepTo(board, peg, prefixes[peg] ?? []);
    }
  }
}

/** What a round of deduction showed of a peg's thread: the start every live path shares. */
function learnPrefix(board: Board, prefixes: number[][], done: boolean[], peg: number): void {
  const paths: readonly (readonly number[])[] = liveIn(board, board.byPeg[peg]).map(
    (row: number): readonly number[] => pathFrom(candidateAt(board, row), peg),
  );
  const [first, ...rest]: readonly (readonly number[])[] = paths;
  if (!first) return;
  let shared: number = 0;
  while (
    shared < first.length &&
    rest.every((path: readonly number[]): boolean => path[shared] === first[shared])
  ) {
    shared++;
  }
  if (shared <= (prefixes[peg]?.length ?? 0)) return;
  prefixes[peg] = first.slice(0, shared);
  if (rest.length > 0) return;
  const partner: number = partnerOf(board, liveIn(board, board.byPeg[peg])[0] ?? -1, peg);
  done[peg] = true;
  done[partner] = true;
  prefixes[partner] = [...first].reverse();
}

/** Rules out every path that disagrees with what's known of a peg's thread. */
function keepTo(board: Board, peg: number, prefix: readonly number[]): void {
  const colour: ThreadColour = pegOf(board, peg).colour;
  for (const row of liveIn(board, board.byPeg[peg])) {
    const path: readonly number[] = pathFrom(candidateAt(board, row), peg);
    if (prefix.some((square: number, i: number): boolean => path[i] !== square)) {
      board.alive[row] = 0;
    }
  }
  for (const square of prefix) {
    for (const row of liveIn(board, board.bySlot[slotOf(board.slots, square, colour)])) {
      if (!candidateAt(board, row).pegs.includes(peg)) board.alive[row] = 0;
    }
  }
}

function pathFrom(candidate: Candidate, peg: number): readonly number[] {
  return candidate.pegs[0] === peg ? candidate.squares : [...candidate.squares].reverse();
}

function squareOf(puzzle: Puzzle, point: Point): number {
  return point.y * puzzle.width + point.x;
}

function solve(puzzle: Puzzle, rules: readonly Rule[], advance: Advance): RoundsResult {
  const list: CandidateList = listCandidates(puzzle);
  if (!list.ok) return { result: { status: "too-open", pegs: list.pegs }, rounds: [] };
  const board: Board = createBoard(puzzle, list.candidates);
  const allowed: readonly Rule[] = RULES.filter((rule: Rule): boolean => rules.includes(rule));
  const rounds: (readonly Step[])[] = [];

  while (!hasContradiction(board) && !isSolved(board)) {
    const found: readonly Finding[] = advance(board, allowed);
    if (found.length === 0) break;
    rounds.push(found.map((finding: Finding): Step => ruleOut(board, finding)));
  }
  return { result: resultOf(board, rounds.flat()), rounds };
}

function resultOf(board: Board, steps: readonly Step[]): LogicResult {
  if (hasContradiction(board)) return { status: "contradiction", steps };
  if (!isSolved(board)) return { status: "stuck", steps, unsettled: unsettledPegs(board) };
  return {
    status: "solved",
    steps,
    difficulty: steps.some((step: Step): boolean => RULE_DIFFICULTY[step.rule] === "medium")
      ? "medium"
      : "easy",
    solution: solutionOf(
      board.puzzle.width,
      liveIn(board, [...board.candidates.keys()]).map((row: number): Candidate =>
        candidateAt(board, row),
      ),
    ),
  };
}

function firstFinding(board: Board, allowed: readonly Rule[]): readonly Finding[] {
  for (const rule of allowed) {
    for (let item: number = 0; item < itemCount(board, rule); item++) {
      const found: Finding | undefined = findAt[rule](board, item);
      if (found) return [found];
    }
  }
  return [];
}

/** `allowed` runs easiest first, so a tier's rules are next to each other. */
function roundOfFindings(board: Board, allowed: readonly Rule[]): readonly Finding[] {
  const found: Finding[] = [];
  let tier: Difficulty | undefined;
  for (const rule of allowed) {
    if (RULE_DIFFICULTY[rule] !== tier && found.length > 0) return found;
    tier = RULE_DIFFICULTY[rule];
    for (let item: number = 0; item < itemCount(board, rule); item++) {
      const finding: Finding | undefined = findAt[rule](board, item);
      if (finding) found.push(finding);
    }
  }
  return found;
}

function itemCount(board: Board, rule: Rule): number {
  return rule === "only-reach" ? board.slots.required.length : board.puzzle.pegs.length;
}

function createBoard(puzzle: Puzzle, candidates: readonly Candidate[]): Board {
  const slots: Slots = slotsOf(puzzle);
  const byPeg: number[][] = puzzle.pegs.map((): number[] => []);
  const bySlot: number[][] = Array.from(
    { length: puzzle.width * puzzle.height * SLOTS_PER_SQUARE },
    (): number[] => [],
  );
  candidates.forEach((candidate: Candidate, row: number): void => {
    const [first, second]: readonly [number, number] = candidate.pegs;
    byPeg[first]?.push(row);
    if (second !== first) byPeg[second]?.push(row);
    for (const square of candidate.squares) {
      bySlot[slotOf(slots, square, candidate.colour)]?.push(row);
    }
  });
  return {
    puzzle,
    slots,
    candidates,
    alive: new Uint8Array(candidates.length).fill(1),
    byPeg,
    bySlot,
  };
}

/** A peg whose paths all lead to one partner pairs with it, so the partner's other paths go. */
function findPartner(board: Board, index: number): Finding | undefined {
  const peg: Peg = pegOf(board, index);
  if (peg.length === 1) return undefined;
  const partners: ReadonlySet<number> = new Set<number>(
    liveIn(board, board.byPeg[index]).map((row: number): number => partnerOf(board, row, index)),
  );
  const partner: number | undefined = partners.size === 1 ? [...partners][0] : undefined;
  if (partner === undefined) return undefined;
  const elsewhere: readonly number[] = liveIn(board, board.byPeg[partner]).filter(
    (row: number): boolean => partnerOf(board, row, partner) !== index,
  );
  return finding("partner", peg.colour, positionOf(peg), elsewhere);
}

/** A peg with one path left is fixed, so every path sharing a peg or a slot with it goes. */
function findOnlyPath(board: Board, index: number): Finding | undefined {
  const peg: Peg = pegOf(board, index);
  const rows: readonly number[] = liveIn(board, board.byPeg[index]);
  const only: number | undefined = rows[0];
  if (rows.length !== 1 || only === undefined) return undefined;
  const candidate: Candidate = candidateAt(board, only);
  const clashes: readonly number[] = liveIn(board, [
    ...candidate.pegs.flatMap((pegIndex: number): readonly number[] => board.byPeg[pegIndex] ?? []),
    ...candidate.squares.flatMap(
      (square: number): readonly number[] =>
        board.bySlot[slotOf(board.slots, square, candidate.colour)] ?? [],
    ),
  ]).filter((row: number): boolean => row !== only);
  return finding("only-path", peg.colour, positionOf(peg), clashes);
}

/** Squares on every remaining path of a peg are its own, so other threads lose those slots. */
function findShared(board: Board, index: number): Finding | undefined {
  const peg: Peg = pegOf(board, index);
  const paths: readonly (readonly number[])[] = liveIn(board, board.byPeg[index]).map(
    (row: number): readonly number[] => candidateAt(board, row).squares,
  );
  const [first, ...rest]: readonly (readonly number[])[] = paths;
  if (!first) return undefined;
  const shared: readonly number[] = first.filter((square: number): boolean =>
    rest.every((squares: readonly number[]): boolean => squares.includes(square)),
  );
  const others: readonly number[] = liveIn(
    board,
    shared.flatMap(
      (square: number): readonly number[] =>
        board.bySlot[slotOf(board.slots, square, peg.colour)] ?? [],
    ),
  ).filter((row: number): boolean => !candidateAt(board, row).pegs.includes(index));
  return finding("shared", peg.colour, positionOf(peg), others);
}

/** If every path through a slot belongs to one peg, that peg's paths that miss the slot go. */
function findOnlyReach(board: Board, item: number): Finding | undefined {
  const slot: number | undefined = board.slots.required[item];
  if (slot === undefined) throw new RangeError(`no slot ${String(item)}`);
  const through: readonly number[] = liveIn(board, board.bySlot[slot]);
  const [first, ...rest]: readonly number[] = through;
  if (first === undefined) return undefined;
  const owners: readonly number[] = candidateAt(board, first).pegs.filter((peg: number): boolean =>
    rest.every((row: number): boolean => candidateAt(board, row).pegs.includes(peg)),
  );
  const square: Point = pointAt(board, squareOfSlot(slot));
  for (const owner of owners) {
    const misses: readonly number[] = liveIn(board, board.byPeg[owner]).filter(
      (row: number): boolean => !through.includes(row),
    );
    const found: Finding | undefined = finding(
      "only-reach",
      candidateAt(board, first).colour,
      square,
      misses,
    );
    if (found) return found;
  }
  return undefined;
}

/** Undefined if there's nothing to rule out. */
function finding(
  rule: Rule,
  colour: ThreadColour,
  at: Point,
  rows: readonly number[],
): Finding | undefined {
  if (rows.length === 0) return undefined;
  const unique: readonly number[] = [...new Set<number>(rows)].sort(
    (a: number, b: number): number => a - b,
  );
  return { rule, colour, at, rows: unique };
}

function ruleOut(board: Board, { rule, colour, at, rows }: Finding): Step {
  for (const row of rows) board.alive[row] = 0;
  return {
    rule,
    colour,
    at,
    ruledOut: rows.map((row: number): Thread =>
      threadOf(board.puzzle.width, candidateAt(board, row)),
    ),
  };
}

function hasContradiction(board: Board): boolean {
  return (
    board.byPeg.some((rows: readonly number[]): boolean => liveIn(board, rows).length === 0) ||
    board.slots.required.some(
      (slot: number): boolean => liveIn(board, board.bySlot[slot]).length === 0,
    )
  );
}

/** One live path per slot also means no two live paths clash. */
function isSolved(board: Board): boolean {
  return (
    board.byPeg.every((rows: readonly number[]): boolean => liveIn(board, rows).length === 1) &&
    board.slots.required.every(
      (slot: number): boolean => liveIn(board, board.bySlot[slot]).length === 1,
    )
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

function pegOf(board: Board, index: number): Peg {
  const peg: Peg | undefined = board.puzzle.pegs[index];
  if (!peg) throw new RangeError(`no peg ${String(index)}`);
  return peg;
}

function partnerOf(board: Board, row: number, peg: number): number {
  const [first, second]: readonly [number, number] = candidateAt(board, row).pegs;
  return first === peg ? second : first;
}

function pointAt(board: Board, square: number): Point {
  return { x: square % board.puzzle.width, y: Math.floor(square / board.puzzle.width) };
}

function unsettledPegs(board: Board): readonly Point[] {
  return board.puzzle.pegs.flatMap((peg: Peg, index: number): Point[] =>
    liveIn(board, board.byPeg[index]).length > 1 ? [positionOf(peg)] : [],
  );
}
