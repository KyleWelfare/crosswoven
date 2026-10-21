import type { Puzzle, SquareColour, ThreadColour } from "../core/puzzle.ts";
import { squareOrigin, type BoardLayout } from "./board-layout.ts";
import type { Palette } from "./palette.ts";
import { createSprite, type Sprite } from "./sprite-cache.ts";

const pips: Readonly<Record<SquareColour, readonly ThreadColour[]>> = {
  blank: [],
  red: [],
  blue: [],
  yellow: [],
  purple: ["red", "blue"],
  orange: ["red", "yellow"],
  green: ["blue", "yellow"],
};

/** CSS pixels. */
const BOARD_SHADOW_BLUR: number = 5;
const BOARD_SHADOW_OFFSET: number = 1;

/** Fractions of a square. */
const TILE_GAP: number = 0.05;
const TILE_RADIUS: number = 0.1;
const PIP_RADIUS: number = 0.06;
const PIP_INSET: number = 0.17;

/** Everything that only changes with the puzzle, the canvas size or the palette, as one image. */
export function drawBoardLayer(
  puzzle: Puzzle,
  layout: BoardLayout,
  palette: Palette,
): HTMLCanvasElement {
  const { canvas, context }: Sprite = createSprite(layout.width, layout.height);
  const cell: number = layout.cell;
  const gap: number = Math.max(layout.ratio, TILE_GAP * cell);
  const radius: number = TILE_RADIUS * cell;

  context.save();
  context.shadowColor = palette.boardShadow;
  context.shadowBlur = BOARD_SHADOW_BLUR * layout.ratio;
  context.shadowOffsetY = BOARD_SHADOW_OFFSET * layout.ratio;
  context.fillStyle = palette.frame;
  context.beginPath();
  context.roundRect(
    layout.left - gap / 2,
    layout.top - gap / 2,
    puzzle.width * cell + gap,
    puzzle.height * cell + gap,
    radius + gap / 2,
  );
  context.fill();
  context.restore();

  puzzle.pattern.forEach((row: readonly SquareColour[], y: number): void => {
    row.forEach((square: SquareColour, x: number): void => {
      const { x: left, y: top }: { x: number; y: number } = squareOrigin(layout, { x, y });
      context.fillStyle = palette.wash[square];
      context.beginPath();
      context.roundRect(left + gap / 2, top + gap / 2, cell - gap, cell - gap, radius);
      context.fill();
      pips[square].forEach((colour: ThreadColour, i: number): void => {
        const inset: number = i === 0 ? PIP_INSET : 1 - PIP_INSET;
        context.fillStyle = palette.thread[colour];
        context.beginPath();
        context.arc(left + inset * cell, top + PIP_INSET * cell, PIP_RADIUS * cell, 0, 2 * Math.PI);
        context.fill();
      });
    });
  });
  return canvas;
}
