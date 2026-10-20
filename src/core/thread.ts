import type { Point, Puzzle, ThreadColour } from "./puzzle.ts";

export interface Thread {
  readonly colour: ThreadColour;
  /** From one peg to the other, both included. */
  readonly squares: readonly Point[];
}

/**
 * Threads ordered by their first square in reading order (left to right, top to bottom), each
 * starting from whichever of its pegs comes first. Two equal solutions are deeply equal.
 */
export type Solution = readonly Thread[];

/** Whether a colour's thread joins two neighbouring squares, numbered `y * width + x`. */
export type LinkTest = (colour: ThreadColour, a: number, b: number) => boolean;

/** Follows each thread on a finished board from its first peg in reading order. */
export function readThreads(puzzle: Puzzle, linked: LinkTest): Solution {
  const width: number = puzzle.width;
  const pegSquares: Map<number, ThreadColour> = new Map<number, ThreadColour>(
    puzzle.pegs.map((peg: Point & { colour: ThreadColour }): [number, ThreadColour] => [
      peg.y * width + peg.x,
      peg.colour,
    ]),
  );
  const starts: number[] = [...pegSquares.keys()].sort((a: number, b: number): number => a - b);
  const tied: Set<number> = new Set<number>();
  const threads: Thread[] = [];

  for (const start of starts) {
    const colour: ThreadColour | undefined = pegSquares.get(start);
    if (colour === undefined || tied.has(start)) continue;
    const path: number[] = [start];
    let previous: number = -1;
    let current: number = start;
    do {
      const next: number | undefined = neighbours(puzzle, current).find(
        (square: number): boolean => square !== previous && linked(colour, current, square),
      );
      if (next === undefined) {
        throw new Error(`${colour} thread from square ${String(start)} has a loose end`);
      }
      previous = current;
      current = next;
      path.push(current);
    } while (!pegSquares.has(current));
    tied.add(current);
    threads.push({
      colour,
      squares: path.map((square: number): Point => ({
        x: square % width,
        y: Math.floor(square / width),
      })),
    });
  }
  return threads;
}

function neighbours(puzzle: Puzzle, square: number): number[] {
  const x: number = square % puzzle.width;
  const y: number = Math.floor(square / puzzle.width);
  const found: number[] = [];
  if (x + 1 < puzzle.width) found.push(square + 1);
  if (y + 1 < puzzle.height) found.push(square + puzzle.width);
  if (x > 0) found.push(square - 1);
  if (y > 0) found.push(square - puzzle.width);
  return found;
}
