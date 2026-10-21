import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/layout.css";
import "./styles/masthead.css";
import type { Model } from "./app/model.ts";
import { decodeLevel, type DecodeResult } from "./core/level-decoder.ts";
import type { Point, ThreadColour } from "./core/puzzle.ts";
import type { Thread } from "./core/thread.ts";
import { drawBraid } from "./view/braid.ts";
import { drawStage } from "./view/stage.ts";
import { createSpriteCache, type SpriteCache } from "./view/sprite-cache.ts";

// TODO: replace the demo with the level list once the pipeline ships levels to src/levels/.
const demoLevel: unknown = {
  version: 2,
  id: "lattice",
  title: "Lattice",
  pattern: [".RRR.", "BPBPB", "BPBPB", "BPBRR", "BR.RR"],
  pegs: [
    { x: 2, y: 0, length: 6 },
    { x: 3, y: 0, length: 7 },
    { x: 4, y: 1, length: 10 },
    { x: 4, y: 2, length: 10 },
    { x: 2, y: 3, length: 4 },
    { x: 0, y: 4, length: 4 },
    { x: 1, y: 4, length: 6 },
    { x: 3, y: 4, length: 7 },
  ],
};

// Three of the four threads in the solution, so the board shows both tied and untied pegs.
const demoThreads: readonly Thread[] = [
  threadOf("red", [
    [2, 0],
    [1, 0],
    [1, 1],
    [1, 2],
    [1, 3],
    [1, 4],
  ]),
  threadOf("red", [
    [3, 0],
    [3, 1],
    [3, 2],
    [3, 3],
    [4, 3],
    [4, 4],
    [3, 4],
  ]),
  threadOf("blue", [
    [4, 1],
    [3, 1],
    [2, 1],
    [1, 1],
    [0, 1],
    [0, 2],
    [1, 2],
    [2, 2],
    [3, 2],
    [4, 2],
  ]),
];

function threadOf(colour: ThreadColour, squares: readonly (readonly [number, number])[]): Thread {
  return {
    colour,
    squares: squares.map(([x, y]: readonly [number, number]): Point => ({ x, y })),
  };
}

const stage: HTMLCanvasElement | null = document.querySelector<HTMLCanvasElement>("#stage");
if (!stage) throw new Error("Canvas #stage not found");
const braid: SVGSVGElement | null = document.querySelector<SVGSVGElement>("#braid");
if (!braid) throw new Error("SVG #braid not found");
drawBraid(braid);
const decoded: DecodeResult = decodeLevel(demoLevel);
if (!decoded.ok) throw new Error(decoded.errors.join("; "));
const model: Model = { puzzle: decoded.puzzle, threads: demoThreads };
const sprites: SpriteCache = createSpriteCache();

let renderPending: boolean = false;

function scheduleRender(): void {
  if (renderPending || !stage) return;
  renderPending = true;
  requestAnimationFrame((): void => {
    renderPending = false;
    drawStage(stage, model, sprites);
  });
}

new ResizeObserver(scheduleRender).observe(stage);
// The palette comes from CSS custom properties that switch with the colour scheme.
matchMedia("(prefers-color-scheme: dark)").addEventListener("change", scheduleRender);
