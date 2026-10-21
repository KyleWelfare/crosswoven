import type { Point, ThreadColour } from "../../src/core/puzzle.ts";
import type { Thread } from "../../src/core/thread.ts";

/** Squares as `[x, y]`. */
export function threadOf(
  colour: ThreadColour,
  ...squares: readonly (readonly [number, number])[]
): Thread {
  return {
    colour,
    squares: squares.map(([x, y]: readonly [number, number]): Point => ({ x, y })),
  };
}
