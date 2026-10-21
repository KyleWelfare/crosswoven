import type { Model } from "../app/model.ts";
import type { Peg, Point, Puzzle, SquareColour, ThreadColour } from "../core/puzzle.ts";
import type { Thread } from "../core/thread.ts";
import { threadTile, type Piece, type TileCache } from "./thread-tiles.ts";

interface Palette {
  readonly frame: string;
  readonly boardShadow: string;
  readonly pegShadow: string;
  readonly weaveShadow: string;
  readonly pegShine: string;
  readonly shade: string;
  readonly thread: Readonly<Record<ThreadColour, string>>;
  readonly wash: Readonly<Record<SquareColour, string>>;
}

/** CSS pixels, apart from `ratio`. */
interface Layout {
  readonly left: number;
  readonly top: number;
  readonly cell: number;
  /** Device pixels per CSS pixel. */
  readonly ratio: number;
}

type Axis = "across" | "down";

interface Crossing extends Point {
  readonly over: Thread;
  readonly axis: Axis;
}

interface Placement {
  readonly piece: Piece;
  /** Clockwise quarter turns from the heading the piece is drawn at. */
  readonly turns: number;
}

const pips: Readonly<Record<SquareColour, readonly ThreadColour[]>> = {
  blank: [],
  red: [],
  blue: [],
  yellow: [],
  purple: ["red", "blue"],
  orange: ["red", "yellow"],
  green: ["blue", "yellow"],
};

/** CSS pixels, leaving room for the board's shadow. */
const BOARD_MARGIN: number = 12;
const BOARD_SHADOW_BLUR: number = 16;

/** Fractions of a square. */
const TILE_GAP: number = 0.05;
const TILE_RADIUS: number = 0.1;
const THREAD_WIDTH: number = 0.28;
const WEAVE_SHADOW: number = 0.14;
const PEG_RADIUS: number = 0.34;
const PEG_RING: number = 0.08;
const PEG_SHADOW_BLUR: number = 0.12;
const PIP_RADIUS: number = 0.06;
const PIP_INSET: number = 0.17;

// TODO: peg numbers once Peg carries its thread length, a deeper wash on squares whose threads
// match, hint flags and the win animation.
export function drawStage(canvas: HTMLCanvasElement, model: Model, tiles: TileCache): void {
  const context: CanvasRenderingContext2D | null = canvas.getContext("2d");
  if (!context) throw new Error("Canvas 2D context unavailable");
  const width: number = canvas.clientWidth;
  const height: number = canvas.clientHeight;
  const ratio: number = window.devicePixelRatio;
  fitBackingStore(canvas, Math.round(width * ratio), Math.round(height * ratio));
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  context.clearRect(0, 0, width, height);

  const palette: Palette = readPalette(canvas);
  const layout: Layout = layoutBoard(model.puzzle, width, height, ratio);
  drawBoard(context, model.puzzle, layout, palette);
  for (const thread of model.threads) drawThread(context, thread, layout, palette, tiles);
  for (const crossing of crossings(model.puzzle, model.threads)) {
    drawCrossing(context, crossing, layout, palette, tiles);
  }
  for (const peg of model.puzzle.pegs) drawPeg(context, peg, model.threads, layout, palette);
}

function fitBackingStore(canvas: HTMLCanvasElement, width: number, height: number): void {
  // Assigning a canvas dimension reallocates and clears the buffer, even when it's unchanged.
  if (canvas.width !== width) canvas.width = width;
  if (canvas.height !== height) canvas.height = height;
}

function readPalette(canvas: HTMLCanvasElement): Palette {
  const style: CSSStyleDeclaration = getComputedStyle(canvas);
  const css = (name: string): string => style.getPropertyValue(name).trim();
  return {
    frame: css("--board-frame"),
    boardShadow: css("--board-shadow"),
    pegShadow: css("--peg-shadow"),
    weaveShadow: css("--weave-shadow"),
    pegShine: css("--peg-shine"),
    shade: css("--thread-shade"),
    thread: {
      red: css("--thread-red"),
      blue: css("--thread-blue"),
      yellow: css("--thread-yellow"),
    },
    wash: {
      blank: css("--wash-blank"),
      red: css("--wash-red"),
      blue: css("--wash-blue"),
      yellow: css("--wash-yellow"),
      purple: css("--wash-purple"),
      orange: css("--wash-orange"),
      green: css("--wash-green"),
    },
  };
}

