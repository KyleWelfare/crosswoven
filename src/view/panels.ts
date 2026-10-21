import type { Msg } from "../app/messages.ts";
import type { Model } from "../app/model.ts";
import { winProgress } from "../app/win.ts";
import type { Puzzle } from "../core/puzzle.ts";

// TODO: the level list, progress and hint mode.
export interface Panels {
  readonly controls: HTMLElement;
  readonly undo: HTMLButtonElement;
  readonly clear: HTMLButtonElement;
  readonly win: HTMLElement;
  readonly winTitle: HTMLElement;
  readonly next: HTMLButtonElement;
}

export function findPanels(root: ParentNode): Panels {
  return {
    controls: required(root, "#controls", HTMLElement),
    undo: required(root, "#undo", HTMLButtonElement),
    clear: required(root, "#clear", HTMLButtonElement),
    win: required(root, "#win", HTMLElement),
    winTitle: required(root, "#win-title", HTMLElement),
    next: required(root, "#next", HTMLButtonElement),
  };
}

/** `next` is the level after this one, if there is one. */
export function listenToPanels(
  panels: Panels,
  dispatch: (msg: Msg) => void,
  next: () => Puzzle | undefined,
): void {
  panels.undo.addEventListener("click", (): void => {
    dispatch({ type: "UndoPressed" });
  });
  panels.clear.addEventListener("click", (): void => {
    dispatch({ type: "ClearPressed" });
  });
  panels.next.addEventListener("click", (): void => {
    const puzzle: Puzzle | undefined = next();
    if (puzzle) dispatch({ type: "LevelStarted", puzzle });
  });
}

/** The win panel fades in as the threads fade out, in the place the controls leave. */
export function renderPanels(panels: Panels, model: Model, hasNext: boolean): void {
  const solved: boolean = model.solvedFor !== undefined;
  panels.controls.classList.toggle("is-hidden", solved);
  panels.undo.disabled = model.history.length === 0;
  panels.clear.disabled = model.threads.length === 0;
  panels.win.classList.toggle("is-hidden", !solved);
  panels.win.style.opacity = String(winProgress(model));
  panels.winTitle.textContent = model.puzzle.title;
  panels.next.hidden = !hasNext;
}

function required<T extends Element>(
  root: ParentNode,
  selector: string,
  type: abstract new () => T,
): T {
  const element: Element | null = root.querySelector(selector);
  if (!(element instanceof type)) throw new Error(`${selector} not found`);
  return element;
}
