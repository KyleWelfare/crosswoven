import type { Puzzle } from "../../src/core/puzzle.ts";
import { findSolutions, type SearchResult } from "../../src/core/search-solver.ts";
import type { Solution } from "../../src/core/thread.ts";

export function allSolutions(puzzle: Puzzle, limit: number): readonly Solution[] {
  const result: SearchResult = findSolutions(puzzle, limit);
  if (!result.ok) throw new Error(`pegs at ${JSON.stringify(result.pegs)} are too open`);
  return result.solutions;
}
