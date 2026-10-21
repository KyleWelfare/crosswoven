import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/layout.css";
import "./styles/masthead.css";
import type { Model } from "./app/model.ts";
import { decodeLevel, type DecodeResult } from "./core/level-decoder.ts";
import { decodeOrder, type OrderResult } from "./core/level-order.ts";
import type { Puzzle } from "./core/puzzle.ts";
import order from "./levels/order.json";
import { drawBraid } from "./view/braid.ts";
import { drawStage } from "./view/stage.ts";
import { createSpriteCache, type SpriteCache } from "./view/sprite-cache.ts";

const levelFiles: Readonly<Record<string, unknown>> = import.meta.glob(
  ["./levels/*.json", "!./levels/order.json"],
  { eager: true, import: "default" },
);

/** Every shipped level in play order. tests/shipped-levels.test.ts keeps these from failing. */
function shippedLevels(): readonly Puzzle[] {
  const byId: Map<string, Puzzle> = new Map<string, Puzzle>();
  for (const [path, json] of Object.entries(levelFiles)) {
    const decoded: DecodeResult = decodeLevel(json);
    if (!decoded.ok) throw new Error(`${path}: ${decoded.errors.join("; ")}`);
    byId.set(decoded.puzzle.id, decoded.puzzle);
  }
  const played: OrderResult = decodeOrder(order, [...byId.keys()]);
  if (!played.ok) throw new Error(`levels/order.json: ${played.errors.join("; ")}`);
  return played.order.map((id: string): Puzzle => {
    const puzzle: Puzzle | undefined = byId.get(id);
    if (!puzzle) throw new Error(`No level "${id}"`);
    return puzzle;
  });
}

const stage: HTMLCanvasElement | null = document.querySelector<HTMLCanvasElement>("#stage");
if (!stage) throw new Error("Canvas #stage not found");
const braid: SVGSVGElement | null = document.querySelector<SVGSVGElement>("#braid");
if (!braid) throw new Error("SVG #braid not found");
drawBraid(braid);
const levels: readonly Puzzle[] = shippedLevels();
const first: Puzzle | undefined = levels[0];
if (!first) throw new Error("No levels shipped");
const model: Model = { puzzle: first, threads: [] };
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
