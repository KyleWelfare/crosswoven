import { decodeLevel, type DecodeResult } from "../../src/core/level-decoder.ts";
import type { Puzzle } from "../../src/core/puzzle.ts";
import { levelJson } from "./level-json.ts";

export function puzzleOf(
  pattern: readonly string[],
  pegs: readonly (readonly [number, number])[],
): Puzzle {
  return decoded(levelJson(pattern, pegs));
}

export function decoded(json: unknown): Puzzle {
  const result: DecodeResult = decodeLevel(json);
  if (!result.ok) throw new Error(result.errors.join("; "));
  return result.puzzle;
}
