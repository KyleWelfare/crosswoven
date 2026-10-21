import { draggedThread, shownThreads } from "../app/drag.ts";
import type { Model } from "../app/model.ts";
import { isPegTied } from "../app/tie.ts";
import { mixOf, wovenSquares } from "../app/weave.ts";
import { winProgress } from "../app/win.ts";
import type { Peg, Point, Puzzle, SquareColour } from "../core/puzzle.ts";
import type { Thread } from "../core/thread.ts";
import { drawBoardLayer, drawWovenSquare } from "./board-layer.ts";
import { canvasLayout, squareOrigin, type BoardLayout } from "./board-layout.ts";
import { drawLengthBadge } from "./length-badge.ts";
import { readPalette, type Palette } from "./palette.ts";
import { drawPegSprite } from "./peg-sprites.ts";
import { cachedSprite, rotateSprite, setGeneration, type SpriteCache } from "./sprite-cache.ts";
import {
  drawCrossingTile,
  drawThreadTile,
  dyeStraightTile,
  type Axis,
  type Piece,
} from "./thread-tiles.ts";

interface Crossing extends Point {
  readonly over: Thread;
  readonly under: Thread;
  /** Which way the top thread runs. */
  readonly axis: Axis;
}

interface Placement {
  readonly piece: Piece;
  /** Clockwise quarter turns from the heading the piece is drawn at. */
  readonly turns: number;
}

/** Fraction of a square. */
const THREAD_WIDTH: number = 0.28;
/** CSS pixels between the length badge and the square at the end of the thread. */
const BADGE_GAP: number = 14;

/**
 * Each frame copies cached sprites at whole device pixels: one image for the board, then a tile
 * per thread square, crossing and peg. Sprites are redrawn only when the square size or palette
 * changes, because unaccelerated canvas pays for every resampled or blurred pixel.
 */
// TODO: hint flags.
export function drawStage(canvas: HTMLCanvasElement, model: Model, sprites: SpriteCache): void {
  const context: CanvasRenderingContext2D | null = canvas.getContext("2d");
  if (!context) throw new Error("Canvas 2D context unavailable");
  canvas.style.aspectRatio = `${String(model.puzzle.width)} / ${String(model.puzzle.height)}`;
  const layout: BoardLayout = canvasLayout(canvas, model.puzzle);
  fitBackingStore(canvas, layout.width, layout.height);
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.clearRect(0, 0, layout.width, layout.height);

  const palette: Palette = readPalette(canvas);
  setGeneration(sprites, `${String(layout.cell)} ${JSON.stringify(palette)}`);

  const board: HTMLCanvasElement = cachedSprite(
    sprites,
    `board ${model.puzzle.id} ${String(layout.width)}x${String(layout.height)}`,
    (): HTMLCanvasElement => drawBoardLayer(model.puzzle, layout, palette),
  );
  context.drawImage(board, 0, 0);
  const threads: readonly Thread[] = shownThreads(model.puzzle, model.threads, model.drag);
  drawWovenSquares(context, model.puzzle, threads, layout, palette, sprites);

  // Once solved, the threads and pegs fade back to leave the picture.
  const fade: number = winProgress(model);
  if (fade < 1) {
    context.globalAlpha = 1 - fade;
    drawThreads(context, model.puzzle, threads, layout, palette, sprites);
    for (const peg of model.puzzle.pegs) {
      blit(
        context,
        layout,
        peg,
        pegSprite(sprites, peg, isPegTied(model.puzzle, threads, peg), layout, palette),
      );
    }
    context.globalAlpha = 1;
  }
  if (model.drag) {
    const length: number = draggedThread(model.puzzle, model.threads, model.drag).squares.length;
    drawDragLength(context, model.drag, length, layout, palette, sprites);
  }
}

