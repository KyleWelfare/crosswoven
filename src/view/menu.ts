import type { Msg } from "../app/messages.ts";
import type { Model } from "../app/model.ts";
import { requiredElement } from "./required-element.ts";

export interface MenuControls {
  readonly play: HTMLButtonElement;
  readonly howToPlay: HTMLButtonElement;
  readonly howPuzzlesAreMade: HTMLButtonElement;
  readonly rules: HTMLDialogElement;
}

export function findMenu(root: ParentNode): MenuControls {
  return {
    play: requiredElement(root, "#play", HTMLButtonElement),
    howToPlay: requiredElement(root, "#how-to-play", HTMLButtonElement),
    howPuzzlesAreMade: requiredElement(root, "#how-puzzles-are-made", HTMLButtonElement),
    rules: requiredElement(root, "#rules", HTMLDialogElement),
  };
}

/** `tourSteps` is how many steps How the Puzzles Are Made has. */
export function listenToMenu(
  menu: MenuControls,
  dispatch: (msg: Msg) => void,
  tourSteps: number,
): void {
  menu.play.addEventListener("click", (): void => {
    dispatch({ type: "PlayPressed" });
  });
  menu.howToPlay.addEventListener("click", (): void => {
    dispatch({ type: "HowToPlayPressed" });
  });
  menu.howPuzzlesAreMade.addEventListener("click", (): void => {
    dispatch({ type: "HowPuzzlesAreMadePressed", steps: tourSteps });
  });
  // Fires for the dialog's own button and for Escape alike.
  menu.rules.addEventListener("close", (): void => {
    dispatch({ type: "RulesClosed" });
  });
}

/** A modal dialog traps focus and hands it back to How to Play when it closes. */
export function renderMenu(menu: MenuControls, model: Model): void {
  const open: boolean = model.screen === "menu" && model.rulesOpen;
  if (open && !menu.rules.open) menu.rules.showModal();
  if (!open && menu.rules.open) menu.rules.close();
}
