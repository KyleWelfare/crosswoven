import { decodeLevel, type DecodeResult } from "../../src/core/level-decoder.ts";
import type { Point, Puzzle } from "../../src/core/puzzle.ts";

export function puzzleOf(
  pattern: readonly string[],
  pegs: readonly (readonly [number, number])[],
): Puzzle {
  return decoded({
    version: 1,
    id: "test",
    title: "Test",
    pattern,
    pegs: pegs.map(([x, y]: readonly [number, number]): Point => ({ x, y })),
  });
}

export function decoded(json: unknown): Puzzle {
  const result: DecodeResult = decodeLevel(json);
  if (!result.ok) throw new Error(result.errors.join("; "));
  return result.puzzle;
}
