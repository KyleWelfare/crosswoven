import { decodeLevel, type DecodeResult } from "../../src/core/level-decoder.ts";
import type { Puzzle } from "../../src/core/puzzle.ts";
import { levelJson, type PegTriple } from "./level-json.ts";

export function puzzleOf(pattern: readonly string[], pegs: readonly PegTriple[]): Puzzle {
  return decoded(levelJson(pattern, pegs));
}

/** The pattern is the picture revealed on solving; the player sees only pegs, marks and walls. */
export function hiddenPuzzleOf(pattern: readonly string[], pegs: readonly PegTriple[]): Puzzle {
  return decoded({ ...levelJson(pattern, pegs), hidden: true });
}

export function decoded(json: unknown): Puzzle {
  const result: DecodeResult = decodeLevel(json);
  if (!result.ok) throw new Error(result.errors.join("; "));
  return result.puzzle;
}
