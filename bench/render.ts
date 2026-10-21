import "../src/styles/tokens.css";
import "../src/styles/base.css";
import "../src/styles/layout.css";
import type { Model } from "../src/app/model.ts";
import type { Peg, Point, SquareColour } from "../src/core/puzzle.ts";
import type { Thread } from "../src/core/thread.ts";
import { drawStage } from "../src/view/stage.ts";
import { createSpriteCache, type SpriteCache } from "../src/view/sprite-cache.ts";
import type { Bench, BenchResult } from "./result.ts";

declare global {
  interface Window {
    crosswovenBench?: Bench;
  }
}

const RECORD_RUNS: number = 100;
const WARM_UP_FRAMES: number = 20;
const FRAMES: number = 120;

window.crosswovenBench = { run };

async function run(size: number): Promise<BenchResult> {
  const canvas: HTMLCanvasElement | null = document.querySelector<HTMLCanvasElement>("#stage");
  if (!canvas) throw new Error("Canvas #stage not found");
  const model: Model = worstCase(size);
  const sprites: SpriteCache = createSpriteCache();
  const draw = (): void => {
    drawStage(canvas, model, sprites);
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
    canvasCalls: Object.values(callsByMethod).reduce(
      (sum: number, n: number): number => sum + n,
      0,
    ),
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
function worstCase(size: number): Model {
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
    puzzle: { id: "worst-case", title: "Worst case", width: size, height: size, pattern, pegs },
    threads,
  };
}

function timed(work: () => void): number {
  const start: number = performance.now();
  work();
  return performance.now() - start;
}

/** Wraps every 2D context method for one call of `draw`, counting calls by method name. */
function countCanvasCalls(draw: () => void): Record<string, number> {
  const prototype: object = CanvasRenderingContext2D.prototype;
  const counts: Record<string, number> = {};
  const originals: [string, PropertyDescriptor][] = [];
  for (const name of Object.getOwnPropertyNames(prototype)) {
    const descriptor: PropertyDescriptor | undefined = Object.getOwnPropertyDescriptor(
      prototype,
      name,
    );
    const method: unknown = descriptor?.value;
    if (!descriptor || typeof method !== "function" || name === "constructor") continue;
    originals.push([name, descriptor]);
    Object.defineProperty(prototype, name, {
      ...descriptor,
      value: function (this: unknown, ...args: unknown[]): unknown {
        counts[name] = (counts[name] ?? 0) + 1;
        const result: unknown = Reflect.apply(method, this, args);
        return result;
      },
    });
  }
  try {
    draw();
  } finally {
    for (const [name, descriptor] of originals) Object.defineProperty(prototype, name, descriptor);
  }
  return counts;
}

async function frameIntervals(draw: () => void, count: number): Promise<number[]> {
  const intervals: number[] = [];
  let last: number = await nextFrame();
  for (let i: number = 0; i < count; i++) {
    draw();
    const now: number = await nextFrame();
    intervals.push(now - last);
    last = now;
  }
  return intervals;
}

function nextFrame(): Promise<number> {
  return new Promise<number>((resolve: (time: number) => void): void => {
    requestAnimationFrame(resolve);
  });
}

function percentile(values: readonly number[], fraction: number): number {
  const sorted: number[] = [...values].sort((a: number, b: number): number => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * fraction))] ?? 0;
}

function renderer(): string {
  const gl: WebGLRenderingContext | null = document.createElement("canvas").getContext("webgl");
  const info: WEBGL_debug_renderer_info | null =
    gl?.getExtension("WEBGL_debug_renderer_info") ?? null;
  if (!gl || !info) return "unknown";
  return String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL));
}
