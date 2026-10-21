import { listCandidates, type Candidate, type CandidateList } from "./candidate-paths.ts";
import {
  RULE_DIFFICULTY,
  solveInRounds,
  type Difficulty,
  type RoundsResult,
  type Step,
} from "./logic-solver.ts";
import type { Puzzle } from "./puzzle.ts";

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

function sum(values: readonly number[]): number {
  return values.reduce((total: number, value: number): number => total + value, 0);
}
