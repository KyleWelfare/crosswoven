import type { Msg } from "../app/messages.ts";
import type { Game } from "../app/model.ts";
import { currentStep, type TutorialStep } from "../app/tutorial.ts";
import type { Point } from "../core/puzzle.ts";
import { canvasLayout, squareOrigin, type BoardLayout } from "./board-layout.ts";
import { requiredElement } from "./required-element.ts";

export interface TutorialView {
  readonly root: HTMLElement;
  readonly shade: HTMLCanvasElement;
  readonly hand: HTMLElement;
  readonly card: HTMLElement;
  readonly text: HTMLElement;
  readonly skip: HTMLButtonElement;
  readonly ok: HTMLButtonElement;
}

/** CSS pixels. */
const WINDOW_PADDING: number = 4;
const WINDOW_RADIUS: number = 8;
const CARD_GAP: number = 14;
const VIEWPORT_MARGIN: number = 16;
const RING_WIDTH: number = 3;

// A playtester skipped straight away, taking Skip for the only thing to do, and never saw the
// highlighted squares. Holding it back gives the board time to be noticed first.
const SKIP_DELAY_MS: number = 10_000;

/** Milliseconds in the hand's loop. */
const HAND_PRESS: number = 300;
const HAND_HOLD: number = 200;
const HAND_STEP: number = 350;
const HAND_LIFT: number = 600;
const HAND_REST: number = 900;

