export type ThreadColour = "red" | "blue" | "yellow";

export type MixedColour = "purple" | "orange" | "green";

export type SquareColour = "blank" | ThreadColour | MixedColour;

export interface Point {
  readonly x: number;
  readonly y: number;
}

export interface Peg extends Point {
  readonly colour: ThreadColour;
  /** Squares in the peg's thread, both pegs included. 1 is a thread on its own. */
  readonly length: number;
}

export interface Puzzle {
  readonly id: string;
  readonly title: string;
  readonly width: number;
  readonly height: number;
  /** Indexed `pattern[y][x]`. */
  readonly pattern: readonly (readonly SquareColour[])[];
  readonly pegs: readonly Peg[];
}

export const THREAD_COLOURS: readonly ThreadColour[] = ["red", "blue", "yellow"];

export const MIN_SIZE: number = 5;
export const MAX_SIZE: number = 15;

const threadsBySquare: Readonly<Record<SquareColour, readonly ThreadColour[]>> = {
  blank: [],
  red: ["red"],
  blue: ["blue"],
  yellow: ["yellow"],
  purple: ["red", "blue"],
  orange: ["red", "yellow"],
  green: ["blue", "yellow"],
};

export function threadsThrough(square: SquareColour): readonly ThreadColour[] {
  return threadsBySquare[square];
}

export function isThreadColour(square: SquareColour): square is ThreadColour {
  return threadsBySquare[square].length === 1;
}

/** Bit `1 << i` is set for `THREAD_COLOURS[i]`: red 1, blue 2, yellow 4. */
export type ColourMask = number;

export function colourBit(colour: ThreadColour): ColourMask {
  return 1 << THREAD_COLOURS.indexOf(colour);
}

export function squareMask(square: SquareColour): ColourMask {
  return threadsThrough(square).reduce(
    (mask: ColourMask, colour: ThreadColour): ColourMask => mask | colourBit(colour),
    0,
  );
}
