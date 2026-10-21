import type { Point, Puzzle } from "../core/puzzle.ts";

/** Device pixels, so every square starts on a whole pixel and sprites copy without resampling. */
export interface BoardLayout {
  readonly width: number;
  readonly height: number;
  readonly left: number;
  readonly top: number;
  readonly cell: number;
  /** Device pixels per CSS pixel. */
  readonly ratio: number;
}

/** CSS pixels, leaving room for the board's shadow. */
const BOARD_MARGIN: number = 12;

export function layoutBoard(
  puzzle: Puzzle,
  width: number,
  height: number,
  ratio: number,
): BoardLayout {
  const margin: number = BOARD_MARGIN * ratio;
  const cell: number = Math.floor(
    Math.min((width - 2 * margin) / puzzle.width, (height - 2 * margin) / puzzle.height),
  );
  return {
    width,
    height,
    cell,
    left: Math.round((width - cell * puzzle.width) / 2),
    top: Math.round((height - cell * puzzle.height) / 2),
    ratio,
  };
}

export function squareOrigin(layout: BoardLayout, square: Point): Point {
  return { x: layout.left + square.x * layout.cell, y: layout.top + square.y * layout.cell };
}
