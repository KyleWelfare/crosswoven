import { threadsThrough, type Puzzle, type SquareColour } from "../core/puzzle.ts";

/**
 * What a square shows while its level is played. A hidden level keeps its picture back: a blank
 * square is a wall, a two-colour square shows its colours, and any other square is open field.
 */
export type SquareFace = SquareColour | "field" | "wall";

export function faceOf(puzzle: Puzzle, square: SquareColour): SquareFace {
  if (puzzle.hidden !== true) return square;
  if (square === "blank") return "wall";
  return threadsThrough(square).length === 2 ? square : "field";
}
