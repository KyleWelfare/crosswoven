import type { Msg } from "../app/messages.ts";
import { faceOf, type SquareFace } from "../app/square-face.ts";
import type { Puzzle, SquareColour } from "../core/puzzle.ts";

/** Fraction of a square left between neighbours, as on the board. */
const SQUARE_GAP: number = 0.12;

// TODO: mark cleared levels and lock the rest in order, once progress is saved.
/** Built once, since the shipped levels don't change while the page is open. */
export function buildLevelList(
  list: HTMLElement,
  levels: readonly Puzzle[],
  dispatch: (msg: Msg) => void,
): void {
  list.replaceChildren(
    ...levels.map((puzzle: Puzzle, i: number): HTMLLIElement => levelItem(puzzle, i + 1, dispatch)),
  );
}

/** The title stays hidden, since it names the picture that solving reveals. */
function levelItem(puzzle: Puzzle, number: number, dispatch: (msg: Msg) => void): HTMLLIElement {
  const size: string = `${String(puzzle.width)}×${String(puzzle.height)}`;
  const button: HTMLButtonElement = document.createElement("button");
  button.type = "button";
  button.className = "level-tile";
  button.ariaLabel = `Level ${String(number)}, ${String(puzzle.width)} by ${String(puzzle.height)}`;
  button.append(thumbnail(puzzle), text("level-number", String(number)), text("level-size", size));
  button.addEventListener("click", (): void => {
    dispatch({ type: "LevelStarted", puzzle });
  });
  const item: HTMLLIElement = document.createElement("li");
  item.append(button);
  return item;
}

/** The board as it starts, in the same pale washes, so a hidden level keeps its picture back. */
function thumbnail(puzzle: Puzzle): SVGSVGElement {
  const svg: SVGSVGElement = svgElement("svg");
  svg.setAttribute("viewBox", `0 0 ${String(puzzle.width)} ${String(puzzle.height)}`);
  svg.setAttribute("aria-hidden", "true");
  svg.classList.add("level-thumbnail");
  puzzle.pattern.forEach((row: readonly SquareColour[], y: number): void => {
    row.forEach((square: SquareColour, x: number): void => {
      const rect: SVGRectElement = svgElement("rect");
      rect.setAttribute("x", String(x + SQUARE_GAP / 2));
      rect.setAttribute("y", String(y + SQUARE_GAP / 2));
      rect.setAttribute("width", String(1 - SQUARE_GAP));
      rect.setAttribute("height", String(1 - SQUARE_GAP));
      rect.setAttribute("rx", String(SQUARE_GAP));
      // A fill attribute can't read a custom property; a style can.
      rect.style.fill = washOf(faceOf(puzzle, square));
      svg.append(rect);
    });
  });
  return svg;
}

function washOf(face: SquareFace): string {
  return face === "wall"
    ? "var(--board-frame)"
    : `var(--wash-${face === "field" ? "blank" : face})`;
}

function text(className: string, content: string): HTMLSpanElement {
  const span: HTMLSpanElement = document.createElement("span");
  span.className = className;
  span.textContent = content;
  return span;
}

function svgElement<K extends keyof SVGElementTagNameMap>(name: K): SVGElementTagNameMap[K] {
  return document.createElementNS("http://www.w3.org/2000/svg", name);
}
