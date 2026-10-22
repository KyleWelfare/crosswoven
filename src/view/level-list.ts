import type { Msg } from "../app/messages.ts";
import { isUnlocked, type Progress } from "../app/progress.ts";
import type { Puzzle, SquareColour } from "../core/puzzle.ts";

/** Fraction of a square left between neighbours, as on the board. */
const SQUARE_GAP: number = 0.12;

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

/** Ticks the cleared levels and locks each one until the level before it is cleared. */
export function renderLevelList(
  list: HTMLElement,
  levels: readonly Puzzle[],
  progress: Progress,
): void {
  const order: readonly string[] = levels.map((puzzle: Puzzle): string => puzzle.id);
  list
    .querySelectorAll<HTMLButtonElement>(".level-tile")
    .forEach((button: HTMLButtonElement, i: number): void => {
      const puzzle: Puzzle | undefined = levels[i];
      if (!puzzle) return;
      const cleared: boolean = progress.cleared.includes(puzzle.id);
      const locked: boolean = !isUnlocked(progress, order, i);
      button.classList.toggle("is-cleared", cleared);
      button.classList.toggle("is-locked", locked);
      // aria-disabled rather than disabled, so a locked level stays focusable and is announced.
      button.ariaDisabled = String(locked);
      const state: string = cleared ? ", cleared" : locked ? ", locked" : "";
      button.ariaLabel = `${levelLabel(puzzle, i + 1)}${state}`;
    });
}

function levelLabel(puzzle: Puzzle, number: number): string {
  return `Level ${String(number)}, ${String(puzzle.width)} by ${String(puzzle.height)}`;
}

/** The title stays hidden, since it names the picture that solving reveals. */
function levelItem(puzzle: Puzzle, number: number, dispatch: (msg: Msg) => void): HTMLLIElement {
  const size: string = `${String(puzzle.width)}×${String(puzzle.height)}`;
  const button: HTMLButtonElement = document.createElement("button");
  button.type = "button";
  button.className = "level-tile";
  button.ariaLabel = levelLabel(puzzle, number);
  const art: HTMLDivElement = document.createElement("div");
  art.className = "level-art";
  art.append(thumbnail(puzzle), lockPatch());
  button.append(art, text("level-number", String(number)), text("level-size", size));
  button.addEventListener("click", (): void => {
    if (button.ariaDisabled === "true") return;
    dispatch({ type: "LevelStarted", puzzle });
  });
  const item: HTMLLIElement = document.createElement("li");
  item.append(button);
  return item;
}

/** The pattern in its woven colours, so the list reads as a gallery of pictures to make. */
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
      // A fill attribute can't read a custom property; a style can. A locked tile sets
      // --loom-fill to show its loom still empty.
      const woven: string = square === "blank" ? "var(--wash-blank)" : `var(--woven-${square})`;
      rect.style.fill = `var(--loom-fill, ${woven})`;
      svg.append(rect);
    });
  });
  return svg;
}

/** A padlock sewn on a cloth patch in running stitch. Shown only on locked tiles. */
function lockPatch(): SVGSVGElement {
  const svg: SVGSVGElement = svgElement("svg");
  svg.setAttribute("viewBox", "0 0 32 32");
  svg.setAttribute("aria-hidden", "true");
  svg.classList.add("level-lock");
  const patch: SVGCircleElement = svgElement("circle");
  patch.setAttribute("cx", "16");
  patch.setAttribute("cy", "16");
  patch.setAttribute("r", "15");
  patch.classList.add("level-lock-patch");
  const shackle: SVGPathElement = svgElement("path");
  shackle.setAttribute("d", "M11.5 15v-3.5a4.5 4.5 0 0 1 9 0V15");
  const body: SVGRectElement = svgElement("rect");
  body.setAttribute("x", "9");
  body.setAttribute("y", "15");
  body.setAttribute("width", "14");
  body.setAttribute("height", "10");
  body.setAttribute("rx", "1.5");
  const keyhole: SVGPathElement = svgElement("path");
  keyhole.setAttribute("d", "M16 18.5v3");
  for (const stitched of [shackle, body, keyhole]) stitched.classList.add("level-lock-stitch");
  svg.append(patch, shackle, body, keyhole);
  return svg;
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
