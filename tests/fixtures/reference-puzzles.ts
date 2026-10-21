import { levelJson, type LevelJson } from "./level-json.ts";

/** Easy: needs the Crossing rule on top of Count. */
export const crossingLevel: LevelJson = levelJson(
  [".BRR.", "RPR..", "RPR..", ".B...", "....."],
  [
    [1, 0, 4],
    [3, 0, 8],
    [2, 2, 8],
    [1, 3, 4],
  ],
);

/** Medium: (3,2) can't link down to (3,3), the other end of its own piece. */
export const loopLevel: LevelJson = levelJson(
  [".....", ".....", "..YYY", "..YYY", "....."],
  [
    [2, 2, 6],
    [2, 3, 6],
  ],
);

/** Medium: the only two pegs sit side by side, but joining them directly would strand the rest. */
export const strandLevel: LevelJson = levelJson(
  [".RRRR", ".RRRR", ".RRRR", "..RR.", "....."],
  [
    [2, 3, 14],
    [3, 3, 14],
  ],
);

/** Unique, but settling which way the left side runs takes a two-step "what if". */
export const guessingLevel: LevelJson = levelJson(
  [".....", "RRRRR", "RR.RR", "RR.RR", "RRRRR"],
  [
    [2, 1, 10],
    [4, 1, 8],
    [3, 3, 8],
    [2, 4, 10],
  ],
);

/** No solution: both threads would have to turn at the crossing. Lengths assume they do. */
export const turningCrossingLevel: LevelJson = levelJson(
  [".....", "..B..", ".RPB.", "..R..", "....."],
  [
    [2, 1, 3],
    [3, 2, 3],
    [1, 2, 3],
    [2, 3, 3],
  ],
);

/** Two solutions: the four pegs pair up across or down. */
export const pairingLevel: LevelJson = levelJson(
  ["RR...", "RR...", ".....", ".....", "....."],
  [
    [0, 0, 2],
    [1, 0, 2],
    [0, 1, 2],
    [1, 1, 2],
  ],
);
