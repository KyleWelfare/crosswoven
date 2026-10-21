import { listCandidates, type Candidate, type CandidateList } from "./candidate-paths.ts";
import {
  RULE_DIFFICULTY,
  solveInRounds,
  type Difficulty,
  type RoundsResult,
  type Step,
} from "./logic-solver.ts";
import { threadsThrough, type Point, type Puzzle } from "./puzzle.ts";
import type { Thread } from "./thread.ts";

/**
 * How a puzzle plays, beyond the hardest rule it needs. "Before any deduction" means from the
 * candidate paths alone, which a player sees by looking at the board.
 */
export interface SolveProfile {
  readonly pegs: number;
  /** Pegs with one possible path before any deduction: threads the board gives away. */
  readonly givenPegs: number;
  /** Pegs that could pair with more than one peg before any deduction. */
  readonly pegsWithRivals: number;
  /** Candidate paths per peg before any deduction, on average. */
  readonly pathsPerPeg: number;
  /** The longest chain of reasoning: each round needs what the one before it ruled out. */
  readonly rounds: number;
  readonly mediumRounds: number;
  /** Deductions open per round, on average. Many at once means the player never has to search. */
  readonly stepsPerRound: number;
  readonly difficulty: Difficulty;
  /** Threads in the solution longer than one square. */
  readonly threads: number;
  /**
   * Of those, threads a player reads at a glance instead of deducing, though the solver may take
   * rounds to prove them: ones running in a straight line to a matching number, and ones leaving a
   * peg straight into a band of crossings, which only that peg can reach.
   */
  readonly obviousThreads: number;
}

/** Undefined unless the logic solver finishes the puzzle. */
export function profileSolve(puzzle: Puzzle): SolveProfile | undefined {
  const list: CandidateList = listCandidates(puzzle);
  const solved: RoundsResult = solveInRounds(puzzle);
  if (!list.ok || solved.result.status !== "solved") return undefined;
  const pathCounts: number[] = puzzle.pegs.map((): number => 0);
  const partners: Set<number>[] = puzzle.pegs.map((): Set<number> => new Set<number>());
  for (const candidate of list.candidates) countCandidate(candidate, pathCounts, partners);

  const pegs: number = puzzle.pegs.length;
  const rounds: number = solved.rounds.length;
  const long: readonly Thread[] = solved.result.solution.filter(
    (thread: Thread): boolean => thread.squares.length > 1,
  );
  return {
    pegs,
    givenPegs: pathCounts.filter((count: number): boolean => count === 1).length,
    pegsWithRivals: partners.filter((found: Set<number>): boolean => found.size > 1).length,
    pathsPerPeg: sum(pathCounts) / pegs,
    rounds,
    mediumRounds: solved.rounds.filter((round: readonly Step[]): boolean =>
      round.some((step: Step): boolean => RULE_DIFFICULTY[step.rule] === "medium"),
    ).length,
    stepsPerRound: rounds === 0 ? 0 : solved.result.steps.length / rounds,
    difficulty: solved.result.difficulty,
    threads: long.length,
    obviousThreads: long.filter((thread: Thread): boolean => isObvious(puzzle, thread)).length,
  };
}

function countCandidate(
  { pegs: [first, second] }: Candidate,
  pathCounts: number[],
  partners: Set<number>[],
): void {
  const ends: readonly number[] = first === second ? [first] : [first, second];
  for (const peg of ends) {
    pathCounts[peg] = (pathCounts[peg] ?? 0) + 1;
    partners[peg]?.add(peg === first ? second : first);
  }
}

function isObvious(puzzle: Puzzle, { squares }: Thread): boolean {
  const [first]: readonly Point[] = squares;
  const straight: boolean =
    first !== undefined &&
    (squares.every((square: Point): boolean => square.x === first.x) ||
      squares.every((square: Point): boolean => square.y === first.y));
  return (
    straight ||
    [squares[1], squares.at(-2)].some(
      (square: Point | undefined): boolean =>
        square !== undefined &&
        threadsThrough(puzzle.pattern[square.y]?.[square.x] ?? "blank").length === 2,
    )
  );
}

function sum(values: readonly number[]): number {
  return values.reduce((total: number, value: number): number => total + value, 0);
}