function layoutBoard(puzzle: Puzzle, width: number, height: number, ratio: number): Layout {
  const cell: number = Math.floor(
    Math.min(
      (width - 2 * BOARD_MARGIN) / puzzle.width,
      (height - 2 * BOARD_MARGIN) / puzzle.height,
    ),
  );
  return {
    cell,
    left: Math.round((width - cell * puzzle.width) / 2),
    top: Math.round((height - cell * puzzle.height) / 2),
    ratio,
  };
}

function centre(layout: Layout, square: Point): Point {
  return {
    x: layout.left + (square.x + 0.5) * layout.cell,
    y: layout.top + (square.y + 0.5) * layout.cell,
  };
}

function drawBoard(
  context: CanvasRenderingContext2D,
  puzzle: Puzzle,
  layout: Layout,
  palette: Palette,
): void {
  const cell: number = layout.cell;
  const gap: number = Math.max(1, TILE_GAP * cell);
  const radius: number = TILE_RADIUS * cell;

  context.save();
  context.shadowColor = palette.boardShadow;
  context.shadowBlur = BOARD_SHADOW_BLUR;
  context.shadowOffsetY = 2;
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
      const left: number = layout.left + x * cell;
      const top: number = layout.top + y * cell;
      context.fillStyle = palette.wash[square];
      context.beginPath();
      context.roundRect(left + gap / 2, top + gap / 2, cell - gap, cell - gap, radius);
      context.fill();
      pips[square].forEach((colour: ThreadColour, i: number): void => {
        const inset: number = i === 0 ? PIP_INSET : 1 - PIP_INSET;
        context.fillStyle = palette.thread[colour];
        circle(context, { x: left + inset * cell, y: top + PIP_INSET * cell }, PIP_RADIUS * cell);
        context.fill();
      });
    });
  });
}

