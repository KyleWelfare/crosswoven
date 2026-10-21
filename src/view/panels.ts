import type { Msg } from "../app/messages.ts";
import type { Game } from "../app/model.ts";
import { winProgress } from "../app/win.ts";
import type { Puzzle } from "../core/puzzle.ts";
import { requiredElement } from "./required-element.ts";

// TODO: progress and hint mode.
export interface Panels {
  readonly title: HTMLElement;
  readonly controls: HTMLElement;
  readonly undo: HTMLButtonElement;
  readonly clear: HTMLButtonElement;
  readonly win: HTMLElement;
  readonly winTitle: HTMLElement;
  readonly next: HTMLButtonElement;
}

export function findPanels(root: ParentNode): Panels {
  return {
    title: requiredElement(root, "#game-title", HTMLElement),
    controls: requiredElement(root, "#controls", HTMLElement),
    undo: requiredElement(root, "#undo", HTMLButtonElement),
    clear: requiredElement(root, "#clear", HTMLButtonElement),
    win: requiredElement(root, "#win", HTMLElement),
    winTitle: requiredElement(root, "#win-title", HTMLElement),
    next: requiredElement(root, "#next", HTMLButtonElement),
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
export function renderPanels(panels: Panels, game: Game, levels: readonly Puzzle[]): void {
  const solved: boolean = game.solvedFor !== undefined;
  const number: number = levels.indexOf(game.puzzle) + 1;
  panels.title.textContent = `Level ${String(number)}`;
  panels.controls.classList.toggle("is-hidden", solved);
  panels.undo.disabled = game.history.length === 0;
  panels.clear.disabled = game.threads.length === 0;
  panels.win.classList.toggle("is-hidden", !solved);
  panels.win.style.opacity = String(winProgress(game));
  panels.winTitle.textContent = game.puzzle.title;
  panels.next.hidden = number === levels.length;
}
