import type { Point, Puzzle, SquareColour, ThreadColour } from "../core/puzzle.ts";
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
  const gap: number = tileGap(layout);

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
    TILE_RADIUS * cell + gap / 2,
  );
  context.fill();
  context.restore();

  puzzle.pattern.forEach((row: readonly SquareColour[], y: number): void => {
    row.forEach((square: SquareColour, x: number): void => {
      paintSquare(
        context,
        squareOrigin(layout, { x, y }),
        square,
        palette.wash[square],
        layout,
        palette,
      );
    });
  });
  return canvas;
}

/** A square's tile in its stronger colour, copied over the board once its threads match. */
export function drawWovenSquare(
  square: SquareColour,
  layout: BoardLayout,
  palette: Palette,
): HTMLCanvasElement {
  const { canvas, context }: Sprite = createSprite(layout.cell, layout.cell);
  paintSquare(context, { x: 0, y: 0 }, square, palette.woven[square], layout, palette);
  return canvas;
}

function paintSquare(
  context: CanvasRenderingContext2D,
  origin: Point,
  square: SquareColour,
  fill: string,
  layout: BoardLayout,
  palette: Palette,
): void {
  const cell: number = layout.cell;
  const gap: number = tileGap(layout);
  context.fillStyle = fill;
  context.beginPath();
  context.roundRect(
    origin.x + gap / 2,
    origin.y + gap / 2,
    cell - gap,
    cell - gap,
    TILE_RADIUS * cell,
  );
  context.fill();
  pips[square].forEach((colour: ThreadColour, i: number): void => {
    const inset: number = i === 0 ? PIP_INSET : 1 - PIP_INSET;
    context.fillStyle = palette.thread[colour];
    context.beginPath();
    context.arc(
      origin.x + inset * cell,
      origin.y + PIP_INSET * cell,
      PIP_RADIUS * cell,
      0,
      2 * Math.PI,
    );
    context.fill();
  });
}

function tileGap(layout: BoardLayout): number {
  return Math.max(layout.ratio, TILE_GAP * layout.cell);
}
