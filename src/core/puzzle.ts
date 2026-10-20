export type ThreadColour = "red" | "blue" | "yellow";

export type MixedColour = "purple" | "orange" | "green";

export type SquareColour = "blank" | ThreadColour | MixedColour;

export interface Point {
  readonly x: number;
  readonly y: number;
}

export interface Peg extends Point {
  readonly colour: ThreadColour;
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
