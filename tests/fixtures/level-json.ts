import type { LevelFile, PegEntry } from "../../src/core/level-decoder.ts";

export type PegTriple = readonly [x: number, y: number, length: number];

export function levelJson(pattern: readonly string[], pegs: readonly PegTriple[]): LevelFile {
  return {
    version: 2,
    id: "test",
    title: "Test",
    pattern,
    pegs: pegs.map(([x, y, length]: PegTriple): PegEntry => ({ x, y, length })),
  };
}
