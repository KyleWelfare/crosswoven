import type { Msg } from "../app/messages.ts";
import type { Model } from "../app/model.ts";
import { requiredElement } from "./required-element.ts";

export interface MenuControls {
  readonly play: HTMLButtonElement;
  readonly howToPlay: HTMLButtonElement;
  readonly rules: HTMLDialogElement;
}

export function findMenu(root: ParentNode): MenuControls {
  return {
    play: requiredElement(root, "#play", HTMLButtonElement),
    howToPlay: requiredElement(root, "#how-to-play", HTMLButtonElement),
    rules: requiredElement(root, "#rules", HTMLDialogElement),
  };
}

// TODO: How It Works, once the slideshow in docs/DESIGN.md exists.
export function listenToMenu(menu: MenuControls, dispatch: (msg: Msg) => void): void {
  menu.play.addEventListener("click", (): void => {
    dispatch({ type: "PlayPressed" });
  });
  menu.howToPlay.addEventListener("click", (): void => {
    dispatch({ type: "HowToPlayPressed" });
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
