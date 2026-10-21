import type { Model } from "../app/model.ts";
import type { Peg, Point, Puzzle } from "../core/puzzle.ts";
import type { Thread } from "../core/thread.ts";
import { drawBoardLayer } from "./board-layer.ts";
import { layoutBoard, squareOrigin, type BoardLayout } from "./board-layout.ts";
import { readPalette, type Palette } from "./palette.ts";
import { drawPegSprite } from "./peg-sprites.ts";
import { cachedSprite, rotateSprite, setGeneration, type SpriteCache } from "./sprite-cache.ts";
import { drawCrossingTile, drawThreadTile, type Axis, type Piece } from "./thread-tiles.ts";

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

/**
 * Each frame copies cached sprites at whole device pixels: one image for the board, then a tile
 * per thread square, crossing and peg. Sprites are redrawn only when the square size or palette
 * changes, because unaccelerated canvas pays for every resampled or blurred pixel.
 */
// TODO: peg numbers once Peg carries its thread length, a deeper wash on squares whose threads
// match, hint flags and the win animation.
export function drawStage(canvas: HTMLCanvasElement, model: Model, sprites: SpriteCache): void {
  const context: CanvasRenderingContext2D | null = canvas.getContext("2d");
  if (!context) throw new Error("Canvas 2D context unavailable");
  const ratio: number = window.devicePixelRatio;
  const width: number = Math.round(canvas.clientWidth * ratio);
  const height: number = Math.round(canvas.clientHeight * ratio);
  fitBackingStore(canvas, width, height);
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.clearRect(0, 0, width, height);

  const palette: Palette = readPalette(canvas);
  const layout: BoardLayout = layoutBoard(model.puzzle, width, height, ratio);
  setGeneration(sprites, `${String(layout.cell)} ${JSON.stringify(palette)}`);

  const board: HTMLCanvasElement = cachedSprite(
    sprites,
    `board ${model.puzzle.id} ${String(width)}x${String(height)}`,
    (): HTMLCanvasElement => drawBoardLayer(model.puzzle, layout, palette),
  );
  context.drawImage(board, 0, 0);

  const crossingsAt: Map<number, Crossing> = crossings(model.puzzle, model.threads);
  for (const thread of model.threads) {
    const colour: string = palette.thread[thread.colour];
    thread.squares.forEach((square: Point, i: number): void => {
      // A crossing square gets one tile holding both of its threads.
      if (crossingsAt.has(squareIndex(model.puzzle, square))) return;
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
  for (const peg of model.puzzle.pegs) {
    blit(
      context,
      layout,
      peg,
      pegSprite(sprites, peg, isTied(peg, model.threads), layout, palette),
    );
  }
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
  const straight = (thread: Thread, turns: number): HTMLCanvasElement =>
    threadSprite(sprites, { piece: "straight", turns }, palette.thread[thread.colour], cell);
  return cachedSprite(
    sprites,
    `crossing ${crossing.over.colour} ${crossing.under.colour} ${crossing.axis}`,
    (): HTMLCanvasElement =>
      drawCrossingTile(
        straight(crossing.under, 1 - overTurns),
        straight(crossing.over, overTurns),
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
    `peg ${peg.colour} ${tied ? "tied" : "loose"}`,
    (): HTMLCanvasElement =>
      drawPegSprite(
        palette.thread[peg.colour],
        palette.wash[peg.colour],
        tied,
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

function isTied(peg: Peg, threads: readonly Thread[]): boolean {
  return threads.some(
    (thread: Thread): boolean =>
      thread.colour === peg.colour &&
      [thread.squares[0], thread.squares.at(-1)].some(
        (end: Point | undefined): boolean => end?.x === peg.x && end.y === peg.y,
      ),
  );
}
