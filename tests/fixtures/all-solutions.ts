import type { Puzzle } from "../../src/core/puzzle.ts";
import { findSolutions, type SearchResult } from "../../src/core/search-solver.ts";
import type { Solution } from "../../src/core/thread.ts";

export function allSolutions(puzzle: Puzzle, limit: number): readonly Solution[] {
  const result: SearchResult = findSolutions(puzzle, limit);
  if (!result.ok) throw new Error(`pegs at ${JSON.stringify(result.pegs)} are too open`);
  return result.solutions;
}

export function onlySolution(puzzle: Puzzle): Solution {
  const [solution, ...others]: readonly Solution[] = allSolutions(puzzle, 2);
  if (!solution || others.length > 0) throw new Error("expected exactly one solution");
  return solution;
}