/** A rectangle in CSS pixels, relative to the viewport. */
interface Box {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

export function findTutorial(root: ParentNode): TutorialView {
  return {
    root: requiredElement(root, "#tutorial", HTMLElement),
    shade: requiredElement(root, "#tutorial-shade", HTMLCanvasElement),
    hand: requiredElement(root, "#tutorial-hand", HTMLElement),
    card: requiredElement(root, "#tutorial-card", HTMLElement),
    text: requiredElement(root, "#tutorial-text", HTMLElement),
    skip: requiredElement(root, "#tutorial-skip", HTMLButtonElement),
    ok: requiredElement(root, "#tutorial-ok", HTMLButtonElement),
  };
}

export function listenToTutorial(view: TutorialView, dispatch: (msg: Msg) => void): void {
  view.skip.addEventListener("click", (): void => {
    dispatch({ type: "TutorialSkipped" });
  });
  view.ok.addEventListener("click", (): void => {
    dispatch({ type: "TipDismissed" });
  });
}

/**
 * Shades the page but for the screen bar, so Back and How to Play stay clear, and the step's
 * window, with the card just beside it. The board itself
 * ignores presses outside the window, so the shade only has to look the part; the controls
 * under it are made inert. A tip that's read and dismissed shades the whole board.
 */
export function renderTutorial(
  view: TutorialView,
  game: Game | undefined,
  stage: HTMLCanvasElement,
  controls: HTMLElement,
  bar: HTMLElement,
): void {
  const step: TutorialStep | undefined = game && currentStep(game);
  view.root.hidden = !step;
  controls.inert = step !== undefined;
  if (!game || !step) return;
  if (view.text.textContent !== step.text) {
    view.text.textContent = step.text;
    // Restarts the card's entrance, so each new step reads as new.
    view.card.getAnimations().forEach((animation: Animation): void => {
      animation.cancel();
      animation.play();
    });
    holdBack(view.skip);
  }
  view.ok.hidden = step.tie.length > 0;
  const windows: readonly Box[] = step.window.map((square: Point): Box =>
    squareBox(stage, game, square),
  );
  drawShade(view.shade, barArea(bar, stage), windows);
  traceMove(view.hand, windows.map(centre), game.drag !== undefined);
  if (windows.length > 0) placeCard(view.card, bounds(windows));
  else centreCard(view.card, stage.getBoundingClientRect());
}

function squareBox(stage: HTMLCanvasElement, game: Game, square: Point): Box {
  const layout: BoardLayout = canvasLayout(stage, game.puzzle);
  const board: DOMRect = stage.getBoundingClientRect();
  const origin: Point = squareOrigin(layout, square);
  const left: number = board.left + origin.x / layout.ratio;
  const top: number = board.top + origin.y / layout.ratio;
  const size: number = layout.cell / layout.ratio;
  return { left, top, right: left + size, bottom: top + size };
}

/** The bar and the page around it: a band across the top, or its own column on a landscape phone. */
function barArea(bar: HTMLElement, stage: HTMLCanvasElement): Box {
  const box: DOMRect = bar.getBoundingClientRect();
  const besideBoard: boolean = box.bottom > stage.getBoundingClientRect().top;
  return { left: besideBoard ? box.left : 0, top: 0, right: window.innerWidth, bottom: box.bottom };
}

function drawShade(canvas: HTMLCanvasElement, bar: Box, windows: readonly Box[]): void {
  const ratio: number = window.devicePixelRatio;
  canvas.width = Math.round(canvas.clientWidth * ratio);
  canvas.height = Math.round(canvas.clientHeight * ratio);
  const context: CanvasRenderingContext2D | null = canvas.getContext("2d");
  if (!context) return;
  context.scale(ratio, ratio);
  context.fillStyle = getComputedStyle(canvas).color;
  context.fillRect(0, 0, canvas.clientWidth, canvas.clientHeight);
  context.clearRect(bar.left, bar.top, bar.right - bar.left, bar.bottom - bar.top);
  // Padded squares overlap their neighbours, so a run of them opens as one window.
  context.beginPath();
  for (const box of windows) {
    context.roundRect(
      box.left - WINDOW_PADDING,
      box.top - WINDOW_PADDING,
      box.right - box.left + 2 * WINDOW_PADDING,
      box.bottom - box.top + 2 * WINDOW_PADDING,
      WINDOW_RADIUS,
    );
  }
  // Clearing the window afterwards wipes the stroke's inner half and the lines between squares,
  // leaving a ring around the outside only.
  context.strokeStyle = getComputedStyle(canvas).getPropertyValue("--tutorial-ring");
  context.lineWidth = 2 * RING_WIDTH;
  context.stroke();
  context.globalCompositeOperation = "destination-out";
  // Opaque, as the shade's own translucent colour would only half clear the window.
  context.fillStyle = "#000";
  context.fill();
}

/** Hides Skip tutorial for a while after each new card, without moving the card's layout. */
function holdBack(skip: HTMLButtonElement): void {
  skip.getAnimations().forEach((animation: Animation): void => {
    animation.cancel();
  });
  // Script animations aren't caught by the reduced-motion rule, which would show Skip at once.
  skip.animate([{ visibility: "hidden" }, { visibility: "hidden" }], { duration: SKIP_DELAY_MS });
}

/**
 * Loops a fingertip pressing the first square and dragging through the rest, in the window's
 * order. Hidden while the player drags, and under reduced motion, where the ring has to do.
 */
function traceMove(hand: HTMLElement, path: readonly Point[], dragging: boolean): void {
  hand.hidden =
    path.length === 0 || dragging || matchMedia("(prefers-reduced-motion: reduce)").matches;
  const key: string = JSON.stringify(path);
  if (hand.dataset.path === key) return;
  hand.dataset.path = key;
  hand.getAnimations().forEach((animation: Animation): void => {
    animation.cancel();
  });
  const [first, ...rest]: readonly Point[] = path;
  if (!first) return;
  const last: Point = rest.at(-1) ?? first;
  const pressed: number = HAND_PRESS + HAND_HOLD;
  const lifted: number = pressed + rest.length * HAND_STEP + HAND_LIFT;
  const total: number = lifted + HAND_REST;
  const at = (point: Point, time: number, opacity: number, scale: number): Keyframe => ({
    transform: `translate(${String(point.x)}px, ${String(point.y)}px) scale(${String(scale)})`,
    opacity,
    offset: time / total,
  });
  hand.animate(
    [
      at(first, 0, 0, 1.4),
      at(first, HAND_PRESS, 1, 1),
      at(first, pressed, 1, 1),
      ...rest.map((point: Point, i: number): Keyframe =>
        at(point, pressed + (i + 1) * HAND_STEP, 1, 1),
      ),
      at(last, lifted - HAND_LIFT / 2, 1, 1),
      at(last, lifted, 0, 1.4),
      at(last, total, 0, 1.4),
    ],
    { duration: total, iterations: Infinity },
  );
}

function centre(box: Box): Point {
  return { x: (box.left + box.right) / 2, y: (box.top + box.bottom) / 2 };
}

/** Below the window if the card fits there, otherwise above, kept inside the viewport. */
function placeCard(card: HTMLElement, target: Box): void {
  const width: number = card.offsetWidth;
  const height: number = card.offsetHeight;
  const below: number = target.bottom + WINDOW_PADDING + CARD_GAP;
  const above: number = target.top - WINDOW_PADDING - CARD_GAP - height;
  const fitsBelow: boolean = below + height <= window.innerHeight - VIEWPORT_MARGIN;
  const top: number = fitsBelow || above < VIEWPORT_MARGIN ? below : above;
  moveCard(card, (target.left + target.right) / 2 - width / 2, top);
}

function centreCard(card: HTMLElement, target: Box): void {
  moveCard(
    card,
    (target.left + target.right - card.offsetWidth) / 2,
    (target.top + target.bottom - card.offsetHeight) / 2,
  );
}

function moveCard(card: HTMLElement, left: number, top: number): void {
  const clamp = (value: number, size: number, room: number): number =>
    Math.round(Math.max(Math.min(value, room - VIEWPORT_MARGIN - size), VIEWPORT_MARGIN));
  card.style.left = `${String(clamp(left, card.offsetWidth, window.innerWidth))}px`;
  card.style.top = `${String(clamp(top, card.offsetHeight, window.innerHeight))}px`;
}

function bounds(boxes: readonly Box[]): Box {
  return {
    left: Math.min(...boxes.map((box: Box): number => box.left)),
    top: Math.min(...boxes.map((box: Box): number => box.top)),
    right: Math.max(...boxes.map((box: Box): number => box.right)),
    bottom: Math.max(...boxes.map((box: Box): number => box.bottom)),
  };
}
