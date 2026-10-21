import type { LevelFile } from "../../src/core/level-decoder.ts";
import { levelJson } from "./level-json.ts";

/** Easy: (2,0) can only reach (1,0), which frees (1,1) to pair with (1,2). */
export const partnerLevel: LevelFile = levelJson(
  [".BB..", ".B...", ".B...", ".....", "....."],
  [
    [1, 0, 2],
    [2, 0, 2],
    [1, 1, 2],
    [1, 2, 2],
  ],
);

/** Easy: (3,0)'s one path runs through (1,1), so (1,0) can't. */
export const onlyPathLevel: LevelFile = levelJson(
  ["BB.B.", "BBBB.", ".B...", ".....", "....."],
  [
    [1, 0, 3],
    [3, 0, 5],
    [0, 1, 3],
    [1, 2, 5],
  ],
);

/** Medium: every path from (1,0) runs through (1,1), so no other thread may. */
export const sharedLevel: LevelFile = levelJson(
  [".Y...", "YYY..", "YYY..", ".Y...", "....."],
  [
    [1, 0, 4],
    [2, 1, 4],
    [0, 2, 4],
    [1, 3, 4],
  ],
);

/** Medium: only (1,5)'s paths reach (1,6), so its paths that miss it go. */
export const onlyReachLevel: LevelFile = levelJson(
  [".....", ".....", "..YYY", "..YYY", "..YYY", ".YYYY", ".YYYY"],
  [
    [2, 2, 8],
    [3, 3, 9],
    [1, 5, 9],
    [3, 6, 8],
  ],
);

/** Unique, but no rule applies from the start. */
export const guessingLevel: LevelFile = levelJson(
  [".....", "YYYYY", "Y.YYY", "YYYYY", "YYYY."],
  [
    [4, 1, 8],
    [1, 3, 10],
    [4, 3, 10],
    [0, 4, 8],
  ],
);

/** No solution: both threads would have to turn at the crossing. Lengths assume they do. */
export const turningCrossingLevel: LevelFile = levelJson(
  [".....", "..B..", ".RPB.", "..R..", "....."],
  [
    [2, 1, 3],
    [3, 2, 3],
    [1, 2, 3],
    [2, 3, 3],
  ],
);

/** Two solutions: the four pegs pair up across or down. */
export const pairingLevel: LevelFile = levelJson(
  ["RR...", "RR...", ".....", ".....", "....."],
  [
    [0, 0, 2],
    [1, 0, 2],
    [0, 1, 2],
    [1, 1, 2],
  ],
);

/**
 * Unique when shown, since the colours say which way each thread runs through the crossing. Hidden,
 * the mark only says red and yellow cross there, so either can run across: two solutions.
 */
export const loneCrossingLevel: LevelFile = levelJson(
  ["YYR..", "ROR..", "RYY..", ".....", "....."],
  [
    [0, 0, 5],
    [2, 0, 5],
    [0, 2, 5],
    [2, 2, 5],
  ],
);

/** Too open to check: tens of millions of paths join the two corners. */
export const openLevel: LevelFile = levelJson(
  Array.from({ length: 15 }, (): string => "R".repeat(15)),
  [
    [0, 0, 29],
    [14, 14, 29],
  ],
);
