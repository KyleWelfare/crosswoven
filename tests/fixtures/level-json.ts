import type { Point } from "../../src/core/puzzle.ts";

export interface LevelJson {
  readonly version: number;
  readonly id: string;
  readonly title: string;
  readonly pattern: readonly string[];
  readonly pegs: readonly Point[];
}

export function levelJson(
  pattern: readonly string[],
  pegs: readonly (readonly [number, number])[],
): LevelJson {
  return {
    version: 1,
    id: "test",
    title: "Test",
    pattern,
    pegs: pegs.map(([x, y]: readonly [number, number]): Point => ({ x, y })),
  };
}
