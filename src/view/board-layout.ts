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

/** The layout for the canvas at its current CSS size, so drawing and input agree on the squares. */
export function canvasLayout(canvas: HTMLCanvasElement, puzzle: Puzzle): BoardLayout {
  const ratio: number = window.devicePixelRatio;
  return layoutBoard(
    puzzle,
    Math.round(canvas.clientWidth * ratio),
    Math.round(canvas.clientHeight * ratio),
    ratio,
  );
}

export function squareOrigin(layout: BoardLayout, square: Point): Point {
  return { x: layout.left + square.x * layout.cell, y: layout.top + square.y * layout.cell };
}

/** The square under a point in device pixels, which may be off the board. */
export function squareAt(layout: BoardLayout, point: Point): Point {
  return {
    x: Math.floor((point.x - layout.left) / layout.cell),
    y: Math.floor((point.y - layout.top) / layout.cell),
  };
}
