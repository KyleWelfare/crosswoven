import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/layout.css";
import "./styles/masthead.css";
import "./styles/dock.css";
import type { Msg } from "./app/messages.ts";
import { startLevel, type Model } from "./app/model.ts";
import { update } from "./app/update.ts";
import { isFading } from "./app/win.ts";
import { decodeLevel, type DecodeResult } from "./core/level-decoder.ts";
import { decodeOrder, type OrderResult } from "./core/level-order.ts";
import type { Puzzle } from "./core/puzzle.ts";
import order from "./levels/order.json";
import { listenForDrags } from "./view/board-input.ts";
import { drawBraid } from "./view/braid.ts";
import { findPanels, listenToPanels, renderPanels, type Panels } from "./view/panels.ts";
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
// TODO: drop ?level= once the level list can open any level.
const requested: string | null = new URLSearchParams(location.search).get("level");
const first: Puzzle | undefined =
  levels.find((puzzle: Puzzle): boolean => puzzle.id === requested) ?? levels[0];
if (!first) throw new Error("No levels shipped");
let model: Model = startLevel(first);
const sprites: SpriteCache = createSpriteCache();
const panels: Panels = findPanels(document);

let renderPending: boolean = false;
let ticking: boolean = false;

function dispatch(msg: Msg): void {
  const next: Model = update(model, msg);
  if (next === model) return;
  model = next;
  scheduleRender();
  if (isFading(model)) startTicking();
}

/** Zooming or moving to another screen changes the pixel ratio without resizing the canvas. */
function watchPixelRatio(): void {
  matchMedia(`(resolution: ${String(window.devicePixelRatio)}dppx)`).addEventListener(
    "change",
    (): void => {
      scheduleRender();
      watchPixelRatio();
    },
    { once: true },
  );
}

function scheduleRender(): void {
  if (renderPending || !stage) return;
  renderPending = true;
  requestAnimationFrame((): void => {
    renderPending = false;
    drawStage(stage, model, sprites);
    renderPanels(panels, model, nextLevel() !== undefined);
  });
}

/** Sends a Tick each animation frame for as long as the win animation runs. */
function startTicking(): void {
  if (ticking) return;
  ticking = true;
  let last: number | undefined;
  const frame = (time: number): void => {
    if (last !== undefined) dispatch({ type: "Tick", dt: time - last });
    last = time;
    if (isFading(model)) requestAnimationFrame(frame);
    else ticking = false;
  };
  requestAnimationFrame(frame);
}

function nextLevel(): Puzzle | undefined {
  return levels[levels.indexOf(model.puzzle) + 1];
}

listenForDrags(stage, (): Puzzle => model.puzzle, dispatch);
listenToPanels(panels, dispatch, nextLevel);
new ResizeObserver(scheduleRender).observe(stage);
watchPixelRatio();
// The palette comes from CSS custom properties that switch with the colour scheme.
matchMedia("(prefers-color-scheme: dark)").addEventListener("change", scheduleRender);
