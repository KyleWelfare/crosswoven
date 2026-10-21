import type { Point } from "../../src/core/puzzle.ts";

export interface PegJson extends Point {
  readonly length: number;
}

/** `[x, y, length]` */
export type PegTriple = readonly [number, number, number];

export interface LevelJson {
  readonly version: number;
  readonly id: string;
  readonly title: string;
  readonly pattern: readonly string[];
  readonly pegs: readonly PegJson[];
}

export function levelJson(pattern: readonly string[], pegs: readonly PegTriple[]): LevelJson {
  return {
    version: 2,
    id: "test",
    title: "Test",
    pattern,
    pegs: pegs.map(([x, y, length]: PegTriple): PegJson => ({ x, y, length })),
  };
}
