import type { Msg } from "../app/messages.ts";
import type { Game } from "../app/model.ts";
import { currentStep, type TutorialStep } from "../app/tutorial.ts";
import type { Point } from "../core/puzzle.ts";
import { canvasLayout, squareOrigin, type BoardLayout } from "./board-layout.ts";
import { requiredElement } from "./required-element.ts";

export interface TutorialView {
  readonly root: HTMLElement;
  readonly shade: HTMLCanvasElement;
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
    card: requiredElement(root, "#tutorial-card", HTMLElement),
    text: requiredElement(root, "#tutorial-text", HTMLElement),
    skip: requiredElement(root, "#tutorial-skip", HTMLButtonElement),
    ok: requiredElement(root, "#tutorial-ok", HTMLButtonElement),
  };
}

/** `step` is the step on screen when OK is pressed. */
export function listenToTutorial(
  view: TutorialView,
  dispatch: (msg: Msg) => void,
  step: () => TutorialStep | undefined,
): void {
  view.skip.addEventListener("click", (): void => {
    dispatch({ type: "TutorialSkipped" });
  });
  view.ok.addEventListener("click", (): void => {
    const shown: TutorialStep | undefined = step();
    if (shown) dispatch({ type: "TipSeen", tip: shown.id });
  });
}

/**
 * Shades the page below the screen bar, so Back and How to Play stay clear, but for the step's
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
  }
  view.ok.hidden = step.tie.length > 0;
  const windows: readonly Box[] = step.window.map((square: Point): Box =>
    squareBox(stage, game, square),
  );
  drawShade(view.shade, bar.getBoundingClientRect().bottom, windows);
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

function drawShade(canvas: HTMLCanvasElement, top: number, windows: readonly Box[]): void {
  const ratio: number = window.devicePixelRatio;
  canvas.width = Math.round(canvas.clientWidth * ratio);
  canvas.height = Math.round(canvas.clientHeight * ratio);
  const context: CanvasRenderingContext2D | null = canvas.getContext("2d");
  if (!context) return;
  context.scale(ratio, ratio);
  context.fillStyle = getComputedStyle(canvas).color;
  context.fillRect(0, top, canvas.clientWidth, canvas.clientHeight - top);
  // Padded squares overlap their neighbours, so a run of them opens as one window.
  context.globalCompositeOperation = "destination-out";
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
  context.fill();
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
