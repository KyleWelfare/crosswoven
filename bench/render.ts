import "../src/styles/tokens.css";
import "../src/styles/base.css";
import "../src/styles/layout.css";
import type { Game } from "../src/app/model.ts";
import type { Peg, Point, SquareColour } from "../src/core/puzzle.ts";
import type { Thread } from "../src/core/thread.ts";
import { drawStage } from "../src/view/stage.ts";
import { createSpriteCache, type SpriteCache } from "../src/view/sprite-cache.ts";
import {
  countCanvasCalls,
  frameIntervals,
  percentile,
  renderer,
  timed,
  totalCalls,
} from "./measurement.ts";
import type { BoardBench, BoardResult } from "./result.ts";

const RECORD_RUNS: number = 100;
const WARM_UP_FRAMES: number = 20;
const FRAMES: number = 120;

const bench: BoardBench = { run };
window.crosswovenBench = bench;

async function run(size: number): Promise<BoardResult> {
  const canvas: HTMLCanvasElement | null = document.querySelector<HTMLCanvasElement>("#stage");
  if (!canvas) throw new Error("Canvas #stage not found");
  const game: Game = worstCase(size);
  const sprites: SpriteCache = createSpriteCache();
  const draw = (): void => {
    drawStage(canvas, game, sprites);
  };

  const firstFrame: number = timed(draw);
  const callsByMethod: Record<string, number> = countCanvasCalls(draw);
  const record: number = timed((): void => {
    for (let i: number = 0; i < RECORD_RUNS; i++) draw();
  });
  await frameIntervals(draw, WARM_UP_FRAMES);
  const intervals: number[] = await frameIntervals(draw, FRAMES);

  return {
    size,
    renderer: renderer(),
    canvasCalls: totalCalls(callsByMethod),
    callsByMethod,
    firstFrame,
    record: record / RECORD_RUNS,
    frameMedian: percentile(intervals, 0.5),
    frameP90: percentile(intervals, 0.9),
    frameMax: Math.max(...intervals),
  };
}

/**
 * A red thread along every row and a blue one down every column, so every inner square is a
 * crossing and every edge square holds a tied peg. Busier than any real level.
 */
function worstCase(size: number): Game {
  const line = (at: (i: number) => Point): Point[] => [...Array(size).keys()].map(at);
  const threads: Thread[] = [];
  const pegs: Peg[] = [];
  for (let i: number = 0; i < size; i++) {
    threads.push({ colour: "red", squares: line((x: number): Point => ({ x, y: i })) });
    threads.push({ colour: "blue", squares: line((y: number): Point => ({ x: i, y })) });
    pegs.push(
      { x: 0, y: i, colour: "red", length: size },
      { x: size - 1, y: i, colour: "red", length: size },
    );
    pegs.push(
      { x: i, y: 0, colour: "blue", length: size },
      { x: i, y: size - 1, colour: "blue", length: size },
    );
  }
  const pattern: SquareColour[][] = Array.from({ length: size }, (): SquareColour[] =>
    Array.from({ length: size }, (): SquareColour => "purple"),
  );
  return {
    screen: "game",
    puzzle: { id: "worst-case", title: "Worst case", width: size, height: size, pattern, pegs },
    threads,
    drag: undefined,
    history: [],
    solvedFor: undefined,
  };
}
