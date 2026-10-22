import "@fontsource-variable/figtree";
import "@fontsource-variable/fraunces/soft.css";
import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/layout.css";
import "./styles/masthead.css";
import "./styles/menu.css";
import "./styles/rules.css";
import "./styles/level-list.css";
import "./styles/tour.css";
import "./styles/dock.css";
import "./styles/tutorial.css";
import type { Msg } from "./app/messages.ts";
import { menu, type Model } from "./app/model.ts";
import { decodeProgress, noProgress, type Progress } from "./app/progress.ts";
import { update } from "./app/update.ts";
import { tourFrames, type StepScene, type TourFrame } from "./app/tour.ts";
import { currentStep, type TutorialStep } from "./app/tutorial.ts";
import { isFading } from "./app/win.ts";
import { decodeLevel, type DecodeResult } from "./core/level-decoder.ts";
import { decodeOrder, type OrderResult } from "./core/level-order.ts";
import type { Puzzle } from "./core/puzzle.ts";
import { tourRecord } from "./how-it-works/record.ts";
import order from "./levels/order.json";
import { listenForDrags } from "./view/board-input.ts";
import { drawBraid } from "./view/braid.ts";
import { buildLevelList, renderLevelList } from "./view/level-list.ts";
import { findMenu, listenToMenu, menuScene, renderMenu, type MenuControls } from "./view/menu.ts";
import { findPanels, listenToPanels, renderPanels, type Panels } from "./view/panels.ts";
import { requiredElement } from "./view/required-element.ts";
import { findScreens, listenForBack, renderScreens, type Screens } from "./view/screens.ts";
import { drawStage } from "./view/stage.ts";
import { createSpriteCache, setGeneration, type SpriteCache } from "./view/sprite-cache.ts";
import { findThemePicker, listenToThemePicker, renderTheme } from "./view/theme-picker.ts";
import { buildTimeline, findTour, listenToTour, renderTour, type TourView } from "./view/tour.ts";
import {
  findTutorial,
  listenToTutorial,
  renderTutorial,
  type TutorialView,
} from "./view/tutorial.ts";

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

const PROGRESS_KEY: string = "crosswoven:progress";

// Storage access throws when it's blocked (some private modes, disabled cookies) and writes throw
// when it's full. The game plays on either way; progress just won't outlast the page.
function loadProgress(): Progress {
  try {
    const saved: string | null = localStorage.getItem(PROGRESS_KEY);
    return saved === null ? noProgress : decodeProgress(JSON.parse(saved));
  } catch {
    return noProgress;
  }
}

function saveProgress(progress: Progress): void {
  try {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
  } catch {
    // See loadProgress.
  }
}

const stage: HTMLCanvasElement = requiredElement(document, "#stage", HTMLCanvasElement);
drawBraid(requiredElement(document, "#braid", SVGSVGElement));
drawBraid(requiredElement(document, "#win-braid", SVGSVGElement));
const levels: readonly Puzzle[] = shippedLevels();
const levelListElement: HTMLElement = requiredElement(document, "#level-list", HTMLElement);
let model: Model = { ...menu, progress: loadProgress() };
const sprites: SpriteCache = createSpriteCache();
const screens: Screens = findScreens(document);
const menuControls: MenuControls = findMenu(document);
const themePicker: HTMLSelectElement = findThemePicker(document);
const panels: Panels = findPanels(document);
const tour: TourView = findTour(document);
const tutorial: TutorialView = findTutorial(document);
const gameBar: HTMLElement = requiredElement(document, "#game .screen-bar", HTMLElement);
const frames: readonly TourFrame[] = tourFrames(tourRecord);
// The tour board shows a different puzzle, so it keeps its own sprites.
const tourSprites: SpriteCache = createSpriteCache();
const heroScene: StepScene | undefined = menuScene(frames);
// Separate from the tour's too, as the two boards are drawn at different sizes.
const heroSprites: SpriteCache = createSpriteCache();

let renderPending: boolean = false;
let ticking: boolean = false;

function dispatch(msg: Msg): void {
  const next: Model = update(model, msg);
  if (next === model) return;
  if (next.progress !== model.progress) saveProgress(next.progress);
  model = next;
  scheduleRender();
  if (animating()) startTicking();
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
    // The canvases read their colours from the theme's tokens.
    renderTheme(themePicker, model.progress.theme);
    // Screens first, so a canvas that has just appeared has a size to draw at.
    renderScreens(screens, model);
    renderMenu(menuControls, model, heroScene, heroSprites);
    renderTutorial(
      tutorial,
      model.screen === "game" ? model : undefined,
      stage,
      panels.controls,
      gameBar,
    );
    if (model.screen === "levels") renderLevelList(levelListElement, levels, model.progress);
    if (model.screen === "tour") renderTour(tour, frames, model.step, model.elapsed, tourSprites);
    if (model.screen !== "game") return;
    drawStage(stage, model, sprites);
    renderPanels(panels, model, levels);
  });
}

/**
 * The win fades in, and How the Puzzles Are Made loops its scenes for as long as it's open, as
 * the menu does its board unless motion is reduced, when it shows the finished weave still.
 */
function animating(): boolean {
  return (
    (model.screen === "game" && isFading(model)) ||
    model.screen === "tour" ||
    (model.screen === "menu" && !matchMedia("(prefers-reduced-motion: reduce)").matches)
  );
}

/** Sends a Tick each animation frame for as long as something animates. */
function startTicking(): void {
  if (ticking) return;
  ticking = true;
  let last: number | undefined;
  const frame = (time: number): void => {
    if (last !== undefined) dispatch({ type: "Tick", dt: time - last });
    last = time;
    if (animating()) requestAnimationFrame(frame);
    else ticking = false;
  };
  requestAnimationFrame(frame);
}

function nextLevel(): Puzzle | undefined {
  return model.screen === "game" ? levels[levels.indexOf(model.puzzle) + 1] : undefined;
}

buildLevelList(levelListElement, levels, dispatch);
listenToMenu(menuControls, dispatch, frames.length);
listenToThemePicker(themePicker, dispatch);
buildTimeline(tour, frames);
listenToTour(tour, dispatch);
listenForBack(document, dispatch);
listenForDrags(
  stage,
  (): Puzzle | undefined => (model.screen === "game" ? model.puzzle : undefined),
  dispatch,
);
listenToPanels(panels, dispatch, nextLevel);
listenToTutorial(tutorial, dispatch, (): TutorialStep | undefined =>
  model.screen === "game" ? currentStep(model) : undefined,
);
new ResizeObserver(scheduleRender).observe(stage);
new ResizeObserver(scheduleRender).observe(tour.canvas);
new ResizeObserver(scheduleRender).observe(menuControls.board);
watchPixelRatio();
if (animating()) startTicking();
// The System theme follows the device, and the palette with it.
matchMedia("(prefers-color-scheme: dark)").addEventListener("change", scheduleRender);
// Peg numbers drawn before the web font arrived would stay in the fallback font in cached sprites.
void document.fonts.ready.then((): void => {
  setGeneration(sprites, "");
  setGeneration(tourSprites, "");
  setGeneration(heroSprites, "");
  scheduleRender();
});
