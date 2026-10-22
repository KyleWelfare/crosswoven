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

export function pegAt(puzzle: Puzzle, square: Point): Peg | undefined {
  return puzzle.pegs.find((peg: Peg): boolean => peg.x === square.x && peg.y === square.y);
}

export function onBoard(puzzle: Puzzle, square: Point): boolean {
  return square.x >= 0 && square.y >= 0 && square.x < puzzle.width && square.y < puzzle.height;
}

/** Drops a peg's colour and length, so it compares equal to a plain point. */
export function positionOf(peg: Peg): Point {
  return { x: peg.x, y: peg.y };
}

export function formatPoint(point: Point): string {
  return `(${String(point.x)}, ${String(point.y)})`;
}

/** Squares are numbered in reading order, `y * width + x`. */
export function neighbourSquares(width: number, height: number, square: number): number[] {
  const x: number = square % width;
  const y: number = Math.floor(square / width);
  const found: number[] = [];
  if (x + 1 < width) found.push(square + 1);
  if (y + 1 < height) found.push(square + width);
  if (x > 0) found.push(square - 1);
  if (y > 0) found.push(square - width);
  return found;
}