function drawThreads(
  context: CanvasRenderingContext2D,
  puzzle: Puzzle,
  threads: readonly Thread[],
  layout: BoardLayout,
  palette: Palette,
  sprites: SpriteCache,
): void {
  const crossingsAt: Map<number, Crossing> = crossings(puzzle, threads);
  for (const thread of threads) {
    const colour: string = palette.thread[thread.colour];
    thread.squares.forEach((square: Point, i: number): void => {
      // A crossing square gets one tile holding both of its threads.
      if (crossingsAt.has(squareIndex(puzzle, square))) return;
      const placement: Placement | undefined = placementAt(
        thread.squares[i - 1],
        square,
        thread.squares[i + 1],
      );
      if (!placement) return;
      blit(context, layout, square, threadSprite(sprites, placement, colour, layout.cell));
    });
  }
  for (const crossing of crossingsAt.values()) {
    blit(context, layout, crossing, crossingSprite(sprites, crossing, layout.cell, palette));
  }
}

function drawWovenSquares(
  context: CanvasRenderingContext2D,
  puzzle: Puzzle,
  threads: readonly Thread[],
  layout: BoardLayout,
  palette: Palette,
  sprites: SpriteCache,
): void {
  const woven: readonly boolean[] = wovenSquares(puzzle, threads);
  puzzle.pattern.forEach((row: readonly SquareColour[], y: number): void => {
    row.forEach((square: SquareColour, x: number): void => {
      if (!woven[squareIndex(puzzle, { x, y })]) return;
      const sprite: HTMLCanvasElement = cachedSprite(
        sprites,
        `woven ${square}`,
        (): HTMLCanvasElement => drawWovenSquare(square, layout, palette),
      );
      blit(context, layout, { x, y }, sprite);
    });
  });
}

function fitBackingStore(canvas: HTMLCanvasElement, width: number, height: number): void {
  // Assigning a canvas dimension reallocates and clears the buffer, even when it's unchanged.
  if (canvas.width !== width) canvas.width = width;
  if (canvas.height !== height) canvas.height = height;
}

function blit(
  context: CanvasRenderingContext2D,
  layout: BoardLayout,
  square: Point,
  sprite: HTMLCanvasElement,
): void {
  const origin: Point = squareOrigin(layout, square);
  context.drawImage(sprite, origin.x, origin.y);
}

function threadSprite(
  sprites: SpriteCache,
  placement: Placement,
  colour: string,
  cell: number,
): HTMLCanvasElement {
  const base: HTMLCanvasElement = cachedSprite(
    sprites,
    `thread ${placement.piece} 0 ${colour}`,
    (): HTMLCanvasElement => drawThreadTile(placement.piece, colour, cell, THREAD_WIDTH),
  );
  if (placement.turns === 0) return base;
  return cachedSprite(
    sprites,
    `thread ${placement.piece} ${String(placement.turns)} ${colour}`,
    (): HTMLCanvasElement => rotateSprite(base, placement.turns),
  );
}

function crossingSprite(
  sprites: SpriteCache,
  crossing: Crossing,
  cell: number,
  palette: Palette,
): HTMLCanvasElement {
  const overTurns: number = crossing.axis === "across" ? 0 : 1;
  const dye: string = palette.thread[mixOf(crossing.over.colour, crossing.under.colour)];
  const straight = (colour: string): HTMLCanvasElement =>
    threadSprite(sprites, { piece: "straight", turns: 0 }, colour, cell);
  const dyed = (thread: Thread, turns: number): HTMLCanvasElement => {
    const tile: HTMLCanvasElement = dyeStraightTile(
      straight(palette.thread[thread.colour]),
      straight(dye),
    );
    return turns === 0 ? tile : rotateSprite(tile, turns);
  };
  return cachedSprite(
    sprites,
    `crossing ${crossing.over.colour} ${crossing.under.colour} ${crossing.axis}`,
    (): HTMLCanvasElement =>
      drawCrossingTile(
        dyed(crossing.under, 1 - overTurns),
        dyed(crossing.over, overTurns),
        crossing.axis,
        palette.weaveShadow,
        THREAD_WIDTH,
      ),
  );
}

