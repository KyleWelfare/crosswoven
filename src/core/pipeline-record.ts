import { listCandidates, threadOf, type Candidate, type CandidateList } from "./candidate-paths.ts";
import {
  generateLevel,
  puzzleOf,
  type Attempt,
  type Generation,
  type Outcome,
} from "./generator.ts";
import {
  solveInRounds,
  type Difficulty,
  type RoundsResult,
  type Rule,
  type Step,
} from "./logic-solver.ts";
import type { Picture } from "./picture.ts";
import type { Point, Puzzle } from "./puzzle.ts";
import { findSolutions, type SearchResult } from "./search-solver.ts";
import { sameSolution, threadKey, type Solution, type Thread } from "./thread.ts";

/** One laying the generator tried, with what the validator's checks found. */
export interface RecordedLaying {
  readonly puzzle: Puzzle;
  readonly threads: Solution;
  readonly outcome: Outcome;
  /** The other solution the search solver found, for a laying that has two. */
  readonly rival?: Solution;
  /** The squares that got it rejected. */
  readonly trouble: readonly Point[];
}

/** A round of the logic solver: the paths it ruled out, and the threads left with only one. */
export interface RecordedRound {
  readonly rules: readonly Rule[];
  readonly ruledOut: readonly Thread[];
  readonly settled: readonly Thread[];
}

/**
 * Everything How the Puzzles Are Made replays for one picture: each laying in turn, then the accepted level
 * solved round by round. The browser never runs the generator or the search solver, so the
 * slideshow can't fail while someone is watching.
 */
export interface PipelineRecord {
  readonly layings: readonly RecordedLaying[];
  /** Every path a pair of the accepted level's pegs could be joined by. */
  readonly candidates: readonly Thread[];
  /** Paths the search solver tried proving the accepted level has one solution. */
  readonly tried: number;
  /** Threads with only one possible path before any deduction. */
  readonly given: readonly Thread[];
  readonly rounds: readonly RecordedRound[];
  readonly difficulty: Difficulty;
  readonly solution: Solution;
}

/** Undefined if the picture doesn't generate a level. */
export function recordPipeline(picture: Picture): PipelineRecord | undefined {
  const generation: Generation = generateLevel(picture);
  if (!generation.ok) return undefined;
  const puzzle: Puzzle = generation.puzzle;
  const list: CandidateList = listCandidates(puzzle);
  const search: SearchResult = findSolutions(puzzle, 2);
  const solved: RoundsResult = solveInRounds(puzzle);
  if (!list.ok || !search.ok || solved.result.status !== "solved") return undefined;
  const solution: Solution = solved.result.solution;
  const settledAfter: readonly (readonly Thread[])[] = settledByRound(
    puzzle,
    list.candidates,
    solution,
    solved.rounds,
  );
  return {
    layings: generation.attempts.map((attempt: Attempt): RecordedLaying =>
      recordLaying(picture, attempt),
    ),
    candidates: list.candidates.map((candidate: Candidate): Thread =>
      threadOf(puzzle.width, candidate),
    ),
    tried: search.tried,
    given: settledAfter[0] ?? [],
    rounds: solved.rounds.map((round: readonly Step[], i: number): RecordedRound => ({
      rules: [...new Set<Rule>(round.map((step: Step): Rule => step.rule))],
      ruledOut: uniqueThreads(
        round.flatMap((step: Step): readonly Thread[] => step.ruledOut),
        puzzle.width,
      ),
      settled: settledAfter[i + 1] ?? [],
    })),
    difficulty: solved.result.difficulty,
    solution,
  };
}

function recordLaying(picture: Picture, attempt: Attempt): RecordedLaying {
  const puzzle: Puzzle = puzzleOf(picture, attempt.threads);
  const search: SearchResult =
    attempt.outcome === "not-unique"
      ? findSolutions(puzzle, 2)
      : { ok: true, solutions: [], tried: 0 };
  const rival: Solution | undefined = search.ok
    ? search.solutions.find(
        (solution: Solution): boolean => !sameSolution(solution, attempt.threads),
      )
    : undefined;
  return {
    puzzle,
    threads: attempt.threads,
    outcome: attempt.outcome,
    ...(rival ? { rival } : {}),
    trouble: attempt.trouble,
  };
}

/**
 * For the start and after each round, the solution's threads that newly have only one live path,
 * replayed from the paths each round ruled out.
 */
function settledByRound(
  puzzle: Puzzle,
  candidates: readonly Candidate[],
  solution: Solution,
  rounds: readonly (readonly Step[])[],
): readonly (readonly Thread[])[] {
  const keyed: readonly { readonly key: string; readonly candidate: Candidate }[] = candidates.map(
    (candidate: Candidate): { key: string; candidate: Candidate } => ({
      key: threadKey(threadOf(puzzle.width, candidate), puzzle.width),
      candidate,
    }),
  );
  const alive: Set<string> = new Set<string>(keyed.map(({ key }: { key: string }): string => key));
  const pegIndex = (point: Point | undefined): number =>
    puzzle.pegs.findIndex((peg: Point): boolean => peg.x === point?.x && peg.y === point.y);
  const livePaths = (peg: number): number =>
    keyed.filter(
      ({ key, candidate }: { key: string; candidate: Candidate }): boolean =>
        alive.has(key) && candidate.pegs.includes(peg),
    ).length;
  const settled: Set<string> = new Set<string>();
  const newlySettled = (): readonly Thread[] =>
    solution.filter((thread: Thread): boolean => {
      const key: string = threadKey(thread, puzzle.width);
      const ends: readonly number[] = [
        pegIndex(thread.squares[0]),
        pegIndex(thread.squares.at(-1)),
      ];
      if (settled.has(key) || !ends.every((peg: number): boolean => livePaths(peg) === 1))
        return false;
      settled.add(key);
      return true;
    });

  const byRound: (readonly Thread[])[] = [newlySettled()];
  for (const round of rounds) {
    for (const step of round) {
      for (const thread of step.ruledOut) alive.delete(threadKey(thread, puzzle.width));
    }
    byRound.push(newlySettled());
  }
  return byRound;
}

/** A round's steps can rule out the same path twice. */
function uniqueThreads(threads: readonly Thread[], width: number): readonly Thread[] {
  const byKey: Map<string, Thread> = new Map<string, Thread>(
    threads.map((thread: Thread): [string, Thread] => [threadKey(thread, width), thread]),
  );
  return [...byKey.values()];
}
