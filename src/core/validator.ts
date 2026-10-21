import { MAX_PATHS_PER_PAIR, type TooOpen } from "./candidate-paths.ts";
import { decodeLevel, type DecodeResult } from "./level-decoder.ts";
import { solveLogically, type Difficulty, type LogicResult } from "./logic-solver.ts";
import { formatPoint, type Peg, type Puzzle } from "./puzzle.ts";
import { findSolutions, type SearchResult } from "./search-solver.ts";
import { sameSolution, type Solution } from "./thread.ts";

export type Rejection = "invalid" | "too-open" | "unsolvable" | "not-unique" | "needs-guessing";

export type Verdict =
  | {
      readonly ok: true;
      readonly puzzle: Puzzle;
      readonly difficulty: Difficulty;
      readonly solution: Solution;
    }
  | { readonly ok: false; readonly rejection: Rejection; readonly errors: readonly string[] };

/** Certifies a level file. Runs in the level pipeline and CI, not in the shipped game. */
export function validateLevel(json: unknown): Verdict {
  const decoded: DecodeResult = decodeLevel(json);
  if (!decoded.ok) return { ok: false, rejection: "invalid", errors: decoded.errors };
  return validatePuzzle(decoded.puzzle);
}

export function validatePuzzle(puzzle: Puzzle): Verdict {
  const search: SearchResult = findSolutions(puzzle, 2);
  if (!search.ok) return reject("too-open", tooOpenError(search));
  const solutions: readonly Solution[] = search.solutions;
  const solution: Solution | undefined = solutions[0];
  if (!solution) return reject("unsolvable", "no way to weave the pattern");
  if (solutions.length > 1) return reject("not-unique", "more than one way to weave the pattern");

  const logic: LogicResult = solveLogically(puzzle);
  // The solvers check each other. Disagreeing on a puzzle with one solution is a solver bug, so it
  // throws: rejecting would let the generator quietly retry past it.
  if (logic.status === "too-open") {
    throw new Error(
      `logic solver found puzzle "${puzzle.id}" too open, but the search solver didn't`,
    );
  }
  if (logic.status !== "solved") {
    if (logic.status === "contradiction") {
      throw new Error(`logic solver found a contradiction in solvable puzzle "${puzzle.id}"`);
    }
    return reject(
      "needs-guessing",
      `no deduction rule applies after ${String(logic.steps.length)} steps`,
    );
  }
  if (!sameSolution(logic.solution, solution)) {
    throw new Error(`logic and search solvers disagree on puzzle "${puzzle.id}"`);
  }
  return { ok: true, puzzle, difficulty: logic.difficulty, solution };
}

function reject(rejection: Rejection, error: string): Verdict {
  return { ok: false, rejection, errors: [error] };
}

function tooOpenError(tooOpen: TooOpen): string {
  const [from, to]: readonly [Peg, Peg] = tooOpen.pegs;
  return `the ${from.colour} pegs at ${formatPoint(from)} and ${formatPoint(to)} have more than ${String(MAX_PATHS_PER_PAIR)} possible paths`;
}