function pegSprite(
  sprites: SpriteCache,
  peg: Peg,
  tied: boolean,
  layout: BoardLayout,
  palette: Palette,
): HTMLCanvasElement {
  return cachedSprite(
    sprites,
    `peg ${peg.colour} ${tied ? "tied" : "loose"} ${String(peg.length)}`,
    (): HTMLCanvasElement =>
      drawPegSprite(
        palette.thread[peg.colour],
        palette.wash[peg.colour],
        tied,
        peg.length,
        layout.cell,
        palette,
      ),
  );
}

function placementAt(
  previous: Point | undefined,
  square: Point,
  next: Point | undefined,
): Placement | undefined {
  const [a, b]: readonly number[] = [previous, next]
    .filter((neighbour: Point | undefined): neighbour is Point => neighbour !== undefined)
    .map((neighbour: Point): number => heading(square, neighbour));
  if (a === undefined) return undefined;
  if (b === undefined) return { piece: "end", turns: a };
  if ((a - b + 4) % 4 === 2) return { piece: "straight", turns: a % 2 };
  // The corner piece joins west to north, so whichever heading the other follows clockwise is west.
  const west: number = b === (a + 1) % 4 ? a : b;
  return { piece: "corner", turns: (west + 2) % 4 };
}

/** Clockwise quarter turns from east. */
function heading(from: Point, to: Point): number {
  if (to.x > from.x) return 0;
  if (to.y > from.y) return 1;
  if (to.x < from.x) return 2;
  return 3;
}

function squareIndex(puzzle: Puzzle, square: Point): number {
  return square.y * puzzle.width + square.x;
}

/** Squares where one thread runs straight across and another straight down, by square index. */
function crossings(puzzle: Puzzle, threads: readonly Thread[]): Map<number, Crossing> {
  const across: Map<number, Thread> = new Map<number, Thread>();
  const down: Map<number, Thread> = new Map<number, Thread>();
  for (const thread of threads) {
    for (let i: number = 1; i < thread.squares.length - 1; i++) {
      const previous: Point | undefined = thread.squares[i - 1];
      const square: Point | undefined = thread.squares[i];
      const next: Point | undefined = thread.squares[i + 1];
      if (!previous || !square || !next) continue;
      const index: number = squareIndex(puzzle, square);
      if (previous.y === next.y) across.set(index, thread);
      else if (previous.x === next.x) down.set(index, thread);
    }
  }

  const found: Map<number, Crossing> = new Map<number, Crossing>();
  for (const [index, acrossThread] of across) {
    const downThread: Thread | undefined = down.get(index);
    if (!downThread) continue;
    const x: number = index % puzzle.width;
    const y: number = Math.floor(index / puzzle.width);
    // Plain weave: the across thread goes over on one colour of a checkerboard and under on the other.
    const acrossOnTop: boolean = (x + y) % 2 === 0;
    found.set(index, {
      x,
      y,
      over: acrossOnTop ? acrossThread : downThread,
      under: acrossOnTop ? downThread : acrossThread,
      axis: acrossOnTop ? "across" : "down",
    });
  }
  return found;
}

/**
 * Above the end of the thread, clear of the finger drawing it, or below when there's no room above.
 * Kept inside the canvas.
 */
function drawDragLength(
  context: CanvasRenderingContext2D,
  drag: Thread,
  length: number,
  layout: BoardLayout,
  palette: Palette,
  sprites: SpriteCache,
): void {
  const head: Point | undefined = drag.squares.at(-1);
  if (!head) return;
  const badge: HTMLCanvasElement = cachedSprite(
    sprites,
    `length ${String(length)} ${drag.colour}`,
    (): HTMLCanvasElement =>
      drawLengthBadge(length, palette.thread[drag.colour], layout.ratio, palette),
  );
  const square: Point = squareOrigin(layout, head);
  const gap: number = BADGE_GAP * layout.ratio;
  const above: number = square.y - gap - badge.height;
  const y: number = above >= 0 ? above : square.y + layout.cell + gap;
  const x: number = square.x + (layout.cell - badge.width) / 2;
  context.drawImage(
    badge,
    Math.round(Math.min(Math.max(x, 0), layout.width - badge.width)),
    Math.round(Math.min(y, layout.height - badge.height)),
  );
}
