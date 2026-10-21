import type { Msg } from "../app/messages.ts";
import { startLevel, type Game } from "../app/model.ts";
import { CHECKS, type Check, type CheckState, type TourFrame } from "../app/tour.ts";
import { WIN_FADE } from "../app/win.ts";
import type { Point } from "../core/puzzle.ts";
import { canvasLayout, squareOrigin, type BoardLayout } from "./board-layout.ts";
import { requiredElement } from "./required-element.ts";
import type { SpriteCache } from "./sprite-cache.ts";
import { drawStage } from "./stage.ts";

export interface TourView {
  readonly canvas: HTMLCanvasElement;
  readonly checks: HTMLElement;
  readonly stepTitle: HTMLElement;
  readonly caption: HTMLElement;
  readonly count: HTMLElement;
  readonly previous: HTMLButtonElement;
  readonly next: HTMLButtonElement;
}

const checkNames: Readonly<Record<Check, string>> = {
  laid: "Threads laid",
  solvable: "Solvable",
  unique: "Unique",
  deducible: "No guessing",
  rated: "Rated",
};

const stateMarks: Readonly<Record<CheckState, string>> = {
  pending: "○",
  passed: "✓",
  failed: "✗",
};

const stateNames: Readonly<Record<CheckState, string>> = {
  pending: "not yet",
  passed: "passed",
  failed: "failed",
};

/** Fractions of a square: the outline of a lit square, rounded like the board's tiles. */
const HIGHLIGHT_WIDTH: number = 0.07;
const HIGHLIGHT_RADIUS: number = 0.14;

export function findTour(root: ParentNode): TourView {
  return {
    canvas: requiredElement(root, "#tour-stage", HTMLCanvasElement),
    checks: requiredElement(root, "#tour-checks", HTMLElement),
    stepTitle: requiredElement(root, "#tour-step-title", HTMLElement),
    caption: requiredElement(root, "#tour-caption", HTMLElement),
    count: requiredElement(root, "#tour-count", HTMLElement),
    previous: requiredElement(root, "#tour-previous", HTMLButtonElement),
    next: requiredElement(root, "#tour-next", HTMLButtonElement),
  };
}

/** The arrow keys step too; off How It Works, update ignores them. */
export function listenToTour(view: TourView, dispatch: (msg: Msg) => void): void {
  view.previous.addEventListener("click", (): void => {
    dispatch({ type: "PreviousStepPressed" });
  });
  view.next.addEventListener("click", (): void => {
    dispatch({ type: "NextStepPressed" });
  });
  document.addEventListener("keydown", (event: KeyboardEvent): void => {
    if (event.key === "ArrowRight") dispatch({ type: "NextStepPressed" });
    if (event.key === "ArrowLeft") dispatch({ type: "PreviousStepPressed" });
  });
}

export function renderTour(
  view: TourView,
  frames: readonly TourFrame[],
  step: number,
  sprites: SpriteCache,
): void {
  const frame: TourFrame | undefined = frames[step];
  if (!frame) return;
  const game: Game = {
    ...startLevel(frame.puzzle),
    threads: frame.threads,
    solvedFor: frame.revealed ? WIN_FADE : undefined,
  };
  drawStage(view.canvas, game, sprites);
  outlineSquares(view.canvas, game, frame.highlight);
  view.checks.replaceChildren(
    ...CHECKS.map((check: Check): HTMLLIElement => checkItem(check, frame.checks[check])),
  );
  view.stepTitle.textContent = frame.title;
  view.caption.textContent = frame.caption;
  view.count.textContent = `${String(step + 1)} / ${String(frames.length)}`;
  view.previous.disabled = step === 0;
  view.next.disabled = step === frames.length - 1;
}

function checkItem(check: Check, state: CheckState): HTMLLIElement {
  const item: HTMLLIElement = document.createElement("li");
  item.className = `tour-check is-${state}`;
  const mark: HTMLSpanElement = document.createElement("span");
  mark.className = "tour-check-mark";
  mark.ariaHidden = "true";
  mark.textContent = stateMarks[state];
  const name: HTMLSpanElement = document.createElement("span");
  name.textContent = checkNames[check];
  const status: HTMLSpanElement = document.createElement("span");
  status.className = "visually-hidden";
  status.textContent = `: ${stateNames[state]}`;
  item.append(mark, name, status);
  return item;
}

function outlineSquares(canvas: HTMLCanvasElement, game: Game, squares: readonly Point[]): void {
  const context: CanvasRenderingContext2D | null = canvas.getContext("2d");
  const layout: BoardLayout = canvasLayout(canvas, game.puzzle);
  if (!context || layout.cell < 1 || squares.length === 0) return;
  const width: number = Math.max(layout.ratio, HIGHLIGHT_WIDTH * layout.cell);
  context.strokeStyle = getComputedStyle(canvas).getPropertyValue("--ink");
  context.lineWidth = width;
  for (const square of squares) {
    const origin: Point = squareOrigin(layout, square);
    context.beginPath();
    context.roundRect(
      origin.x + width / 2,
      origin.y + width / 2,
      layout.cell - width,
      layout.cell - width,
      HIGHLIGHT_RADIUS * layout.cell,
    );
    context.stroke();
  }
}