function drawThread(
  context: CanvasRenderingContext2D,
  thread: Thread,
  layout: Layout,
  palette: Palette,
  tiles: TileCache,
): void {
  thread.squares.forEach((square: Point, i: number): void => {
    const placement: Placement | undefined = placementAt(
      thread.squares[i - 1],
      square,
      thread.squares[i + 1],
    );
    if (placement)
      drawPiece(context, square, placement, palette.thread[thread.colour], layout, tiles);
  });
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

function drawPiece(
  context: CanvasRenderingContext2D,
  square: Point,
  placement: Placement,
  colour: string,
  layout: Layout,
  tiles: TileCache,
): void {
  const size: number = Math.round(layout.cell * layout.ratio);
  const tile: HTMLCanvasElement = threadTile(tiles, placement.piece, colour, size, THREAD_WIDTH);
  const point: Point = centre(layout, square);
  const half: number = layout.cell / 2;
  context.save();
  context.translate(point.x, point.y);
  context.rotate((placement.turns * Math.PI) / 2);
  context.drawImage(tile, -half, -half, layout.cell, layout.cell);
  context.restore();
}

/** Squares where one thread runs straight across and another straight down. */
function crossings(puzzle: Puzzle, threads: readonly Thread[]): Crossing[] {
  const across: Map<number, Thread> = new Map<number, Thread>();
  const down: Map<number, Thread> = new Map<number, Thread>();
  for (const thread of threads) {
    for (let i: number = 1; i < thread.squares.length - 1; i++) {
      const previous: Point | undefined = thread.squares[i - 1];
      const square: Point | undefined = thread.squares[i];
      const next: Point | undefined = thread.squares[i + 1];
      if (!previous || !square || !next) continue;
      const index: number = square.y * puzzle.width + square.x;
      if (previous.y === next.y) across.set(index, thread);
      else if (previous.x === next.x) down.set(index, thread);
    }
  }

  const found: Crossing[] = [];
  for (const [index, acrossThread] of across) {
    const downThread: Thread | undefined = down.get(index);
    if (!downThread) continue;
    const x: number = index % puzzle.width;
    const y: number = Math.floor(index / puzzle.width);
    // Plain weave: the across thread goes over on one colour of a checkerboard and under on the other.
    const acrossOnTop: boolean = (x + y) % 2 === 0;
    found.push({
      x,
      y,
      over: acrossOnTop ? acrossThread : downThread,
      axis: acrossOnTop ? "across" : "down",
    });
  }
  return found;
}

/** Redraws the top thread through the square, shading the one beneath either side of it. */
function drawCrossing(
  context: CanvasRenderingContext2D,
  crossing: Crossing,
  layout: Layout,
  palette: Palette,
  tiles: TileCache,
): void {
  const point: Point = centre(layout, crossing);
  const threadWidth: number = THREAD_WIDTH * layout.cell;
  const dx: number = crossing.axis === "across" ? 1 : 0;
  const dy: number = 1 - dx;

  const fade: number = WEAVE_SHADOW * layout.cell;
  const alongOver: number = threadWidth / 2;
  const alongUnder: number = threadWidth / 2 + fade;
  const shadow: CanvasGradient = context.createLinearGradient(
    point.x - dy * alongUnder,
    point.y - dx * alongUnder,
    point.x + dy * alongUnder,
    point.y + dx * alongUnder,
  );
  const edge: number = fade / (2 * alongUnder);
  shadow.addColorStop(0, "transparent");
  shadow.addColorStop(edge, palette.weaveShadow);
  shadow.addColorStop(1 - edge, palette.weaveShadow);
  shadow.addColorStop(1, "transparent");
  const halfWidth: number = dx * alongOver + dy * alongUnder;
  const halfHeight: number = dy * alongOver + dx * alongUnder;
  context.fillStyle = shadow;
  context.fillRect(point.x - halfWidth, point.y - halfHeight, 2 * halfWidth, 2 * halfHeight);

  const over: Placement = { piece: "straight", turns: crossing.axis === "across" ? 0 : 1 };
  drawPiece(context, crossing, over, palette.thread[crossing.over.colour], layout, tiles);
}

function drawPeg(
  context: CanvasRenderingContext2D,
  peg: Peg,
  threads: readonly Thread[],
  layout: Layout,
  palette: Palette,
): void {
  const point: Point = centre(layout, peg);
  const colour: string = palette.thread[peg.colour];
  const radius: number = PEG_RADIUS * layout.cell;
  const ring: number = PEG_RING * layout.cell;

  if (!isTied(peg, threads)) {
    circle(context, point, radius - ring / 2);
    context.fillStyle = palette.wash[peg.colour];
    context.fill();
    context.strokeStyle = colour;
    context.lineWidth = ring;
    context.stroke();
    return;
  }

  context.save();
  context.shadowColor = palette.pegShadow;
  context.shadowBlur = PEG_SHADOW_BLUR * layout.cell;
  context.shadowOffsetY = PEG_SHADOW_BLUR * layout.cell * 0.3;
  circle(context, point, radius);
  context.fillStyle = colour;
  context.fill();
  context.restore();

  const glint: Point = { x: point.x - radius * 0.35, y: point.y - radius * 0.35 };
  const sheen: CanvasGradient = context.createRadialGradient(
    glint.x,
    glint.y,
    0,
    glint.x,
    glint.y,
    radius,
  );
  sheen.addColorStop(0, palette.pegShine);
  sheen.addColorStop(1, "transparent");
  context.fillStyle = sheen;
  context.fill();

  circle(context, point, radius - ring / 4);
  context.strokeStyle = palette.shade;
  context.lineWidth = ring / 2;
  context.stroke();
}

function circle(context: CanvasRenderingContext2D, point: Point, radius: number): void {
  context.beginPath();
  context.arc(point.x, point.y, radius, 0, 2 * Math.PI);
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
