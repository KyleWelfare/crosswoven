import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/layout.css";
import "./styles/masthead.css";
import "./styles/menu.css";
import "./styles/level-list.css";
import "./styles/tour.css";
import "./styles/dock.css";
import type { Msg } from "./app/messages.ts";
import { menu, type Model } from "./app/model.ts";
import { update } from "./app/update.ts";
import { tourFrames, type TourFrame } from "./app/tour.ts";
import { isFading } from "./app/win.ts";
import { decodeLevel, type DecodeResult } from "./core/level-decoder.ts";
import { decodeOrder, type OrderResult } from "./core/level-order.ts";
import type { Puzzle } from "./core/puzzle.ts";
import { tourRecord } from "./how-it-works/record.ts";
import order from "./levels/order.json";
import { listenForDrags } from "./view/board-input.ts";
import { drawBraid } from "./view/braid.ts";
import { buildLevelList } from "./view/level-list.ts";
import { findMenu, listenToMenu, renderMenu, type MenuControls } from "./view/menu.ts";
import { findPanels, listenToPanels, renderPanels, type Panels } from "./view/panels.ts";
import { requiredElement } from "./view/required-element.ts";
import { findScreens, listenForBack, renderScreens, type Screens } from "./view/screens.ts";
import { drawStage } from "./view/stage.ts";
import { createSpriteCache, type SpriteCache } from "./view/sprite-cache.ts";
import { findTour, listenToTour, renderTour, type TourView } from "./view/tour.ts";

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

const stage: HTMLCanvasElement = requiredElement(document, "#stage", HTMLCanvasElement);
drawBraid(requiredElement(document, "#braid", SVGSVGElement));
const levels: readonly Puzzle[] = shippedLevels();
let model: Model = menu;
const sprites: SpriteCache = createSpriteCache();
const screens: Screens = findScreens(document);
const menuControls: MenuControls = findMenu(document);
const panels: Panels = findPanels(document);
const tour: TourView = findTour(document);
const frames: readonly TourFrame[] = tourFrames(tourRecord);
// The tour board shows a different puzzle, so it keeps its own sprites.
const tourSprites: SpriteCache = createSpriteCache();

let renderPending: boolean = false;
let ticking: boolean = false;

function dispatch(msg: Msg): void {
  const next: Model = update(model, msg);
  if (next === model) return;
  model = next;
  scheduleRender();
  if (winFading()) startTicking();
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
  if (renderPending) return;
  renderPending = true;
  requestAnimationFrame((): void => {
    renderPending = false;
    // Screens first, so a canvas that has just appeared has a size to draw at.
    renderScreens(screens, model);
    renderMenu(menuControls, model);
    if (model.screen === "tour") renderTour(tour, frames, model.step, tourSprites);
    if (model.screen !== "game") return;
    drawStage(stage, model, sprites);
    renderPanels(panels, model, levels);
  });
}

function winFading(): boolean {
  return model.screen === "game" && isFading(model);
}

/** Sends a Tick each animation frame for as long as the win animation runs. */
function startTicking(): void {
  if (ticking) return;
  ticking = true;
  let last: number | undefined;
  const frame = (time: number): void => {
    if (last !== undefined) dispatch({ type: "Tick", dt: time - last });
    last = time;
    if (winFading()) requestAnimationFrame(frame);
    else ticking = false;
  };
  requestAnimationFrame(frame);
}

function nextLevel(): Puzzle | undefined {
  return model.screen === "game" ? levels[levels.indexOf(model.puzzle) + 1] : undefined;
}

buildLevelList(requiredElement(document, "#level-list", HTMLElement), levels, dispatch);
listenToMenu(menuControls, dispatch, frames.length);
listenToTour(tour, dispatch);
listenForBack(document, dispatch);
listenForDrags(
  stage,
  (): Puzzle | undefined => (model.screen === "game" ? model.puzzle : undefined),
  dispatch,
);
listenToPanels(panels, dispatch, nextLevel);
new ResizeObserver(scheduleRender).observe(stage);
new ResizeObserver(scheduleRender).observe(tour.canvas);
watchPixelRatio();
// The palette comes from CSS custom properties that switch with the colour scheme.
matchMedia("(prefers-color-scheme: dark)").addEventListener("change", scheduleRender);
