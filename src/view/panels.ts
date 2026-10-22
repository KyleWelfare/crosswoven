import type { Msg } from "../app/messages.ts";
import { levelNumber, nextLevel, type Game } from "../app/model.ts";
import { winProgress } from "../app/win.ts";
import { requiredElement } from "./required-element.ts";

// TODO: progress and hint mode.
export interface Panels {
  readonly title: HTMLElement;
  readonly howToPlay: HTMLButtonElement;
  readonly rules: HTMLDialogElement;
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
    howToPlay: requiredElement(root, "#how-to-play", HTMLButtonElement),
    rules: requiredElement(root, "#rules", HTMLDialogElement),
    controls: requiredElement(root, "#controls", HTMLElement),
    undo: requiredElement(root, "#undo", HTMLButtonElement),
    clear: requiredElement(root, "#clear", HTMLButtonElement),
    win: requiredElement(root, "#win", HTMLElement),
    winTitle: requiredElement(root, "#win-title", HTMLElement),
    next: requiredElement(root, "#next", HTMLButtonElement),
  };
}

export function listenToPanels(panels: Panels, dispatch: (msg: Msg) => void): void {
  panels.howToPlay.addEventListener("click", (): void => {
    dispatch({ type: "HowToPlayPressed" });
  });
  // Fires for the dialog's own button and for Escape alike.
  panels.rules.addEventListener("close", (): void => {
    dispatch({ type: "RulesClosed" });
  });
  panels.undo.addEventListener("click", (): void => {
    dispatch({ type: "UndoPressed" });
  });
  panels.clear.addEventListener("click", (): void => {
    dispatch({ type: "ClearPressed" });
  });
  panels.next.addEventListener("click", (): void => {
    dispatch({ type: "NextLevelPressed" });
  });
}

/**
 * The win panel fades in as the threads fade out, in the place the controls leave. The rules are
 * a modal dialog, which traps focus and hands it back to How to Play when it closes.
 */
export function renderPanels(panels: Panels, game: Game): void {
  if (game.rulesOpen && !panels.rules.open) panels.rules.showModal();
  if (!game.rulesOpen && panels.rules.open) panels.rules.close();
  const solved: boolean = game.solvedFor !== undefined;
  panels.title.textContent = `Level ${String(levelNumber(game))}`;
  panels.controls.classList.toggle("is-hidden", solved);
  panels.undo.disabled = game.history.length === 0;
  panels.clear.disabled = game.threads.length === 0;
  panels.win.classList.toggle("is-hidden", !solved);
  panels.win.style.opacity = String(winProgress(game));
  panels.winTitle.textContent = game.puzzle.title;
  panels.next.hidden = !nextLevel(game);
}
